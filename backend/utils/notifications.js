import db from '../config/database.js';
import { emitToUser } from './socket.js';
import { sendEmail } from './emailSender.js';
import { sendPushNotification } from './pushSender.js';

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
    
    const notificationPayload = {
      id: result.insertId,
      title,
      message,
      type,
      related_id: relatedId,
      related_type: relatedType,
      is_read: false,
      created_at: new Date().toISOString()
    };

    // Emit real-time notification to the user
    emitToUser(recipientId, 'notification', notificationPayload);
    
    // Background tasks: Push and Email
    // Push notification
    sendPushNotification(recipientId, notificationPayload).catch(err => console.error('Push error:', err));
    
    // Email notification
    db.query('SELECT email FROM employees WHERE id = ?', [recipientId])
      .then(([rows]) => {
        if (rows.length > 0 && rows[0].email) {
          const html = `
            <h2>${title}</h2>
            <p>${message}</p>
            <p><small>Type: ${type}</small></p>
          `;
          sendEmail(rows[0].email, title, html).catch(err => console.error('Email error:', err));
        }
      })
      .catch(err => console.error('Error fetching email for notification:', err));

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
 * Get super admin reps who should be notified
 * @returns {Promise<number[]>} - Array of user IDs with senior_project_manager role
 */
export async function getSuperAdminReps() {
  try {
    const [users] = await db.query(`
      SELECT id FROM employees WHERE role = 'senior_project_manager' AND is_active = 1
    `);
    return users.map(u => u.id);
  } catch (error) {
    console.error('Failed to get super admin reps:', error);
    return [];
  }
}

/**
 * Get ceos who should be notified
 * @returns {Promise<number[]>} - Array of user IDs with ceo role
 */
export async function getCeos() {
  try {
    const [users] = await db.query(`
      SELECT id FROM employees WHERE role = 'ceo' AND is_active = 1
    `);
    return users.map(u => u.id);
  } catch (error) {
    console.error('Failed to get ceos:', error);
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
    
    if (requesterRole === 'admin') {
      // If requester is Admin: reviewers are all Admins + Super Admin Rep + Super Admin + Ceos
      const admins = await getAdmins();
      const superAdminReps = await getSuperAdminReps();
      const superAdmins = await getSuperAdmins();
      const ceos = await getCeos();
      reviewers = [...admins, ...superAdminReps, ...superAdmins, ...ceos];
    } else {
      // Everyone else (Engineer, Senior Project Manager, CEO, Super Admin)
      // starts at Engineer Review and goes through the full chain.
      const engineers = await getEngineers();
      const admins = await getAdmins();
      const superAdminReps = await getSuperAdminReps();
      const superAdmins = await getSuperAdmins();
      const ceos = await getCeos();
      reviewers = [...engineers, ...admins, ...superAdminReps, ...superAdmins, ...ceos];
    }
    
    // Remove duplicates and filter out the requester themselves
    return [...new Set(reviewers)];
  } catch (error) {
    console.error('Failed to get reviewers for PR:', error);
    return [];
  }
}
