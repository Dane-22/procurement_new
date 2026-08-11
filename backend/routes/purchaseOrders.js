import express from 'express';
import { authenticate, requireAdmin, requireSuperAdmin, requireAdminOnly } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import db from '../config/database.js';
import { createNotification, getSuperAdmins } from '../utils/notifications.js';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { resolveExcelTemplatePath } from '../utils/excelTemplatePath.js';
import { assertProjectIsActive } from '../utils/branchProjects.js';
import { assertOrderNumberUnlocked } from '../utils/orderNumberLocks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const PAYMENT_TERM_LABELS = {
  CASH: 'CASH',
  COD: 'COD',
  NET_7: 'NET 7',
  NET_15: 'NET 15',
  NET_30: 'NET 30',
  CUSTOM: 'CUSTOM'
};

const resolvePaymentTermFromPR = (code, note) => {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return null;
  if (normalizedCode === 'CUSTOM') {
    const normalizedNote = note == null ? '' : String(note).trim();
    return normalizedNote || null;
  }
  return PAYMENT_TERM_LABELS[normalizedCode] || normalizedCode;
};

const getNextPoNumbers = async (conn, prefix, countNeeded) => {
  if (!countNeeded || countNeeded <= 0) return [];

  // Lock the latest row for this prefix inside the transaction to reduce collisions.
  const [lastRows] = await conn.query(
    `SELECT po_number
     FROM purchase_orders
     WHERE po_number LIKE ?
     ORDER BY po_number DESC
     LIMIT 1
     FOR UPDATE`,
    [`${prefix}%`]
  );

  let counter = 1;
  if (lastRows.length > 0) {
    const match = String(lastRows[0].po_number || '').match(/-(\d{3})$/);
    if (match) counter = Number(match[1]) + 1;
  }

  const results = [];
  for (let index = 0; index < countNeeded; index += 1) {
    results.push(`${prefix}${String(counter + index).padStart(3, '0')}`);
  }
  return results;
};

// Get all POs
router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
    const offset = (page - 1) * pageSize;

    let query = `
      SELECT po.*, 
             s.supplier_name as supplier_name,
             pr.pr_number,
             sr.sr_number,
             COALESCE(pr.pr_number, sr.sr_number) as source_number,
             e.first_name as prepared_by_first_name,
             e.last_name as prepared_by_last_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN purchase_requests pr ON po.purchase_request_id = pr.id
      LEFT JOIN service_requests sr ON po.service_request_id = sr.id
      LEFT JOIN employees e ON po.prepared_by = e.id
    `;
    
    const params = [];
    
    if (req.user.role === 'engineer') {
      query += ' WHERE (pr.requested_by = ? OR sr.requested_by = ?)';
      params.push(req.user.id, req.user.id);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM purchase_orders po
      LEFT JOIN purchase_requests pr ON po.purchase_request_id = pr.id
      LEFT JOIN service_requests sr ON po.service_request_id = sr.id
      ${req.user.role === 'engineer' ? 'WHERE (pr.requested_by = ? OR sr.requested_by = ?)' : ''}
    `;
    const countParams = [];
    if (req.user.role === 'engineer') {
      countParams.push(req.user.id, req.user.id);
    }
    
    query += ' ORDER BY po.created_at DESC LIMIT ? OFFSET ?';
    
    const [pos] = await db.query(query, [...params, pageSize, offset]);
    const [countRows] = await db.query(countQuery, countParams);

    res.json({ purchaseOrders: pos, page, pageSize, total: countRows?.[0]?.total ?? 0 });
  } catch (error) {
    console.error('Failed to fetch purchase orders', error);
    res.status(500).json({ message: 'Failed to fetch purchase orders' });
  }
});

// Get single PO with items
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [pos] = await db.query(`
      SELECT po.*, 
             s.supplier_name as supplier_name, s.address as supplier_address, s.contact_person, s.phone, s.email,
             pr.pr_number, pr.remarks as pr_remarks,
             sr.sr_number,
             COALESCE(pr.pr_number, sr.sr_number) as source_number,
             e.first_name as prepared_by_first_name,
             e.last_name as prepared_by_last_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN purchase_requests pr ON po.purchase_request_id = pr.id
      LEFT JOIN service_requests sr ON po.service_request_id = sr.id
      LEFT JOIN employees e ON po.prepared_by = e.id
      WHERE po.id = ?
    `, [req.params.id]);

    if (pos.length === 0) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    const [items] = await db.query(`
      SELECT poi.*, i.item_name as item_name, i.unit
      FROM purchase_order_items poi
      JOIN items i ON poi.item_id = i.id
      WHERE poi.purchase_order_id = ?
    `, [req.params.id]);

    // Get attachments for this PO
    const [attachments] = await db.query(`
      SELECT pa.*, e.first_name as uploaded_by_first_name, e.last_name as uploaded_by_last_name
      FROM po_attachments pa
      LEFT JOIN employees e ON pa.uploaded_by = e.id
      WHERE pa.purchase_order_id = ?
      ORDER BY pa.uploaded_at DESC
    `, [req.params.id]);

    res.json({ purchaseOrder: { ...pos[0], items, attachments } });
  } catch (error) {
    console.error('Failed to fetch purchase order', error);
    res.status(500).json({ message: 'Failed to fetch purchase order' });
  }
});

// Create PO (admin only)
router.post('/', authenticate, requireAdminOnly, async (req, res) => {
  let conn;
  try {
    const { purchase_request_id, supplier_id, expected_delivery_date, place_of_delivery, project, delivery_term, payment_term, notes, items, service_request_id, save_as_draft } = req.body;
    const hasPRSource = Boolean(purchase_request_id);
    const hasSRSource = Boolean(service_request_id);

    if ((hasPRSource && hasSRSource) || (!hasPRSource && !hasSRSource)) {
      return res.status(400).json({ message: 'Provide exactly one source: purchase_request_id or service_request_id' });
    }

    const rawItems = Array.isArray(items) ? items : [];
    if (hasPRSource && rawItems.length === 0) {
      return res.status(400).json({ message: 'At least one item is required for Purchase Request source' });
    }

    const normalizedItems = rawItems.map((item, index) => {
      const itemId = Number(item.item_id);
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unit_price);
      const prItemId = item.purchase_request_item_id ? Number(item.purchase_request_item_id) : null;

      return {
        index,
        item_id: Number.isInteger(itemId) && itemId > 0 ? itemId : null,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : null,
        unit_price: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : null,
        purchase_request_item_id: Number.isInteger(prItemId) && prItemId > 0 ? prItemId : null
      };
    });

    if (normalizedItems.length > 0) {
      const invalidItem = normalizedItems.find(
        (item) => item.item_id === null || item.quantity === null || item.unit_price === null
      );
      if (invalidItem) {
        return res.status(400).json({
          message: `Invalid item on row ${invalidItem.index + 1}. Item ID, quantity (> 0), and unit price (>= 0) are required.`
        });
      }
    }
    
    // Determine status based on save_as_draft flag
    const status = save_as_draft ? 'Draft' : 'Pending Approval';
    
    // Check if creating from PR or Service Request
    let prDetails = null;
    let srDetails = null;
    let poType = 'purchase_order'; // default
    let finalSupplierId = supplier_id;
    let sourceOrderNumber = null;
    let effectivePaymentTerm = payment_term || 'CASH';
    
    if (hasPRSource) {
      // Get PR details including payment_basis
      const [prs] = await db.query(
        `SELECT pr_number, payment_basis, supplier_id as pr_supplier_id, order_number, project,
                payment_terms_code, payment_terms_note
         FROM purchase_requests
         WHERE id = ?`,
        [purchase_request_id]
      );
      if (prs.length === 0) {
        return res.status(404).json({ message: 'Purchase request not found' });
      }
      prDetails = prs[0];
      
      // Reject non_debt PRs - they must use payment-requests endpoint
      if (prDetails.payment_basis === 'non_debt') {
        return res.status(400).json({ 
          message: 'PRs without account must use /api/payment-requests endpoint',
          redirectTo: '/api/payment-requests'
        });
      }

      const hasTermsCode = Boolean(String(prDetails.payment_terms_code || '').trim());
      const hasTermsNote = Boolean(String(prDetails.payment_terms_note || '').trim());

      if (!hasTermsCode && !hasTermsNote) {
        return res.status(400).json({
          message: 'Set Payment Terms in PR approval before creating Purchase Order.'
        });
      }

      const fallbackTermsCode = hasTermsCode ? prDetails.payment_terms_code : 'CUSTOM';
      const resolvedPRPaymentTerm = resolvePaymentTermFromPR(fallbackTermsCode, prDetails.payment_terms_note);

      if (!resolvedPRPaymentTerm) {
        return res.status(400).json({
          message: 'Payment Terms on PR are incomplete. Set Payment Terms in PR approval before creating Purchase Order.'
        });
      }
      effectivePaymentTerm = resolvedPRPaymentTerm;
      
      // Use supplier from PR if engineer selected one
      if (!finalSupplierId && prDetails.pr_supplier_id) {
        finalSupplierId = prDetails.pr_supplier_id;
      }
      sourceOrderNumber = prDetails.order_number || null;
    } else if (hasSRSource) {
      // Service Requests always create Payment Orders
      const [srs] = await db.query(
        'SELECT sr_number, supplier_id as sr_supplier_id, order_number, amount, project FROM service_requests WHERE id = ?',
        [service_request_id]
      );
      if (srs.length === 0) {
        return res.status(404).json({ message: 'Service request not found' });
      }
      srDetails = srs[0];
      poType = 'payment_order';
      if (!finalSupplierId && srDetails.sr_supplier_id) {
        finalSupplierId = srDetails.sr_supplier_id;
      }
      sourceOrderNumber = srDetails.order_number || null;
    }
    
    // Validate supplier is provided
    if (!finalSupplierId) {
      return res.status(400).json({ message: 'Supplier is required' });
    }

    if (!sourceOrderNumber || !String(sourceOrderNumber).trim()) {
      return res.status(400).json({
        message: 'Selected source has no order number. Update the source document first.'
      });
    }

    const sourceProject = hasPRSource ? prDetails?.project : srDetails?.project;
    await assertProjectIsActive(sourceProject || project, {
      providedOrderNumber: sourceOrderNumber
    });
    await assertOrderNumberUnlocked(sourceOrderNumber, 'purchase order creation');
    
    conn = await db.getConnection();
    await conn.beginTransaction();

    // Generate PO number prefix (MTN-YYYY-MM-)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const [userResult] = await conn.query('SELECT first_name, last_name FROM employees WHERE id = ? LIMIT 1', [req.user.id]);
    const user = userResult[0] || {};
    const initials = (user.first_name?.[0] || 'M') + (user.last_name?.[0] || 'T') + 'N';
    const prefix = `${initials}-${year}-${month}-`;

    // Calculate total amount (based on items for PR; based on SR amount for SR source)
    const totalAmount = hasSRSource && normalizedItems.length === 0
      ? Number(srDetails?.amount || 0)
      : normalizedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    const [poNumber] = await getNextPoNumbers(conn, prefix, 1);

    const [poResult] = await conn.query(
      `INSERT INTO purchase_orders
       (po_number, purchase_request_id, service_request_id, supplier_id, prepared_by, total_amount, po_date, expected_delivery_date, place_of_delivery, project, order_number, delivery_term, payment_term, notes, status, po_type,
        parent_po_id, installment_schedule_id, scheduled_payment_date, scheduled_amount)
       VALUES (?, ?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)`,
      [
        poNumber,
        purchase_request_id || null,
        service_request_id || null,
        finalSupplierId,
        req.user.id,
        totalAmount,
        expected_delivery_date || null,
        place_of_delivery || null,
        project || null,
        sourceOrderNumber,
        delivery_term || 'COD',
        effectivePaymentTerm,
        notes || null,
        status,
        poType
      ]
    );

    const poId = poResult.insertId;

    for (const item of normalizedItems) {
      await conn.query(
        'INSERT INTO purchase_order_items (purchase_order_id, purchase_request_item_id, item_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
        [poId, item.purchase_request_item_id || null, item.item_id, item.quantity, item.unit_price, item.quantity * item.unit_price]
      );
    }

    if (hasPRSource) {
      await conn.query(
        "UPDATE purchase_requests SET status = 'PO Created' WHERE id = ?",
        [purchase_request_id]
      );
    } else if (hasSRSource) {
      await conn.query(
        "UPDATE service_requests SET status = 'PO Created' WHERE id = ?",
        [service_request_id]
      );
    }

    await conn.commit();

    // Notify Super Admins that a new PO needs approval (only if not a draft)
    if (!save_as_draft) {
      const superAdmins = await getSuperAdmins();
      for (const adminId of superAdmins) {
        await createNotification(
          adminId,
          'New PO Pending Approval',
          `Purchase Order ${poNumber} has been created and requires your approval`,
          'PO Created',
          poId,
          'purchase_order'
        );
      }
    }

    const message = save_as_draft
      ? `${poType === 'payment_order' ? 'Payment Request' : 'Purchase Order'} saved as draft`
      : `${poType === 'payment_order' ? 'Payment Request' : 'Purchase Order'} created successfully and is pending approval`;

    res.status(201).json({
      message,
      poId,
      poNumber,
      installment_po_ids: [],
      po_type: poType,
      status,
      create_mode: 'single'
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
    }
    console.error('Failed to create purchase order', error);
    res.status(500).json({ message: 'Failed to create purchase order' });
  } finally {
    if (conn) conn.release();
  }
});

// Approve/Reject PO (super admin only)
router.put('/:id/super-admin-approve', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { status } = req.body; // 'approved' | 'hold'

    const [pos] = await db.query(
      'SELECT status, order_number, parent_po_id, purchase_request_id FROM purchase_orders WHERE id = ?',
      [req.params.id]
    );
    if (pos.length === 0) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    await assertOrderNumberUnlocked(pos[0].order_number, 'approval');

    const currentStatus = pos[0].status;
    if (currentStatus !== 'Draft' && currentStatus !== 'On Hold' && currentStatus !== 'Pending Approval') {
      return res.status(400).json({ message: 'Purchase order not ready for Super Admin approval' });
    }

    if (status !== 'approved' && status !== 'hold') {
      return res.status(400).json({ message: 'Invalid status. Allowed values: approved, hold' });
    }

    const newStatus = status === 'approved' ? 'Approved' : 'On Hold';

    await db.query(
      'UPDATE purchase_orders SET status = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, req.params.id]
    );

    const isMasterPo = pos[0].parent_po_id == null;

    // Propagate status to installment POs if this is a master PO.
    if (isMasterPo) {
      await db.query(
        `UPDATE purchase_orders
         SET status = ?, updated_at = NOW()
         WHERE parent_po_id = ? AND status IN ('Draft','Pending Approval','On Hold')`,
        [newStatus, req.params.id]
      );
    }

    // If master PO is approved, update the related PR to Completed (installment approvals should not).
    if (status === 'approved' && isMasterPo && pos[0].purchase_request_id) {
      await db.query(
        "UPDATE purchase_requests SET status = 'Completed' WHERE id = ?",
        [pos[0].purchase_request_id]
      );

      const [pr] = await db.query(
        'SELECT pr_number, requested_by FROM purchase_requests WHERE id = ?',
        [pos[0].purchase_request_id]
      );
      if (pr.length > 0) {
        await createNotification(
          pr[0].requested_by,
          'PO Approved - Order Placed',
          `Your Purchase Order has been approved and placed. Related PR: ${pr[0].pr_number}`,
          'PO Created',
          req.params.id,
          'purchase_order'
        );
      }
    }

    res.json({ message: `Purchase order ${status} successfully`, status: newStatus });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Failed to approve purchase order', error);
    res.status(500).json({ message: 'Failed to approve purchase order' });
  }
});

// Update PO status (admin only)
router.put('/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body; // 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'
    const [pos] = await db.query('SELECT order_number FROM purchase_orders WHERE id = ?', [req.params.id]);
    if (pos.length === 0) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    await assertOrderNumberUnlocked(pos[0].order_number, 'status update');
    
    await db.query(
      'UPDATE purchase_orders SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, req.params.id]
    );

    res.json({ message: 'Purchase order status updated successfully' });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to update purchase order status' });
  }
});

// Export PO to Excel
router.get('/:id/export', authenticate, async (req, res) => {
  try {
    // Get PO details with supplier and PR info
    const [pos] = await db.query(`
      SELECT po.*, 
             s.supplier_name, s.address as supplier_address,
             pr.pr_number,
             e.first_name as prepared_by_first_name,
             e.last_name as prepared_by_last_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN purchase_requests pr ON po.purchase_request_id = pr.id
      LEFT JOIN employees e ON po.prepared_by = e.id
      WHERE po.id = ?
    `, [req.params.id]);

    if (pos.length === 0) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    const po = pos[0];

    // Get PO items
    const [items] = await db.query(`
      SELECT poi.*, i.item_name, i.item_code, i.unit
      FROM purchase_order_items poi
      JOIN items i ON poi.item_id = i.id
      WHERE poi.purchase_order_id = ?
    `, [req.params.id]);

    // Load template workbook
    const templatePath = resolveExcelTemplatePath('PO 2026.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const worksheet = workbook.getWorksheet(1);

    // Format date helper
    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    };

    // Fill PO number (G5)
    worksheet.getCell('G5').value = po.po_number || '';

    // Fill supplier name (B5)
    worksheet.getCell('B5').value = po.supplier_name || '';

    // Fill supplier address (B6)
    worksheet.getCell('B6').value = po.supplier_address || '';

    // Fill date (G6) - po_date
    worksheet.getCell('G6').value = formatDate(po.po_date);

    // Fill project (B8)
    worksheet.getCell('B8').value = po.project || '';

    // Fill order number (G8)
    worksheet.getCell('G8').value = po.order_number || '';

    // Fill place of delivery (B9)
    worksheet.getCell('B9').value = po.place_of_delivery || '';

    // Fill delivery term (G9)
    worksheet.getCell('G9').value = po.delivery_term || 'COD';

    // Fill date of delivery (B10) - expected_delivery_date
    worksheet.getCell('B10').value = formatDate(po.expected_delivery_date);

    // Fill payment term (G10)
    worksheet.getCell('G10').value = po.payment_term || 'CASH';

    // Fill items starting from row 12
    let rowNum = 12;
    items.forEach((item, index) => {
      const row = worksheet.getRow(rowNum);
      row.getCell(1).value = item.quantity; // A - QTY
      row.getCell(2).value = item.unit; // B - UNIT
      // Description spans C-E, set to C
      row.getCell(3).value = item.item_name || item.item_code; // C - DESCRIPTION (spans to E)
      row.getCell(6).value = parseFloat(item.unit_price) || 0; // F - UNIT COST
      row.getCell(7).value = parseFloat(item.total_price) || 0; // G - AMOUNT
      rowNum++;
    });

    // Fill purchase total (G29)
    worksheet.getCell('G29').value = po.total_amount || 0;

    // Generate filename
    const filename = `PO-${po.po_number}-${Date.now()}.xlsx`;

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Export PO error:', error);
    res.status(500).json({ message: 'Failed to export purchase order: ' + error.message });
  }
});

// Resubmit rejected PO (admin)
router.put('/:id/resubmit', authenticate, requireAdmin, async (req, res) => {
  let conn;
  try {
    const { supplier_id, expected_delivery_date, place_of_delivery, project, delivery_term, payment_term, notes, items } = req.body;

    // Check if PO exists and is cancelled (rejected) or on hold
    const [pos] = await db.query('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
    if (pos.length === 0) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    const po = pos[0];

    // Only cancelled (rejected) or on-hold POs can be resubmitted
    if (po.status !== 'Cancelled' && po.status !== 'On Hold') {
      return res.status(400).json({ message: 'Only cancelled (rejected) or on-hold purchase orders can be resubmitted' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // Calculate new total amount if items provided
    let totalAmount = po.total_amount;
    if (items && items.length > 0) {
      totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

      // Delete existing items
      await conn.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [req.params.id]);

      // Insert new items
      for (const item of items) {
        await conn.query(
          'INSERT INTO purchase_order_items (purchase_order_id, purchase_request_item_id, item_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
          [req.params.id, item.purchase_request_item_id || null, item.item_id, item.quantity, item.unit_price, item.quantity * item.unit_price]
        );
      }
    }

    // Update PO details and reset status to Draft
    await conn.query(
      `UPDATE purchase_orders 
       SET supplier_id = ?, expected_delivery_date = ?, place_of_delivery = ?, 
           project = ?, delivery_term = ?, payment_term = ?, notes = ?,
           total_amount = ?, status = 'Draft', updated_at = NOW()
       WHERE id = ?`,
      [
        supplier_id || po.supplier_id,
        expected_delivery_date || po.expected_delivery_date,
        place_of_delivery || po.place_of_delivery,
        project || po.project,
        delivery_term || po.delivery_term || 'COD',
        payment_term || po.payment_term || 'CASH',
        notes ?? po.notes,
        totalAmount,
        req.params.id
      ]
    );

    await conn.commit();

    // Notify Super Admins about resubmitted PO
    const superAdmins = await getSuperAdmins();
    for (const adminId of superAdmins) {
      await createNotification(
        adminId,
        'PO Resubmitted - Pending Approval',
        `Purchase Order ${po.po_number} has been resubmitted and requires your approval`,
        'PO Created',
        po.id,
        'purchase_order'
      );
    }

    res.json({ message: 'Purchase order resubmitted successfully', status: 'Draft' });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
    }
    console.error('Resubmit PO error:', error);
    res.status(500).json({ message: 'Failed to resubmit purchase order: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Get all attachments for a PO
router.get('/:id/attachments', authenticate, async (req, res) => {
  try {
    // Check if PO exists
    const [pos] = await db.query('SELECT id FROM purchase_orders WHERE id = ?', [req.params.id]);
    if (pos.length === 0) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    const [attachments] = await db.query(`
      SELECT pa.*, e.first_name as uploaded_by_first_name, e.last_name as uploaded_by_last_name
      FROM po_attachments pa
      LEFT JOIN employees e ON pa.uploaded_by = e.id
      WHERE pa.purchase_order_id = ?
      ORDER BY pa.uploaded_at DESC
    `, [req.params.id]);

    res.json({ attachments });
  } catch (error) {
    console.error('Failed to fetch attachments', error);
    res.status(500).json({ message: 'Failed to fetch attachments' });
  }
});

// Upload attachment to a PO (admin or super admin only)
router.post('/:id/attachments', authenticate, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Check if PO exists
    const [pos] = await db.query('SELECT id, po_number FROM purchase_orders WHERE id = ?', [req.params.id]);
    if (pos.length === 0) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    // Save attachment record to database
    const [result] = await db.query(
      'INSERT INTO po_attachments (purchase_order_id, file_path, file_name, file_size, mime_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
      [
        req.params.id,
        `/uploads/receipts/${req.file.filename}`,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
        req.user.id
      ]
    );

    res.status(201).json({
      message: 'File uploaded successfully',
      attachment: {
        id: result.insertId,
        purchase_order_id: parseInt(req.params.id),
        file_path: `/uploads/receipts/${req.file.filename}`,
        file_name: req.file.originalname,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        uploaded_by: req.user.id,
        uploaded_at: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to upload attachment', error);
    res.status(500).json({ message: 'Failed to upload attachment' });
  }
});

// Delete attachment (admin or super admin only, or the uploader)
router.delete('/:id/attachments/:attachmentId', authenticate, async (req, res) => {
  try {
    // Check if attachment exists and get file info
    const [attachments] = await db.query(
      'SELECT * FROM po_attachments WHERE id = ? AND purchase_order_id = ?',
      [req.params.attachmentId, req.params.id]
    );

    if (attachments.length === 0) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    const attachment = attachments[0];

    // Check permissions - allow if user is admin, super admin, or the original uploader
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && attachment.uploaded_by !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this attachment' });
    }

    // Delete file from filesystem
    try {
      const uploadsDir = path.resolve(__dirname, '../uploads/receipts');
      const fileName = path.basename(attachment.file_path || '');
      const filePath = path.resolve(uploadsDir, fileName);

      // Verify file is within uploads directory
      if (!filePath.startsWith(uploadsDir)) {
        return res.status(400).json({ message: 'Invalid file path' });
      }

      await fs.unlink(filePath);
    } catch (err) {
      console.log('File may not exist on disk:', err.message);
    }

    // Delete record from database
    await db.query('DELETE FROM po_attachments WHERE id = ?', [req.params.attachmentId]);

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Failed to delete attachment', error);
    res.status(500).json({ message: 'Failed to delete attachment' });
  }
});

export default router;
