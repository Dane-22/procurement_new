import express from 'express';
import { authenticate, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import db from '../config/database.js';
import { createNotification, getAdmins } from '../utils/notifications.js';
import ExcelJS from 'exceljs';
import { resolveExcelTemplatePath } from '../utils/excelTemplatePath.js';
import { assertProjectIsActive } from '../utils/branchProjects.js';
import { assertOrderNumberUnlocked } from '../utils/orderNumberLocks.js';

const router = express.Router();
const normalizePaymentTermsNote = (note) => {
  const normalized = note == null ? '' : String(note).trim();
  return normalized || null;
};
const createInputError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const normalizePaymentSchedules = (paymentSchedules) => {
  if (paymentSchedules == null) return [];
  if (!Array.isArray(paymentSchedules)) {
    throw createInputError('payment_schedules must be an array');
  }

  const seenDates = new Set();
  const normalized = paymentSchedules.map((entry, index) => {
    const paymentDate = String(entry?.payment_date || '').trim();
    if (!paymentDate) {
      throw createInputError(`payment_schedules[${index}].payment_date is required`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      throw createInputError(`payment_schedules[${index}].payment_date must be YYYY-MM-DD`);
    }

    const parsedDate = new Date(`${paymentDate}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== paymentDate) {
      throw createInputError(`payment_schedules[${index}].payment_date is invalid`);
    }

    if (seenDates.has(paymentDate)) {
      throw createInputError(`Duplicate payment date found: ${paymentDate}`);
    }
    seenDates.add(paymentDate);

    const note = entry?.note == null ? null : String(entry.note).trim() || null;
    let amount = null;
    if (entry?.amount != null && entry.amount !== '') {
      const numericAmount = Number(entry.amount);
      if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        throw createInputError(`payment_schedules[${index}].amount must be a non-negative number`);
      }
      amount = Number(numericAmount.toFixed(2));
    }

    return {
      payment_date: paymentDate,
      amount,
      note
    };
  });

  return normalized.sort((a, b) => a.payment_date.localeCompare(b.payment_date));
};

const replacePaymentSchedules = async (conn, cashRequestId, schedules, employeeId) => {
  await conn.query(
    'DELETE FROM cash_request_payment_schedules WHERE cash_request_id = ?',
    [cashRequestId]
  );

  if (!schedules.length) return;

  for (const schedule of schedules) {
    await conn.query(
      `INSERT INTO cash_request_payment_schedules
      (cash_request_id, payment_date, amount, note, created_by)
      VALUES (?, ?, ?, ?, ?)`,
      [cashRequestId, schedule.payment_date, schedule.amount, schedule.note, employeeId]
    );
  }
};

const getPaymentScheduleCount = async (conn, cashRequestId) => {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS count FROM cash_request_payment_schedules WHERE cash_request_id = ?',
    [cashRequestId]
  );
  return rows[0]?.count || 0;
};

// Generate CR number (CR-Initials-YYYY-MM-XXX format)
const generateCRNumber = async (user) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const firstInitial = String(user.first_name || '').charAt(0).toUpperCase();
  const middleInitial = String(user.middle_initial || '').charAt(0).toUpperCase();
  const lastInitial = String(user.last_name || '').charAt(0).toUpperCase();
  const initials = `${firstInitial}${middleInitial}${lastInitial}`;

  const [lastCRs] = await db.query(
    "SELECT cr_number FROM cash_requests WHERE cr_number LIKE ? ORDER BY cr_number DESC LIMIT 1",
    [`CR-${initials}-${year}-${month}-%`]
  );

  let counter = 1;
  if (lastCRs.length > 0) {
    const lastNumber = lastCRs[0].cr_number;
    const match = lastNumber.match(/-(\d{3})$/);
    if (match) {
      counter = parseInt(match[1], 10) + 1;
    }
  }

  return `CR-${initials}-${year}-${month}-${String(counter).padStart(3, '0')}`;
};

// Get all Cash Requests
router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
    const offset = (page - 1) * pageSize;

    const { view } = req.query;
    const q = String(req.query.q || '').trim();

    const statusesRaw = req.query.status;
    const statuses = Array.isArray(statusesRaw)
      ? statusesRaw
      : (typeof statusesRaw === 'string' && statusesRaw.length > 0)
        ? statusesRaw.split(',')
        : [];
    const normalizedStatuses = statuses
      .map((s) => String(s || '').trim())
      .filter(Boolean);

    const baseFrom = `
      FROM cash_requests cr
      JOIN employees e ON cr.requested_by = e.id
      LEFT JOIN employees approver ON cr.approved_by = approver.id
    `;

    const whereClauses = [];
    const whereParams = [];

    if (req.query.kind === 'standard') {
      whereClauses.push("cr.request_kind = 'standard'");
    } else if (req.query.kind === 'petty_cash') {
      whereClauses.push("cr.request_kind = 'petty_cash'");
    }

    // Engineers see only their own CRs by default, but can view all with ?view=all
    if (req.user.role === 'engineer' && view !== 'all') {
      whereClauses.push('cr.requested_by = ?');
      whereParams.push(req.user.id);
    }

    if (normalizedStatuses.length > 0) {
      whereClauses.push(`cr.status IN (${normalizedStatuses.map(() => '?').join(', ')})`);
      whereParams.push(...normalizedStatuses);
    }

    if (q) {
      const like = `%${q}%`;
      whereClauses.push(`(
        cr.cr_number LIKE ?
        OR cr.purpose LIKE ?
        OR cr.project LIKE ?
        OR cr.supplier_name LIKE ?
        OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?
      )`);
      whereParams.push(like, like, like, like, like);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const listQuery = `
      SELECT cr.*, 
             e.first_name as requester_first_name, 
             e.last_name as requester_last_name,
             (SELECT COUNT(*) FROM cash_request_payment_schedules crs WHERE crs.cash_request_id = cr.id) as payment_schedule_count,
             (SELECT MIN(crs.payment_date) FROM cash_request_payment_schedules crs WHERE crs.cash_request_id = cr.id) as next_payment_date,
             approver.first_name as approver_first_name,
             approver.last_name as approver_last_name
      ${baseFrom}
      ${whereSql}
      ORDER BY cr.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      ${baseFrom}
      ${whereSql}
    `;

    const [crs] = await db.query(listQuery, [...whereParams, pageSize, offset]);
    const [countRows] = await db.query(countQuery, whereParams);

    res.json({
      cashRequests: crs,
      page,
      pageSize,
      total: countRows?.[0]?.total ?? 0
    });
  } catch (error) {
    console.error('Fetch cash requests error:', error);
    res.status(500).json({ message: 'Failed to fetch cash requests: ' + error.message });
  }
});

// Get single Cash Request
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [crs] = await db.query(`
      SELECT cr.*, 
             e.first_name as requester_first_name, 
             e.last_name as requester_last_name,
             approver.first_name as approver_first_name,
             approver.last_name as approver_last_name
      FROM cash_requests cr
      JOIN employees e ON cr.requested_by = e.id
      LEFT JOIN employees approver ON cr.approved_by = approver.id
      WHERE cr.id = ?
    `, [req.params.id]);

    if (crs.length === 0) {
      return res.status(404).json({ message: 'Cash request not found' });
    }

    const [paymentSchedules] = await db.query(
      `SELECT id, cash_request_id, payment_date, amount, note, created_by, created_at, updated_at
       FROM cash_request_payment_schedules
       WHERE cash_request_id = ?
       ORDER BY payment_date ASC`,
      [req.params.id]
    );

    // Cash Requests store item data directly in the main table (no separate items table)
    // quantity, unit, amount, purpose are columns in cash_requests
    res.json({ cashRequest: { ...crs[0], items: [], payment_schedules: paymentSchedules } });
  } catch (error) {
    console.error('Fetch cash request error:', error);
    res.status(500).json({ message: 'Failed to fetch cash request: ' + error.message });
  }
});

// Create Cash Request (engineer)
router.post('/', authenticate, async (req, res) => {
  let conn;
  try {
    const {
      purpose,
      description,
      amount,
      quantity,
      unit,
      project,
      project_address,
      date_needed,
      remarks,
      order_number,
      supplier_id,
      supplier_name,
      supplier_address,
      cr_type,
      payment_terms_note,
      payment_schedules
    } = req.body;
    await assertProjectIsActive(project, { providedOrderNumber: order_number });

    // Validate required fields
    if (!purpose || !String(purpose).trim()) {
      return res.status(400).json({ message: 'Purpose is required' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    const normalizedPaymentTermsNote = normalizePaymentTermsNote(payment_terms_note);
    const normalizedPaymentSchedules = normalizePaymentSchedules(payment_schedules);
    if (normalizedPaymentSchedules.length === 0) {
      return res.status(400).json({ message: 'At least one payment schedule is required.' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const crNumber = await generateCRNumber(req.user);

    console.log('Creating Cash Request with data:', {
      crNumber,
      requested_by: req.user.id,
      purpose,
      description,
      amount,
      quantity,
      unit,
      project,
      project_address,
      date_needed,
      remarks,
      order_number,
      supplier_id,
      supplier_name,
      supplier_address,
      cr_type,
      payment_terms_note: normalizedPaymentTermsNote
    });

    // Create cash request
    const [result] = await conn.query(
      `INSERT INTO cash_requests 
       (cr_number, requested_by, purpose, description, amount, quantity, unit, project, project_address, date_needed, remarks, order_number, supplier_id, supplier_name, supplier_address, cr_type, payment_terms_note, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crNumber,
        req.user.id,
        purpose,
        description || null,
        amount,
        quantity || 1,
        unit || 'pcs',
        project || null,
        project_address || null,
        date_needed || null,
        remarks || null,
        order_number || null,
        supplier_id || null,
        supplier_name || null,
        supplier_address || null,
        cr_type || 'payment_request',
        normalizedPaymentTermsNote,
        'Draft'
      ]
    );
    await replacePaymentSchedules(conn, result.insertId, normalizedPaymentSchedules, req.user.id);

    await conn.commit();

    res.status(201).json({
      message: 'Cash request created successfully',
      crId: result.insertId,
      cr_number: crNumber,
      status: 'Draft'
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Create cash request error:', error);
    res.status(500).json({ message: 'Failed to create cash request: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Update Cash Request (Draft only, engineer only)
router.put('/:id', authenticate, async (req, res) => {
  let conn;
  try {
    const { purpose, description, amount, quantity, unit, project, project_address, date_needed, remarks, order_number, supplier_id, supplier_name, supplier_address, cr_type, payment_terms_note, payment_schedules } = req.body;
    await assertProjectIsActive(project, { providedOrderNumber: order_number });

    // Check if CR exists
    const [crs] = await db.query('SELECT * FROM cash_requests WHERE id = ?', [req.params.id]);
    if (crs.length === 0) {
      return res.status(404).json({ message: 'Cash request not found' });
    }

    const cr = crs[0];
    await assertOrderNumberUnlocked(cr.order_number, 'approval');
    await assertOrderNumberUnlocked(cr.order_number, 'approval');

    if (cr.request_kind === 'petty_cash') {
      return res.status(400).json({ message: 'Use the Petty Cash Request form to edit this request' });
    }

    // Only the original requester can update
    if (cr.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can update this cash request' });
    }

    // Only draft, rejected, or returned CRs can be updated
    if (cr.status !== 'Draft' && cr.status !== 'Rejected' && cr.status !== 'Returned') {
      return res.status(400).json({ message: 'Only draft, rejected, or returned cash requests can be updated' });
    }

    const normalizedPaymentTermsNote = hasOwn(req.body, 'payment_terms_note')
      ? normalizePaymentTermsNote(payment_terms_note)
      : cr.payment_terms_note;
    const hasPaymentSchedulesField = hasOwn(req.body, 'payment_schedules');
    const normalizedPaymentSchedules = hasPaymentSchedulesField ? normalizePaymentSchedules(payment_schedules) : null;
    if (hasPaymentSchedulesField && normalizedPaymentSchedules.length === 0) {
      return res.status(400).json({ message: 'At least one payment schedule is required.' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query(
      `UPDATE cash_requests 
       SET purpose = ?, description = ?, amount = ?, quantity = ?, unit = ?, 
           project = ?, project_address = ?, date_needed = ?, remarks = ?, 
           order_number = ?, supplier_id = ?, supplier_name = ?, supplier_address = ?, cr_type = ?, payment_terms_note = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        purpose || cr.purpose,
        description ?? cr.description,
        amount || cr.amount,
        quantity || cr.quantity,
        unit || cr.unit,
        project ?? cr.project,
        project_address ?? cr.project_address,
        date_needed ?? cr.date_needed,
        remarks ?? cr.remarks,
        order_number ?? cr.order_number,
        supplier_id ?? cr.supplier_id,
        supplier_name ?? cr.supplier_name,
        supplier_address ?? cr.supplier_address,
        cr_type ?? cr.cr_type,
        normalizedPaymentTermsNote,
        req.params.id
      ]
    );
    if (hasPaymentSchedulesField) {
      await replacePaymentSchedules(conn, req.params.id, normalizedPaymentSchedules, req.user.id);
    }

    await conn.commit();

    res.json({ message: 'Cash request updated successfully', status: 'Draft' });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Update cash request error:', error);
    res.status(500).json({ message: 'Failed to update cash request: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Submit Cash Request (Draft -> For Admin Review)
router.put('/:id/submit', authenticate, async (req, res) => {
  let conn;
  try {
    const [crs] = await db.query('SELECT * FROM cash_requests WHERE id = ?', [req.params.id]);
    if (crs.length === 0) {
      return res.status(404).json({ message: 'Cash request not found' });
    }

    const cr = crs[0];
    if (cr.request_kind === 'petty_cash') return res.status(400).json({ message: 'Submit Petty Cash Requests through their own approval flow' });
    await assertOrderNumberUnlocked(cr.order_number, 'approval');

    // Only the original requester can submit
    if (cr.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can submit this cash request' });
    }

    // Only draft, rejected, or returned CRs can be submitted
    if (cr.status !== 'Draft' && cr.status !== 'Rejected' && cr.status !== 'Returned') {
      return res.status(400).json({ message: 'Only draft, rejected, or returned cash requests can be submitted' });
    }

    // Validate required fields
    if (!cr.purpose || !String(cr.purpose).trim()) {
      return res.status(400).json({ message: 'Purpose is required to submit' });
    }

    if (!cr.amount || cr.amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required to submit' });
    }
    if (cr.request_kind === 'petty_cash') {
      const [detailRows] = await db.query(
        'SELECT COUNT(*) AS line_count, COALESCE(SUM(amount), 0) AS total FROM petty_cash_request_details WHERE cash_request_id = ?',
        [cr.id]
      );
      if (!cr.payee_name || !detailRows[0]?.line_count || Number(detailRows[0].total) !== Number(cr.amount)) {
        return res.status(400).json({ message: 'Payee and reconciled Petty Cash details are required before submission' });
      }
    }
    const scheduleCount = cr.request_kind === 'petty_cash' ? 1 : await getPaymentScheduleCount(db, req.params.id);
    if (scheduleCount === 0) {
      return res.status(400).json({ message: 'At least one payment schedule is required before submission.' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [lockedRows] = await conn.query('SELECT status FROM cash_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!lockedRows[0] || !['Draft', 'Rejected', 'Returned'].includes(lockedRows[0].status)) {
      await conn.rollback();
      return res.status(409).json({ message: 'Cash request has already changed status' });
    }

    await conn.query(
      "UPDATE cash_requests SET status = 'For Admin Review', updated_at = NOW() WHERE id = ?",
      [req.params.id]
    );

    await conn.commit();

    // Notify admins for review after the state change has committed.
    const adminUsers = await getAdmins();
    for (const p of adminUsers) {
      await createNotification(
        p,
        'CR Submitted/Resubmitted',
        `${cr.request_kind === 'petty_cash' ? 'Petty Cash Request' : 'Cash Request'} ${cr.cr_number} has been submitted by ${req.user.first_name} ${req.user.last_name}`,
        'CR Created',
        cr.id,
        'cash_request'
      );
      if (req.io) {
        req.io.to(`user_${p}`).emit('notification', {
          title: 'CR Submitted',
          message: `Cash Request ${cr.cr_number} has been submitted.`
        });
      }
    }

    try {
      const { logAudit } = await import('../utils/auditLogger.js');
      await logAudit(req.user.id, 'Request Submitted', 'cash_requests', cr.id, JSON.stringify({ order_number: cr.order_number }));
    } catch (auditErr) {
      console.error('Audit log error:', auditErr);
    }

    res.json({ message: 'Cash request submitted successfully', status: 'For Admin Review' });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
    }
    console.error('Submit cash request error:', error);
    res.status(500).json({ message: 'Failed to submit cash request: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});
// Admin Approval/Reject Cash Request (moves to For Super Admin Final Approval)
router.put('/:id/admin-approve', authenticate, requireAdmin, async (req, res) => {
  let conn;
  try {
    const { status, remarks } = req.body;

    const [crs] = await db.query('SELECT * FROM cash_requests WHERE id = ?', [req.params.id]);
    if (crs.length === 0) {
      return res.status(404).json({ message: 'Cash request not found' });
    }

    const cr = crs[0];

    // Only For Admin Review CRs can be admin approved
    if (cr.request_kind === 'petty_cash') return res.status(400).json({ message: 'Review Petty Cash Requests through their own approval flow' });
    if (cr.status !== 'For Admin Review') {
      return res.status(400).json({ message: 'Cash request not ready for Admin review' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [lockedRows] = await conn.query('SELECT status FROM cash_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    if (lockedRows[0]?.status !== 'For Admin Review') {
      await conn.rollback();
      return res.status(409).json({ message: 'Cash request has already changed status' });
    }

    let newStatus;
    if (status === 'approved') {
      const scheduleCount = cr.request_kind === 'petty_cash' ? 1 : await getPaymentScheduleCount(conn, req.params.id);
      if (scheduleCount === 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'At least one payment schedule is required before approval.' });
      }
      newStatus = 'For Super Admin Final Approval';
      await conn.query(
        "UPDATE cash_requests SET status = ?, remarks = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?",
        [newStatus, remarks || null, req.user.id, req.params.id]
      );
    } else if (status === 'hold') {
      newStatus = 'On Hold';
      await conn.query(
        "UPDATE cash_requests SET status = ?, remarks = ?, updated_at = NOW() WHERE id = ?",
        [newStatus, remarks || null, req.params.id]
      );
    } else {
      newStatus = 'Rejected';
      await conn.query(
        "UPDATE cash_requests SET status = ?, remarks = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?",
        [newStatus, remarks || null, remarks || null, req.params.id]
      );
    }

    await conn.commit();

    // Notify engineer
    if (cr.request_kind === 'petty_cash') {
      try {
        const { logAudit } = await import('../utils/auditLogger.js');
        await logAudit(req.user.id, 'Petty Cash Admin Review', 'cash_requests', cr.id, JSON.stringify({ decision: status, remarks: remarks || null }));
      } catch (auditErr) {
        console.error('Audit log error:', auditErr);
      }
    }
    if (status === 'approved') {
      await createNotification(
        cr.requested_by,
        'Cash Request Approved by Admin',
        `Your Cash Request ${cr.cr_number} has been reviewed by Admin and is waiting for Super Admin final approval`,
        'PR Approved',
        cr.id,
        'cash_request'
      );
    } else if (status === 'hold') {
      await createNotification(
        cr.requested_by,
        'Cash Request On Hold',
        `Your Cash Request ${cr.cr_number} has been put on hold${remarks ? ': ' + remarks : ''}`,
        'PR On Hold',
        cr.id,
        'cash_request'
      );
    } else {
      await createNotification(
        cr.requested_by,
        'Cash Request Rejected',
        `Your Cash Request ${cr.cr_number} has been rejected${remarks ? ': ' + remarks : ''}. Please edit and resubmit your request.. Please edit and resubmit your request.`,
        'PR Rejected',
        cr.id,
        'cash_request'
      );
    }

    res.json({ message: `Cash request ${status} successfully`, status: newStatus });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Admin approve cash request error:', error);
    res.status(500).json({ message: 'Failed to approve cash request: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Super Admin Final Approval/Reject Cash Request
router.put('/:id/super-admin-approve', authenticate, requireSuperAdmin, async (req, res) => {
  let conn;
  try {
    const { status, remarks } = req.body;

    const [crs] = await db.query('SELECT * FROM cash_requests WHERE id = ?', [req.params.id]);
    if (crs.length === 0) {
      return res.status(404).json({ message: 'Cash request not found' });
    }

    const cr = crs[0];

    // Only 'For Super Admin Final Approval' or 'On Hold' CRs can be super admin approved
    if (cr.request_kind === 'petty_cash') return res.status(400).json({ message: 'Review Petty Cash Requests through their own approval flow' });
    if (cr.status !== 'For Super Admin Final Approval' && cr.status !== 'On Hold') {
      return res.status(400).json({ message: 'Cash request not ready for super admin approval' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [lockedRows] = await conn.query('SELECT status FROM cash_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!['For Super Admin Final Approval', 'On Hold'].includes(lockedRows[0]?.status)) {
      await conn.rollback();
      return res.status(409).json({ message: 'Cash request has already changed status' });
    }

    let newStatus;
    if (status === 'approved') {
      const scheduleCount = cr.request_kind === 'petty_cash' ? 1 : await getPaymentScheduleCount(conn, req.params.id);
      if (scheduleCount === 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'At least one payment schedule is required before approval.' });
      }
      newStatus = 'Approved';
      await conn.query(
        "UPDATE cash_requests SET status = ?, remarks = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?",
        [newStatus, remarks || null, req.user.id, req.params.id]
      );
    } else if (status === 'hold') {
      newStatus = 'On Hold';
      await conn.query(
        "UPDATE cash_requests SET status = ?, remarks = ?, updated_at = NOW() WHERE id = ?",
        [newStatus, remarks || null, req.params.id]
      );
    } else {
      newStatus = 'Rejected';
      await conn.query(
        "UPDATE cash_requests SET status = ?, remarks = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?",
        [newStatus, remarks || null, remarks || null, req.params.id]
      );
    }

    await conn.commit();

    // Notify engineer
    if (cr.request_kind === 'petty_cash') {
      try {
        const { logAudit } = await import('../utils/auditLogger.js');
        await logAudit(req.user.id, 'Petty Cash Final Review', 'cash_requests', cr.id, JSON.stringify({ decision: status, remarks: remarks || null }));
      } catch (auditErr) {
        console.error('Audit log error:', auditErr);
      }
    }
    if (status === 'approved') {
      await createNotification(
        cr.requested_by,
        'Cash Request Approved',
        cr.request_kind === 'petty_cash'
          ? `Your Petty Cash Request ${cr.cr_number} has been approved and is ready for cash release`
          : `Your Cash Request ${cr.cr_number} has been fully approved and is ready for Payment Request creation`,
        'PR Approved',
        cr.id,
        'cash_request'
      );
    } else if (status === 'hold') {
      await createNotification(
        cr.requested_by,
        'Cash Request On Hold',
        `Your Cash Request ${cr.cr_number} has been put on hold${remarks ? ': ' + remarks : ''}`,
        'PR On Hold',
        cr.id,
        'cash_request'
      );
    } else {
      await createNotification(
        cr.requested_by,
        'Cash Request Rejected',
        `Your Cash Request ${cr.cr_number} has been rejected${remarks ? ': ' + remarks : ''}. Please edit and resubmit your request.`,
        'PR Rejected',
        cr.id,
        'cash_request'
      );
    }

    res.json({ message: `Cash request ${status} successfully`, status: newStatus });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Super admin approve cash request error:', error);
    res.status(500).json({ message: 'Failed to approve cash request: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Mark Cash Request as Received (requester only, fulfilled statuses only)
router.put('/:id/received', authenticate, async (req, res) => {
  try {
    const [crs] = await db.query('SELECT * FROM cash_requests WHERE id = ?', [req.params.id]);
    if (crs.length === 0) {
      return res.status(404).json({ message: 'Cash request not found' });
    }

    const cr = crs[0];

    if (cr.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can mark this cash request as received' });
    }

    if (cr.request_kind === 'petty_cash') {
      return res.status(400).json({ message: 'Use the Petty Cash receipt confirmation action' });
    }
    const allowedStatuses = ['Payment Request Created', 'Payment Order Created', 'Paid'];
    if (!allowedStatuses.includes(cr.status)) {
      return res.status(400).json({ message: 'Only fulfilled cash requests can be marked as received' });
    }

    await db.query(
      'UPDATE cash_requests SET status = ?, updated_at = NOW() WHERE id = ?',
      ['Received', req.params.id]
    );

    if (req.io) {
      req.io.emit('cr_status_changed', {
        id: Number(req.params.id),
        cr_number: cr.cr_number,
        status: 'Received',
        type: 'status_update',
        updated_by: 'engineer'
      });
    }

    res.json({ message: 'Cash request marked as received successfully', status: 'Received' });
  } catch (error) {
    console.error('Mark cash request received error:', error);
    res.status(500).json({ message: 'Failed to mark cash request as received' });
  }
});

// Export Cash Request to Excel
router.get('/:id/export', authenticate, async (req, res) => {
  try {
    const [crs] = await db.query(`
      SELECT cr.*, 
             e.first_name as requester_first_name, 
             e.last_name as requester_last_name
      FROM cash_requests cr
      JOIN employees e ON cr.requested_by = e.id
      WHERE cr.id = ?
    `, [req.params.id]);

    if (crs.length === 0) {
      return res.status(404).json({ message: 'Cash request not found' });
    }

    const cr = crs[0];

    console.log('Exporting Cash Request - date_needed from DB:', cr.date_needed, 'type:', typeof cr.date_needed);

    // Fetch payment schedules for this cash request
    const [paymentSchedules] = await db.query(
      'SELECT * FROM cash_request_payment_schedules WHERE cash_request_id = ? ORDER BY payment_date',
      [req.params.id]
    );

    const workbook = new ExcelJS.Workbook();
    
    // Load template
    const templatePath = resolveExcelTemplatePath('Cash Request.xlsx');
    
    let worksheet;
    try {
      await workbook.xlsx.readFile(templatePath);
      worksheet = workbook.worksheets?.[0] || workbook.getWorksheet('Cash Request') || workbook.getWorksheet(1);
    } catch (templateError) {
      worksheet = workbook.addWorksheet('Cash Request');
    }
    
    // Helper to safely set cell values
    const setCellValue = (cellRef, value) => {
      const cell = worksheet.getCell(cellRef);
      cell.value = value || '';
      return cell;
    };
    
    // Fill in data based on Cash Request template layout
    // Left side
    setCellValue('C6', cr.supplier_name || ''); // Receiver
    setCellValue('C8', cr.supplier_address || ''); // Address
    setCellValue('C10', cr.project || ''); // Project
    setCellValue('C11', cr.project_address || ''); // Project Address
    
    // Right side
    setCellValue('F6', cr.cr_number || ''); // CR Number in header
    setCellValue('F8', new Date(cr.created_at).toLocaleDateString()); // Date Prepared
    
    const dateNeededValue = cr.date_needed ? new Date(cr.date_needed).toLocaleDateString() : '';
    console.log('Setting F9 Date Needed to:', dateNeededValue);
    setCellValue('F9', dateNeededValue); // Date Needed
    
    setCellValue('F10', cr.order_number || ''); // Order Number
    
    console.log('After setting F9, cell value is:', worksheet.getCell('F9').value);
    
    // Line item (row 14)
    setCellValue('A14', cr.quantity || 0); // QTY
    setCellValue('B14', cr.unit || ''); // UNIT
    setCellValue('C14', cr.purpose || ''); // DESCRIPTION
    setCellValue('E14', cr.amount / (cr.quantity || 1)); // UNIT COST
    setCellValue('F14', cr.amount); // AMOUNT
    
    // Add payment terms and schedules below the item
    let currentRow = 15; // Start after line item
    
    // Helper to format date
    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    };

    // Add "*** NOTHING FOLLOWS ***" marker
    const nothingFollowsCell = worksheet.getCell(`C${currentRow}`);
    nothingFollowsCell.font = { name: 'Arial', size: 10, color: { argb: '000000' }, bold: false };
    nothingFollowsCell.value = '*** NOTHING FOLLOWS ***';
    currentRow++;

    // Add payment terms note if exists
    const paymentTermsNote = String(cr.payment_terms_note || '').trim();
    if (paymentTermsNote) {
      const noteCell = worksheet.getCell(`C${currentRow}`);
      noteCell.font = { name: 'Arial', size: 10, color: { argb: '000000' }, bold: false };
      noteCell.value = `Payment Terms: ${paymentTermsNote}`;
      currentRow++;
    }

    // Add payment schedules
    if (paymentSchedules.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      paymentSchedules.forEach((schedule) => {
        const scheduleDate = schedule.payment_date;
        const amount = parseFloat(schedule.amount) || 0;
        
        // Determine status
        let statusLabel = '';
        if (scheduleDate < todayYmd) {
          statusLabel = ' (OVERDUE)';
        } else if (scheduleDate === todayYmd) {
          statusLabel = ' (DUE TODAY)';
        } else {
          statusLabel = ' (UPCOMING)';
        }
        
        const line = `${formatDate(scheduleDate)} | ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}${schedule.note ? ` | ${schedule.note}` : ''}${statusLabel}`;
        const scheduleCell = worksheet.getCell(`C${currentRow}`);
        scheduleCell.font = { name: 'Arial', size: 10, color: { argb: '000000' }, bold: false };
        scheduleCell.value = line;
        currentRow++;
      });
    }
    
    // Total (row 31)
    setCellValue('F31', cr.amount); // TOTAL
    
    // Prepared by (row 34)
    const preparedByName = `${cr.requester_first_name || ''} ${cr.requester_last_name || ''}`.trim().toUpperCase();
    setCellValue('A34', preparedByName);
    
    // Reviewed by and Approved by are hardcoded in template
    setCellValue('D34', 'JUNELL B. TADINA');
    setCellValue('F34', 'MARC JUSTIN E. ARZADON');
    
    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Cash_Request_${cr.cr_number || req.params.id}.xlsx`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Error exporting cash request:', error);
    res.status(500).json({ message: 'Failed to export cash request' });
  }
});

// Delete Cash Request (Draft only for creator, any status for Super Admin)
router.delete('/:id', authenticate, async (req, res) => {
  let conn;
  try {
    const isSuperAdmin = req.user.role === 'super_admin';
    const [crs] = await db.query('SELECT * FROM cash_requests WHERE id = ?', [req.params.id]);
    
    if (crs.length === 0) {
      return res.status(404).json({ message: 'Cash request not found' });
    }

    const cr = crs[0];

    // Access control check
    if (!isSuperAdmin) {
      if (cr.requested_by !== req.user.id) {
        return res.status(403).json({ message: 'Only the original requester can delete this cash request' });
      }
      if (cr.status !== 'Draft') {
        return res.status(400).json({ message: 'Only draft cash requests can be deleted' });
      }
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query('DELETE FROM cash_request_payment_schedules WHERE cash_request_id = ?', [req.params.id]);
    await conn.query('DELETE FROM cash_requests WHERE id = ?', [req.params.id]);

    await conn.commit();

    if (isSuperAdmin) {
      try {
        const { logAudit } = await import('../utils/auditLogger.js');
        await logAudit(req.user.id, 'Request Deleted', 'cash_requests', req.params.id, JSON.stringify({ order_number: cr.order_number }));
      } catch (auditErr) {
        console.error('Audit log error:', auditErr);
      }
    }

    res.json({ message: 'Cash request deleted successfully' });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }
    console.error('Delete cash request error:', error);
    res.status(500).json({ message: 'Failed to delete cash request: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});


// Resubmit rejected Cash Request
router.put('/:id/resubmit', authenticate, async (req, res) => {
  let conn;
  try {
    const { purpose, description, amount, date_needed, project, project_address, remarks } = req.body;
    
    conn = await db.getConnection();
    
    // Check if CR exists and is rejected
    const [crs] = await conn.query('SELECT * FROM cash_requests WHERE id = ?', [req.params.id]);
    if (crs.length === 0) {
      return res.status(404).json({ message: 'Cash request not found' });
    }
    const cr = crs[0];

    if (cr.request_kind === 'petty_cash') {
      return res.status(400).json({ message: 'Edit and submit Petty Cash Requests through their own form' });
    }

    // Only original requester can resubmit
    if (cr.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can resubmit this CR' });
    }

    // Only rejected CRs can be resubmitted
    if (cr.status !== 'Rejected' && cr.status !== 'Returned') {
      return res.status(400).json({ message: 'Only rejected or returned cash requests can be resubmitted' });
    }

    // Check if expedited (from amount)
    let newStatus = amount <= 1000 ? 'For Super Admin Final Approval' : 'For Department Head Review';

    await conn.query(
      `UPDATE cash_requests SET 
        purpose = ?, description = ?, amount = ?, date_needed = ?, project = ?, project_address = ?, remarks = ?, status = ?, updated_at = NOW() 
       WHERE id = ?`,
      [
        purpose, description || null, amount, date_needed || null, project || null, project_address || null, remarks || null, newStatus, req.params.id
      ]
    );

    // Notify appropriate approvers based on newStatus
    let notifyRoles = [];
    if (newStatus === 'For Department Head Review') {
       notifyRoles = ['admin']; // Using admin for dept head placeholder or similar based on existing logic
    } else {
       notifyRoles = ['super_admin'];
    }

    const [approvers] = await conn.query(`SELECT id FROM employees WHERE role IN (?) AND is_active = true`, [notifyRoles]);
    
    for (const approver of approvers) {
      await createNotification(
        approver.id,
        'CR Resubmitted',
        `Cash Request ${cr.cr_number} has been resubmitted and requires your review.`,
        'PR Created',
        cr.id,
        'cash_request'
      );
      if (req.io) {
        req.io.to(`user_${approver.id}`).emit('notification', {
          title: 'CR Resubmitted',
          message: `Cash Request ${cr.cr_number} has been resubmitted.`
        });
      }
    }

    try {
      const { logAudit } = await import('../utils/auditLogger.js');
      await logAudit(req.user.id, 'Request Resubmitted', 'cash_requests', cr.id, JSON.stringify({ cr_number: cr.cr_number }));
    } catch (auditErr) {
      console.error('Audit log error:', auditErr);
    }

    res.json({ message: 'Cash request resubmitted successfully', status: newStatus });
  } catch (error) {
    console.error('Resubmit CR error:', error);
    res.status(500).json({ message: 'Failed to resubmit cash request: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

export default router;
