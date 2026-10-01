import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/users
 * @desc Get all users (Employee Directory)
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const query = `
      SELECT u.id, u.name, u.email, u.role, u.department_id, u.status, u.created_at,
             d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.name ASC
    `;
    const users = await db.all(query);
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/users/:id/role
 * @desc Update user role (Admin only)
 */
router.put('/:id/role', authenticateToken, requireRole(['Admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const allowedRoles = ['Employee', 'DepartmentHead', 'AssetManager', 'Admin'];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${allowedRoles.join(', ')}` });
    }

    const db = getDb();

    // Verify user exists
    const user = await db.get('SELECT * FROM users WHERE id = ?', id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update role
    await db.run(
      'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      role,
      id
    );

    // If role is NOT DepartmentHead, and this user was a department head, clear it from departments table
    if (role !== 'DepartmentHead') {
      await db.run('UPDATE departments SET head_id = NULL WHERE head_id = ?', id);
    }

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      req.user.id,
      'Change Role',
      `Changed role of user ${user.email} to ${role}`
    );

    // Notify user
    await db.run(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
      id,
      'Role Updated',
      `Your system role has been updated to ${role} by an Administrator.`,
      'Role Update'
    );

    res.json({
      message: `User role successfully updated to ${role}`,
      user: { id: parseInt(id), name: user.name, email: user.email, role }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/users/:id/status
 * @desc Update user status (Active/Inactive) (Admin only)
 */
router.put('/:id/status', authenticateToken, requireRole(['Admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatus = ['Active', 'Inactive'];
    if (!status || !allowedStatus.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be Active or Inactive.' });
    }

    const db = getDb();

    // Verify user exists
    const user = await db.get('SELECT * FROM users WHERE id = ?', id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deactivating own account
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }

    // Update status
    await db.run(
      'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      status,
      id
    );

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      req.user.id,
      'Change User Status',
      `Changed status of user ${user.email} to ${status}`
    );

    res.json({
      message: `User status successfully updated to ${status}`,
      user: { id: parseInt(id), name: user.name, email: user.email, status }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/users/:id/department
 * @desc Update user department (Admin or AssetManager)
 */
router.put('/:id/department', authenticateToken, requireRole(['Admin', 'AssetManager']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { department_id } = req.body;

    const db = getDb();

    // Verify user exists
    const user = await db.get('SELECT * FROM users WHERE id = ?', id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify department exists if provided
    if (department_id) {
      const dept = await db.get('SELECT id FROM departments WHERE id = ?', department_id);
      if (!dept) {
        return res.status(400).json({ error: 'Invalid department ID' });
      }
    }

    // Update department
    await db.run(
      'UPDATE users SET department_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      department_id || null,
      id
    );

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      req.user.id,
      'Change User Department',
      `Changed department of user ${user.email} (ID: ${id})`
    );

    res.json({
      message: 'User department successfully updated',
      user: { id: parseInt(id), name: user.name, email: user.email, department_id }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
