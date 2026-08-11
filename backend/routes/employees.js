import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Create employee (Super Admin only)
router.post('/',
  authenticate,
  requireSuperAdmin,
  [
    body('employee_no').notEmpty().withMessage('Employee number is required'),
    body('first_name').notEmpty().withMessage('First name is required'),
    body('middle_initial').optional(),
    body('last_name').notEmpty().withMessage('Last name is required'),
    body('role').isIn(['engineer', 'procurement', 'admin', 'super_admin']).withMessage('Invalid role'),
    body('department').optional()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { employee_no, first_name, middle_initial, last_name, role, department } = req.body;

      // Check if employee_no already exists
      const [existingRows] = await db.query(
        'SELECT id FROM employees WHERE employee_no = ?',
        [employee_no]
      );

      if (existingRows.length > 0) {
        return res.status(400).json({ message: 'Employee number already exists' });
      }

      // Default password
      const defaultPassword = 'jajrconstruction';
      
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(defaultPassword, salt);

      // Insert new employee
      const [result] = await db.query(
        'INSERT INTO employees (employee_no, first_name, middle_initial, last_name, role, department, password, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [employee_no, first_name, middle_initial || null, last_name, role, department || null, hashedPassword, true]
      );

      res.status(201).json({
        message: 'Employee created successfully',
        employee: {
          id: result.insertId,
          employee_no,
          first_name,
          middle_initial: middle_initial || null,
          last_name,
          role,
          department: department || null,
          is_active: true
        }
      });
    } catch (error) {
      console.error('Create employee error:', error);
      res.status(500).json({ message: 'Server error creating employee' });
    }
  }
);

// Get all employees (Super Admin only)
router.get('/',
  authenticate,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
      const offset = (page - 1) * pageSize;

      const [rows] = await db.query(
        'SELECT id, employee_no, first_name, middle_initial, last_name, role, department, is_active, created_at FROM employees ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [pageSize, offset]
      );

      const [countRows] = await db.query(
        'SELECT COUNT(*) as total FROM employees'
      );

      res.json({ employees: rows, page, pageSize, total: countRows?.[0]?.total ?? 0 });
    } catch (error) {
      console.error('Get employees error:', error);
      res.status(500).json({ message: 'Server error fetching employees' });
    }
  }
);

// Get employees by role (authenticated)
router.get('/by-role/:role',
  authenticate,
  async (req, res) => {
    try {
      const { role } = req.params;
      const validRoles = ['engineer', 'procurement', 'admin', 'super_admin'];
      
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      const [rows] = await db.query(
        'SELECT id, employee_no, first_name, middle_initial, last_name, role, department, is_active FROM employees WHERE role = ? AND is_active = true ORDER BY last_name, first_name',
        [role]
      );

      res.json({ employees: rows });
    } catch (error) {
      console.error('Get employees by role error:', error);
      res.status(500).json({ message: 'Server error fetching employees by role' });
    }
  }
);

// Update employee (Super Admin only)
router.put('/:id',
  authenticate,
  requireSuperAdmin,
  [
    body('first_name').optional().notEmpty().withMessage('First name cannot be empty'),
    body('last_name').optional().notEmpty().withMessage('Last name cannot be empty'),
    body('role').optional().isIn(['engineer', 'procurement', 'admin', 'super_admin']).withMessage('Invalid role'),
    body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { first_name, middle_initial, last_name, role, department, is_active } = req.body;

      // Check if employee exists
      const [existingRows] = await db.query(
        'SELECT id FROM employees WHERE id = ?',
        [id]
      );

      if (existingRows.length === 0) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      // Build update query dynamically
      const updates = [];
      const values = [];

      if (first_name !== undefined) {
        updates.push('first_name = ?');
        values.push(first_name);
      }
      if (middle_initial !== undefined) {
        updates.push('middle_initial = ?');
        values.push(middle_initial);
      }
      if (last_name !== undefined) {
        updates.push('last_name = ?');
        values.push(last_name);
      }
      if (role !== undefined) {
        updates.push('role = ?');
        values.push(role);
      }
      if (department !== undefined) {
        updates.push('department = ?');
        values.push(department);
      }
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(is_active);
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: 'No fields to update' });
      }

      values.push(id);

      await db.query(
        `UPDATE employees SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      res.json({ message: 'Employee updated successfully' });
    } catch (error) {
      console.error('Update employee error:', error);
      res.status(500).json({ message: 'Server error updating employee' });
    }
  }
);

// Reset employee password (Super Admin only)
router.post('/:id/reset-password',
  authenticate,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check if employee exists
      const [existingRows] = await db.query(
        'SELECT id FROM employees WHERE id = ?',
        [id]
      );

      if (existingRows.length === 0) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      // Default password
      const defaultPassword = 'jajrconstruction';
      
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(defaultPassword, salt);

      await db.query(
        'UPDATE employees SET password = ? WHERE id = ?',
        [hashedPassword, id]
      );

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Server error resetting password' });
    }
  }
);

export default router;
