import express from 'express';
import { authenticate, requireAdmin, requireSuperAdmin, requireProcurement } from '../middleware/auth.js';
import db from '../config/database.js';
import { createNotification, getProcurementOfficers, getSuperAdmins, getAdmins } from '../utils/notifications.js';
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

const replacePaymentSchedules = async (conn, serviceRequestId, schedules, employeeId) => {
  await conn.query(
    'DELETE FROM service_request_payment_schedules WHERE service_request_id = ?',
    [serviceRequestId]
  );

  if (!schedules.length) return;

  for (const schedule of schedules) {
    await conn.query(
      `INSERT INTO service_request_payment_schedules
      (service_request_id, payment_date, amount, note, created_by)
      VALUES (?, ?, ?, ?, ?)`,
      [serviceRequestId, schedule.payment_date, schedule.amount, schedule.note, employeeId]
    );
  }
};

const getPaymentScheduleCount = async (conn, serviceRequestId) => {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS count FROM service_request_payment_schedules WHERE service_request_id = ?',
    [serviceRequestId]
  );
  return rows[0]?.count || 0;
};

// Generate SR number (SRV-Initials-YYYY-MM-XXX format)
const generateSRNumber = async (user) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const firstInitial = String(user.first_name || '').charAt(0).toUpperCase();
  const middleInitial = String(user.middle_initial || '').charAt(0).toUpperCase();
  const lastInitial = String(user.last_name || '').charAt(0).toUpperCase();
  const initials = `${firstInitial}${middleInitial}${lastInitial}`;

  const [lastSRs] = await db.query(
    "SELECT sr_number FROM service_requests WHERE sr_number LIKE ? ORDER BY sr_number DESC LIMIT 1",
    [`SRV-${initials}-${year}-${month}-%`]
  );

  let counter = 1;
  if (lastSRs.length > 0) {
    const lastNumber = lastSRs[0].sr_number;
    const match = lastNumber.match(/-(\d{3})$/);
    if (match) {
      counter = parseInt(match[1], 10) + 1;
    }
  }

  return `SRV-${initials}-${year}-${month}-${String(counter).padStart(3, '0')}`;
};

// Get all Service Requests
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
      FROM service_requests sr
      JOIN employees e ON sr.requested_by = e.id
      LEFT JOIN suppliers s ON sr.supplier_id = s.id
      LEFT JOIN employees approver ON sr.approved_by = approver.id
    `;

    const whereClauses = [];
    const whereParams = [];

    // Engineers see only their own SRs by default, but can view all with ?view=all
    if (req.user.role === 'engineer' && view !== 'all') {
      whereClauses.push('sr.requested_by = ?');
      whereParams.push(req.user.id);
    }

    if (normalizedStatuses.length > 0) {
      whereClauses.push(`sr.status IN (${normalizedStatuses.map(() => '?').join(', ')})`);
      whereParams.push(...normalizedStatuses);
    }

    if (q) {
      const like = `%${q}%`;
      whereClauses.push(`(
        sr.sr_number LIKE ?
        OR sr.purpose LIKE ?
        OR sr.service_type LIKE ?
        OR sr.project LIKE ?
        OR s.supplier_name LIKE ?
        OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?
      )`);
      whereParams.push(like, like, like, like, like, like);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const listQuery = `
      SELECT sr.*, 
             e.first_name as requester_first_name, 
             e.last_name as requester_last_name,
             s.supplier_name,
             (SELECT COUNT(*) FROM service_request_payment_schedules srs WHERE srs.service_request_id = sr.id) as payment_schedule_count,
             (SELECT MIN(srs.payment_date) FROM service_request_payment_schedules srs WHERE srs.service_request_id = sr.id) as next_payment_date,
             approver.first_name as approver_first_name,
             approver.last_name as approver_last_name
      ${baseFrom}
      ${whereSql}
      ORDER BY sr.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      ${baseFrom}
      ${whereSql}
    `;

    const [srs] = await db.query(listQuery, [...whereParams, pageSize, offset]);
    const [countRows] = await db.query(countQuery, whereParams);
    
    // Add items for service requests that have quantity (payment_order type)
    for (const sr of srs) {
      if (sr.sr_type === 'payment_order' && sr.quantity) {
        // For payment orders, create a virtual item for display
        sr.items = [{
          id: `sr-${sr.id}`,
          description: sr.purpose,
          quantity: sr.quantity,
          unit: sr.unit,
          unit_price: sr.amount / sr.quantity,
          total_price: sr.amount
        }];
      } else {
        sr.items = [];
      }
    }
    
    res.json({
      serviceRequests: srs,
      page,
      pageSize,
      total: countRows?.[0]?.total ?? 0
    });
  } catch (error) {
    console.error('Fetch service requests error:', error);
    res.status(500).json({ message: 'Failed to fetch service requests: ' + error.message });
  }
});

// Get single Service Request
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [srs] = await db.query(`
      SELECT sr.*, 
             e.first_name as requester_first_name, 
             e.last_name as requester_last_name,
             s.supplier_name, s.contact_person, s.phone, s.email, s.address as supplier_address,
             approver.first_name as approver_first_name,
             approver.last_name as approver_last_name
      FROM service_requests sr
      JOIN employees e ON sr.requested_by = e.id
      LEFT JOIN suppliers s ON sr.supplier_id = s.id
      LEFT JOIN employees approver ON sr.approved_by = approver.id
      WHERE sr.id = ?
    `, [req.params.id]);

    if (srs.length === 0) {
      return res.status(404).json({ message: 'Service request not found' });
    }

    const [paymentSchedules] = await db.query(
      `SELECT id, service_request_id, payment_date, amount, note, created_by, created_at, updated_at
       FROM service_request_payment_schedules
       WHERE service_request_id = ?
       ORDER BY payment_date ASC`,
      [req.params.id]
    );

    res.json({ serviceRequest: { ...srs[0], payment_schedules: paymentSchedules } });
  } catch (error) {
    console.error('Fetch service request error:', error);
    res.status(500).json({ message: 'Failed to fetch service request: ' + error.message });
  }
});

// Create Service Request (engineer)
router.post('/', authenticate, async (req, res) => {
  let conn;
  try {
    const {
      purpose,
      description,
      service_type,
      sr_type,
      project,
      project_address,
      supplier_id,
      amount,
      quantity,
      unit,
      date_needed,
      remarks,
      order_number,
      payment_terms_note,
      payment_schedules
    } = req.body;
    await assertProjectIsActive(project, { providedOrderNumber: order_number });

    // Validate required fields
    if (!purpose || !String(purpose).trim()) {
      return res.status(400).json({ message: 'Purpose is required' });
    }

    if (!service_type) {
      return res.status(400).json({ message: 'Service type is required' });
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    const normalizedPaymentTermsNote = normalizePaymentTermsNote(payment_terms_note);
    const normalizedPaymentSchedules = normalizePaymentSchedules(payment_schedules);
    if (normalizedPaymentSchedules.length === 0) {
      return res.status(400).json({ message: 'At least one payment schedule is required.' });
    }

    // Validate quantity required for payment_request type (payment_request = amount + qty)
    const finalSrType = sr_type || 'payment_order';
    if (finalSrType === 'payment_request' && (!quantity || quantity <= 0)) {
      return res.status(400).json({ message: 'Valid quantity is required for Payment Request type' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const srNumber = await generateSRNumber(req.user);

    const [result] = await conn.query(
      `INSERT INTO service_requests 
       (sr_number, requested_by, purpose, description, service_type, sr_type, project, project_address, supplier_id, amount, quantity, unit, date_needed, remarks, order_number, payment_terms_note, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        srNumber,
        req.user.id,
        purpose,
        description || null,
        service_type,
        finalSrType,
        project || null,
        project_address || null,
        supplier_id || null,
        amount,
        finalSrType === 'payment_request' ? quantity : null,
        unit || null,
        date_needed || null,
        remarks || null,
        order_number || null,
        normalizedPaymentTermsNote,
        'Draft'
      ]
    );

    const srId = result.insertId;
    await replacePaymentSchedules(conn, srId, normalizedPaymentSchedules, req.user.id);

    await conn.commit();

    res.status(201).json({
      message: 'Service request created successfully',
      srId,
      sr_number: srNumber,
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
    console.error('Create service request error:', error);
    res.status(500).json({ message: 'Failed to create service request: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Update Service Request (Draft only, engineer only)
router.put('/:id', authenticate, async (req, res) => {
  let conn;
  try {
    const { purpose, description, service_type, sr_type, project, project_address, supplier_id, amount, quantity, unit, date_needed, remarks, order_number, payment_terms_note, payment_schedules } = req.body;
    await assertProjectIsActive(project, { providedOrderNumber: order_number });

    // Check if SR exists
    const [srs] = await db.query('SELECT * FROM service_requests WHERE id = ?', [req.params.id]);
    if (srs.length === 0) {
      return res.status(404).json({ message: 'Service request not found' });
    }

    const sr = srs[0];
    await assertOrderNumberUnlocked(sr.order_number, 'approval');

    // Only the original requester can update
    if (sr.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can update this service request' });
    }

    // Only draft SRs can be updated
    if (sr.status !== 'Draft') {
      return res.status(400).json({ message: 'Only draft service requests can be updated' });
    }

    // Validate quantity required for payment_request type (payment_request = amount + qty)
    const finalSrType = sr_type ?? sr.sr_type ?? 'payment_order';
    if (finalSrType === 'payment_request' && amount && (!quantity || quantity <= 0)) {
      return res.status(400).json({ message: 'Valid quantity is required for Payment Request type' });
    }
    const normalizedPaymentTermsNote = hasOwn(req.body, 'payment_terms_note')
      ? normalizePaymentTermsNote(payment_terms_note)
      : sr.payment_terms_note;
    const hasPaymentSchedulesField = hasOwn(req.body, 'payment_schedules');
    const normalizedPaymentSchedules = hasPaymentSchedulesField ? normalizePaymentSchedules(payment_schedules) : null;
    if (hasPaymentSchedulesField && normalizedPaymentSchedules.length === 0) {
      return res.status(400).json({ message: 'At least one payment schedule is required.' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query(
      `UPDATE service_requests 
       SET purpose = ?, description = ?, service_type = ?, sr_type = ?, project = ?, project_address = ?, 
           supplier_id = ?, amount = ?, quantity = ?, unit = ?, date_needed = ?, remarks = ?, order_number = ?, payment_terms_note = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        purpose ?? sr.purpose,
        description ?? sr.description,
        service_type ?? sr.service_type,
        finalSrType,
        project || sr.project,
        project_address || sr.project_address,
        supplier_id ?? sr.supplier_id,
        amount || sr.amount,
        finalSrType === 'payment_request' ? (quantity || sr.quantity) : null,
        unit || sr.unit,
        date_needed || sr.date_needed,
        remarks ?? sr.remarks,
        order_number || sr.order_number,
        normalizedPaymentTermsNote,
        req.params.id
      ]
    );
    if (hasPaymentSchedulesField) {
      await replacePaymentSchedules(conn, req.params.id, normalizedPaymentSchedules, req.user.id);
    }

    await conn.commit();

    res.json({ message: 'Service request updated successfully', status: 'Draft' });
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
    console.error('Update service request error:', error);
    res.status(500).json({ message: 'Failed to update service request: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Submit Service Request (Draft -> Pending)
router.put('/:id/submit', authenticate, async (req, res) => {
  let conn;
  try {
    const [srs] = await db.query('SELECT * FROM service_requests WHERE id = ?', [req.params.id]);
    if (srs.length === 0) {
      return res.status(404).json({ message: 'Service request not found' });
    }

    const sr = srs[0];
    await assertOrderNumberUnlocked(sr.order_number, 'approval');

    // Only the original requester can submit
    if (sr.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can submit this service request' });
    }

    // Only draft SRs can be submitted
    if (sr.status !== 'Draft') {
      return res.status(400).json({ message: 'Only draft service requests can be submitted' });
    }

    // Validate required fields
    if (!sr.purpose || !String(sr.purpose).trim()) {
      return res.status(400).json({ message: 'Purpose is required to submit' });
    }

    if (!sr.amount || sr.amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required to submit' });
    }
    const scheduleCount = await getPaymentScheduleCount(db, req.params.id);
    if (scheduleCount === 0) {
      return res.status(400).json({ message: 'At least one payment schedule is required before submission.' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query(
      "UPDATE service_requests SET status = 'For Procurement Review', updated_at = NOW() WHERE id = ?",
      [req.params.id]
    );

    await conn.commit();

    // Notify procurement officers for review
    const procurementOfficers = await getProcurementOfficers();
    for (const officerId of procurementOfficers) {
      await createNotification(
        officerId,
        'New Service Request',
        `Service Request ${sr.sr_number} has been submitted and requires your review`,
        'PR Created',
        sr.id,
        'service_request'
      );
    }

    // Emit real-time SR update to procurement officers
    req.io.to('role_procurement').emit('sr_updated', {
      id: sr.id,
      sr_number: sr.sr_number,
      status: 'For Procurement Review',
      type: 'new_sr'
    });

    res.json({ message: 'Service request submitted successfully', status: 'For Procurement Review' });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
    }
    console.error('Submit service request error:', error);
    res.status(500).json({ message: 'Failed to submit service request: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Approve/Reject by Procurement (to Super Admin Final Approval)
router.put('/:id/procurement-approve', authenticate, requireProcurement, async (req, res) => {
  let conn;
  try {
    const { status, rejection_reason, supplier_id, supplier_address } = req.body;
    
    conn = await db.getConnection();
    await conn.beginTransaction();
    
    const [srs] = await conn.query('SELECT * FROM service_requests WHERE id = ?', [req.params.id]);
    if (srs.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Service request not found' });
    }
    
    const sr = srs[0];
    
    if (sr.status !== 'For Procurement Review') {
      await conn.rollback();
      return res.status(400).json({ message: 'Service request not ready for Procurement review' });
    }
    
    let newStatus;
    
    if (status === 'approved') {
      const scheduleCount = await getPaymentScheduleCount(conn, req.params.id);
      if (scheduleCount === 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'At least one payment schedule is required before approval.' });
      }
      newStatus = 'For Super Admin Final Approval';
      
      // Validate supplier_id is provided for approval
      if (!supplier_id) {
        await conn.rollback();
        return res.status(400).json({ message: 'Supplier is required for approval' });
      }
      
      // Update SR with supplier info
      await conn.query(
        'UPDATE service_requests SET status = ?, supplier_id = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, supplier_id, req.params.id]
      );
    } else {
      newStatus = 'Rejected';
      await conn.query(
        'UPDATE service_requests SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, rejection_reason || null, req.params.id]
      );
    }
    
    await conn.commit();

    // Get PR details for notification
    const srData = srs[0];

    if (status === 'approved') {
      // Procurement approved - notify Super Admin for final approval
      const superAdmins = await getSuperAdmins();
      for (const adminId of superAdmins) {
        await createNotification(
          adminId,
          'SR Pending Final Approval',
          `Service Request ${srData.sr_number} has been reviewed by Procurement and requires your final approval`,
          'PR Approved',
          req.params.id,
          'service_request'
        );
      }
    } else {
      // Rejected - notify engineer
      await createNotification(
        srData.requested_by,
        'Service Request Rejected by Procurement',
        `Your Service Request ${srData.sr_number} has been rejected by Procurement${rejection_reason ? ': ' + rejection_reason : ''}`,
        'PR Rejected',
        req.params.id,
        'service_request'
      );
    }

    // Emit real-time SR status update
    req.io.emit('sr_status_changed', {
      id: req.params.id,
      sr_number: srData.sr_number,
      status: newStatus,
      type: 'status_update',
      updated_by: 'procurement'
    });

    res.json({ message: `Service request ${status} by Procurement successfully`, status: newStatus });
  } catch (error) {
    if (conn) await conn.rollback();
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Procurement approval error:', error);
    res.status(500).json({ message: 'Failed to update service request: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Approve/Reject by Super Admin (Final Approval)
router.put('/:id/super-admin-approve', authenticate, requireSuperAdmin, async (req, res) => {
  let conn;
  try {
    const { status, rejection_reason, remarks } = req.body;
    
    conn = await db.getConnection();
    await conn.beginTransaction();
    
    const [srs] = await conn.query('SELECT * FROM service_requests WHERE id = ?', [req.params.id]);
    if (srs.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Service request not found' });
    }
    
    const sr = srs[0];
    
    if (sr.status !== 'For Super Admin Final Approval') {
      await conn.rollback();
      return res.status(400).json({ message: 'Service request not ready for Super Admin final approval' });
    }
    
    let newStatus;
    if (status === 'approved') {
      const scheduleCount = await getPaymentScheduleCount(conn, req.params.id);
      if (scheduleCount === 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'At least one payment schedule is required before approval.' });
      }
      newStatus = 'Approved';
      await conn.query(
        'UPDATE service_requests SET status = ?, approved_by = ?, approved_at = NOW(), remarks = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, req.user.id, remarks || null, req.params.id]
      );
    } else {
      newStatus = 'Rejected';
      await conn.query(
        'UPDATE service_requests SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, rejection_reason || null, req.params.id]
      );
    }
    
    await conn.commit();

    // Notify engineer
    if (status === 'approved') {
      await createNotification(
        sr.requested_by,
        'Service Request Fully Approved',
        `Your Service Request ${sr.sr_number} has been fully approved and is ready for PO creation`,
        'PR Approved',
        sr.id,
        'service_request'
      );
      
      // Also notify admins who can create POs
      const admins = await getAdmins();
      for (const adminId of admins) {
        await createNotification(
          adminId,
          'SR Ready for PO Creation',
          `Service Request ${sr.sr_number} has been approved and is ready for PO creation`,
          'PR Approved',
          sr.id,
          'service_request'
        );
      }
    } else {
      await createNotification(
        sr.requested_by,
        'Service Request Rejected',
        `Your Service Request ${sr.sr_number} has been rejected by Super Admin${rejection_reason ? ': ' + rejection_reason : ''}`,
        'PR Rejected',
        sr.id,
        'service_request'
      );
    }

    // Emit real-time SR status update
    req.io.emit('sr_status_changed', {
      id: req.params.id,
      sr_number: sr.sr_number,
      status: newStatus,
      type: 'status_update',
      updated_by: 'super_admin'
    });

    res.json({ message: `Service request ${status} successfully`, status: newStatus });
  } catch (error) {
    if (conn) await conn.rollback();
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Super Admin approval error:', error);
    res.status(500).json({ message: 'Failed to approve service request: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Mark Service Request as Received (requester only, fulfilled statuses only)
router.put('/:id/received', authenticate, async (req, res) => {
  try {
    const [srs] = await db.query('SELECT * FROM service_requests WHERE id = ?', [req.params.id]);
    if (srs.length === 0) {
      return res.status(404).json({ message: 'Service request not found' });
    }

    const sr = srs[0];

    if (sr.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can mark this service request as received' });
    }

    const allowedStatuses = ['PO Created', 'Payment Request Created', 'Payment Order Created', 'Paid'];
    if (!allowedStatuses.includes(sr.status)) {
      return res.status(400).json({
        message: 'Only fulfilled service requests can be marked as received'
      });
    }

    await db.query(
      'UPDATE service_requests SET status = ?, updated_at = NOW() WHERE id = ?',
      ['Received', req.params.id]
    );

    req.io.emit('sr_status_changed', {
      id: Number(req.params.id),
      sr_number: sr.sr_number,
      status: 'Received',
      type: 'status_update',
      updated_by: 'engineer'
    });

    res.json({ message: 'Service request marked as received successfully', status: 'Received' });
  } catch (error) {
    console.error('Mark service request received error:', error);
    res.status(500).json({ message: 'Failed to mark service request as received' });
  }
});

// Delete Service Request (Draft only, engineer only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const [srs] = await db.query('SELECT * FROM service_requests WHERE id = ?', [req.params.id]);
    if (srs.length === 0) {
      return res.status(404).json({ message: 'Service request not found' });
    }

    const sr = srs[0];

    // Only the original requester can delete
    if (sr.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can delete this service request' });
    }

    // Only draft SRs can be deleted
    if (sr.status !== 'Draft') {
      return res.status(400).json({ message: 'Only draft service requests can be deleted' });
    }

    await db.query('DELETE FROM service_requests WHERE id = ?', [req.params.id]);

    res.json({ message: 'Service request deleted successfully' });
  } catch (error) {
    console.error('Delete service request error:', error);
    res.status(500).json({ message: 'Failed to delete service request: ' + error.message });
  }
});

// Export Service Request to Excel
router.get('/:id/export', authenticate, async (req, res) => {
  try {
    // Fetch service request with supplier details
    const [srs] = await db.query(`
      SELECT sr.*, 
             e.first_name as requester_first_name, 
             e.last_name as requester_last_name,
             s.supplier_name, s.contact_person, s.phone, s.email, s.address as supplier_address,
             approver.first_name as approver_first_name,
             approver.last_name as approver_last_name
      FROM service_requests sr
      JOIN employees e ON sr.requested_by = e.id
      LEFT JOIN suppliers s ON sr.supplier_id = s.id
      LEFT JOIN employees approver ON sr.approved_by = approver.id
      WHERE sr.id = ?
    `, [req.params.id]);

    if (srs.length === 0) {
      return res.status(404).json({ message: 'Service request not found' });
    }

    const sr = srs[0];

    // Fetch payment schedules for this service request
    const [paymentSchedules] = await db.query(
      'SELECT * FROM service_request_payment_schedules WHERE service_request_id = ? ORDER BY payment_date',
      [req.params.id]
    );

    // Create Excel workbook from template
    const workbook = new ExcelJS.Workbook();
    const templatePath = resolveExcelTemplatePath('Service Request.xlsx');

    let worksheet;
    try {
      await workbook.xlsx.readFile(templatePath);
      worksheet = workbook.worksheets?.[0] || workbook.getWorksheet('SERVICE REQUEST') || workbook.getWorksheet(1);
    } catch (templateError) {
      worksheet = workbook.addWorksheet('Service Request');
    }

    // Helper function to set cell value
    const setCellValue = (address, value) => {
      const cell = worksheet.getCell(address);
      cell.value = value;
      return cell;
    };

    // Fill in header fields based on template layout
    // Left side
    setCellValue('C6', sr.supplier_name || '');
    setCellValue('C7', sr.project || '');
    setCellValue('C8', sr.project_address || '');
    setCellValue('C9', sr.order_number || '');

    // Right side
    setCellValue('H6', new Date(sr.created_at).toLocaleDateString());
    setCellValue('H7', sr.date_needed ? new Date(sr.date_needed).toLocaleDateString() : '');
    setCellValue('H8', sr.payment_term || '');

    // SR Number in header (cell G5)
    setCellValue('G5', sr.sr_number || '');

    // Items table - Service Request has quantity, unit, description, amount
    let currentRow = 11;
    let totalAmount = 0;

    const quantity = parseFloat(sr.quantity) || 0;
    const amount = parseFloat(sr.amount) || 0;
    totalAmount = amount;

    // Fill in the service line item
    setCellValue(`A${currentRow}`, quantity);
    setCellValue(`B${currentRow}`, sr.unit || 'hours');
    // Set purpose with black font - set font BEFORE value to override template
    const purposeCell = worksheet.getCell(`D${currentRow}`);
    purposeCell.font = { name: 'Arial', size: 10, color: { argb: '000000' }, bold: false };
    purposeCell.value = sr.purpose || sr.description || '';
    setCellValue(`H${currentRow}`, amount);

    // Add payment terms and schedules below the item
    currentRow++; // Move to next row after the item
    
    // Helper to format date
    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    };

    // Add "*** NOTHING FOLLOWS ***" marker
    const nothingFollowsRow = currentRow;
    // Set font BEFORE value to override template styling
    const nothingFollowsCell = worksheet.getCell(`D${currentRow}`);
    nothingFollowsCell.font = { name: 'Arial', size: 10, color: { argb: '000000' }, bold: false };
    nothingFollowsCell.value = '*** NOTHING FOLLOWS ***';
    currentRow++;

    // Add payment terms note if exists
    const paymentTermsNote = String(sr.payment_terms_note || '').trim();
    if (paymentTermsNote) {
      const noteCell = worksheet.getCell(`A${currentRow}`);
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
        const scheduleCell = worksheet.getCell(`A${currentRow}`);
        scheduleCell.font = { name: 'Arial', size: 10, color: { argb: '000000' }, bold: false };
        scheduleCell.value = line;
        currentRow++;
      });
    }

    // Grand Total - keep at row 21 or adjust if needed
    setCellValue('G21', totalAmount);

    // Prepared by, Reviewed by, Approved by - row 26
    const preparedByName = `${sr.requester_first_name || ''} ${sr.requester_last_name || ''}`.trim().toUpperCase();
    worksheet.getCell('A26').value = preparedByName;
    worksheet.getCell('D26').value = 'JUNELL B. TADINA'; // Reviewed by
    worksheet.getCell('F26').value = 'MARC JUSTIN E. ARZADON'; // Approved by

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Service_Request_${sr.sr_number || req.params.id}.xlsx`);
    res.send(buffer);

  } catch (error) {
    console.error('Failed to export service request', error);
    res.status(500).json({ message: 'Failed to export service request: ' + error.message });
  }
});

export default router;
