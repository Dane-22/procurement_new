import express from 'express';
import db from '../config/database.js';
import { authenticate, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import ExcelJS from 'exceljs';
import fs from 'fs';
import { resolveExcelTemplatePath } from '../utils/excelTemplatePath.js';
import { assertProjectIsActive } from '../utils/branchProjects.js';
import { assertOrderNumberUnlocked } from '../utils/orderNumberLocks.js';

const router = express.Router();

// Generate PO Number
const generatePONumber = async () => {
  const prefix = 'PO';
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  const [result] = await db.query(
    `SELECT po_number FROM payment_orders 
     WHERE po_number LIKE ? 
     ORDER BY id DESC LIMIT 1`,
    [`${prefix}-${year}-${month}-%`]
  );
  
  let sequence = 1;
  if (result.length > 0) {
    const lastNumber = result[0].po_number;
    const lastSequence = parseInt(lastNumber.split('-').pop());
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }
  
  return `${prefix}-${year}-${month}-${String(sequence).padStart(3, '0')}`;
};

// Get All Payment Orders
router.get('/', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT po.*, 
             sr.sr_number,
             e.first_name, e.last_name
      FROM payment_orders po
      LEFT JOIN service_requests sr ON po.service_request_id = sr.id
      LEFT JOIN employees e ON po.requested_by = e.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status && status !== 'all') {
      query += ' AND po.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY po.created_at DESC';
    
    const [paymentOrders] = await db.query(query, params);
    res.json(paymentOrders);
  } catch (error) {
    console.error('Error fetching payment orders:', error);
    res.status(500).json({ message: 'Failed to fetch payment orders' });
  }
});

// Get Payment Order by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [paymentOrders] = await db.query(
      `SELECT po.*, 
              sr.sr_number,
              e.first_name, e.last_name
       FROM payment_orders po
       LEFT JOIN service_requests sr ON po.service_request_id = sr.id
       LEFT JOIN employees e ON po.requested_by = e.id
       WHERE po.id = ?`,
      [req.params.id]
    );
    
    if (paymentOrders.length === 0) {
      return res.status(404).json({ message: 'Payment order not found' });
    }
    await assertOrderNumberUnlocked(paymentOrders[0].order_number, 'status update');
    
    const paymentOrder = paymentOrders[0];
    console.log('DEBUG Payment Order:', { id: paymentOrder.id, service_request_id: paymentOrder.service_request_id, sr_number: paymentOrder.sr_number });
    
    res.json(paymentOrders[0]);
  } catch (error) {
    console.error('Error fetching payment order:', error);
    res.status(500).json({ message: 'Failed to fetch payment order' });
  }
});

// Create Payment Order (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { service_request_id, cash_request_id, reimbursement_id, payee_name, payee_address, purpose, project, project_address, order_number, amount, remarks } = req.body;
    
    // Validate that at least one source is provided
    const sourceCount = [service_request_id, cash_request_id, reimbursement_id].filter(Boolean).length;
    if (sourceCount === 0) {
      return res.status(400).json({ message: 'Either Service Request ID, Cash Request ID, or Reimbursement ID is required' });
    }
    
    // Validate that only one source is provided
    if (sourceCount > 1) {
      return res.status(400).json({ message: 'Cannot provide multiple sources. Only one of Service Request, Cash Request, or Reimbursement is allowed' });
    }
    
    let sourcePurpose = '';
    let sourceRequestedBy = null;
    
    // If SR source, validate SR
    if (service_request_id) {
      const [srs] = await db.query(
        'SELECT sr_number, requested_by, purpose, status, sr_type, project, order_number FROM service_requests WHERE id = ?',
        [service_request_id]
      );
      if (srs.length === 0) {
        return res.status(404).json({ message: 'Service request not found' });
      }
      const srDetails = srs[0];
      
      // Only allow approved SRs with sr_type = 'payment_order' (payment order type)
      if (srDetails.status !== 'Approved') {
        return res.status(400).json({ message: 'Only approved Service Requests can create payment orders' });
      }
      if (srDetails.sr_type !== 'payment_order') {
        return res.status(400).json({ message: 'Only Service Requests with sr_type = payment_order can create Payment Orders' });
      }
      await assertProjectIsActive(srDetails.project || project, {
        providedOrderNumber: srDetails.order_number || order_number
      });
      sourcePurpose = srDetails.purpose || '';
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
      
      // Only allow approved CRs with cr_type = 'payment_order' to become payment orders
      if (crDetails.status !== 'Approved') {
        return res.status(400).json({ message: 'Only approved Cash Requests can create payment orders' });
      }
      if (crDetails.cr_type !== 'payment_order') {
        return res.status(400).json({ message: 'Only Cash Requests with cr_type = payment_order can create Payment Orders' });
      }
      await assertProjectIsActive(crDetails.project || project, {
        providedOrderNumber: crDetails.order_number || order_number
      });
      sourcePurpose = crDetails.purpose || '';
      sourceRequestedBy = crDetails.requested_by;
    }
    
    // If Reimbursement source, validate Reimbursement
    if (reimbursement_id) {
      const [reimbursements] = await db.query(
        'SELECT id, rmb_number, requested_by, purpose, status, amount, payee, project, project_address, order_number FROM reimbursements WHERE id = ?',
        [reimbursement_id]
      );
      if (reimbursements.length === 0) {
        return res.status(404).json({ message: 'Reimbursement not found' });
      }
      const rmbDetails = reimbursements[0];
      
      // Only allow reimbursements with status = 'For Purchase' to become payment orders
      if (rmbDetails.status !== 'For Purchase') {
        return res.status(400).json({ message: 'Only reimbursements with status For Purchase can create Payment Orders' });
      }
      await assertProjectIsActive(rmbDetails.project || project, {
        providedOrderNumber: rmbDetails.order_number || order_number
      });
      sourcePurpose = rmbDetails.purpose || '';
      sourceRequestedBy = rmbDetails.requested_by;
    }
    
    const poNumber = await generatePONumber();
    
    const [result] = await db.query(
      `INSERT INTO payment_orders 
       (po_number, service_request_id, cash_request_id, payee_name, payee_address, purpose, project, project_address, order_number, amount, status, remarks, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        poNumber,
        service_request_id || null,
        cash_request_id || null,
        payee_name || null,
        payee_address || null,
        purpose || sourcePurpose,
        project || null,
        project_address || null,
        order_number || null,
        amount || 0,
        'Pending',
        remarks || null,
        req.user.id
      ]
    );
    
    // Update Service Request status to 'Payment Order Created'
    if (service_request_id) {
      await db.query(
        'UPDATE service_requests SET status = ?, updated_at = NOW() WHERE id = ?',
        ['Payment Order Created', service_request_id]
      );
    }
    
    // Update Cash Request status to 'Payment Order Created'
    if (cash_request_id) {
      await db.query(
        'UPDATE cash_requests SET status = ?, updated_at = NOW() WHERE id = ?',
        ['Payment Order Created', cash_request_id]
      );
    }
    
    // Update Reimbursement status to 'Payment Order Created'
    if (reimbursement_id) {
      await db.query(
        'UPDATE reimbursements SET status = ?, updated_at = NOW() WHERE id = ?',
        ['Payment Order Created', reimbursement_id]
      );
    }
    
    res.status(201).json({ 
      id: result.insertId, 
      po_number: poNumber,
      message: 'Payment Order created successfully' 
    });
  } catch (error) {
    console.error('Error creating payment order:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Failed to create payment order' });
  }
});

// Update Payment Order Status
router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const validStatuses = ['Draft', 'Pending', 'For Admin Approval', 'For Super Admin Final Approval', 'Approved', 'PO Created', 'On Hold', 'Rejected'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const [paymentOrders] = await db.query(
      'SELECT * FROM payment_orders WHERE id = ?',
      [req.params.id]
    );
    
    if (paymentOrders.length === 0) {
      return res.status(404).json({ message: 'Payment order not found' });
    }
    
    await db.query(
      'UPDATE payment_orders SET status = ?, remarks = ?, updated_at = NOW() WHERE id = ?',
      [status, remarks || null, req.params.id]
    );
    
    res.json({ message: 'Payment order status updated successfully' });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Error updating payment order status:', error);
    res.status(500).json({ message: 'Failed to update payment order status' });
  }
});

// Super Admin Approve Payment Order
router.patch('/:id/super-admin-approve', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['approved', 'rejected', 'hold'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be approved, rejected, or hold' });
    }
    
    const statusMap = {
      'approved': 'Approved',
      'rejected': 'Rejected',
      'hold': 'On Hold'
    };
    const newStatus = statusMap[status];
    
    const [paymentOrders] = await db.query(
      'SELECT * FROM payment_orders WHERE id = ?',
      [req.params.id]
    );
    
    if (paymentOrders.length === 0) {
      return res.status(404).json({ message: 'Payment order not found' });
    }
    await assertOrderNumberUnlocked(paymentOrders[0].order_number, 'approval');
    
    await db.query(
      'UPDATE payment_orders SET status = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, req.params.id]
    );
    
    res.json({ message: `Payment order ${status} successfully` });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Error super admin approving payment order:', error);
    res.status(500).json({ message: 'Failed to approve payment order' });
  }
});

// Export Payment Order to Excel
router.get('/:id/export', authenticate, async (req, res) => {
  try {
    const [paymentOrders] = await db.query(
      `SELECT po.*, sr.sr_number, sr.description, sr.quantity, sr.unit,
              e.first_name, e.last_name
       FROM payment_orders po
       LEFT JOIN service_requests sr ON po.service_request_id = sr.id
       LEFT JOIN employees e ON po.requested_by = e.id
       WHERE po.id = ?`,
      [req.params.id]
    );
    
    if (paymentOrders.length === 0) {
      return res.status(404).json({ message: 'Payment order not found' });
    }
    
    const paymentOrder = paymentOrders[0];
    
    const workbook = new ExcelJS.Workbook();
    
    // Load template
    const templatePath = resolveExcelTemplatePath('Payment Order.xlsx');
    
    let worksheet;
    try {
      await workbook.xlsx.readFile(templatePath);
      worksheet = workbook.worksheets?.[0] || workbook.getWorksheet('Payment Order') || workbook.getWorksheet(1);
    } catch (templateError) {
      worksheet = workbook.addWorksheet('Payment Order');
    }
    
    // Helper to safely set cell values
    const setCellValue = (cellRef, value) => {
      const cell = worksheet.getCell(cellRef);
      cell.value = value || '';
      return cell;
    };
    
    // Fill in data based on Payment Order template layout
    setCellValue('C6', paymentOrder.payee_name || '');
    setCellValue('C7', paymentOrder.project || '');
    setCellValue('C8', paymentOrder.project_address || '');
    setCellValue('C9', paymentOrder.remarks || '');
    setCellValue('C10', paymentOrder.order_number || '');
    
    // Right side
    setCellValue('H6', new Date(paymentOrder.created_at).toLocaleDateString());
    setCellValue('H7', paymentOrder.sr_number || '');
    setCellValue('H8', paymentOrder.payment_term || '');
    setCellValue('H10', paymentOrder.check_no || '');
    
    // Line item (row 12)
    const quantity = parseFloat(paymentOrder.quantity) || 0;
    const amount = parseFloat(paymentOrder.amount) || 0;
    
    setCellValue('A12', quantity);
    setCellValue('B12', paymentOrder.unit || 'hours');
    setCellValue('D12', paymentOrder.description || '');
    setCellValue('H12', amount);
    
    // Total (row 27)
    setCellValue('G27', amount);
    
    // Prepared by and Approved by (row 31)
    const preparedByName = `${paymentOrder.first_name || ''} ${paymentOrder.last_name || ''}`.trim().toUpperCase();
    setCellValue('A31', preparedByName);
    setCellValue('E31', 'MARC JUSTIN E. ARZADON');
    
    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Payment_Order_${paymentOrder.po_number || req.params.id}.xlsx`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Error exporting payment order:', error);
    res.status(500).json({ message: 'Failed to export payment order' });
  }
});

// Delete Payment Order
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const [paymentOrders] = await db.query(
      'SELECT * FROM payment_orders WHERE id = ?',
      [req.params.id]
    );
  } catch (error) {
    console.error('Error deleting payment order:', error);
    res.status(500).json({ message: 'Failed to delete payment order' });
  }
});

export default router;
