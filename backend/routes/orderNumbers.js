import express from 'express';
import db from '../config/database.js';
import { authenticate, requireProcurement } from '../middleware/auth.js';
import ExcelJS from 'exceljs';
import {
  getLockedOrderNumbers,
  getOrderNumberLock,
  lockOrderNumber,
  normalizeOrderNumber
} from '../utils/orderNumberLocks.js';

const router = express.Router();

// Get all order numbers with their project info
router.get('/', authenticate, async (req, res) => {
  try {
    // Get distinct order numbers from the 4 source tables with their project info
    // Using COLLATE to ensure consistent collation across all UNION operations
    const query = `
      SELECT DISTINCT 
        COALESCE(pr.order_number, sr.order_number, cr.order_number, rmb.order_number) as order_number,
        COALESCE(pr.project, sr.project, cr.project, rmb.project) as project,
        COALESCE(pr.project_address, sr.project_address, cr.project_address, rmb.project_address) as project_address
      FROM (
        SELECT 
          order_number COLLATE utf8mb4_unicode_ci as order_number,
          project COLLATE utf8mb4_unicode_ci as project,
          project_address COLLATE utf8mb4_unicode_ci as project_address
        FROM purchase_requests 
        WHERE order_number IS NOT NULL AND order_number != ''
        UNION
        SELECT 
          order_number COLLATE utf8mb4_unicode_ci,
          project COLLATE utf8mb4_unicode_ci,
          project_address COLLATE utf8mb4_unicode_ci
        FROM service_requests 
        WHERE order_number IS NOT NULL AND order_number != ''
        UNION
        SELECT 
          order_number COLLATE utf8mb4_unicode_ci,
          project COLLATE utf8mb4_unicode_ci,
          project_address COLLATE utf8mb4_unicode_ci
        FROM cash_requests 
        WHERE order_number IS NOT NULL AND order_number != ''
        UNION
        SELECT 
          order_number COLLATE utf8mb4_unicode_ci,
          project COLLATE utf8mb4_unicode_ci,
          NULL as project_address
        FROM purchase_orders 
        WHERE order_number IS NOT NULL AND order_number != ''
        UNION
        SELECT 
          order_number COLLATE utf8mb4_unicode_ci,
          project COLLATE utf8mb4_unicode_ci,
          NULL as project_address
        FROM payment_requests 
        WHERE order_number IS NOT NULL AND order_number != ''
        UNION
        SELECT 
          order_number COLLATE utf8mb4_unicode_ci,
          project COLLATE utf8mb4_unicode_ci,
          NULL as project_address
        FROM payment_orders 
        WHERE order_number IS NOT NULL AND order_number != ''
      ) as combined
      LEFT JOIN purchase_requests pr ON pr.order_number = combined.order_number COLLATE utf8mb4_unicode_ci AND pr.project = combined.project COLLATE utf8mb4_unicode_ci
      LEFT JOIN service_requests sr ON sr.order_number = combined.order_number COLLATE utf8mb4_unicode_ci AND sr.project = combined.project COLLATE utf8mb4_unicode_ci
      LEFT JOIN cash_requests cr ON cr.order_number = combined.order_number COLLATE utf8mb4_unicode_ci AND cr.project = combined.project COLLATE utf8mb4_unicode_ci
      LEFT JOIN reimbursements rmb ON rmb.order_number = combined.order_number COLLATE utf8mb4_unicode_ci AND rmb.project = combined.project COLLATE utf8mb4_unicode_ci
      ORDER BY order_number DESC
    `;
    
    const [orderNumbers] = await db.query(query);
    const lockedSet = await getLockedOrderNumbers(orderNumbers.map((row) => row.order_number));
    const withLockState = orderNumbers.map((row) => ({
      ...row,
      is_locked: lockedSet.has(normalizeOrderNumber(row.order_number))
    }));
    res.json(withLockState);
  } catch (error) {
    console.error('Error fetching order numbers:', error);
    res.status(500).json({ message: 'Failed to fetch order numbers' });
  }
});

// Get dashboard data for a specific order number
router.get('/dashboard/:orderNumber', authenticate, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { project } = req.query;

    // Build the WHERE clause
    let whereClause = 'WHERE order_number = ?';
    const params = [orderNumber];
    
    if (project && project !== 'all') {
      whereClause += ' AND project = ?';
      params.push(project);
    }

    // Get Purchase Requests data
    const [purchaseRequests] = await db.query(
      `SELECT 
        id, pr_number, purpose, project, project_address, 
        total_amount, status, created_at, approved_at
      FROM purchase_requests 
      ${whereClause} AND total_amount > 0
      ORDER BY created_at DESC`,
      params
    );

    // Get Service Requests data
    const [serviceRequests] = await db.query(
      `SELECT 
        id, sr_number, purpose, description, service_type, project, project_address,
        amount, status, created_at, approved_at
      FROM service_requests 
      ${whereClause} AND amount > 0
      ORDER BY created_at DESC`,
      params
    );

    // Get Cash Requests data
    const [cashRequests] = await db.query(
      `SELECT 
        id, cr_number, purpose, description, cr_type, project, project_address,
        amount, status, created_at, approved_at
      FROM cash_requests 
      ${whereClause} AND amount > 0
      ORDER BY created_at DESC`,
      params
    );

    // Get Reimbursements data
    const [reimbursements] = await db.query(
      `SELECT 
        id, rmb_number, purpose, payee, project, project_address,
        amount, status, created_at, approved_at
      FROM reimbursements 
      ${whereClause} AND amount > 0
      ORDER BY created_at DESC`,
      params
    );

    // Get Purchase Orders data (excluded from total actual cost)
    const [purchaseOrders] = await db.query(
      `SELECT 
        id, po_number, notes as purpose, project, NULL as project_address,
        total_amount as amount, status, created_at
      FROM purchase_orders 
      ${whereClause} AND total_amount > 0
      ORDER BY created_at DESC`,
      params
    );

    // Get Payment Requests data (excluded from total actual cost)
    const [paymentRequests] = await db.query(
      `SELECT 
        id, pr_number, purpose, payee_name as payee, project, project_address,
        amount, status, created_at
      FROM payment_requests 
      ${whereClause} AND amount > 0
      ORDER BY created_at DESC`,
      params
    );

    // Get Payment Orders data (excluded from total actual cost)
    const [paymentOrders] = await db.query(
      `SELECT 
        id, po_number, purpose, payee_name as payee, project, project_address,
        amount, status, created_at
      FROM payment_orders 
      ${whereClause} AND amount > 0
      ORDER BY created_at DESC`,
      params
    );

    // Calculate totals for original 4 types only (actual cost)
    const prTotal = purchaseRequests.reduce((sum, pr) => sum + parseFloat(pr.total_amount || 0), 0);
    const srTotal = serviceRequests.reduce((sum, sr) => sum + parseFloat(sr.amount || 0), 0);
    const crTotal = cashRequests.reduce((sum, cr) => sum + parseFloat(cr.amount || 0), 0);
    const rmbTotal = reimbursements.reduce((sum, rmb) => sum + parseFloat(rmb.amount || 0), 0);

    const totalActualCost = prTotal + srTotal + crTotal + rmbTotal;

    const poTotal = purchaseOrders.reduce((sum, po) => sum + parseFloat(po.amount || 0), 0);
    const pyreqTotal = paymentRequests.reduce((sum, pr) => sum + parseFloat(pr.amount || 0), 0);
    const pyordTotal = paymentOrders.reduce((sum, po) => sum + parseFloat(po.amount || 0), 0);

    // Get unique projects for this order number
    const projectsQuery = `
      SELECT DISTINCT project COLLATE utf8mb4_unicode_ci as project, project_address COLLATE utf8mb4_unicode_ci as project_address
      FROM (
        SELECT project COLLATE utf8mb4_unicode_ci as project, project_address COLLATE utf8mb4_unicode_ci as project_address 
        FROM purchase_requests 
        WHERE order_number = ? COLLATE utf8mb4_unicode_ci AND project IS NOT NULL
        UNION
        SELECT project COLLATE utf8mb4_unicode_ci, project_address COLLATE utf8mb4_unicode_ci 
        FROM service_requests 
        WHERE order_number = ? COLLATE utf8mb4_unicode_ci AND project IS NOT NULL
        UNION
        SELECT project COLLATE utf8mb4_unicode_ci, project_address COLLATE utf8mb4_unicode_ci 
        FROM cash_requests 
        WHERE order_number = ? COLLATE utf8mb4_unicode_ci AND project IS NOT NULL
        UNION
        SELECT project COLLATE utf8mb4_unicode_ci, project_address COLLATE utf8mb4_unicode_ci 
        FROM reimbursements 
        WHERE order_number = ? COLLATE utf8mb4_unicode_ci AND project IS NOT NULL
      ) as projects
    `;
    const [projects] = await db.query(projectsQuery, [orderNumber, orderNumber, orderNumber, orderNumber]);

    // Get planned cost for this order number
    const [budgets] = await db.query(
      `SELECT * FROM order_number_budgets 
       WHERE order_number = ? COLLATE utf8mb4_unicode_ci`,
      [orderNumber]
    );

    // Get the overall planned cost (project = null) or project-specific
    let plannedCost = null;
    if (project && project !== 'all') {
      // Look for project-specific budget first
      const projectBudget = budgets.find(b => b.project === project);
      if (projectBudget) {
        plannedCost = parseFloat(projectBudget.planned_cost);
      } else {
        // Fall back to overall budget
        const overallBudget = budgets.find(b => b.project === null);
        if (overallBudget) {
          plannedCost = parseFloat(overallBudget.planned_cost);
        }
      }
    } else {
      // Use overall budget
      const overallBudget = budgets.find(b => b.project === null);
      if (overallBudget) {
        plannedCost = parseFloat(overallBudget.planned_cost);
      }
    }

    const lock = await getOrderNumberLock(orderNumber);

    res.json({
      orderNumber,
      project: project || 'All Projects',
      lock: {
        isLocked: Boolean(lock),
        lockedAt: lock?.locked_at || null,
        lockedBy: lock
          ? {
              id: lock.locked_by,
              first_name: lock.first_name || null,
              last_name: lock.last_name || null
            }
          : null
      },
      projects,
      plannedCost,
      budgetDetails: budgets,
      summary: {
        totalActualCost,
        purchaseRequests: {
          count: purchaseRequests.length,
          total: prTotal
        },
        serviceRequests: {
          count: serviceRequests.length,
          total: srTotal
        },
        cashRequests: {
          count: cashRequests.length,
          total: crTotal
        },
        reimbursements: {
          count: reimbursements.length,
          total: rmbTotal
        }
      },
      pieChartData: [
        { name: 'Purchase Requests', value: prTotal, count: purchaseRequests.length },
        { name: 'Service Requests', value: srTotal, count: serviceRequests.length },
        { name: 'Cash Requests', value: crTotal, count: cashRequests.length },
        { name: 'Reimbursements', value: rmbTotal, count: reimbursements.length }
      ],
      additionalSummary: {
        purchaseOrders: {
          count: purchaseOrders.length,
          total: poTotal
        },
        paymentRequests: {
          count: paymentRequests.length,
          total: pyreqTotal
        },
        paymentOrders: {
          count: paymentOrders.length,
          total: pyordTotal
        }
      },
      details: {
        purchaseRequests,
        serviceRequests,
        cashRequests,
        reimbursements
      },
      additionalDetails: {
        purchaseOrders,
        paymentRequests,
        paymentOrders
      }
    });
  } catch (error) {
    console.error('Error fetching order number dashboard:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data' });
  }
});

// Permanently lock an order number (procurement/admin/super_admin)
router.post('/:orderNumber/lock', authenticate, requireProcurement, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const normalized = normalizeOrderNumber(orderNumber);
    if (!normalized) {
      return res.status(400).json({ message: 'Order number is required' });
    }

    // Ensure order number exists in at least one request/order table before locking.
    const [rows] = await db.query(
      `SELECT 1
       FROM (
         SELECT order_number COLLATE utf8mb4_unicode_ci AS order_number FROM purchase_requests
         UNION ALL SELECT order_number COLLATE utf8mb4_unicode_ci AS order_number FROM service_requests
         UNION ALL SELECT order_number COLLATE utf8mb4_unicode_ci AS order_number FROM cash_requests
         UNION ALL SELECT order_number COLLATE utf8mb4_unicode_ci AS order_number FROM reimbursements
         UNION ALL SELECT order_number COLLATE utf8mb4_unicode_ci AS order_number FROM purchase_orders
         UNION ALL SELECT order_number COLLATE utf8mb4_unicode_ci AS order_number FROM payment_requests
         UNION ALL SELECT order_number COLLATE utf8mb4_unicode_ci AS order_number FROM payment_orders
       ) all_orders
       WHERE all_orders.order_number = ? COLLATE utf8mb4_unicode_ci
       LIMIT 1`,
      [normalized]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Order number not found' });
    }

    const lock = await lockOrderNumber(normalized, req.user.id);
    res.json({
      message: `Order number "${normalized}" is now locked.`,
      lock: {
        order_number: lock?.order_number || normalized,
        locked_at: lock?.locked_at || null,
        locked_by: lock
          ? {
              id: lock.locked_by,
              first_name: lock.first_name || null,
              last_name: lock.last_name || null
            }
          : null
      }
    });
  } catch (error) {
    console.error('Error locking order number:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Failed to lock order number' });
  }
});

// Export ALL purchase request items for an order number (optionally filtered by project)
router.get('/dashboard/:orderNumber/purchase-requests/export-items', authenticate, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { project } = req.query;

    let where = 'WHERE pr.order_number = ?';
    const params = [orderNumber];
    if (project && project !== 'all') {
      where += ' AND pr.project = ?';
      params.push(project);
    }

    const [rows] = await db.query(
      `SELECT
         pr.id as purchase_request_id,
         pr.pr_number,
         pr.purpose,
         pr.project,
         pr.project_address,
         pr.order_number,
         pr.status,
         pr.created_at,
         pr.date_needed,
         pr.total_amount,
         e.first_name as requester_first_name,
         e.last_name as requester_last_name,
         pri.id as purchase_request_item_id,
         pri.item_id,
         i.item_code,
         i.item_name,
         COALESCE(pri.unit, i.unit) as unit,
         pri.quantity,
         pri.unit_price,
         pri.total_price,
         pri.remarks as item_remarks
       FROM purchase_requests pr
       JOIN employees e ON pr.requested_by = e.id
       JOIN purchase_request_items pri ON pri.purchase_request_id = pr.id
       JOIN items i ON pri.item_id = i.id
       ${where}
       ORDER BY pr.created_at DESC, pr.id DESC, pri.id ASC`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('PR Items');

    worksheet.columns = [
      { header: 'PR Number', key: 'pr_number', width: 20 },
      { header: 'PR Status', key: 'status', width: 22 },
      { header: 'Order Number', key: 'order_number', width: 18 },
      { header: 'Project', key: 'project', width: 20 },
      { header: 'Project Address', key: 'project_address', width: 28 },
      { header: 'Purpose', key: 'purpose', width: 32 },
      { header: 'Requested By', key: 'requested_by', width: 22 },
      { header: 'Created At', key: 'created_at', width: 16 },
      { header: 'Date Needed', key: 'date_needed', width: 16 },
      { header: 'SKU', key: 'item_code', width: 16 },
      { header: 'Item Name', key: 'item_name', width: 28 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Unit Price', key: 'unit_price', width: 14 },
      { header: 'Total Price', key: 'total_price', width: 14 },
      { header: 'Item Remarks', key: 'item_remarks', width: 28 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const r of rows) {
      worksheet.addRow({
        pr_number: r.pr_number,
        status: r.status,
        order_number: r.order_number,
        project: r.project,
        project_address: r.project_address,
        purpose: r.purpose,
        requested_by: `${r.requester_first_name || ''} ${r.requester_last_name || ''}`.trim(),
        created_at: r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '',
        date_needed: r.date_needed ? new Date(r.date_needed).toISOString().slice(0, 10) : '',
        item_code: r.item_code,
        item_name: r.item_name,
        unit: r.unit,
        quantity: r.quantity,
        unit_price: r.unit_price ?? null,
        total_price: r.total_price ?? null,
        item_remarks: r.item_remarks
      });
    }

    const safeProject = project && project !== 'all' ? String(project).replace(/[^a-z0-9-_ ]/gi, '') : 'ALL';
    const filename = `ORDER-${String(orderNumber).replace(/[^a-z0-9-_]/gi, '')}-PR-ITEMS-${safeProject}-${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting PR items by order number:', error);
    res.status(500).json({ message: 'Failed to export purchase request items' });
  }
});

// Get cost breakdown by project for an order number
router.get('/project-breakdown/:orderNumber', authenticate, async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const query = `
      SELECT 
        project COLLATE utf8mb4_unicode_ci as project,
        SUM(pr_total) as purchase_requests,
        SUM(sr_total) as service_requests,
        SUM(cr_total) as cash_requests,
        SUM(rmb_total) as reimbursements,
        SUM(pr_total + sr_total + cr_total + rmb_total) as total_cost
      FROM (
        SELECT 
          project COLLATE utf8mb4_unicode_ci as project,
          COALESCE(total_amount, 0) as pr_total,
          0 as sr_total,
          0 as cr_total,
          0 as rmb_total
        FROM purchase_requests 
        WHERE order_number = ? COLLATE utf8mb4_unicode_ci AND total_amount > 0
        UNION ALL
        SELECT 
          project COLLATE utf8mb4_unicode_ci,
          0 as pr_total,
          COALESCE(amount, 0) as sr_total,
          0 as cr_total,
          0 as rmb_total
        FROM service_requests 
        WHERE order_number = ? COLLATE utf8mb4_unicode_ci AND amount > 0
        UNION ALL
        SELECT 
          project COLLATE utf8mb4_unicode_ci,
          0 as pr_total,
          0 as sr_total,
          COALESCE(amount, 0) as cr_total,
          0 as rmb_total
        FROM cash_requests 
        WHERE order_number = ? COLLATE utf8mb4_unicode_ci AND amount > 0
        UNION ALL
        SELECT 
          project COLLATE utf8mb4_unicode_ci,
          0 as pr_total,
          0 as sr_total,
          0 as cr_total,
          COALESCE(amount, 0) as rmb_total
        FROM reimbursements 
        WHERE order_number = ? COLLATE utf8mb4_unicode_ci AND amount > 0
      ) as combined
      WHERE project IS NOT NULL
      GROUP BY project
      ORDER BY total_cost DESC
    `;

    const [breakdown] = await db.query(query, [orderNumber, orderNumber, orderNumber, orderNumber]);
    res.json(breakdown);
  } catch (error) {
    console.error('Error fetching project breakdown:', error);
    res.status(500).json({ message: 'Failed to fetch project breakdown' });
  }
});

// Get planned cost/budget for an order number
router.get('/:orderNumber/budget', authenticate, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { project } = req.query;

    let query = 'SELECT * FROM order_number_budgets WHERE order_number = ? COLLATE utf8mb4_unicode_ci';
    const params = [orderNumber];

    if (project && project !== 'all') {
      query += ' AND project = ?';
      params.push(project);
    }

    const [budgets] = await db.query(query, params);
    res.json(budgets);
  } catch (error) {
    console.error('Error fetching budget:', error);
    res.status(500).json({ message: 'Failed to fetch budget' });
  }
});

// Update planned cost/budget for an order number
router.put('/:orderNumber/budget', authenticate, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { planned_cost, project } = req.body;

    if (planned_cost === undefined || planned_cost === null) {
      return res.status(400).json({ message: 'planned_cost is required' });
    }

    // Check if budget exists
    let query = 'SELECT id FROM order_number_budgets WHERE order_number = ? COLLATE utf8mb4_unicode_ci';
    const params = [orderNumber];

    if (project) {
      query += ' AND project = ?';
      params.push(project);
    } else {
      query += ' AND project IS NULL';
    }

    const [existing] = await db.query(query, params);

    if (existing.length > 0) {
      // Update existing
      await db.query(
        'UPDATE order_number_budgets SET planned_cost = ? WHERE id = ?',
        [planned_cost, existing[0].id]
      );
    } else {
      // Insert new
      await db.query(
        'INSERT INTO order_number_budgets (order_number, project, planned_cost) VALUES (?, ?, ?)',
        [orderNumber, project || null, planned_cost]
      );
    }

    res.json({ 
      order_number: orderNumber,
      project: project || null,
      planned_cost: parseFloat(planned_cost)
    });
  } catch (error) {
    console.error('Error updating budget:', error);
    res.status(500).json({ message: 'Failed to update budget' });
  }
});

export default router;
