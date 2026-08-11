import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import db from '../config/database.js';
import reimbursementUpload from '../middleware/reimbursementUpload.js';
import { createNotification, getAdmins, getSuperAdmins } from '../utils/notifications.js';
import { resolveExcelTemplatePath } from '../utils/excelTemplatePath.js';
import { assertProjectIsActive } from '../utils/branchProjects.js';
import { assertOrderNumberUnlocked } from '../utils/orderNumberLocks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const replacePaymentSchedules = async (conn, reimbursementId, schedules, employeeId) => {
  await conn.query(
    'DELETE FROM reimbursement_payment_schedules WHERE reimbursement_id = ?',
    [reimbursementId]
  );

  if (!schedules.length) return;

  for (const schedule of schedules) {
    await conn.query(
      `INSERT INTO reimbursement_payment_schedules
      (reimbursement_id, payment_date, amount, note, created_by)
      VALUES (?, ?, ?, ?, ?)`,
      [reimbursementId, schedule.payment_date, schedule.amount, schedule.note, employeeId]
    );
  }
};

const getPaymentScheduleCount = async (conn, reimbursementId) => {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS count FROM reimbursement_payment_schedules WHERE reimbursement_id = ?',
    [reimbursementId]
  );
  return rows[0]?.count || 0;
};

// Get pending approvals count for sidebar badge - MUST be before /:id routes
router.get('/pending-count', authenticate, async (req, res) => {
  try {
    // Get counts from all relevant tables
    const [poCount] = await db.query(`
      SELECT COUNT(*) as count FROM purchase_orders 
      WHERE status IN ('Pending Approval', 'Draft')
    `);
    
    const [prCount] = await db.query(`
      SELECT COUNT(*) as count FROM purchase_requests 
      WHERE status IN ('Pending', 'For Approval', 'For Super Admin Final Approval')
    `);
    
    const [paymentCount] = await db.query(`
      SELECT COUNT(*) as count FROM payment_requests 
      WHERE status IN ('Pending', 'For Approval')
    `);
    
    const [dvCount] = await db.query(`
      SELECT COUNT(*) as count FROM disbursement_vouchers 
      WHERE status IN ('Pending', 'Draft')
    `);
    
    const [srCount] = await db.query(`
      SELECT COUNT(*) as count FROM service_requests 
      WHERE status = 'For Super Admin Final Approval'
    `);
    
    const [crCount] = await db.query(`
      SELECT COUNT(*) as count FROM cash_requests 
      WHERE status = 'For Super Admin Final Approval'
    `);
    
    const [paymentOrderCount] = await db.query(`
      SELECT COUNT(*) as count FROM payment_orders 
      WHERE status IN ('Pending', 'Draft')
    `);
    
    const [rmbCount] = await db.query(`
      SELECT COUNT(*) as count FROM reimbursements 
      WHERE status IN ('For Procurement Review', 'For Super Admin Final Approval')
    `);
    
    const totalCount = 
      poCount[0].count + 
      prCount[0].count + 
      paymentCount[0].count + 
      dvCount[0].count + 
      srCount[0].count + 
      crCount[0].count + 
      paymentOrderCount[0].count + 
      rmbCount[0].count;
    
    res.json({ 
      count: totalCount,
      breakdown: {
        purchaseOrders: poCount[0].count,
        purchaseRequests: prCount[0].count,
        paymentRequests: paymentCount[0].count,
        disbursementVouchers: dvCount[0].count,
        serviceRequests: srCount[0].count,
        cashRequests: crCount[0].count,
        paymentOrders: paymentOrderCount[0].count,
        reimbursements: rmbCount[0].count
      }
    });
  } catch (error) {
    console.error('Get pending count error:', error);
    res.status(500).json({ message: 'Failed to get pending count' });
  }
});

// Generate RMB number (RMB-Initials-YYYY-MM-XXX format)
const generateRMBNumber = async (user) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const firstInitial = String(user.first_name || '').charAt(0).toUpperCase();
  const middleInitial = String(user.middle_initial || '').charAt(0).toUpperCase();
  const lastInitial = String(user.last_name || '').charAt(0).toUpperCase();
  const initials = `${firstInitial}${middleInitial}${lastInitial}`;

  const [last] = await db.query(
    'SELECT rmb_number FROM reimbursements WHERE rmb_number LIKE ? ORDER BY rmb_number DESC LIMIT 1',
    [`RMB-${initials}-${year}-${month}-%`]
  );

  let counter = 1;
  if (last.length > 0) {
    const lastNumber = last[0].rmb_number;
    const match = lastNumber.match(/-(\d{3})$/);
    if (match) counter = parseInt(match[1], 10) + 1;
  }

  return `RMB-${initials}-${year}-${month}-${String(counter).padStart(3, '0')}`;
};

// Get all reimbursements
router.get('/', authenticate, async (req, res) => {
  try {
    let query = `
      SELECT r.*, 
             e.first_name as requester_first_name, 
             e.last_name as requester_last_name,
             (SELECT COUNT(*) FROM reimbursement_payment_schedules rs WHERE rs.reimbursement_id = r.id) as payment_schedule_count,
             (SELECT MIN(rs.payment_date) FROM reimbursement_payment_schedules rs WHERE rs.reimbursement_id = r.id) as next_payment_date,
             approver.first_name as approver_first_name,
             approver.last_name as approver_last_name
      FROM reimbursements r
      JOIN employees e ON r.requested_by = e.id
      LEFT JOIN employees approver ON r.approved_by = approver.id
    `;

    const params = [];

    if (req.user.role === 'engineer') {
      query += ' WHERE r.requested_by = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY r.created_at DESC';

    const [rows] = await db.query(query, params);

    // Fetch attachments for each reimbursement
    const reimbursementIds = rows.map(r => r.id);
    let attachmentsMap = {};
    
    if (reimbursementIds.length > 0) {
      const placeholders = reimbursementIds.map(() => '?').join(',');
      const [attachments] = await db.query(
        `SELECT ra.*, e.first_name as uploaded_by_first_name, e.last_name as uploaded_by_last_name
         FROM reimbursement_attachments ra
         LEFT JOIN employees e ON ra.uploaded_by = e.id
         WHERE ra.reimbursement_id IN (${placeholders})
         ORDER BY ra.uploaded_at DESC`,
        reimbursementIds
      );
      
      // Group attachments by reimbursement_id
      attachmentsMap = attachments.reduce((acc, att) => {
        if (!acc[att.reimbursement_id]) acc[att.reimbursement_id] = [];
        acc[att.reimbursement_id].push(att);
        return acc;
      }, {});
    }

    // Add attachments to each reimbursement
    const reimbursementsWithAttachments = rows.map(r => ({
      ...r,
      attachments: attachmentsMap[r.id] || []
    }));

    res.json({ reimbursements: reimbursementsWithAttachments });
  } catch (error) {
    console.error('Fetch reimbursements error:', error);
    res.status(500).json({ message: 'Failed to fetch reimbursements: ' + error.message });
  }
});

// Get single reimbursement (with attachments)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT r.*, 
             e.first_name as requester_first_name, 
             e.last_name as requester_last_name,
             approver.first_name as approver_first_name,
             approver.last_name as approver_last_name
      FROM reimbursements r
      JOIN employees e ON r.requested_by = e.id
      LEFT JOIN employees approver ON r.approved_by = approver.id
      WHERE r.id = ?
      `,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Reimbursement not found' });
    }

    const [attachments] = await db.query(
      `
      SELECT ra.*, e.first_name as uploaded_by_first_name, e.last_name as uploaded_by_last_name
      FROM reimbursement_attachments ra
      LEFT JOIN employees e ON ra.uploaded_by = e.id
      WHERE ra.reimbursement_id = ?
      ORDER BY ra.uploaded_at DESC
      `,
      [req.params.id]
    );

    const [paymentSchedules] = await db.query(
      `SELECT id, reimbursement_id, payment_date, amount, note, created_by, created_at, updated_at
       FROM reimbursement_payment_schedules
       WHERE reimbursement_id = ?
       ORDER BY payment_date ASC`,
      [req.params.id]
    );

    res.json({ reimbursement: { ...rows[0], attachments, payment_schedules: paymentSchedules } });
  } catch (error) {
    console.error('Fetch reimbursement error:', error);
    res.status(500).json({ message: 'Failed to fetch reimbursement: ' + error.message });
  }
});

// Create reimbursement (engineer)
router.post('/', authenticate, async (req, res) => {
  let conn;
  try {
    const {
      payee,
      purpose,
      project,
      project_address,
      order_number,
      amount,
      date_needed,
      remarks,
      payment_terms_note,
      payment_schedules
    } = req.body;
    await assertProjectIsActive(project, { providedOrderNumber: order_number });

    if (!payee || !String(payee).trim()) {
      return res.status(400).json({ message: 'Payee is required' });
    }

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    const normalizedPaymentTermsNote = normalizePaymentTermsNote(payment_terms_note);
    const normalizedPaymentSchedules = normalizePaymentSchedules(payment_schedules);
    if (normalizedPaymentSchedules.length === 0) {
      return res.status(400).json({ message: 'At least one payment schedule is required.' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const rmbNumber = await generateRMBNumber(req.user);

    const [result] = await conn.query(
      `INSERT INTO reimbursements
       (rmb_number, requested_by, payee, purpose, project, project_address, order_number, amount, date_needed, remarks, payment_terms_note, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rmbNumber,
        req.user.id,
        payee,
        purpose || null,
        project || null,
        project_address || null,
        order_number || null,
        parseFloat(amount),
        date_needed || null,
        remarks || null,
        normalizedPaymentTermsNote,
        'For Procurement Review'
      ]
    );
    await replacePaymentSchedules(conn, result.insertId, normalizedPaymentSchedules, req.user.id);

    await conn.commit();

    res.status(201).json({
      message: 'Reimbursement created successfully',
      reimbursementId: result.insertId,
      rmb_number: rmbNumber,
      status: 'For Procurement Review'
    });
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch { /* ignore */ }
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Create reimbursement error:', error);
    res.status(500).json({ message: 'Failed to create reimbursement: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Get pending approvals count for sidebar badge - MUST be before /:id routes
router.get('/pending-count', authenticate, async (req, res) => {
  try {
    // Get counts from all relevant tables
    const [poCount] = await db.query(`
      SELECT COUNT(*) as count FROM purchase_orders 
      WHERE status IN ('Pending Approval', 'Draft')
    `);
    
    const [prCount] = await db.query(`
      SELECT COUNT(*) as count FROM purchase_requests 
      WHERE status IN ('Pending', 'For Approval', 'For Super Admin Final Approval')
    `);
    
    const [paymentCount] = await db.query(`
      SELECT COUNT(*) as count FROM payment_requests 
      WHERE status IN ('Pending', 'For Approval')
    `);
    
    const [dvCount] = await db.query(`
      SELECT COUNT(*) as count FROM disbursement_vouchers 
      WHERE status IN ('Pending', 'Draft')
    `);
    
    const [srCount] = await db.query(`
      SELECT COUNT(*) as count FROM service_requests 
      WHERE status = 'For Super Admin Final Approval'
    `);
    
    const [crCount] = await db.query(`
      SELECT COUNT(*) as count FROM cash_requests 
      WHERE status = 'For Super Admin Final Approval'
    `);
    
    const [paymentOrderCount] = await db.query(`
      SELECT COUNT(*) as count FROM payment_orders 
      WHERE status IN ('Pending', 'Draft')
    `);
    
    const [rmbCount] = await db.query(`
      SELECT COUNT(*) as count FROM reimbursements 
      WHERE status IN ('For Procurement Review', 'For Super Admin Final Approval')
    `);
    
    const totalCount = 
      poCount[0].count + 
      prCount[0].count + 
      paymentCount[0].count + 
      dvCount[0].count + 
      srCount[0].count + 
      crCount[0].count + 
      paymentOrderCount[0].count + 
      rmbCount[0].count;
    
    res.json({ 
      count: totalCount,
      breakdown: {
        purchaseOrders: poCount[0].count,
        purchaseRequests: prCount[0].count,
        paymentRequests: paymentCount[0].count,
        disbursementVouchers: dvCount[0].count,
        serviceRequests: srCount[0].count,
        cashRequests: crCount[0].count,
        paymentOrders: paymentOrderCount[0].count,
        reimbursements: rmbCount[0].count
      }
    });
  } catch (error) {
    console.error('Get pending count error:', error);
    res.status(500).json({ message: 'Failed to get pending count' });
  }
});

// Update reimbursement (Draft only)
router.put('/:id', authenticate, async (req, res) => {
  let conn;
  try {
    const { payee, purpose, project, project_address, order_number, amount, date_needed, remarks, payment_terms_note, payment_schedules } = req.body;
    await assertProjectIsActive(project, { providedOrderNumber: order_number });

    const [rows] = await db.query('SELECT * FROM reimbursements WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Reimbursement not found' });
    }

    const r = rows[0];
    await assertOrderNumberUnlocked(r.order_number, 'approval');

    if (r.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can update this reimbursement' });
    }

    if (r.status !== 'Draft') {
      return res.status(400).json({ message: 'Only draft reimbursements can be updated' });
    }

    if (amount !== undefined && (isNaN(amount) || parseFloat(amount) <= 0)) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }
    const normalizedPaymentTermsNote = hasOwn(req.body, 'payment_terms_note')
      ? normalizePaymentTermsNote(payment_terms_note)
      : r.payment_terms_note;
    const hasPaymentSchedulesField = hasOwn(req.body, 'payment_schedules');
    const normalizedPaymentSchedules = hasPaymentSchedulesField ? normalizePaymentSchedules(payment_schedules) : null;
    if (hasPaymentSchedulesField && normalizedPaymentSchedules.length === 0) {
      return res.status(400).json({ message: 'At least one payment schedule is required.' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query(
      `UPDATE reimbursements
       SET payee = ?, purpose = ?, project = ?, project_address = ?, order_number = ?, amount = ?, date_needed = ?, remarks = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        payee ?? r.payee,
        purpose ?? r.purpose,
        project ?? r.project,
        project_address ?? r.project_address,
        order_number ?? r.order_number,
        amount !== undefined ? parseFloat(amount) : r.amount,
        date_needed ?? r.date_needed,
        remarks ?? r.remarks,
        req.params.id
      ]
    );
    await conn.query(
      'UPDATE reimbursements SET payment_terms_note = ?, updated_at = NOW() WHERE id = ?',
      [normalizedPaymentTermsNote, req.params.id]
    );
    if (hasPaymentSchedulesField) {
      await replacePaymentSchedules(conn, req.params.id, normalizedPaymentSchedules, req.user.id);
    }

    await conn.commit();

    res.json({ message: 'Reimbursement updated successfully', status: 'Draft' });
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch { /* ignore */ }
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Update reimbursement error:', error);
    res.status(500).json({ message: 'Failed to update reimbursement: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Submit reimbursement (Draft -> Pending)
router.put('/:id/submit', authenticate, async (req, res) => {
  let conn;
  try {
    const [rows] = await db.query('SELECT * FROM reimbursements WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Reimbursement not found' });
    }

    const r = rows[0];

    if (r.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can submit this reimbursement' });
    }

    if (r.status !== 'Draft') {
      return res.status(400).json({ message: 'Only draft reimbursements can be submitted' });
    }
    const scheduleCount = await getPaymentScheduleCount(db, req.params.id);
    if (scheduleCount === 0) {
      return res.status(400).json({ message: 'At least one payment schedule is required before submission.' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query("UPDATE reimbursements SET status = 'Pending', updated_at = NOW() WHERE id = ?", [req.params.id]);

    await conn.commit();

    const admins = await getAdmins();
    for (const adminId of admins) {
      await createNotification(
        adminId,
        'New Reimbursement Request',
        `Reimbursement ${r.rmb_number} has been submitted and requires your approval`,
        'PR Created',
        r.id,
        'reimbursement'
      );
    }

    res.json({ message: 'Reimbursement submitted successfully', status: 'Pending' });
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch { /* ignore */ }
    }
    console.error('Submit reimbursement error:', error);
    res.status(500).json({ message: 'Failed to submit reimbursement: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Approve/Reject reimbursement (procurement, admin, super_admin)
router.put('/:id/approve', authenticate, async (req, res) => {
  // Allow procurement, admin, and super_admin to approve
  if (!['procurement', 'admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  
  let conn;
  try {
    const { status, rejection_reason } = req.body; // 'approved' | 'rejected'

    const [rows] = await db.query('SELECT * FROM reimbursements WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Reimbursement not found' });
    }

    const r = rows[0];

    // Procurement can only approve/reject when status is 'For Procurement Review'
    if (req.user.role === 'procurement' && r.status !== 'For Procurement Review') {
      return res.status(400).json({ message: 'Reimbursement is not pending procurement review' });
    }
    
    // Admin/Super Admin can approve when status is 'For Super Admin Final Approval' or other pending states
    if (['admin', 'super_admin'].includes(req.user.role)) {
      if (r.status !== 'For Procurement Review' && r.status !== 'For Super Admin Final Approval' && r.status !== 'Pending') {
        return res.status(400).json({ message: 'Reimbursement not ready for approval' });
      }
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    let newStatus;
    if (status === 'approved') {
      const scheduleCount = await getPaymentScheduleCount(conn, req.params.id);
      if (scheduleCount === 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'At least one payment schedule is required before approval.' });
      }
      // If procurement approves, move to 'For Super Admin Final Approval'
      // If super admin approves, move to 'For Purchase'
      if (req.user.role === 'procurement') {
        newStatus = 'For Super Admin Final Approval';
      } else {
        newStatus = 'For Purchase';
      }
      await conn.query(
        'UPDATE reimbursements SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?',
        [newStatus, req.user.id, req.params.id]
      );
    } else {
      newStatus = 'Rejected';
      await conn.query(
        'UPDATE reimbursements SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, rejection_reason || null, req.params.id]
      );
    }

    await conn.commit();

    // Notify the requester
    if (status === 'approved') {
      if (newStatus === 'For Super Admin Final Approval') {
        // Notify super admins that procurement approved
        const superAdmins = await getSuperAdmins();
        for (const adminId of superAdmins) {
          await createNotification(
            adminId,
            'Reimbursement Pending Final Approval',
            `Reimbursement ${r.rmb_number} has been approved by procurement and requires your final approval`,
            'PR Approved',
            r.id,
            'reimbursement'
          );
        }
      }
      await createNotification(
        r.requested_by,
        newStatus === 'For Super Admin Final Approval' ? 'Reimbursement Approved by Procurement' : 'Reimbursement Approved',
        `Your Reimbursement ${r.rmb_number} has been ${newStatus === 'For Super Admin Final Approval' ? 'approved by procurement and is pending final approval' : 'approved'}`,
        'PR Approved',
        r.id,
        'reimbursement'
      );
    } else {
      await createNotification(
        r.requested_by,
        'Reimbursement Rejected',
        `Your Reimbursement ${r.rmb_number} has been rejected${rejection_reason ? ': ' + rejection_reason : ''}`,
        'PR Rejected',
        r.id,
        'reimbursement'
      );
    }

    res.json({ message: `Reimbursement ${status} successfully`, status: newStatus });
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch { /* ignore */ }
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Approve reimbursement error:', error);
    res.status(500).json({ message: 'Failed to approve reimbursement: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Mark reimbursement as Received (requester only, fulfilled statuses only)
router.put('/:id/received', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM reimbursements WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Reimbursement not found' });
    }

    const r = rows[0];

    if (r.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can mark this reimbursement as received' });
    }

    const allowedStatuses = ['Payment Order Created', 'Paid'];
    if (!allowedStatuses.includes(r.status)) {
      return res.status(400).json({ message: 'Only fulfilled reimbursements can be marked as received' });
    }

    await db.query(
      'UPDATE reimbursements SET status = ?, updated_at = NOW() WHERE id = ?',
      ['Received', req.params.id]
    );

    res.json({ message: 'Reimbursement marked as received successfully', status: 'Received' });
  } catch (error) {
    console.error('Mark reimbursement received error:', error);
    res.status(500).json({ message: 'Failed to mark reimbursement as received' });
  }
});

// List attachments
router.get('/:id/attachments', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, requested_by FROM reimbursements WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Reimbursement not found' });
    }

    const r = rows[0];
    if (req.user.role === 'engineer' && r.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const [attachments] = await db.query(
      `
      SELECT ra.*, e.first_name as uploaded_by_first_name, e.last_name as uploaded_by_last_name
      FROM reimbursement_attachments ra
      LEFT JOIN employees e ON ra.uploaded_by = e.id
      WHERE ra.reimbursement_id = ?
      ORDER BY ra.uploaded_at DESC
      `,
      [req.params.id]
    );

    res.json({ attachments });
  } catch (error) {
    console.error('List reimbursement attachments error:', error);
    res.status(500).json({ message: 'Failed to list attachments: ' + error.message });
  }
});

// Upload liquidation attachments (multiple)
router.post('/:id/attachments', authenticate, reimbursementUpload.array('files', 10), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM reimbursements WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Reimbursement not found' });
    }

    const r = rows[0];

    // Only requester or admins can upload
    if (req.user.role === 'engineer' && r.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can upload attachments' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const uploaded = [];

    for (const file of req.files) {
      const [result] = await db.query(
        `INSERT INTO reimbursement_attachments (reimbursement_id, file_path, file_name, file_size, mime_type, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.params.id,
          `/uploads/reimbursements/${file.filename}`,
          file.originalname,
          file.size,
          file.mimetype,
          req.user.id
        ]
      );

      uploaded.push({
        id: result.insertId,
        file_path: `/uploads/reimbursements/${file.filename}`,
        file_name: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
        uploaded_by: req.user.id
      });
    }

    res.status(201).json({ message: 'Attachments uploaded successfully', attachments: uploaded });
  } catch (error) {
    console.error('Upload reimbursement attachments error:', error);
    res.status(500).json({ message: 'Failed to upload attachments: ' + error.message });
  }
});

// Delete a single attachment (admin/super_admin or uploader)
router.delete('/:id/attachments/:attachmentId', authenticate, async (req, res) => {
  try {
    const [attachments] = await db.query(
      'SELECT * FROM reimbursement_attachments WHERE id = ? AND reimbursement_id = ?',
      [req.params.attachmentId, req.params.id]
    );

    if (attachments.length === 0) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    const attachment = attachments[0];

    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    const isUploader = attachment.uploaded_by === req.user.id;

    if (!isAdmin && !isUploader) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Remove file from disk
    try {
      const uploadsDir = path.resolve(__dirname, '../uploads/reimbursements');
      const fileName = path.basename(attachment.file_path || '');
      const filePath = path.resolve(uploadsDir, fileName);

      if (filePath.startsWith(uploadsDir) && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.log('File may not exist on disk:', err.message);
    }

    await db.query('DELETE FROM reimbursement_attachments WHERE id = ?', [attachment.id]);

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Delete reimbursement attachment error:', error);
    res.status(500).json({ message: 'Failed to delete attachment: ' + error.message });
  }
});

// Delete reimbursement (Draft only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM reimbursements WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Reimbursement not found' });
    }

    const r = rows[0];

    if (r.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can delete this reimbursement' });
    }

    if (r.status !== 'Draft') {
      return res.status(400).json({ message: 'Only draft reimbursements can be deleted' });
    }

    await db.query('DELETE FROM reimbursements WHERE id = ?', [req.params.id]);

    res.json({ message: 'Reimbursement deleted successfully' });
  } catch (error) {
    console.error('Delete reimbursement error:', error);
    res.status(500).json({ message: 'Failed to delete reimbursement: ' + error.message });
  }
});

// Delete reimbursement (Draft only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM reimbursements WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Reimbursement not found' });
    }

    const r = rows[0];

    if (r.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can delete this reimbursement' });
    }

    if (r.status !== 'Draft') {
      return res.status(400).json({ message: 'Only draft reimbursements can be deleted' });
    }

    await db.query('DELETE FROM reimbursements WHERE id = ?', [req.params.id]);

    res.json({ message: 'Reimbursement deleted successfully' });
  } catch (error) {
    console.error('Delete reimbursement error:', error);
    res.status(500).json({ message: 'Failed to delete reimbursement: ' + error.message });
  }
});

router.get('/:id/export', authenticate, async (req, res) => {
  try {
    // Get reimbursement details
    const [reimbursements] = await db.query(`
      SELECT r.*, 
             e.first_name as requester_first_name, 
             e.last_name as requester_last_name
      FROM reimbursements r
      JOIN employees e ON r.requested_by = e.id
      WHERE r.id = ?
    `, [req.params.id]);
    
    if (reimbursements.length === 0) {
      return res.status(404).json({ message: 'Reimbursement not found' });
    }
    
    const rmb = reimbursements[0];
    
    console.log('Exporting reimbursement:', rmb.id, 'purpose:', rmb.purpose, 'amount:', rmb.amount);
    
    // Load template workbook
    const templatePath = resolveExcelTemplatePath('Reimbursement.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    
    const worksheet = workbook.getWorksheet(1);
    
    // Format date helper
    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    };
    
    // Fill payee (B5)
    worksheet.getCell('B5').value = rmb.payee || '';
    
    // Fill address (B7)
    worksheet.getCell('B7').value = rmb.project_address || '';
    
    // Fill project (B8)
    worksheet.getCell('B8').value = rmb.project || '';
    
    // Fill RMB number (G5)
    worksheet.getCell('G5').value = rmb.rmb_number || '';
    
    // Fill date (G6)
    worksheet.getCell('G6').value = formatDate(rmb.created_at);
    
    // Fill order number (G8)
    worksheet.getCell('G8').value = rmb.order_number || '';
    
    // Fill place of delivery (B9)
    worksheet.getCell('B9').value = rmb.project || '';
    
    // Fill delivery term (F9)
    worksheet.getCell('F9').value = '';
    
    // Fill date of delivery (B10)
    worksheet.getCell('B10').value = formatDate(rmb.date_needed);
    
    // Fill payment term (F10)
    worksheet.getCell('F10').value = '';
    
    // Clear row 12 first to remove any template values
    ['A12', 'B12', 'C12', 'D12', 'E12', 'F12', 'G12'].forEach(cell => {
      worksheet.getCell(cell).value = null;
    });
    
    // Fill row 12 data
    worksheet.getCell('A12').value = 1;  // QTY
    worksheet.getCell('B12').value = 'lot';  // UNIT
    worksheet.getCell('C12').value = rmb.purpose || '';  // DESCRIPTION
    worksheet.getCell('F12').value = parseFloat(rmb.amount) || 0;  // UNIT COST
    worksheet.getCell('G12').value = parseFloat(rmb.amount) || 0;  // AMOUNT
    
    console.log('Set C12 to:', rmb.purpose, 'F12 to:', rmb.amount, 'G12 to:', rmb.amount);
    
    // Fill grand total (G27)
    worksheet.getCell('G27').value = parseFloat(rmb.amount) || 0;
    
    // Fill prepared by (B31)
    const requesterName = `${rmb.requester_first_name || ''} ${rmb.requester_last_name || ''}`.trim();
    worksheet.getCell('B31').value = requesterName || '';
    
    // Generate filename
    const filename = `RMB-${rmb.rmb_number}-${Date.now()}.xlsx`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Export reimbursement error:', error);
    res.status(500).json({ message: 'Failed to export reimbursement: ' + error.message });
  }
});

export default router;
