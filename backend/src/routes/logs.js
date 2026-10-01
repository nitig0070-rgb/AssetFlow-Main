import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/logs/audit
 * @desc Get all system activity logs (Admin / AssetManager only)
 */
router.get('/audit', authenticateToken, requireRole(['Admin', 'AssetManager']), async (req, res, next) => {
  try {
    const db = getDb();
    const query = `
      SELECT al.*, u.name as user_name, u.email as user_email, u.role as user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 200
    `;
    const logs = await db.all(query);
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/logs/notifications
 * @desc Get notifications for the logged-in user
 */
router.get('/notifications', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const query = `
      SELECT id, title, message, type, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `;
    const notifications = await db.all(query, req.user.id);
    res.json({ notifications });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/logs/notifications/:id/read
 * @desc Mark a notification as read
 */
router.put('/notifications/:id/read', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // Verify notification belongs to the user
    const notif = await db.get('SELECT id FROM notifications WHERE id = ? AND user_id = ?', id, req.user.id);
    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', id);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
});

export default router;
