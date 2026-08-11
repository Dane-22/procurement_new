import db from '../config/database.js';
import {
  createNotification,
  getAdmins,
  getProcurementOfficers,
  getSuperAdmins
} from '../utils/notifications.js';

const TIMEZONE = 'Asia/Manila';
const TERMINAL_STATUSES = ['Rejected', 'Cancelled', 'Completed', 'Received'];
const REMINDER_RULES = [
  { type: 'D_MINUS_3', daysAhead: 3, label: '3 days' },
  { type: 'D_MINUS_1', daysAhead: 1, label: '1 day' },
  { type: 'D_DAY', daysAhead: 0, label: 'today' }
];

const REQUEST_CONFIGS = [
  {
    key: 'purchase_request',
    label: 'PR',
    numberField: 'pr_number',
    requestIdField: 'purchase_request_id',
    requestTable: 'purchase_requests',
    scheduleTable: 'purchase_request_payment_schedules',
    scheduleFk: 'purchase_request_id',
    logTable: 'payment_schedule_reminder_logs'
  },
  {
    key: 'service_request',
    label: 'SR',
    numberField: 'sr_number',
    requestIdField: 'service_request_id',
    requestTable: 'service_requests',
    scheduleTable: 'service_request_payment_schedules',
    scheduleFk: 'service_request_id',
    logTable: 'service_schedule_reminder_logs'
  },
  {
    key: 'cash_request',
    label: 'CR',
    numberField: 'cr_number',
    requestIdField: 'cash_request_id',
    requestTable: 'cash_requests',
    scheduleTable: 'cash_request_payment_schedules',
    scheduleFk: 'cash_request_id',
    logTable: 'cash_schedule_reminder_logs'
  },
  {
    key: 'reimbursement',
    label: 'RMB',
    numberField: 'rmb_number',
    requestIdField: 'reimbursement_id',
    requestTable: 'reimbursements',
    scheduleTable: 'reimbursement_payment_schedules',
    scheduleFk: 'reimbursement_id',
    logTable: 'reimbursement_schedule_reminder_logs'
  }
];

const formatDateInTimezone = (date, timeZone) => new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(date);

const addDays = (baseDate, days) => {
  const nextDate = new Date(`${baseDate}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate.toISOString().slice(0, 10);
};

const getReminderTitleAndMessage = (schedule, reminderRule, config) => {
  const dueDate = schedule.payment_date;
  const amountLabel = schedule.amount == null
    ? ''
    : ` | Amount: PHP ${Number(schedule.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const noteLabel = schedule.note ? ` | Note: ${schedule.note}` : '';

  return {
    title: `${config.label} Payment Schedule Reminder`,
    message: `${config.label} ${schedule[config.numberField]} has a payment due ${reminderRule.label} (${dueDate})${amountLabel}${noteLabel}`
  };
};

const fetchSchedulesForReminder = async (config, reminderType, targetDate) => {
  const [rows] = await db.query(
    `
      SELECT
        s.id AS schedule_id,
        s.${config.scheduleFk} AS request_id,
        s.payment_date,
        s.amount,
        s.note,
        r.${config.numberField},
        r.requested_by
      FROM ${config.scheduleTable} s
      JOIN ${config.requestTable} r ON r.id = s.${config.scheduleFk}
      LEFT JOIN ${config.logTable} l
        ON l.schedule_id = s.id AND l.reminder_type = ?
      WHERE s.payment_date = ?
        AND l.id IS NULL
        AND r.status NOT IN (${TERMINAL_STATUSES.map(() => '?').join(',')})
    `,
    [reminderType, targetDate, ...TERMINAL_STATUSES]
  );

  return rows;
};

const markReminderAsSent = async (config, scheduleId, reminderType) => {
  await db.query(
    `
      INSERT INTO ${config.logTable} (schedule_id, reminder_type, sent_at)
      VALUES (?, ?, NOW())
    `,
    [scheduleId, reminderType]
  );
};

export async function runPaymentScheduleReminderCycle() {
  const baseDate = formatDateInTimezone(new Date(), TIMEZONE);
  const [procurementIds, adminIds, superAdminIds] = await Promise.all([
    getProcurementOfficers(),
    getAdmins(),
    getSuperAdmins()
  ]);

  for (const reminderRule of REMINDER_RULES) {
    const targetDate = addDays(baseDate, reminderRule.daysAhead);

    for (const config of REQUEST_CONFIGS) {
      let schedules = [];
      try {
        schedules = await fetchSchedulesForReminder(config, reminderRule.type, targetDate);
      } catch (error) {
        if (error?.code === 'ER_NO_SUCH_TABLE') {
          continue;
        }
        throw error;
      }

      for (const schedule of schedules) {
        const recipients = new Set([
          schedule.requested_by,
          ...procurementIds,
          ...adminIds,
          ...superAdminIds
        ].filter(Boolean));

        const { title, message } = getReminderTitleAndMessage(schedule, reminderRule, config);

        for (const recipientId of recipients) {
          await createNotification(
            recipientId,
            title,
            message,
            'Payment Reminder',
            schedule.request_id,
            config.key
          );
        }

        try {
          await markReminderAsSent(config, schedule.schedule_id, reminderRule.type);
        } catch (error) {
          if (error?.code !== 'ER_DUP_ENTRY') {
            throw error;
          }
        }
      }
    }
  }
}

export function startPaymentScheduleReminderJob({
  intervalMs = Number(process.env.PAYMENT_REMINDER_INTERVAL_MS) || 60 * 60 * 1000
} = {}) {
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      await runPaymentScheduleReminderCycle();
    } catch (error) {
      console.error('Payment schedule reminder cycle failed:', error);
    } finally {
      running = false;
    }
  };

  run();
  const timer = setInterval(run, intervalMs);

  return () => clearInterval(timer);
}
