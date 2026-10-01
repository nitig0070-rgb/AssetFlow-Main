import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/notifications
 * @desc Get list of notifications for the authenticated user (unread first, sorted by id desc)
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const notifications = await db.all(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY is_read ASC, id DESC`,
      req.user.id
    );
    res.json({ notifications });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/notifications/:id/read
 * @desc Mark a specific notification as read
 */
router.post('/:id/read', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // Verify notification belongs to the user
    const notify = await db.get('SELECT * FROM notifications WHERE id = ? AND user_id = ?', id, req.user.id);
    if (!notify) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', id);

    res.json({
      message: 'Notification marked as read successfully',
      notificationId: id
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/notifications/read-all
 * @desc Mark all notifications for the authenticated user as read
 */
router.post('/read-all', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', req.user.id);

    res.json({
      message: 'All notifications marked as read successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
