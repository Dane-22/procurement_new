import express from 'express';
import db from '../config/database.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/audit-logs/filters
router.get('/filters', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const [actions] = await db.query('SELECT DISTINCT action FROM system_audit_logs WHERE action IS NOT NULL ORDER BY action ASC');
    const [entities] = await db.query('SELECT DISTINCT entity_type FROM system_audit_logs WHERE entity_type IS NOT NULL ORDER BY entity_type ASC');
    
    res.json({
      actions: actions.map(a => a.action),
      entityTypes: entities.map(e => e.entity_type)
    });
  } catch (error) {
    console.error('Error fetching audit log filters:', error);
    res.status(500).json({ message: 'Server error fetching audit filters.' });
  }
});

// Helper for building filter queries
const buildFilterQuery = (query) => {
  const { search, action, entity_type, start_date, end_date } = query;
  let whereClauses = [];
  let queryParams = [];

  if (search) {
    whereClauses.push('(l.details LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)');
    const searchTerm = `%${search}%`;
    queryParams.push(searchTerm, searchTerm, searchTerm);
  }
  if (action) {
    whereClauses.push('l.action = ?');
    queryParams.push(action);
  }
  if (entity_type) {
    whereClauses.push('l.entity_type = ?');
    queryParams.push(entity_type);
  }
  if (start_date) {
    whereClauses.push('l.created_at >= ?');
    queryParams.push(`${start_date} 00:00:00`);
  }
  if (end_date) {
    whereClauses.push('l.created_at <= ?');
    queryParams.push(`${end_date} 23:59:59`);
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  return { whereString, queryParams };
};

// GET /api/audit-logs/export
router.get('/export', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { whereString, queryParams } = buildFilterQuery(req.query);
    
    const [logs] = await db.query(`
      SELECT 
        l.id, l.action, l.entity_type, l.entity_id, l.details, l.created_at,
        u.first_name, u.last_name, u.employee_no
      FROM system_audit_logs l
      LEFT JOIN employees u ON l.user_id = u.id
      ${whereString}
      ORDER BY l.created_at DESC
      LIMIT 10000
    `, queryParams);

    // Build CSV manually
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.csv');

    const headers = ['ID', 'Date', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details'];
    res.write(headers.join(',') + '\n');

    logs.forEach(log => {
      const row = [
        log.id,
        new Date(log.created_at).toISOString(),
        log.first_name ? `${log.first_name} ${log.last_name}` : 'System',
        log.action,
        log.entity_type || '',
        log.entity_id || '',
        log.details ? String(log.details).replace(/"/g, '""') : ''
      ];
      res.write(row.map(val => `"${val}"`).join(',') + '\n');
    });

    res.end();
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ message: 'Server error exporting audit logs.' });
  }
});

// GET /api/audit-logs
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 50, 1);
    const offset = (page - 1) * limit;

    const { whereString, queryParams } = buildFilterQuery(req.query);

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM system_audit_logs l
      LEFT JOIN employees u ON l.user_id = u.id
      ${whereString}
    `;

    const [countResult] = await db.query(countQuery, queryParams);
    const total = countResult[0].total;

    const [logs] = await db.query(`
      SELECT 
        l.id, l.action, l.entity_type, l.entity_id, l.details, l.created_at,
        u.first_name, u.last_name, u.employee_no
      FROM system_audit_logs l
      LEFT JOIN employees u ON l.user_id = u.id
      ${whereString}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);

    res.json({
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Server error fetching audit logs.' });
  }
});

export default router;
