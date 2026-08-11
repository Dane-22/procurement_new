import express from 'express';
import { authenticate } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

// Get user's notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const [notifications] = await db.query(`
      SELECT n.*
      FROM notifications n
      WHERE n.recipient_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [req.user.id]);

    // Count unread
    const [unreadCount] = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE recipient_id = ? AND is_read = false',
      [req.user.id]
    );

    res.json({ 
      notifications,
      unreadCount: unreadCount[0].count
    });
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = true WHERE id = ? AND recipient_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Failed to update notification:', error);
    res.status(500).json({ message: 'Failed to update notification' });
  }
});

// Mark all as read
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = true WHERE recipient_id = ? AND is_read = false',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Failed to update notifications:', error);
    res.status(500).json({ message: 'Failed to update notifications' });
  }
});

export default router;
