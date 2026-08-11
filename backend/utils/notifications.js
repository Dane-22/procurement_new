import db from '../config/database.js';
import { emitToUser } from './socket.js';

/**
 * Create a notification for a user
 * @param {number} recipientId - The user ID who should receive this notification
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Type: 'PR Created', 'PR Approved', 'PR Rejected', 'PO Created', 'Item Received', 'System'
 * @param {number|null} relatedId - ID of related record (PR, PO, etc.)
 * @param {string|null} relatedType - Type of related record
 * @returns {Promise<number>} - The notification ID
 */
export async function createNotification(recipientId, title, message, type = 'System', relatedId = null, relatedType = null) {
  try {
    const [result] = await db.query(`
      INSERT INTO notifications (recipient_id, title, message, type, related_id, related_type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, false, NOW())
    `, [recipientId, title, message, type, relatedId, relatedType]);
    
    // Emit real-time notification to the user
    emitToUser(recipientId, 'notification', {
      id: result.insertId,
      title,
      message,
      type,
      related_id: relatedId,
      related_type: relatedType,
      is_read: false,
      created_at: new Date().toISOString()
    });
    
    return result.insertId;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

/**
 * Get procurement officers who should be notified
 * @returns {Promise<number[]>} - Array of user IDs with procurement role
 */
export async function getProcurementOfficers() {
  try {
    const [users] = await db.query(`
      SELECT id FROM employees WHERE role = 'procurement' AND is_active = 1
    `);
    return users.map(u => u.id);
  } catch (error) {
    console.error('Failed to get procurement officers:', error);
    return [];
  }
}

/**
 * Get super admins who should be notified
 * @returns {Promise<number[]>} - Array of user IDs with super_admin role
 */
export async function getSuperAdmins() {
  try {
    const [users] = await db.query(`
      SELECT id FROM employees WHERE role = 'super_admin' AND is_active = 1
    `);
    return users.map(u => u.id);
  } catch (error) {
    console.error('Failed to get super admins:', error);
    return [];
  }
}

/**
 * Get admins who should be notified
 * @returns {Promise<number[]>} - Array of user IDs with admin role
 */
export async function getAdmins() {
  try {
    const [users] = await db.query(`
      SELECT id FROM employees WHERE role = 'admin' AND is_active = 1
    `);
    return users.map(u => u.id);
  } catch (error) {
    console.error('Failed to get admins:', error);
    return [];
  }
}

/**
 * Get engineers who should be notified
 * @returns {Promise<number[]>} - Array of user IDs with engineer role
 */
export async function getEngineers() {
  try {
    const [users] = await db.query(`
      SELECT id FROM employees WHERE role = 'engineer' AND is_active = 1
    `);
    return users.map(u => u.id);
  } catch (error) {
    console.error('Failed to get engineers:', error);
    return [];
  }
}

/**
 * Get reviewers for a PR based on requester role
 * @param {string} requesterRole - The role of the person who created the PR
 * @returns {Promise<number[]>} - Array of user IDs who should review the PR
 */
export async function getReviewersForPR(requesterRole) {
  try {
    let reviewers = [];
    
    if (requesterRole === 'engineer') {
      // If requester is Engineer: reviewers are all Engineers + Procurement + Super Admin
      const engineers = await getEngineers();
      const procurement = await getProcurementOfficers();
      const superAdmins = await getSuperAdmins();
      reviewers = [...engineers, ...procurement, ...superAdmins];
    } else if (requesterRole === 'admin') {
      // If requester is Admin: reviewers are all Admins + Super Admin
      const admins = await getAdmins();
      const superAdmins = await getSuperAdmins();
      reviewers = [...admins, ...superAdmins];
    } else if (requesterRole === 'procurement') {
      // If requester is Procurement: reviewers are all Procurement + Super Admin
      const procurement = await getProcurementOfficers();
      const superAdmins = await getSuperAdmins();
      reviewers = [...procurement, ...superAdmins];
    } else {
      // Super Admin doesn't need review
      reviewers = [];
    }
    
    // Remove duplicates and filter out the requester themselves
    return [...new Set(reviewers)];
  } catch (error) {
    console.error('Failed to get reviewers for PR:', error);
    return [];
  }
}
