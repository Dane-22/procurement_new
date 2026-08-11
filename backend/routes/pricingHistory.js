import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

// Get all pricing history records with filters and pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const { item_id, supplier_id, start_date, end_date, search, page = 1, limit = 20 } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    let countQuery = `
      SELECT COUNT(*) as total
      FROM pricing_history ph
      LEFT JOIN items i ON ph.item_id = i.id
      LEFT JOIN suppliers s ON ph.supplier_id = s.id
      WHERE 1=1
    `;
    let dataQuery = `
      SELECT ph.*, 
             i.item_name, i.item_code, i.unit,
             s.supplier_name,
             e.first_name as created_by_first_name,
             e.last_name as created_by_last_name
      FROM pricing_history ph
      LEFT JOIN items i ON ph.item_id = i.id
      LEFT JOIN suppliers s ON ph.supplier_id = s.id
      LEFT JOIN employees e ON ph.created_by = e.id
      WHERE 1=1
    `;
    const params = [];
    
    if (item_id) {
      countQuery += ' AND ph.item_id = ?';
      dataQuery += ' AND ph.item_id = ?';
      params.push(item_id);
    }
    
    if (supplier_id) {
      countQuery += ' AND ph.supplier_id = ?';
      dataQuery += ' AND ph.supplier_id = ?';
      params.push(supplier_id);
    }
    
    if (start_date) {
      countQuery += ' AND ph.date_recorded >= ?';
      dataQuery += ' AND ph.date_recorded >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      countQuery += ' AND ph.date_recorded <= ?';
      dataQuery += ' AND ph.date_recorded <= ?';
      params.push(end_date);
    }
    
    if (search) {
      const searchClause = ' AND (i.item_name LIKE ? OR i.item_code LIKE ? OR s.supplier_name LIKE ?)';
      countQuery += searchClause;
      dataQuery += searchClause;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    // Get total count
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0].total;
    
    // Get paginated data
    dataQuery += ' ORDER BY ph.date_recorded DESC, ph.created_at DESC';
    dataQuery += ' LIMIT ? OFFSET ?';
    const dataParams = [...params, limitNum, offset];
    
    const [records] = await db.query(dataQuery, dataParams);
    
    res.json({ 
      pricingHistory: records,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Failed to fetch pricing history', error);
    res.status(500).json({ message: 'Failed to fetch pricing history' });
  }
});

// Get pricing history for a specific item
router.get('/item/:itemId', authenticate, async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const [records] = await db.query(`
      SELECT ph.*, 
             s.supplier_name,
             e.first_name as created_by_first_name,
             e.last_name as created_by_last_name
      FROM pricing_history ph
      LEFT JOIN suppliers s ON ph.supplier_id = s.id
      LEFT JOIN employees e ON ph.created_by = e.id
      WHERE ph.item_id = ?
      ORDER BY ph.date_recorded DESC, ph.created_at DESC
    `, [itemId]);
    
    res.json({ pricingHistory: records });
  } catch (error) {
    console.error('Failed to fetch item pricing history', error);
    res.status(500).json({ message: 'Failed to fetch item pricing history' });
  }
});

// Get pricing history for a specific supplier
router.get('/supplier/:supplierId', authenticate, async (req, res) => {
  try {
    const { supplierId } = req.params;
    
    const [records] = await db.query(`
      SELECT ph.*, 
             i.item_name, i.item_code, i.unit,
             e.first_name as created_by_first_name,
             e.last_name as created_by_last_name
      FROM pricing_history ph
      LEFT JOIN items i ON ph.item_id = i.id
      LEFT JOIN employees e ON ph.created_by = e.id
      WHERE ph.supplier_id = ?
      ORDER BY ph.date_recorded DESC, ph.created_at DESC
    `, [supplierId]);
    
    res.json({ pricingHistory: records });
  } catch (error) {
    console.error('Failed to fetch supplier pricing history', error);
    res.status(500).json({ message: 'Failed to fetch supplier pricing history' });
  }
});

// Create pricing history record (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      item_id,
      supplier_id,
      unit_price,
      quantity,
      total_amount,
      purchase_order_id,
      purchase_request_id,
      po_number,
      pr_number,
      date_recorded,
      notes
    } = req.body;
    
    if (!item_id || !supplier_id || !unit_price) {
      return res.status(400).json({ message: 'Item ID, Supplier ID, and Unit Price are required' });
    }
    
    const finalTotalAmount = total_amount || (quantity ? unit_price * quantity : unit_price);
    const finalDateRecorded = date_recorded || new Date().toISOString().split('T')[0];
    
    const [result] = await db.query(
      `INSERT INTO pricing_history 
       (item_id, supplier_id, unit_price, quantity, total_amount, 
        purchase_order_id, purchase_request_id, po_number, pr_number,
        date_recorded, notes, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item_id,
        supplier_id,
        unit_price,
        quantity || null,
        finalTotalAmount,
        purchase_order_id || null,
        purchase_request_id || null,
        po_number || null,
        pr_number || null,
        finalDateRecorded,
        notes || null,
        req.user.id
      ]
    );
    
    res.status(201).json({
      message: 'Pricing history record created successfully',
      id: result.insertId
    });
  } catch (error) {
    console.error('Failed to create pricing history record', error);
    res.status(500).json({ message: 'Failed to create pricing history record: ' + error.message });
  }
});

// Update pricing history record (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      unit_price,
      quantity,
      total_amount,
      date_recorded,
      notes
    } = req.body;
    
    // Check if record exists
    const [records] = await db.query('SELECT * FROM pricing_history WHERE id = ?', [id]);
    if (records.length === 0) {
      return res.status(404).json({ message: 'Pricing history record not found' });
    }
    
    const record = records[0];
    const finalUnitPrice = unit_price !== undefined ? unit_price : record.unit_price;
    const finalQuantity = quantity !== undefined ? quantity : record.quantity;
    const finalTotalAmount = total_amount !== undefined 
      ? total_amount 
      : (finalQuantity ? finalUnitPrice * finalQuantity : finalUnitPrice);
    
    await db.query(
      `UPDATE pricing_history 
       SET unit_price = ?, quantity = ?, total_amount = ?, 
           date_recorded = ?, notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        finalUnitPrice,
        finalQuantity,
        finalTotalAmount,
        date_recorded || record.date_recorded,
        notes !== undefined ? notes : record.notes,
        id
      ]
    );
    
    res.json({ message: 'Pricing history record updated successfully' });
  } catch (error) {
    console.error('Failed to update pricing history record', error);
    res.status(500).json({ message: 'Failed to update pricing history record: ' + error.message });
  }
});

// Delete pricing history record (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [records] = await db.query('SELECT * FROM pricing_history WHERE id = ?', [id]);
    if (records.length === 0) {
      return res.status(404).json({ message: 'Pricing history record not found' });
    }
    
    await db.query('DELETE FROM pricing_history WHERE id = ?', [id]);
    res.json({ message: 'Pricing history record deleted successfully' });
  } catch (error) {
    console.error('Failed to delete pricing history record', error);
    res.status(500).json({ message: 'Failed to delete pricing history record' });
  }
});

// Get pricing statistics/trends for an item
router.get('/stats/item/:itemId', authenticate, async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const [stats] = await db.query(`
      SELECT 
        MIN(unit_price) as lowest_price,
        MAX(unit_price) as highest_price,
        AVG(unit_price) as average_price,
        COUNT(*) as total_purchases,
        supplier_id as most_frequent_supplier_id,
        (SELECT supplier_name FROM suppliers WHERE id = ph.supplier_id) as most_frequent_supplier_name
      FROM pricing_history ph
      WHERE ph.item_id = ?
      GROUP BY supplier_id
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `, [itemId]);
    
    const [priceTrend] = await db.query(`
      SELECT unit_price, date_recorded
      FROM pricing_history
      WHERE item_id = ?
      ORDER BY date_recorded ASC
    `, [itemId]);
    
    res.json({
      statistics: stats[0] || null,
      priceTrend: priceTrend
    });
  } catch (error) {
    console.error('Failed to fetch pricing statistics', error);
    res.status(500).json({ message: 'Failed to fetch pricing statistics' });
  }
});

// Get monthly pricing trends for dashboard chart
router.get('/trends/monthly', authenticate, async (req, res) => {
  try {
    const { item_id, months = 12, year } = req.query;
    
    let query = `
      SELECT 
        DATE_FORMAT(date_recorded, '%Y-%m') as month,
        DATE_FORMAT(date_recorded, '%b %Y') as month_label,
        AVG(unit_price) as avg_price,
        MIN(unit_price) as min_price,
        MAX(unit_price) as max_price,
        COUNT(*) as record_count
      FROM pricing_history
      WHERE 1=1
    `;
    const params = [];
    
    if (year) {
      // Filter by specific year
      query += ' AND YEAR(date_recorded) = ?';
      params.push(parseInt(year));
    } else {
      // Default: last N months
      query += ' AND date_recorded >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)';
      params.push(parseInt(months));
    }
    
    if (item_id) {
      query += ' AND item_id = ?';
      params.push(item_id);
    }
    
    query += `
      GROUP BY DATE_FORMAT(date_recorded, '%Y-%m'), DATE_FORMAT(date_recorded, '%b %Y')
      ORDER BY month ASC
    `;
    
    const [trends] = await db.query(query, params);
    
    // Deduplicate trends by month to prevent duplicate labels
    const seenMonths = new Set();
    const uniqueTrends = trends.filter(t => {
      if (seenMonths.has(t.month)) {
        return false;
      }
      seenMonths.add(t.month);
      return true;
    });
    
    // Get available years for filter dropdown
    const [years] = await db.query(`
      SELECT DISTINCT YEAR(date_recorded) as year
      FROM pricing_history
      ORDER BY year DESC
    `);
    
    // Get top items for dropdown
    const [topItems] = await db.query(`
      SELECT i.id, i.item_name, i.item_code
      FROM pricing_history ph
      JOIN items i ON ph.item_id = i.id
      GROUP BY i.id
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `);
    
    res.json({ 
      trends: uniqueTrends,
      topItems: topItems,
      availableYears: years.map(y => y.year)
    });
  } catch (error) {
    console.error('Failed to fetch monthly trends', error);
    res.status(500).json({ message: 'Failed to fetch monthly trends' });
  }
});

export default router;
