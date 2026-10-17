import express from 'express';
import db from '../config/database.js';
import { authenticate, requireAdmin, requireSuperAdmin, authorize } from '../middleware/auth.js';
import ExcelJS from 'exceljs';
import fs from 'fs';
import { resolveExcelTemplatePath } from '../utils/excelTemplatePath.js';
import { assertProjectIsActive } from '../utils/branchProjects.js';
import { assertOrderNumberUnlocked } from '../utils/orderNumberLocks.js';

import { transaction } from '../services/requestWorkflow.js';
import { restorePaymentSource } from '../services/paymentSourceRestoration.js';
import { fail, lineCents, moneyCents } from '../utils/requestWorkflowRules.js';

const router = express.Router();

// Generate PO Number
const generatePONumber = async (connection = db) => {
  const prefix = 'PO';
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  const [result] = await connection.query(
    `SELECT po_number FROM payment_orders 
     WHERE po_number LIKE ? 
     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
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

const engineerPaymentOrderScope = `(
  po.requested_by = ?
  OR EXISTS (SELECT 1 FROM service_requests source_sr WHERE source_sr.id = po.service_request_id AND source_sr.requested_by = ?)
  OR EXISTS (SELECT 1 FROM cash_requests source_cr WHERE source_cr.id = po.cash_request_id AND source_cr.requested_by = ?)
)`;

const canEngineerViewPaymentOrder = async (paymentOrderId, engineerId) => {
  const [rows] = await db.query(
    `SELECT 1 FROM payment_orders po WHERE po.id = ? AND ${engineerPaymentOrderScope} LIMIT 1`,
    [paymentOrderId, engineerId, engineerId, engineerId]
  );
  return rows.length > 0;
};

// Get All Payment Orders
router.get('/', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT po.*, 
             sr.sr_number,
             e.first_name, e.last_name,
             COALESCE(sr.date_needed, cr.date_needed, r.date_needed) as date_needed
      FROM payment_orders po
      LEFT JOIN service_requests sr ON po.service_request_id = sr.id
      LEFT JOIN cash_requests cr ON po.cash_request_id = cr.id
      LEFT JOIN reimbursements r ON po.reimbursement_id = r.id
      LEFT JOIN employees e ON po.requested_by = e.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status && status !== 'all') {
      query += ' AND po.status = ?';
      params.push(status);
    }

    if (req.user.role === 'engineer') {
      query += ` AND ${engineerPaymentOrderScope}`;
      params.push(req.user.id, req.user.id, req.user.id);
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
    if (req.user.role === 'engineer' && !(await canEngineerViewPaymentOrder(req.params.id, req.user.id))) {
      return res.status(403).json({ message: 'Not authorized to view this payment order' });
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

// Create Payment Order from an eligible source request
router.post('/', authenticate, authorize('engineer', 'admin', 'senior_project_manager', 'ceo', 'super_admin'), async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const { service_request_id, cash_request_id, reimbursement_id, payee_name, payee_address, purpose, project, project_address, order_number, remarks } = req.body;
    if (!String(payee_name || '').trim()) throw fail('Payee name is required');
    
    // Validate that at least one source is provided
    const sourceCount = [service_request_id, cash_request_id, reimbursement_id].filter(Boolean).length;
    if (sourceCount === 0) {
      return res.status(400).json({ message: 'Either Service Request ID, Cash Request ID, or Reimbursement ID is required' });
    }
    
    // Validate that only one source is provided
    if (sourceCount > 1) {
      return res.status(400).json({ message: 'Cannot provide multiple sources. Only one of Service Request, Cash Request, or Reimbursement is allowed' });
    }
    
    const sourceTable=service_request_id?'service_requests':cash_request_id?'cash_requests':'reimbursements';
    const sourceId=service_request_id||cash_request_id||reimbursement_id;
    const [sourceRows]=await conn.query('SELECT * FROM '+sourceTable+' WHERE id=? FOR UPDATE',[sourceId]);
    const source=sourceRows[0];
    if(!source)throw fail('Source request not found',404);
    const column=service_request_id?'service_request_id':cash_request_id?'cash_request_id':'reimbursement_id';
    const [duplicates]=await conn.query('SELECT id FROM payment_orders WHERE '+column+"=? AND status NOT IN ('Cancelled','Rejected') LIMIT 1",[sourceId]);
    if(duplicates.length)throw fail('This source already has an active Payment Order',409);
    const sourceAmount=(sourceTable==='reimbursements'?moneyCents(source.amount):lineCents(source.amount,source.quantity??1))/100;
    if(!Number.isFinite(sourceAmount)||sourceAmount<=0)throw fail('Source total must be positive');
    let sourcePurpose = '';
    let sourceRequestedBy = null;
    
    // If SR source, validate SR
    if (service_request_id) {
      const [srs] = await conn.query(
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
      const [crs] = await conn.query(
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
      const [reimbursements] = await conn.query(
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

    if (req.user.role === 'engineer' && Number(sourceRequestedBy) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'Engineers can create payment orders only from their own approved requests' });
    }
    
    const [numberLock] = await conn.query("SELECT GET_LOCK('procurement_payment_order_number',5) AS acquired");
    if (!numberLock[0].acquired) throw fail('Payment order numbering is busy; retry shortly',409);
    const poNumber = await generatePONumber(conn);
    
    const [result] = await conn.query(
      `INSERT INTO payment_orders 
       (po_number, service_request_id, cash_request_id, reimbursement_id, payee_name, payee_address, purpose, project, project_address, order_number, amount, status, remarks, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        poNumber,
        service_request_id || null,
        cash_request_id || null,
        reimbursement_id || null,
        payee_name || null,
        payee_address || null,
        purpose || sourcePurpose,
        project || null,
        project_address || null,
        order_number || null,
        sourceAmount,
        'Pending',
        remarks || null,
        req.user.id
      ]
    );
    
    // Update Service Request status to 'Payment Order Created'
    if (service_request_id) {
      await conn.query(
        'UPDATE service_requests SET status = ?, updated_at = NOW() WHERE id = ?',
        ['Payment Order Created', service_request_id]
      );
    }
    
    // Update Cash Request status to 'Payment Order Created'
    if (cash_request_id) {
      await conn.query(
        'UPDATE cash_requests SET status = ?, updated_at = NOW() WHERE id = ?',
        ['Payment Order Created', cash_request_id]
      );
    }
    
    // Update Reimbursement status to 'Payment Order Created'
    if (reimbursement_id) {
      await conn.query(
        'UPDATE reimbursements SET status = ?, updated_at = NOW() WHERE id = ?',
        ['Payment Order Created', reimbursement_id]
      );
    }
    
    await conn.commit();
    res.status(201).json({ 
      id: result.insertId, 
      po_number: poNumber,
      message: 'Payment Order created successfully' 
    });
  } catch (error) {
    if(conn)await conn.rollback();
    console.error('Error creating payment order:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Failed to create payment order' });
  } finally { if(conn){await conn.rollback();await conn.query("SELECT RELEASE_LOCK('procurement_payment_order_number')").catch(()=>{});conn.release();} }
});

// Update Payment Order Status
router.patch('/:id/status', authenticate, requireAdmin, async (req,res)=>{
  try {
    await transaction(async conn => {
      const [rows] = await conn.query('SELECT * FROM payment_orders WHERE id=? FOR UPDATE', [req.params.id]);
      if (!rows.length) throw fail('Payment order not found', 404);
      if (!['Draft','Pending','For Admin Approval'].includes(rows[0].status) || req.body.status !== 'For Super Admin Final Approval') {
        throw fail('Use the Payment Order review action; this status transition is not allowed', 409);
      }
      await assertOrderNumberUnlocked(rows[0].order_number, 'submission');
      await conn.query('UPDATE payment_orders SET status=?,updated_at=NOW() WHERE id=?', [req.body.status,req.params.id]);
    });
    res.json({message:'Payment order submitted for final review'});
  } catch(error) { res.status(error.statusCode||500).json({message:error.statusCode?error.message:'Failed to submit payment order'}); }
});

// Super Admin Approve Payment Order
router.patch('/:id/super-admin-approve', authenticate, requireSuperAdmin, async (req,res)=>{
  try {
    const status=await transaction(async conn=>{
      const [rows]=await conn.query('SELECT * FROM payment_orders WHERE id=? FOR UPDATE',[req.params.id]);
      if(!rows.length)throw fail('Payment order not found',404);
      if(!['Pending','For Admin Approval','For Super Admin Final Approval','On Hold'].includes(rows[0].status))throw fail('Payment order is not awaiting review',409);
      const mapped={approved:'Approved',rejected:'Rejected',hold:'On Hold'}[req.body.status];
      if(!mapped)throw fail('Invalid review decision');
      await assertOrderNumberUnlocked(rows[0].order_number,'approval');
      await conn.query('UPDATE payment_orders SET status=?,updated_at=NOW() WHERE id=?',[mapped,req.params.id]);
      if(mapped==='Rejected')await restorePaymentSource(conn,rows[0],'payment_orders',req.params.id);
      return mapped;
    });
    res.json({message:'Payment order reviewed successfully',status});
  }catch(error){res.status(error.statusCode||500).json({message:error.statusCode?error.message:'Failed to review payment order'});}
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
    if (req.user.role === 'engineer' && !(await canEngineerViewPaymentOrder(req.params.id, req.user.id))) {
      return res.status(403).json({ message: 'Not authorized to export this payment order' });
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
router.delete('/:id', authenticate, requireAdmin, async(req,res)=>{
  try {
    await transaction(async conn=>{
      const [rows]=await conn.query('SELECT * FROM payment_orders WHERE id=? FOR UPDATE',[req.params.id]);
      if(!rows.length)throw fail('Payment order not found',404);
      const payment=rows[0];
      if(!['Draft','Pending'].includes(payment.status))throw fail('Only Draft or Pending payment orders may be deleted',409);
      await assertOrderNumberUnlocked(payment.order_number,'deletion');
      const [links]=await conn.query('SELECT id FROM disbursement_vouchers WHERE payment_order_id=? LIMIT 1',[payment.id]);
      if(links.length)throw fail('Payment order has voucher history and cannot be deleted',409);
      await conn.query('INSERT INTO system_audit_logs (user_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?)',[req.user.id,'Payment Order Deleted','payment_orders',payment.id,JSON.stringify(payment)]);
      await conn.query('DELETE FROM payment_orders WHERE id=?',[payment.id]);
      await restorePaymentSource(conn,payment,'payment_orders',payment.id);
    });
    res.json({message:'Payment order deleted successfully'});
  }catch(error){res.status(error.statusCode||500).json({message:error.statusCode?error.message:'Failed to delete payment order'});}
});

export default router;
