import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const ATTENDANCE_SYNC_API_KEY = process.env.ATTENDANCE_SYNC_API_KEY;
const ATTENDANCE_API_URL = process.env.ATTENDANCE_API_URL || 'https://jajr.xandree.com/change-password-api.php';
const ATTENDANCE_API_KEY = process.env.ATTENDANCE_API_KEY || 'qwertyuiopasdfghjklzxcvbnm';

// Login
router.post('/login', [
  body('employee_no').notEmpty().withMessage('Employee number is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employee_no, password } = req.body;

    // Find employee - using employee_no column
    const [rows] = await db.query(
      'SELECT id, employee_no, password, first_name, middle_initial, last_name, role, is_active, created_at FROM employees WHERE employee_no = ?',
      [employee_no]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    // Check password
    let isMatch = false;
    if (typeof user.password === 'string') {
      // Use bcrypt for password comparison
      try {
        isMatch = await bcrypt.compare(password, user.password);
      } catch (e) {
        isMatch = false;
      }
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Role is already stored as role in database
    const role = user.role;

    // Generate token
    const token = jwt.sign(
      { id: user.id, role: role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Remove password from response
    delete user.password;

    try {
      const { logAudit } = await import('../utils/auditLogger.js');
      await logAudit(user.id, 'User Logged In', 'auth', null, JSON.stringify({ employee_no: user.employee_no }));
    } catch (auditErr) {
      console.error('Audit log error:', auditErr);
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        employee_no: user.employee_no,
        first_name: user.first_name,
        middle_initial: user.middle_initial,
        last_name: user.last_name,
        role: role,
        is_active: user.is_active
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Update push notification token
router.post('/push-token', authenticate, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    await db.query(
      'UPDATE employees SET fcm_token = ? WHERE id = ?',
      [token, req.user.id]
    );

    res.json({ message: 'Push token updated successfully' });
  } catch (error) {
    console.error('Update push token error:', error);
    res.status(500).json({ message: 'Server error while updating push token' });
  }
});

// Get current user profile (protected)
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Procurement Login - forwards to coworker's API
// POST /api/auth/procurement
// Body: { employee_no, password }
router.post('/procurement', [
  body('employee_no').notEmpty().withMessage('Employee number is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employee_no, password } = req.body;

    // Forward to coworker's API
    const PROXY_API_URL = process.env.PROXY_API_URL || 'https://procurement-api.xandree.com/api/auth/login';

    const response = await axios.post(PROXY_API_URL, {
      employee_no,
      password
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    // Return the same response from the external API
    res.json(response.data);

  } catch (error) {
    console.error('Proxy login error:', error.message);
    
    // If external API returned an error, forward that error
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    
    // Otherwise return generic error
    res.status(500).json({ 
      message: 'Failed to connect to external login service',
      error: error.message 
    });
  }
});

// Change password (protected)
router.post('/change-password',
  authenticate,
  [
    body('current_password').notEmpty().withMessage('Current password is required'),
    body('new_password')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long'),
    body('confirm_password')
      .custom((value, { req }) => value === req.body.new_password)
      .withMessage('Passwords do not match')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { current_password, new_password } = req.body;

      const [rows] = await db.query(
        'SELECT id, employee_no, password FROM employees WHERE id = ?',
        [req.user.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = rows[0];

      let isMatch = false;
      if (typeof user.password === 'string') {
        // Use bcrypt for password comparison
        try {
          isMatch = await bcrypt.compare(current_password, user.password);
        } catch (e) {
          isMatch = false;
        }
      }

      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(new_password, 10);

      await db.query(
        'UPDATE employees SET password = ? WHERE id = ?',
        [hashedPassword, req.user.id]
      );

      // Sync password to attendance system (non-blocking - don't fail if attendance API is down)
      try {
        console.log('Syncing password to attendance system...');
        console.log('ATTENDANCE_API_URL:', ATTENDANCE_API_URL);
        console.log('employee_no:', user.employee_no);
        
        const response = await axios.post(ATTENDANCE_API_URL, {
          employee_code: user.employee_no,
          current_password: current_password,
          new_password: new_password,
          confirm_password: new_password
        }, {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': ATTENDANCE_API_KEY
          },
          timeout: 10000
        });
        console.log(`Password synced successfully for employee: ${user.employee_no}`);
        console.log('Attendance API response:', response.data);
      } catch (syncError) {
        console.error('Attendance system sync failed:', syncError.message);
        if (syncError.response) {
          console.error('Attendance API error response:', syncError.response.status, syncError.response.data);
        }
        // Don't fail the password change if sync fails - local password is already updated
      }

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: 'Server error during password update' });
    }
  }
);

// Attendance system password sync (server-to-server)
// POST /api/auth/sync-password
// Headers: x-api-key: <ATTENDANCE_SYNC_API_KEY>
// Body: { employee_no, password }
router.post('/sync-password',
  [
    body('employee_no').notEmpty().withMessage('Employee number is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
  ],
  async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) return res.status(401).json({ message: 'Unauthorized' });
      if (!ATTENDANCE_SYNC_API_KEY) {
        return res.status(503).json({ message: 'Password sync is not configured' });
      }

      if (apiKey !== ATTENDANCE_SYNC_API_KEY) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { employee_no, password } = req.body;

      const [rows] = await db.query(
        'SELECT id FROM employees WHERE employee_no = ?',
        [employee_no]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await db.query(
        'UPDATE employees SET password = ? WHERE employee_no = ?',
        [hashedPassword, employee_no]
      );

      return res.json({ message: 'Password synced successfully' });
    } catch (error) {
      console.error('Sync password error:', error);
      return res.status(500).json({ message: 'Server error during password sync' });
    }
  }
);

// Logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    const { logAudit } = await import('../utils/auditLogger.js');
    await logAudit(req.user.id, 'User Logged Out', 'auth', null, null);
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
});

export default router;
