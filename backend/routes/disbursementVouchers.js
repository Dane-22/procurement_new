import express from 'express';
import { authenticate, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import db from '../config/database.js';
import { createNotification, getSuperAdmins, getProcurementOfficers } from '../utils/notifications.js';
import ExcelJS from 'exceljs';
import { resolveExcelTemplatePath } from '../utils/excelTemplatePath.js';

const router = express.Router();

const getTodayYmd = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const getDueLabel = (paymentDateYmd, todayYmd) => {
  if (!paymentDateYmd) return 'Unknown';
  if (paymentDateYmd < todayYmd) return 'Overdue';
  if (paymentDateYmd === todayYmd) return 'Due Today';
  return 'Upcoming';
};

const getScheduleConfigForSource = (sourceType, sourceRow) => {
  switch (sourceType) {
    case 'purchase_order':
      if (sourceRow?.purchase_request_id) {
        return {
          schedule_source_type: 'pr',
          table: 'purchase_request_payment_schedules',
          fkColumn: 'purchase_request_id',
          fkValue: sourceRow.purchase_request_id
        };
      }
      if (sourceRow?.service_request_id) {
        return {
          schedule_source_type: 'sr',
          table: 'service_request_payment_schedules',
          fkColumn: 'service_request_id',
          fkValue: sourceRow.service_request_id
        };
      }
      return null;
    case 'payment_request':
      if (sourceRow?.purchase_request_id) {
        return {
          schedule_source_type: 'pr',
          table: 'purchase_request_payment_schedules',
          fkColumn: 'purchase_request_id',
          fkValue: sourceRow.purchase_request_id
        };
      }
      if (sourceRow?.service_request_id) {
        return {
          schedule_source_type: 'sr',
          table: 'service_request_payment_schedules',
          fkColumn: 'service_request_id',
          fkValue: sourceRow.service_request_id
        };
      }
      return null;
    case 'payment_order':
      if (sourceRow?.service_request_id) {
        return {
          schedule_source_type: 'sr',
          table: 'service_request_payment_schedules',
          fkColumn: 'service_request_id',
          fkValue: sourceRow.service_request_id
        };
      }
      if (sourceRow?.cash_request_id) {
        return {
          schedule_source_type: 'cr',
          table: 'cash_request_payment_schedules',
          fkColumn: 'cash_request_id',
          fkValue: sourceRow.cash_request_id
        };
      }
      if (sourceRow?.reimbursement_id) {
        return {
          schedule_source_type: 'rmb',
          table: 'reimbursement_payment_schedules',
          fkColumn: 'reimbursement_id',
          fkValue: sourceRow.reimbursement_id
        };
      }
      return null;
    case 'service_request':
      return {
        schedule_source_type: 'sr',
        table: 'service_request_payment_schedules',
        fkColumn: 'service_request_id',
        fkValue: sourceRow?.id
      };
    case 'cash_request':
      return {
        schedule_source_type: 'cr',
        table: 'cash_request_payment_schedules',
        fkColumn: 'cash_request_id',
        fkValue: sourceRow?.id
      };
    default:
      return null;
  }
};

const getSourceColumnForDv = (sourceType) => {
  switch (sourceType) {
    case 'purchase_order':
      return 'purchase_order_id';
    case 'payment_request':
      return 'payment_request_id';
    case 'payment_order':
      return 'payment_order_id';
    case 'service_request':
      return 'service_request_id';
    case 'cash_request':
      return 'cash_request_id';
    default:
      return null;
  }
};

const getSourceRow = async (conn, sourceType, sourceId) => {
  if (!sourceId) return null;

  if (sourceType === 'purchase_order') {
    const [rows] = await conn.query(
      `SELECT id, status, purchase_request_id, service_request_id, installment_schedule_id
       FROM purchase_orders
       WHERE id = ?`,
      [sourceId]
    );
    return rows[0] || null;
  }

  if (sourceType === 'payment_request') {
    const [rows] = await conn.query(
      `SELECT id, status, purchase_request_id, service_request_id
       FROM payment_requests
       WHERE id = ?`,
      [sourceId]
    );
    return rows[0] || null;
  }

  if (sourceType === 'payment_order') {
    const [rows] = await conn.query(
      `SELECT id, status, service_request_id, cash_request_id
       FROM payment_orders
       WHERE id = ?`,
      [sourceId]
    );
    return rows[0] || null;
  }

  if (sourceType === 'service_request') {
    const [rows] = await conn.query(
      `SELECT id, status
       FROM service_requests
       WHERE id = ?`,
      [sourceId]
    );
    return rows[0] || null;
  }

  if (sourceType === 'cash_request') {
    const [rows] = await conn.query(
      `SELECT id, status
       FROM cash_requests
       WHERE id = ?`,
      [sourceId]
    );
    return rows[0] || null;
  }

  return null;
};

const getSchedulesForSource = async (conn, sourceType, sourceId) => {
  console.log('DEBUG getSchedulesForSource:', { sourceType, sourceId });
  const sourceRow = await getSourceRow(conn, sourceType, sourceId);
  console.log('DEBUG sourceRow:', sourceRow);
  if (!sourceRow) {
    return { sourceRow: null, scheduleConfig: null, schedules: [], sourceColumn: getSourceColumnForDv(sourceType) };
  }

  const scheduleConfig = getScheduleConfigForSource(sourceType, sourceRow);
  const sourceColumn = getSourceColumnForDv(sourceType);
  console.log('DEBUG scheduleConfig:', scheduleConfig);
  console.log('DEBUG sourceColumn:', sourceColumn);

  if (!scheduleConfig || !scheduleConfig.fkValue || !sourceColumn) {
    return { sourceRow, scheduleConfig: null, schedules: [], sourceColumn };
  }

  const [schedules] = await conn.query(
    `SELECT id, DATE_FORMAT(payment_date, '%Y-%m-%d') AS payment_date, amount, note
     FROM ${scheduleConfig.table}
     WHERE ${scheduleConfig.fkColumn} = ?
     ORDER BY payment_date ASC`,
    [scheduleConfig.fkValue]
  );
  console.log('DEBUG schedules found:', schedules.length, schedules);

  if (!schedules.length) {
    return { sourceRow, scheduleConfig, schedules: [], sourceColumn };
  }

  const [consumedRows] = await conn.query(
    `SELECT DATE_FORMAT(payment_date, '%Y-%m-%d') AS payment_date
     FROM disbursement_vouchers
     WHERE ${sourceColumn} = ? AND status != 'Cancelled'`,
    [sourceId]
  );
  console.log('DEBUG consumedRows:', consumedRows);
  const consumedDates = new Set(
    consumedRows.map((row) => String(row?.payment_date || '').trim()).filter(Boolean)
  );
  console.log('DEBUG consumedDates:', Array.from(consumedDates));
  const todayYmd = getTodayYmd();

  const mapped = schedules.map((schedule) => {
    const paymentDate = String(schedule?.payment_date || '').trim();
    return {
      id: schedule.id,
      payment_date: paymentDate,
      amount: schedule.amount,
      note: schedule.note,
      due_label: getDueLabel(paymentDate, todayYmd),
      is_consumed: consumedDates.has(paymentDate)
    };
  });

  // If PO is an installment PO bound to a specific schedule, expose only that schedule.
  if (sourceType === 'purchase_order' && sourceRow?.installment_schedule_id) {
    const boundScheduleId = Number(sourceRow.installment_schedule_id);
    const filtered = mapped.filter((entry) => Number(entry.id) === boundScheduleId);
    return { sourceRow, scheduleConfig, schedules: filtered, sourceColumn };
  }

  return { sourceRow, scheduleConfig, schedules: mapped, sourceColumn };
};

// Get all Disbursement Vouchers
router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
    const offset = (page - 1) * pageSize;

    let query = `
      SELECT dv.*, 
             s.supplier_name,
             po.po_number,
             pr.pr_number,
             sr.sr_number,
             cr.cr_number,
             sr2.sr_number as payment_request_sr_number,
             prq.payee_name,
             prq.pr_number as payment_request_pr_number,
             e.first_name as prepared_by_first_name,
             e.last_name as prepared_by_last_name,
             accounting.first_name as accounting_first_name,
             accounting.last_name as accounting_last_name,
             manager.first_name as manager_first_name,
             manager.last_name as manager_last_name
      FROM disbursement_vouchers dv
      LEFT JOIN suppliers s ON dv.supplier_id = s.id
      LEFT JOIN purchase_orders po ON dv.purchase_order_id = po.id
      LEFT JOIN purchase_requests pr ON dv.purchase_request_id = pr.id
      LEFT JOIN service_requests sr ON dv.service_request_id = sr.id
      LEFT JOIN cash_requests cr ON dv.cash_request_id = cr.id
      LEFT JOIN payment_requests prq ON dv.payment_request_id = prq.id
      LEFT JOIN service_requests sr2 ON prq.service_request_id = sr2.id
      LEFT JOIN employees e ON dv.prepared_by = e.id
      LEFT JOIN employees accounting ON dv.certified_by_accounting = accounting.id
      LEFT JOIN employees manager ON dv.certified_by_manager = manager.id
    `;
    
    const params = [];
    
    if (req.user.role === 'engineer') {
      query += ' WHERE pr.requested_by = ?';
      params.push(req.user.id);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM disbursement_vouchers dv
      LEFT JOIN purchase_requests pr ON dv.purchase_request_id = pr.id
      ${req.user.role === 'engineer' ? 'WHERE pr.requested_by = ?' : ''}
    `;
    const countParams = [];
    if (req.user.role === 'engineer') {
      countParams.push(req.user.id);
    }
    
    query += ' ORDER BY dv.created_at DESC LIMIT ? OFFSET ?';
    
    const [vouchers] = await db.query(query, [...params, pageSize, offset]);
    const [countRows] = await db.query(countQuery, countParams);
    res.json({ disbursementVouchers: vouchers, page, pageSize, total: countRows?.[0]?.total ?? 0 });
  } catch (error) {
    console.error('Failed to fetch disbursement vouchers', error);
    res.status(500).json({ message: 'Failed to fetch disbursement vouchers' });
  }
});

// Get available schedules for DV creation based on selected source
router.get('/schedules', authenticate, requireAdmin, async (req, res) => {
  try {
    const sourceType = String(req.query.source_type || '').trim();
    const sourceId = Number(req.query.source_id);

    const validSourceTypes = new Set(['purchase_order', 'payment_request', 'payment_order', 'service_request', 'cash_request']);
    if (!validSourceTypes.has(sourceType)) {
      return res.status(400).json({ message: 'Invalid source_type' });
    }
    if (!Number.isInteger(sourceId) || sourceId <= 0) {
      return res.status(400).json({ message: 'source_id must be a positive integer' });
    }

    const { sourceRow, scheduleConfig, schedules } = await getSchedulesForSource(db, sourceType, sourceId);
    console.log('DEBUG returning schedules:', { count: schedules.length, schedules });
    if (!sourceRow) {
      return res.status(404).json({ message: 'Source document not found' });
    }
    if (!scheduleConfig) {
      return res.status(400).json({ message: 'Selected source has no payment schedule configuration.' });
    }

    res.json({
      source_type: sourceType,
      source_id: sourceId,
      schedule_source_type: scheduleConfig.schedule_source_type,
      schedules
    });
  } catch (error) {
    console.error('Failed to fetch DV schedules', error);
    res.status(500).json({ message: 'Failed to fetch schedules for DV creation' });
  }
});

// Get single Disbursement Voucher
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [vouchers] = await db.query(`
      SELECT dv.*, 
             s.supplier_name, s.address as supplier_address, s.contact_person, s.phone, s.email,
             po.po_number, po.total_amount as po_total_amount,
             pr.pr_number, pr.project_address,
             sr.sr_number, sr.purpose as sr_purpose,
             cr.cr_number, cr.receiver as cr_receiver, cr.purpose as cr_purpose,
             sr2.sr_number as payment_request_sr_number,
             prq.payee_name, prq.pr_number as payment_request_pr_number,
             e.first_name as prepared_by_first_name,
             e.last_name as prepared_by_last_name,
             accounting.first_name as accounting_first_name,
             accounting.last_name as accounting_last_name,
             manager.first_name as manager_first_name,
             manager.last_name as manager_last_name
      FROM disbursement_vouchers dv
      LEFT JOIN suppliers s ON dv.supplier_id = s.id
      LEFT JOIN purchase_orders po ON dv.purchase_order_id = po.id
      LEFT JOIN purchase_requests pr ON dv.purchase_request_id = pr.id
      LEFT JOIN service_requests sr ON dv.service_request_id = sr.id
      LEFT JOIN cash_requests cr ON dv.cash_request_id = cr.id
      LEFT JOIN payment_requests prq ON dv.payment_request_id = prq.id
      LEFT JOIN service_requests sr2 ON prq.service_request_id = sr2.id
      LEFT JOIN employees e ON dv.prepared_by = e.id
      LEFT JOIN employees accounting ON dv.certified_by_accounting = accounting.id
      LEFT JOIN employees manager ON dv.certified_by_manager = manager.id
      WHERE dv.id = ?
    `, [req.params.id]);

    if (vouchers.length === 0) {
      return res.status(404).json({ message: 'Disbursement voucher not found' });
    }

    // Get PO items for reference
    const [items] = await db.query(`
      SELECT poi.*, i.item_name as item_name, i.unit, i.item_code
      FROM purchase_order_items poi
      JOIN items i ON poi.item_id = i.id
      WHERE poi.purchase_order_id = ?
    `, [vouchers[0].purchase_order_id]);

    res.json({ disbursementVoucher: { ...vouchers[0], items } });
  } catch (error) {
    console.error('Failed to fetch disbursement voucher', error);
    res.status(500).json({ message: 'Failed to fetch disbursement voucher' });
  }
});

// Create Disbursement Voucher (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  let conn;
  try {
    const { 
      purchase_order_id,
      service_request_id,
      cash_request_id,
      payment_request_id,
      payment_order_id,
      particulars, 
      project,
      order_number,
      check_number,
      bank_name,
      payment_date,
      received_by,
      schedule_id,
      save_as_draft 
    } = req.body;
    
    // Validate - need one of: purchase_order_id, service_request_id, cash_request_id, payment_request_id, or payment_order_id
    if (!purchase_order_id && !service_request_id && !cash_request_id && !payment_request_id && !payment_order_id) {
      return res.status(400).json({ message: 'Purchase Order ID, Service Request ID, Cash Request ID, Payment Request ID, or Payment Order ID is required' });
    }
    
    conn = await db.getConnection();
    await conn.beginTransaction();
    
    let sourceData = null;
    let dvType = 'po_based';
    let finalPurchaseOrderId = purchase_order_id || null;
    let finalServiceRequestId = service_request_id || null;
    let finalCashRequestId = cash_request_id || null;
    let finalPaymentRequestId = payment_request_id || null;
    let finalPaymentOrderId = payment_order_id || null;
    let supplierId = null;
    let amount = 0;
    let prNumber = null;
    let srNumber = null;
    let crNumber = null;
    let poNumber = null;
    
    if (purchase_order_id) {
      // Get PO details with supplier and PR info
      const [pos] = await conn.query(`
        SELECT po.*, pr.pr_number, pr.project as pr_project, s.address as supplier_address
        FROM purchase_orders po
        LEFT JOIN purchase_requests pr ON po.purchase_request_id = pr.id
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        WHERE po.id = ?
      `, [purchase_order_id]);
      
      if (pos.length === 0) {
        await conn.rollback();
        return res.status(404).json({ message: 'Purchase order not found' });
      }
      
      sourceData = pos[0];
      supplierId = sourceData.supplier_id;
      
      // Recalculate total from PO items to ensure accuracy
      const [poItems] = await conn.query(
        'SELECT quantity, unit_price FROM purchase_order_items WHERE purchase_order_id = ?',
        [purchase_order_id]
      );
      console.log('PO Items for DV creation:', poItems);
      amount = poItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      console.log('Calculated DV amount:', amount, 'from', poItems.length, 'items');
      
      prNumber = sourceData.pr_number;
      dvType = 'po_based';
      finalServiceRequestId = sourceData.service_request_id || null;
    } else if (service_request_id) {
      // Get Service Request details
      const [srs] = await conn.query(`
        SELECT sr.*, s.address as supplier_address
        FROM service_requests sr
        LEFT JOIN suppliers s ON sr.supplier_id = s.id
        WHERE sr.id = ?
      `, [service_request_id]);
      
      if (srs.length === 0) {
        await conn.rollback();
        return res.status(404).json({ message: 'Service request not found' });
      }
      
      sourceData = srs[0];
      supplierId = sourceData.supplier_id;
      amount = sourceData.amount;
      srNumber = sourceData.sr_number;
      dvType = 'sr_based';
    } else if (cash_request_id) {
      // Get Cash Request details
      const [crs] = await conn.query(`
        SELECT cr.*
        FROM cash_requests cr
        WHERE cr.id = ?
      `, [cash_request_id]);
      
      if (crs.length === 0) {
        await conn.rollback();
        return res.status(404).json({ message: 'Cash request not found' });
      }
      
      sourceData = crs[0];
      amount = sourceData.amount;
      supplierId = sourceData.supplier_id;
      crNumber = sourceData.cr_number;
      dvType = 'cash_based';
    } else if (payment_request_id) {
      // Handle Payment Request
      const [prs] = await conn.query(
        `SELECT pr.*
         FROM payment_requests pr
         WHERE pr.id = ? AND pr.status = 'Approved'`,
        [payment_request_id]
      );
      
      if (prs.length === 0) {
        await conn.rollback();
        return res.status(404).json({ message: 'Payment request not found or not approved' });
      }
      
      sourceData = prs[0];
      amount = sourceData.amount;
      supplierId = null; // Payment requests use payee_name, not supplier_id
      prNumber = sourceData.pr_number;
      dvType = 'pr_based';
    } else if (payment_order_id) {
      // Handle Payment Order
      const [pos] = await conn.query(
        `SELECT po.*, sr.sr_number, sr.amount as sr_amount, sr.supplier_id as sr_supplier_id,
                cr.cr_number, cr.amount as cr_amount, cr.supplier_id as cr_supplier_id
         FROM payment_orders po
         LEFT JOIN service_requests sr ON po.service_request_id = sr.id
         LEFT JOIN cash_requests cr ON po.cash_request_id = cr.id
         WHERE po.id = ? AND po.status = 'Approved'`,
        [payment_order_id]
      );
      
      if (pos.length === 0) {
        await conn.rollback();
        return res.status(404).json({ message: 'Payment order not found or not approved' });
      }
      
      sourceData = pos[0];
      // Use SR or CR data depending on which is linked
      if (sourceData.service_request_id) {
        amount = sourceData.sr_amount;
        supplierId = sourceData.sr_supplier_id;
        srNumber = sourceData.sr_number;
        finalServiceRequestId = sourceData.service_request_id;
      } else if (sourceData.cash_request_id) {
        amount = sourceData.cr_amount;
        supplierId = sourceData.cr_supplier_id;
        crNumber = sourceData.cr_number;
        finalCashRequestId = sourceData.cash_request_id;
      }
      poNumber = sourceData.po_number;
      dvType = 'payment_order_based';
    }
    
    const creationSourceType = finalPurchaseOrderId
      ? 'purchase_order'
      : finalPaymentRequestId
        ? 'payment_request'
        : finalPaymentOrderId
          ? 'payment_order'
          : finalServiceRequestId
            ? 'service_request'
            : finalCashRequestId
              ? 'cash_request'
              : null;
    const creationSourceId = finalPurchaseOrderId || finalPaymentRequestId || finalPaymentOrderId || finalServiceRequestId || finalCashRequestId || null;

    if (!creationSourceType || !creationSourceId) {
      await conn.rollback();
      return res.status(400).json({ message: 'Unable to resolve source for schedule-based DV creation.' });
    }

    const { scheduleConfig, schedules, sourceColumn } = await getSchedulesForSource(conn, creationSourceType, creationSourceId);
    if (!scheduleConfig) {
      await conn.rollback();
      return res.status(400).json({ message: 'Selected source has no payment schedules configured.' });
    }
    if (!schedules.length) {
      await conn.rollback();
      return res.status(400).json({ message: 'No payment schedules available for this source.' });
    }

    const numericScheduleId = Number(schedule_id);
    if (!Number.isInteger(numericScheduleId) || numericScheduleId <= 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'schedule_id is required for DV creation.' });
    }

    // If the PO is an installment PO bound to a specific schedule, enforce the binding.
    if (finalPurchaseOrderId && sourceData?.installment_schedule_id) {
      const boundScheduleId = Number(sourceData.installment_schedule_id);
      if (Number.isInteger(boundScheduleId) && boundScheduleId > 0 && numericScheduleId !== boundScheduleId) {
        await conn.rollback();
        return res.status(400).json({ message: 'Selected schedule does not match the installment PO schedule.' });
      }
    }

    const selectedSchedule = schedules.find((entry) => Number(entry.id) === numericScheduleId);
    if (!selectedSchedule) {
      await conn.rollback();
      return res.status(400).json({ message: 'Selected payment schedule is invalid for this source.' });
    }
    if (selectedSchedule.is_consumed) {
      await conn.rollback();
      return res.status(400).json({ message: 'A non-cancelled DV already exists for this payment schedule date.' });
    }

    const scheduleAmount = Number(selectedSchedule.amount);
    if (!Number.isFinite(scheduleAmount) || scheduleAmount <= 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Selected payment schedule has invalid amount. Please set a valid schedule amount first.' });
    }

    const selectedScheduleDate = String(selectedSchedule.payment_date || '').trim();
    if (!selectedScheduleDate) {
      await conn.rollback();
      return res.status(400).json({ message: 'Selected payment schedule has invalid payment date.' });
    }

    // Extra race-condition guard right before insert.
    const [existingByDate] = await conn.query(
      `SELECT id FROM disbursement_vouchers
       WHERE ${sourceColumn} = ? AND DATE_FORMAT(payment_date, '%Y-%m-%d') = ? AND status != 'Cancelled'
       LIMIT 1`,
      [creationSourceId, selectedScheduleDate]
    );
    if (existingByDate.length > 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'A non-cancelled DV already exists for this payment schedule date.' });
    }

    amount = scheduleAmount;
    
    // Generate DV number (YYYY-MM-### format)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Get the last DV number for this year/month
    const [lastDVs] = await conn.query(
      "SELECT dv_number FROM disbursement_vouchers WHERE dv_number LIKE ? ORDER BY dv_number DESC LIMIT 1",
      [`${year}-${month}-%`]
    );
    
    let counter = 1;
    if (lastDVs.length > 0) {
      const lastNumber = lastDVs[0].dv_number;
      const match = lastNumber.match(/-(\d{3})$/);
      if (match) {
        counter = parseInt(match[1], 10) + 1;
      }
    }
    
    const dvNumber = `${year}-${month}-${String(counter).padStart(3, '0')}`;
    
    console.log('DV INSERT - amount:', amount, 'dvNumber:', dvNumber);
    
    // Create DV
    const [result] = await conn.query(
      `INSERT INTO disbursement_vouchers 
       (dv_number, purchase_order_id, purchase_request_id, service_request_id, cash_request_id, payment_request_id, payment_order_id,
        supplier_id, prepared_by, amount, dv_date, particulars, project, 
        pr_number, sr_number, cr_number, po_number, check_number, bank_name, payment_date, 
        received_by, received_date, status, certified_by_accounting, certified_by_manager,
        order_number, dv_type) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, ?, ?)`,
      [
        dvNumber, 
        finalPurchaseOrderId, 
        sourceData.purchase_request_id || null,
        finalServiceRequestId,
        finalCashRequestId,
        finalPaymentRequestId,
        finalPaymentOrderId,
        supplierId, 
        req.user.id,
        amount,
        particulars || (dvType === 'sr_based' ? 'Payment for services' : dvType === 'cash_based' ? 'Cash disbursement' : dvType === 'payment_order_based' ? 'Payment order disbursement' : 'Payment for the procurement of materials'),
        project || sourceData.pr_project || sourceData.project || null,
        prNumber,
        srNumber,
        crNumber,
        poNumber,
        check_number || null,
        bank_name || null,
        selectedScheduleDate,
        received_by || null,
        save_as_draft ? 'Draft' : 'Pending',
        order_number || sourceData.order_number || null,
        dvType
      ]
    );

    await conn.commit();
    
    // If DV was created from a Payment Request, update the PR status
    if (finalPaymentRequestId && !save_as_draft) {
      await db.query(
        'UPDATE payment_requests SET status = ?, updated_at = NOW() WHERE id = ?',
        ['DV Created', finalPaymentRequestId]
      );
    }

    // If DV was created from a Payment Order, update the PO status
    if (finalPaymentOrderId && !save_as_draft) {
      await db.query(
        'UPDATE payment_orders SET status = ?, updated_at = NOW() WHERE id = ?',
        ['DV Created', finalPaymentOrderId]
      );
    }

    res.status(201).json({ 
      message: save_as_draft ? 'Disbursement voucher saved as draft' : 'Disbursement voucher created successfully', 
      dvId: result.insertId,
      dvNumber,
      status: save_as_draft ? 'Draft' : 'Pending'
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
    }
    console.error('Failed to create disbursement voucher', error);
    res.status(500).json({ message: 'Failed to create disbursement voucher: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Update Disbursement Voucher (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  let conn;
  try {
    const { 
      particulars, 
      project,
      check_number,
      bank_name,
      payment_date,
      received_by,
      received_date,
      status
    } = req.body;
    
    conn = await db.getConnection();
    await conn.beginTransaction();
    
    // Check if DV exists
    const [dvs] = await conn.query('SELECT * FROM disbursement_vouchers WHERE id = ?', [req.params.id]);
    if (dvs.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Disbursement voucher not found' });
    }
    
    const dv = dvs[0];
    
    // Update DV
    await conn.query(
      `UPDATE disbursement_vouchers 
       SET particulars = ?, project = ?, check_number = ?, bank_name = ?, 
           payment_date = ?, received_by = ?, received_date = ?, status = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        particulars || dv.particulars,
        project || dv.project,
        check_number !== undefined ? check_number : dv.check_number,
        bank_name !== undefined ? bank_name : dv.bank_name,
        payment_date || dv.payment_date,
        received_by !== undefined ? received_by : dv.received_by,
        received_date || dv.received_date,
        status || dv.status,
        req.params.id
      ]
    );

    await conn.commit();

    res.json({ message: 'Disbursement voucher updated successfully' });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
    }
    console.error('Failed to update disbursement voucher', error);
    res.status(500).json({ message: 'Failed to update disbursement voucher: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Certify DV by Accounting (admin with accounting role or any admin)
router.put('/:id/certify-accounting', authenticate, requireAdmin, async (req, res) => {
  try {
    const [dvs] = await db.query('SELECT * FROM disbursement_vouchers WHERE id = ?', [req.params.id]);
    if (dvs.length === 0) {
      return res.status(404).json({ message: 'Disbursement voucher not found' });
    }
    
    await db.query(
      'UPDATE disbursement_vouchers SET certified_by_accounting = ?, updated_at = NOW() WHERE id = ?',
      [req.user.id, req.params.id]
    );

    res.json({ message: 'Disbursement voucher certified by accounting' });
  } catch (error) {
    console.error('Failed to certify disbursement voucher', error);
    res.status(500).json({ message: 'Failed to certify disbursement voucher' });
  }
});

// Certify DV by Manager (super admin)
router.put('/:id/certify-manager', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const [dvs] = await db.query('SELECT * FROM disbursement_vouchers WHERE id = ?', [req.params.id]);
    if (dvs.length === 0) {
      return res.status(404).json({ message: 'Disbursement voucher not found' });
    }
    
    await db.query(
      'UPDATE disbursement_vouchers SET certified_by_manager = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [req.user.id, 'Approved', req.params.id]
    );

    res.json({ message: 'Disbursement voucher approved by manager', status: 'Approved' });
  } catch (error) {
    console.error('Failed to certify disbursement voucher', error);
    res.status(500).json({ message: 'Failed to certify disbursement voucher' });
  }
});

// Mark DV as Paid (admin only)
router.put('/:id/mark-paid', authenticate, requireAdmin, async (req, res) => {
  try {
    const { check_number, bank_name, payment_date, received_by, received_date } = req.body;
    
    const [dvs] = await db.query('SELECT * FROM disbursement_vouchers WHERE id = ?', [req.params.id]);
    if (dvs.length === 0) {
      return res.status(404).json({ message: 'Disbursement voucher not found' });
    }
    
    await db.query(
      `UPDATE disbursement_vouchers 
       SET status = 'Paid', check_number = ?, bank_name = ?, payment_date = ?, 
           received_by = ?, received_date = ?, updated_at = NOW()
       WHERE id = ?`,
      [check_number, bank_name, payment_date, received_by, received_date || new Date(), req.params.id]
    );

    res.json({ message: 'Disbursement voucher marked as paid' });
  } catch (error) {
    console.error('Failed to mark disbursement voucher as paid', error);
    res.status(500).json({ message: 'Failed to mark disbursement voucher as paid' });
  }
});

// Delete/Cancel Disbursement Voucher (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const [dvs] = await db.query('SELECT * FROM disbursement_vouchers WHERE id = ?', [req.params.id]);
    if (dvs.length === 0) {
      return res.status(404).json({ message: 'Disbursement voucher not found' });
    }
    
    // Only allow deleting Draft or Pending DVs
    const dv = dvs[0];
    if (dv.status === 'Paid') {
      return res.status(400).json({ message: 'Cannot delete a paid disbursement voucher' });
    }
    
    await db.query('DELETE FROM disbursement_vouchers WHERE id = ?', [req.params.id]);

    res.json({ message: 'Disbursement voucher deleted successfully' });
  } catch (error) {
    console.error('Failed to delete disbursement voucher', error);
    res.status(500).json({ message: 'Failed to delete disbursement voucher' });
  }
});

// Export DV to Excel
router.get('/:id/export', authenticate, async (req, res) => {
  try {
    // Get DV details
    const [vouchers] = await db.query(`
      SELECT dv.*, 
             s.supplier_name, s.address as supplier_address,
             po.po_number,
             pr.pr_number,
             sr.sr_number,
             sr2.sr_number as payment_request_sr_number,
             prq.pr_number as payment_request_pr_number,
             e.first_name as prepared_by_first_name,
             e.last_name as prepared_by_last_name,
             accounting.first_name as accounting_first_name,
             accounting.last_name as accounting_last_name,
             manager.first_name as manager_first_name,
             manager.last_name as manager_last_name
      FROM disbursement_vouchers dv
      LEFT JOIN suppliers s ON dv.supplier_id = s.id
      LEFT JOIN purchase_orders po ON dv.purchase_order_id = po.id
      LEFT JOIN purchase_requests pr ON dv.purchase_request_id = pr.id
      LEFT JOIN service_requests sr ON dv.service_request_id = sr.id
      LEFT JOIN payment_requests prq ON dv.payment_request_id = prq.id
      LEFT JOIN service_requests sr2 ON prq.service_request_id = sr2.id
      LEFT JOIN employees e ON dv.prepared_by = e.id
      LEFT JOIN employees accounting ON dv.certified_by_accounting = accounting.id
      LEFT JOIN employees manager ON dv.certified_by_manager = manager.id
      WHERE dv.id = ?
    `, [req.params.id]);

    if (vouchers.length === 0) {
      return res.status(404).json({ message: 'Disbursement voucher not found' });
    }

    const dv = vouchers[0];

    // Load template workbook
    const templatePath = resolveExcelTemplatePath('DISBURSEMENT VOUCHER.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    
    // Get the first worksheet
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Could not load worksheet from template file');
    }

    // Format date helper
    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    };

    // Fill in the data based on the template structure
    // Clear cells first to remove any placeholder values from template
    worksheet.getCell('F3').value = null;
    worksheet.getCell('F4').value = null;
    worksheet.getCell('F5').value = null;
    worksheet.getCell('F7').value = null;
    worksheet.getCell('B7').value = null;
    worksheet.getCell('B8').value = null;
    worksheet.getCell('B9').value = null;
    worksheet.getCell('B15').value = null;
    worksheet.getCell('F15').value = null;
    worksheet.getCell('B23').value = null;
    worksheet.getCell('G23').value = null;
    worksheet.getCell('B27').value = null;
    worksheet.getCell('E27').value = null;
    worksheet.getCell('F29').value = null;
    worksheet.getCell('F30').value = null;
    worksheet.getCell('F31').value = null;
    worksheet.getCell('F32').value = null;

    // F3: Date
    worksheet.getCell('F3').value = formatDate(dv.dv_date);
    // F4: PR NO. value (F4 is master of merged F4:F5)
    // Use SR number for SR-based payment requests, otherwise use PR number
    const refNumber = dv.pr_number || dv.payment_request_pr_number || dv.sr_number || dv.payment_request_sr_number || '';
    worksheet.getCell('F4').value = refNumber;
    // F6: Order No.
    worksheet.getCell('F6').value = dv.order_number || '';
    // F7: DV No.
    worksheet.getCell('F7').value = dv.dv_number || '';

    // B7: Payee (supplier name)
    worksheet.getCell('B7').value = dv.supplier_name || '';
    // B8: Address (supplier address)
    worksheet.getCell('B8').value = dv.supplier_address || '';
    // B9: Project
    worksheet.getCell('B9').value = dv.project || '';

    // B12-H19: Particulars section
    // B15: Particulars text
    const particularsText = dv.particulars || 'PAYMENT FOR THE PROCUREMENT OF MATERIALS';
    worksheet.getCell('B15').value = particularsText;
    
    // F15: Amount
    worksheet.getCell('F15').value = dv.amount || 0;
    worksheet.getCell('F15').numFmt = '#,##0.00';

    // B23: Accounting signature name - hardcoded as ELAINE MARICRIS AGUILAR
    worksheet.getCell('B23').value = 'ELAINE MARICRIS AGUILAR';

    // G23: Manager signature name
    const managerName = dv.manager_first_name && dv.manager_last_name
      ? `${dv.manager_first_name.toUpperCase()} ${dv.manager_last_name.toUpperCase()}`
      : '';
    worksheet.getCell('G23').value = managerName;

    // B27: Date for accounting
    worksheet.getCell('B27').value = formatDate(dv.dv_date);
    // E27: Date for manager
    worksheet.getCell('E27').value = formatDate(dv.dv_date);

    // F29: Check No.
    worksheet.getCell('F29').value = dv.check_number || '';
    // F30: Bank Name
    worksheet.getCell('F30').value = dv.bank_name || '';
    // F31: PR No.
    worksheet.getCell('F31').value = refNumber;
    // F32: Date (payment date)
    worksheet.getCell('F32').value = formatDate(dv.payment_date);

    // Generate filename
    const filename = `DV-${dv.dv_number}-${Date.now()}.xlsx`;

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Export DV error:', error);
    res.status(500).json({ message: 'Failed to export disbursement voucher: ' + error.message });
  }
});

export default router;
