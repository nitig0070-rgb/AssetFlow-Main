import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/audit-logs
 * @desc Get list of activity audit logs (restricted to AssetManager/Admin)
 */
router.get('/', authenticateToken, requireRole(['AssetManager', 'Admin']), async (req, res, next) => {
  try {
    const { user_id, action, start_date, end_date, search } = req.query;
    const db = getDb();

    let query = `
      SELECT al.*, u.name as user_name, u.email as user_email 
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      query += ` AND al.user_id = ?`;
      params.push(user_id);
    }

    if (action) {
      query += ` AND al.action = ?`;
      params.push(action);
    }

    if (start_date) {
      query += ` AND al.created_at >= ?`;
      params.push(new Date(start_date).toISOString());
    }

    if (end_date) {
      query += ` AND al.created_at <= ?`;
      params.push(new Date(end_date).toISOString());
    }

    if (search) {
      query += ` AND (al.details LIKE ? OR al.action LIKE ? OR u.name LIKE ? OR u.email LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ` ORDER BY al.id DESC`;

    const logs = await db.all(query, ...params);
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

export default router;
