import express from 'express';
import { authenticate, requireItemManagement } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

// Get all categories
router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
    const offset = (page - 1) * pageSize;

    const [categories] = await db.query(`
      SELECT c.*, COUNT(i.id) as items_count
      FROM categories c
      LEFT JOIN items i ON c.id = i.category_id AND i.status = 'Active'
      GROUP BY c.id
      ORDER BY c.category_name
      LIMIT ? OFFSET ?
    `, [pageSize, offset]);

    const [countRows] = await db.query(
      'SELECT COUNT(*) as total FROM categories'
    );

    res.json({ categories, page, pageSize, total: countRows?.[0]?.total ?? 0 });
  } catch (error) {
    console.error('Fetch categories error:', error);
    res.status(500).json({ message: 'Failed to fetch categories: ' + error.message });
  }
});

// Get single category
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [categories] = await db.query(
      'SELECT * FROM categories WHERE id = ?',
      [req.params.id]
    );

    if (categories.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const [items] = await db.query(
      "SELECT id, item_name, item_code, unit, status FROM items WHERE category_id = ? AND status = 'Active'",
      [req.params.id]
    );

    res.json({ category: { ...categories[0], items } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch category' });
  }
});

// Create category (procurement, admin, super_admin, engineer can create)
router.post('/', authenticate, requireItemManagement, async (req, res) => {
  try {
    const { name, description } = req.body;
    const created_by = req.user.id;

    const [result] = await db.query(
      'INSERT INTO categories (category_name, description, created_by) VALUES (?, ?, ?)',
      [name, description ?? '', created_by]
    );

    res.status(201).json({ 
      message: 'Category created successfully', 
      categoryId: result.insertId 
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ message: 'Failed to create category: ' + error.message });
  }
});

// Update category (procurement, admin, super_admin, engineer can update)
router.put('/:id', authenticate, requireItemManagement, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    await db.query(
      'UPDATE categories SET category_name = ?, description = ? WHERE id = ?',
      [name, description, req.params.id]
    );

    res.json({ message: 'Category updated successfully' });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ message: 'Failed to update category: ' + error.message });
  }
});

// Delete category (procurement, admin, super_admin, engineer can delete)
router.delete('/:id', authenticate, requireItemManagement, async (req, res) => {
  try {
    await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ message: 'Failed to delete category: ' + error.message });
  }
});

export default router;
