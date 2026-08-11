import express from 'express';
import { authenticate, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import db from '../config/database.js';
import { createNotification, getSuperAdmins } from '../utils/notifications.js';
import ExcelJS from 'exceljs';
import { resolveExcelTemplatePath } from '../utils/excelTemplatePath.js';
import { assertProjectIsActive } from '../utils/branchProjects.js';
import { assertOrderNumberUnlocked } from '../utils/orderNumberLocks.js';

const router = express.Router();
const PAYMENT_TERM_LABELS = {
  CASH: 'CASH',
  COD: 'COD',
  NET_7: 'NET 7',
  NET_15: 'NET 15',
  NET_30: 'NET 30',
  CUSTOM: 'CUSTOM'
};

const resolveInheritedPaymentTerm = (code, note) => {
  const normalizedNote = String(note || '').trim();
  if (normalizedNote) return normalizedNote;

  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return null;
  return PAYMENT_TERM_LABELS[normalizedCode] || normalizedCode.replace(/_/g, ' ');
};

const getPaymentRequestSourceMeta = async (conn, paymentRequest, includeSchedules = false) => {
  if (!paymentRequest) {
    return {
      source_type: null,
      source_number: null,
      payment_terms_code: null,
      payment_terms_note: null,
      payment_term: null,
      payment_schedule_source_type: null,
      payment_schedule_count: 0,
      next_payment_date: null,
      payment_schedules: []
    };
  }

  if (paymentRequest.purchase_request_id) {
    const [rows] = await conn.query(
      `SELECT pr_number, payment_terms_code, payment_terms_note
       FROM purchase_requests
       WHERE id = ?`,
      [paymentRequest.purchase_request_id]
    );
    const sourceRow = rows[0] || {};
    let paymentSchedules = [];

    if (includeSchedules) {
      const [scheduleRows] = await conn.query(
        `SELECT id, DATE_FORMAT(payment_date, '%Y-%m-%d') AS payment_date, amount, note
         FROM purchase_request_payment_schedules
         WHERE purchase_request_id = ?
         ORDER BY payment_date ASC`,
        [paymentRequest.purchase_request_id]
      );
      paymentSchedules = scheduleRows;
    }

    return {
      source_type: 'purchase_request',
      source_number: sourceRow.pr_number || null,
      payment_terms_code: sourceRow.payment_terms_code || null,
      payment_terms_note: sourceRow.payment_terms_note || null,
      payment_term: resolveInheritedPaymentTerm(sourceRow.payment_terms_code, sourceRow.payment_terms_note),
      payment_schedule_source_type: 'pr',
      payment_schedule_count: includeSchedules ? paymentSchedules.length : null,
      next_payment_date: includeSchedules ? (paymentSchedules[0]?.payment_date || null) : null,
      payment_schedules: paymentSchedules
    };
  }

  if (paymentRequest.service_request_id) {
    const [rows] = await conn.query(
      `SELECT sr_number, payment_terms_note
       FROM service_requests
       WHERE id = ?`,
      [paymentRequest.service_request_id]
    );
    const sourceRow = rows[0] || {};
    let paymentSchedules = [];

    if (includeSchedules) {
      const [scheduleRows] = await conn.query(
        `SELECT id, DATE_FORMAT(payment_date, '%Y-%m-%d') AS payment_date, amount, note
         FROM service_request_payment_schedules
         WHERE service_request_id = ?
         ORDER BY payment_date ASC`,
        [paymentRequest.service_request_id]
      );
      paymentSchedules = scheduleRows;
    }

    return {
      source_type: 'service_request',
      source_number: sourceRow.sr_number || null,
      payment_terms_code: null,
      payment_terms_note: sourceRow.payment_terms_note || null,
      payment_term: resolveInheritedPaymentTerm(null, sourceRow.payment_terms_note),
      payment_schedule_source_type: 'sr',
      payment_schedule_count: includeSchedules ? paymentSchedules.length : null,
      next_payment_date: includeSchedules ? (paymentSchedules[0]?.payment_date || null) : null,
      payment_schedules: paymentSchedules
    };
  }

  if (paymentRequest.cash_request_id) {
    const [rows] = await conn.query(
      `SELECT cr_number, payment_terms_note
       FROM cash_requests
       WHERE id = ?`,
      [paymentRequest.cash_request_id]
    );
    const sourceRow = rows[0] || {};
    let paymentSchedules = [];

    if (includeSchedules) {
      const [scheduleRows] = await conn.query(
        `SELECT id, DATE_FORMAT(payment_date, '%Y-%m-%d') AS payment_date, amount, note
         FROM cash_request_payment_schedules
         WHERE cash_request_id = ?
         ORDER BY payment_date ASC`,
        [paymentRequest.cash_request_id]
      );
      paymentSchedules = scheduleRows;
    }

    return {
      source_type: 'cash_request',
      source_number: sourceRow.cr_number || null,
      payment_terms_code: null,
      payment_terms_note: sourceRow.payment_terms_note || null,
      payment_term: resolveInheritedPaymentTerm(null, sourceRow.payment_terms_note),
      payment_schedule_source_type: 'cr',
      payment_schedule_count: includeSchedules ? paymentSchedules.length : null,
      next_payment_date: includeSchedules ? (paymentSchedules[0]?.payment_date || null) : null,
      payment_schedules: paymentSchedules
    };
  }

  return {
    source_type: null,
    source_number: null,
    payment_terms_code: null,
    payment_terms_note: null,
    payment_term: null,
    payment_schedule_source_type: null,
    payment_schedule_count: 0,
    next_payment_date: null,
    payment_schedules: []
  };
};

// Get all Payment Requests
router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
    const offset = (page - 1) * pageSize;

    let query = `
      SELECT pr.*, 
             p.pr_number as original_pr_number,
             sr.sr_number as original_sr_number,
             e.first_name as prepared_by_first_name,
             e.last_name as prepared_by_last_name
      FROM payment_requests pr
      LEFT JOIN purchase_requests p ON pr.purchase_request_id = p.id
      LEFT JOIN service_requests sr ON pr.service_request_id = sr.id
      LEFT JOIN employees e ON pr.requested_by = e.id
    `;
    
    const params = [];
    
    if (req.user.role === 'engineer') {
      query += ' WHERE pr.requested_by = ?';
      params.push(req.user.id);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM payment_requests pr
      ${req.user.role === 'engineer' ? 'WHERE pr.requested_by = ?' : ''}
    `;
    const countParams = [];
    if (req.user.role === 'engineer') {
      countParams.push(req.user.id);
    }
    
    query += ' ORDER BY pr.created_at DESC LIMIT ? OFFSET ?';
    
    const [paymentRequests] = await db.query(query, [...params, pageSize, offset]);
    const [countRows] = await db.query(countQuery, countParams);

    const enrichedPaymentRequests = await Promise.all(
      paymentRequests.map(async (paymentRequest) => {
        const inherited = await getPaymentRequestSourceMeta(db, paymentRequest, true);
        return {
          ...paymentRequest,
          ...inherited,
          payment_schedule_count: inherited.payment_schedule_count ?? 0,
          next_payment_date: inherited.next_payment_date || null
        };
      })
    );

    res.json({ paymentRequests: enrichedPaymentRequests, page, pageSize, total: countRows?.[0]?.total ?? 0 });
  } catch (error) {
    console.error('Failed to fetch payment requests', error);
    res.status(500).json({ message: 'Failed to fetch payment requests' });
  }
});

// Get single Payment Request with items
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [paymentRequests] = await db.query(`
      SELECT pr.*, 
             p.pr_number as original_pr_number,
             sr.sr_number as original_sr_number,
             cr.cr_number as original_cr_number,
             e.first_name as requested_by_first_name,
             e.last_name as requested_by_last_name,
             e2.first_name as approved_by_first_name,
             e2.last_name as approved_by_last_name
      FROM payment_requests pr
      LEFT JOIN purchase_requests p ON pr.purchase_request_id = p.id
      LEFT JOIN service_requests sr ON pr.service_request_id = sr.id
      LEFT JOIN cash_requests cr ON pr.cash_request_id = cr.id
      LEFT JOIN employees e ON pr.requested_by = e.id
      LEFT JOIN employees e2 ON pr.approved_by = e2.id
      WHERE pr.id = ?
    `, [req.params.id]);

    if (paymentRequests.length === 0) {
      return res.status(404).json({ message: 'Payment request not found' });
    }

    const [items] = await db.query(`
      SELECT pri.*, i.item_name as item_name, i.unit
      FROM payment_request_items pri
      LEFT JOIN items i ON pri.item_id = i.id
      WHERE pri.payment_request_id = ?
    `, [req.params.id]);

    const inherited = await getPaymentRequestSourceMeta(db, paymentRequests[0], true);

    res.json({
      paymentRequest: {
        ...paymentRequests[0],
        ...inherited,
        items
      }
    });
  } catch (error) {
    console.error('Failed to fetch payment request', error);
    res.status(500).json({ message: 'Failed to fetch payment request' });
  }
});

// Create Payment Request (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { purchase_request_id, service_request_id, cash_request_id, payee_name, payee_address, purpose, project, project_address, order_number, amount, remarks, items } = req.body;
    
    // Validate that at least one source is provided
    if (!purchase_request_id && !service_request_id && !cash_request_id) {
      return res.status(400).json({ message: 'Either Purchase Request ID, Service Request ID, or Cash Request ID is required' });
    }
    
    // Validate that only one source is provided at a time
    const sourceCount = [purchase_request_id, service_request_id, cash_request_id].filter(Boolean).length;
    if (sourceCount > 1) {
      return res.status(400).json({ message: 'Only one source (Purchase Request, Service Request, or Cash Request) can be provided at a time' });
    }
    
    let sourcePurpose = purpose || '';
    let sourceRequestedBy = null;
    
    // If PR source, validate PR
    if (purchase_request_id) {
      const [prs] = await db.query(
        `SELECT pr_number, payment_basis, requested_by, purpose, payment_terms_code, payment_terms_note, project, order_number
         FROM purchase_requests
         WHERE id = ?`,
        [purchase_request_id]
      );
      if (prs.length === 0) {
        return res.status(404).json({ message: 'Purchase request not found' });
      }
      const prDetails = prs[0];
      
      // Only allow non_debt PRs to become payment requests
      if (prDetails.payment_basis !== 'non_debt') {
        return res.status(400).json({ message: 'Only PRs without account can create payment requests' });
      }

      const hasTermsCode = Boolean(String(prDetails.payment_terms_code || '').trim());
      const hasTermsNote = Boolean(String(prDetails.payment_terms_note || '').trim());
      if (!hasTermsCode && !hasTermsNote) {
        return res.status(400).json({
          message: 'Set Payment Terms in PR approval before creating Payment Request.'
        });
      }
      if (hasTermsCode && String(prDetails.payment_terms_code).toUpperCase() === 'CUSTOM' && !hasTermsNote) {
        return res.status(400).json({
          message: 'Payment Terms on PR are incomplete. Set Payment Terms in PR approval before creating Payment Request.'
        });
      }
      await assertProjectIsActive(prDetails.project || project, {
        providedOrderNumber: prDetails.order_number || order_number
      });
      sourcePurpose = prDetails.purpose || sourcePurpose;
      sourceRequestedBy = prDetails.requested_by;
    }
    
    // If SR source, validate SR
    if (service_request_id) {
      const [srs] = await db.query(
        'SELECT sr_number, requested_by, purpose, status, service_type, project, order_number FROM service_requests WHERE id = ?',
        [service_request_id]
      );
      if (srs.length === 0) {
        return res.status(404).json({ message: 'Service request not found' });
      }
      const srDetails = srs[0];
      
      // Only allow approved SRs with service_type = 'Service' to become payment requests
      if (srDetails.status !== 'Approved') {
        return res.status(400).json({ message: 'Only approved Service Requests can create payment requests' });
      }
      if (srDetails.service_type !== 'Service') {
        return res.status(400).json({ message: 'Only Service Requests with service_type = Service can create payment requests' });
      }
      await assertProjectIsActive(srDetails.project || project, {
        providedOrderNumber: srDetails.order_number || order_number
      });
      sourcePurpose = srDetails.purpose || sourcePurpose;
      sourceRequestedBy = srDetails.requested_by;
    }
    
    // If CR source, validate CR
    if (cash_request_id) {
      const [crs] = await db.query(
        'SELECT cr_number, requested_by, purpose, status, cr_type, amount, supplier_id, supplier_name, project, order_number FROM cash_requests WHERE id = ?',
        [cash_request_id]
      );
      if (crs.length === 0) {
        return res.status(404).json({ message: 'Cash request not found' });
      }
      const crDetails = crs[0];
      
      // Only allow approved CRs with cr_type = 'payment_request' to become payment requests
      if (crDetails.status !== 'Approved') {
        return res.status(400).json({ message: 'Only approved Cash Requests can create payment requests' });
      }
      if (crDetails.cr_type !== 'payment_request') {
        return res.status(400).json({ message: 'Only Cash Requests with cr_type = payment_request can create payment requests' });
      }
      await assertProjectIsActive(crDetails.project || project, {
        providedOrderNumber: crDetails.order_number || order_number
      });
      sourcePurpose = crDetails.purpose || sourcePurpose;
      sourceRequestedBy = crDetails.requested_by;
    }
    
    // Generate Payment Request number only for PR-based requests
    let prNumber = null;
    if (purchase_request_id) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const initials = 'MTN';
      
      const [countResult] = await db.query(
        "SELECT COUNT(*) as count FROM payment_requests WHERE pr_number LIKE ?",
        [`${initials}-${year}-${month}-%`]
      );
      const sequence = String(countResult[0].count + 1).padStart(3, '0');
      prNumber = `${initials}-${year}-${month}-${sequence}`;
    }

    // Calculate total amount if not provided
    const totalAmount = amount || items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Get status from request body, default to 'Pending'
      const paymentStatus = req.body.status || 'Pending';
      
      // Validate status is valid
      const validStatuses = ['Draft', 'Pending', 'For Approval', 'Approved', 'Rejected', 'On Hold', 'Cancelled'];
      if (!validStatuses.includes(paymentStatus)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: 'Invalid status value' });
      }

      // Create payment request
      const [paymentResult] = await connection.query(
        `INSERT INTO payment_requests 
         (pr_number, purchase_request_id, service_request_id, payee_name, payee_address, purpose, project, project_address, order_number, amount, status, requested_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          prNumber,
          purchase_request_id || null,
          service_request_id || null,
          payee_name || null,
          payee_address || null,
          purpose || sourcePurpose,
          project || null,
          project_address || null,
          order_number || null,
          totalAmount,
          paymentStatus,
          req.user.id
        ]
      );

      const paymentRequestId = paymentResult.insertId;

      // Add payment request items if provided
      if (items && items.length > 0) {
        for (const item of items) {
          await connection.query(
            `INSERT INTO payment_request_items 
             (payment_request_id, item_id, quantity, unit_price)
             VALUES (?, ?, ?, ?)`,
            [
              paymentRequestId,
              item.item_id,
              item.quantity,
              item.unit_price || 0
            ]
          );
        }
      }

      // Update purchase request status to 'Payment Request Created' if not draft
      if (paymentStatus !== 'Draft' && purchase_request_id) {
        await connection.query(
          'UPDATE purchase_requests SET status = ?, updated_at = NOW() WHERE id = ?',
          ['Payment Request Created', purchase_request_id]
        );
      }

      // Update service request status to 'Payment Request Created' if not draft
      if (paymentStatus !== 'Draft' && service_request_id) {
        await connection.query(
          'UPDATE service_requests SET status = ?, updated_at = NOW() WHERE id = ?',
          ['Payment Request Created', service_request_id]
        );
      }

      // Update cash request status to 'Payment Request Created' if not draft
      if (paymentStatus !== 'Draft' && cash_request_id) {
        await connection.query(
          'UPDATE cash_requests SET status = ?, updated_at = NOW() WHERE id = ?',
          ['Payment Request Created', cash_request_id]
        );
      }

      await connection.commit();
      connection.release();

      res.status(201).json({ 
        id: paymentRequestId,
        message: `Payment request created successfully with status: ${paymentStatus}`,
        status: paymentStatus
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Failed to create payment request', error);
    res.status(error.statusCode || 500).json({ message: 'Failed to create payment request: ' + error.message });
  }
});

// Approve/Reject Payment Request (super admin only)
router.put('/:id/approve', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { status, rejection_reason } = req.body;
    console.log('DEBUG: Approve endpoint called');
    console.log('DEBUG: Request body:', req.body);
    console.log('DEBUG: Payment request ID:', req.params.id);
    console.log('DEBUG: User:', req.user);
    
    const normalizedStatus = status?.toLowerCase() === 'approved' ? 'Approved' : status?.toLowerCase() === 'rejected' ? 'Rejected' : status;
    console.log('DEBUG: Original status:', status);
    console.log('DEBUG: Normalized status:', normalizedStatus);

    const [paymentRequests] = await db.query('SELECT * FROM payment_requests WHERE id = ?', [req.params.id]);
    console.log('DEBUG: Found payment requests:', paymentRequests.length);
    
    if (paymentRequests.length === 0) {
      console.log('DEBUG: Payment request not found');
      return res.status(404).json({ message: 'Payment request not found' });
    }
    await assertOrderNumberUnlocked(paymentRequests[0].order_number, 'approval');

    const currentStatus = paymentRequests[0].status;
    console.log('DEBUG: Current payment request status:', currentStatus);
    console.log('DEBUG: Required statuses: Draft, Pending, For Approval, On Hold');
    
    if (currentStatus !== 'Draft' && currentStatus !== 'Pending' && currentStatus !== 'For Approval' && currentStatus !== 'On Hold') {
      console.log('DEBUG: Status check failed - returning 400');
      return res.status(400).json({ message: 'Payment request not ready for approval' });
    }

    console.log('DEBUG: Status check passed');
    
    if (normalizedStatus !== 'Approved' && normalizedStatus !== 'Rejected') {
      console.log('DEBUG: Invalid normalized status - returning 400');
      return res.status(400).json({ message: 'Invalid status. Allowed values: Approved, Rejected' });
    }

    console.log('DEBUG: Normalized status check passed');

    const updateData = {
      status: normalizedStatus,
      approved_by: req.user.id,
      approved_at: new Date(),
      rejection_reason: normalizedStatus === 'Rejected' ? rejection_reason : null
    };

    await db.query(
      'UPDATE payment_requests SET status = ?, approved_by = ?, approved_at = ?, rejection_reason = ? WHERE id = ?',
      [updateData.status, updateData.approved_by, updateData.approved_at, updateData.rejection_reason, req.params.id]
    );

    // If approved, update the related PR to Completed
    if (normalizedStatus === 'Approved') {
      await db.query(
        "UPDATE purchase_requests SET status = 'Completed' WHERE id = ?",
        [paymentRequests[0].purchase_request_id]
      );
      
      // Notify requester
      await createNotification(
        paymentRequests[0].requested_by,
        'Payment Request Approved',
        `Your Payment Request ${paymentRequests[0].pr_number} has been approved`,
        'Payment Request Approved',
        req.params.id,
        'payment_request'
      );
    } else if (normalizedStatus === 'Rejected') {
      // Update PR status back to 'For Purchase'
      await db.query(
        "UPDATE purchase_requests SET status = 'For Purchase' WHERE id = ?",
        [paymentRequests[0].purchase_request_id]
      );
      
      // Notify requester
      await createNotification(
        paymentRequests[0].requested_by,
        'Payment Request Rejected',
        `Your Payment Request ${paymentRequests[0].pr_number} has been rejected. Reason: ${rejection_reason || 'No reason provided'}`,
        'Payment Request Rejected',
        req.params.id,
        'payment_request'
      );
    }

    res.json({ message: `Payment request ${normalizedStatus.toLowerCase()} successfully`, status: normalizedStatus });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Failed to approve payment request', error);
    res.status(500).json({ message: 'Failed to approve payment request' });
  }
});

// Update Payment Request status (admin only)
router.put('/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    // Get current payment request to check its status and get PR id
    const [paymentRequests] = await db.query(
      'SELECT purchase_request_id, status, order_number FROM payment_requests WHERE id = ?',
      [req.params.id]
    );
    
    if (paymentRequests.length === 0) {
      return res.status(404).json({ message: 'Payment request not found' });
    }
    await assertOrderNumberUnlocked(paymentRequests[0].order_number, 'status update');
    
    const currentStatus = paymentRequests[0].status;
    const purchaseRequestId = paymentRequests[0].purchase_request_id;
    
    await db.query(
      'UPDATE payment_requests SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, req.params.id]
    );
    
    // If changing from Draft to Pending, also update PR status to 'Payment Request Created'
    if (currentStatus === 'Draft' && status === 'Pending' && purchaseRequestId) {
      await db.query(
        'UPDATE purchase_requests SET status = ?, updated_at = NOW() WHERE id = ?',
        ['Payment Request Created', purchaseRequestId]
      );
    }

    res.json({ message: 'Payment request status updated successfully' });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to update payment request status' });
  }
});

// Export Payment Request to Excel
router.get('/:id/export', authenticate, async (req, res) => {
  try {
    // Fetch payment request with PR details (if any)
    const [paymentRequests] = await db.query(
      `SELECT pr.*, prr.pr_number as pr_pr_number, sr.sr_number, cr.cr_number, e.first_name, e.last_name 
       FROM payment_requests pr
       LEFT JOIN purchase_requests prr ON pr.purchase_request_id = prr.id
       LEFT JOIN service_requests sr ON pr.service_request_id = sr.id
       LEFT JOIN cash_requests cr ON pr.cash_request_id = cr.id
       LEFT JOIN employees e ON pr.requested_by = e.id
       WHERE pr.id = ?`,
      [req.params.id]
    );

    if (paymentRequests.length === 0) {
      return res.status(404).json({ message: 'Payment request not found' });
    }

    const paymentRequest = paymentRequests[0];
    const inherited = await getPaymentRequestSourceMeta(db, paymentRequest, true);

    // If payment request is from Service Request, fetch SR details
    let srNumber = null;
    let srDetails = null;
    if (paymentRequest.service_request_id) {
      const [srs] = await db.query(
        'SELECT sr_number, description, quantity, unit, amount FROM service_requests WHERE id = ?',
        [paymentRequest.service_request_id]
      );
      if (srs.length > 0) {
        srNumber = srs[0].sr_number;
        srDetails = srs[0];
      }
    }

    // Use PR number if available, otherwise use SR number
    const sourceNumber = paymentRequest.pr_pr_number || paymentRequest.sr_number || paymentRequest.cr_number || srNumber || '';

    // Fetch payment request items
    const [items] = await db.query(
      `SELECT pri.*, i.item_name, i.unit as item_unit
       FROM payment_request_items pri
       JOIN items i ON pri.item_id = i.id
       WHERE pri.payment_request_id = ?`,
      [req.params.id]
    );

    // Create Excel workbook from template (preserves formatting)
    const workbook = new ExcelJS.Workbook();
    const templatePath = resolveExcelTemplatePath('Payment-Request.xlsx');

    let worksheet;
    try {
      await workbook.xlsx.readFile(templatePath);
      worksheet = workbook.worksheets?.[0] || workbook.getWorksheet('PAYMENT REQUEST') || workbook.getWorksheet(1);
    } catch (templateError) {
      worksheet = workbook.addWorksheet('Payment Request');
    }

    // Fill in header fields (cell mapping based on provided template)
    // Left side
    worksheet.getCell('C6').value = paymentRequest.payee_name || '';
    worksheet.getCell('C7').value = paymentRequest.project || '';
    worksheet.getCell('C8').value = paymentRequest.project_address || '';
    worksheet.getCell('C9').value = paymentRequest.order_number || '';

    // Right side
    worksheet.getCell('H6').value = new Date(paymentRequest.created_at).toLocaleDateString();
    worksheet.getCell('H7').value = sourceNumber;

    // Items table
    let currentRow = 12;
    let totalAmount = 0;

    const setCellValue = (address, value) => {
      const cell = worksheet.getCell(address);
      const target = cell?.isMerged ? cell.master : cell;
      target.value = value;
      return target;
    };

    if (items && items.length > 0) {
      items.forEach((item) => {
        const quantity = parseFloat(item.quantity) || 0;
        const unitPrice = parseFloat(item.unit_price) || 0;
        const amount = quantity * unitPrice;
        totalAmount += amount;

        // Template columns (based on template layout):
        // QTY: A, UNIT: B, DESCRIPTION: D, UNIT COST: F, AMOUNT: H
        // Use merged-cell-safe setter so values show even when cells are merged.
        setCellValue(`A${currentRow}`, quantity);
        setCellValue(`B${currentRow}`, item.item_unit || 'pcs');
        setCellValue(`D${currentRow}`, item.item_name || '');
        setCellValue(`F${currentRow}`, unitPrice);
        setCellValue(`H${currentRow}`, amount);

        currentRow++;
      });
    } else if (srDetails) {
      // For Service Request-sourced payment requests, show SR details as a line item
      const quantity = parseFloat(srDetails.quantity) || 0;
      const unitPrice = parseFloat(srDetails.amount) / (quantity || 1);
      const amount = parseFloat(srDetails.amount) || 0;
      totalAmount = amount;

      setCellValue(`A${currentRow}`, quantity);
      setCellValue(`B${currentRow}`, srDetails.unit || 'hours');
      setCellValue(`D${currentRow}`, srDetails.description || '');
      setCellValue(`F${currentRow}`, unitPrice);
      setCellValue(`H${currentRow}`, amount);
    }

    // Total - use calculated total from items, or payment request amount if no items
    const finalTotal = totalAmount > 0 ? totalAmount : (parseFloat(paymentRequest.amount) || 0);
    const totalCell = setCellValue('G21', finalTotal);
    totalCell.numFmt = '#,##0.00';

    let notesRow = currentRow + 1;
    const exportNoteLines = [];
    if (inherited.payment_term) {
      exportNoteLines.push(`Payment Terms: ${inherited.payment_term}`);
    }
    if (Array.isArray(inherited.payment_schedules) && inherited.payment_schedules.length > 0) {
      const today = new Date();
      const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const firstUpcomingOrToday = inherited.payment_schedules.find((schedule) => schedule.payment_date >= todayYmd);
      const targetSchedule = firstUpcomingOrToday || inherited.payment_schedules[inherited.payment_schedules.length - 1];
      if (targetSchedule?.payment_date) {
        const amountNumber = Number(targetSchedule.amount);
        const amountSuffix = Number.isFinite(amountNumber)
          ? ` | Amount: ${amountNumber.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : '';
        exportNoteLines.push(`Next Payment: ${targetSchedule.payment_date}${amountSuffix}`);
      }
    }
    exportNoteLines.forEach((line) => {
      setCellValue(`C${notesRow}`, line);
      notesRow += 1;
    });

    // Prepared by
    const preparedByName = `${paymentRequest.first_name || ''} ${paymentRequest.last_name || ''}`.trim().toUpperCase();
    setCellValue('A25', preparedByName);

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Payment_Request_${sourceNumber || req.params.id}.xlsx`);
    res.send(buffer);

  } catch (error) {
    console.error('Failed to export payment request', error);
    res.status(500).json({ message: 'Failed to export payment request' });
  }
});

// Delete Payment Request (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const [paymentRequests] = await db.query('SELECT purchase_request_id FROM payment_requests WHERE id = ?', [req.params.id]);
    if (paymentRequests.length === 0) {
      return res.status(404).json({ message: 'Payment request not found' });
    }

    // Delete items first (cascade should handle this, but being explicit)
    await db.query('DELETE FROM payment_request_items WHERE payment_request_id = ?', [req.params.id]);
    
    // Delete payment request
    await db.query('DELETE FROM payment_requests WHERE id = ?', [req.params.id]);

    // Revert PR status back to 'For Purchase'
    if (paymentRequests[0].purchase_request_id) {
      await db.query(
        "UPDATE purchase_requests SET status = 'For Purchase' WHERE id = ?",
        [paymentRequests[0].purchase_request_id]
      );
    }

    res.json({ message: 'Payment request deleted successfully' });
  } catch (error) {
    console.error('Failed to delete payment request', error);
    res.status(500).json({ message: 'Failed to delete payment request' });
  }
});

export default router;
