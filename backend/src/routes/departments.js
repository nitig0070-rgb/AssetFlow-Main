import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/departments
 * @desc Get list of departments (with head and parent details)
 */
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const query = `
      SELECT d.*, 
             u.name as head_name, u.email as head_email,
             p.name as parent_name
      FROM departments d
      LEFT JOIN users u ON d.head_id = u.id
      LEFT JOIN departments p ON d.parent_id = p.id
      ORDER BY d.name ASC
    `;
    const departments = await db.all(query);
    res.json({ departments });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/departments
 * @desc Create a new department (Admin only)
 */
router.post('/', authenticateToken, requireRole(['Admin']), async (req, res, next) => {
  try {
    const { name, head_id, parent_id, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const db = getDb();

    // Check unique name
    const existing = await db.get('SELECT id FROM departments WHERE name = ?', name);
    if (existing) {
      return res.status(400).json({ error: 'Department name already exists' });
    }

    const result = await db.run(
      `INSERT INTO departments (name, head_id, parent_id, status) VALUES (?, ?, ?, ?)`,
      name,
      head_id || null,
      parent_id || null,
      status || 'Active'
    );

    const newId = result.lastID;

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      req.user.id,
      'Create Department',
      `Created department ${name} (ID: ${newId})`
    );

    res.status(201).json({
      message: 'Department created successfully',
      department: { id: newId, name, head_id, parent_id, status: status || 'Active' }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/departments/:id
 * @desc Update a department (Admin only)
 */
router.put('/:id', authenticateToken, requireRole(['Admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, head_id, parent_id, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const db = getDb();

    // Verify department exists
    const dept = await db.get('SELECT * FROM departments WHERE id = ?', id);
    if (!dept) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Check unique name excluding current
    const existing = await db.get('SELECT id FROM departments WHERE name = ? AND id != ?', name, id);
    if (existing) {
      return res.status(400).json({ error: 'Department name already exists' });
    }

    // Update department
    await db.run(
      `UPDATE departments 
       SET name = ?, head_id = ?, parent_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      name,
      head_id || null,
      parent_id || null,
      status || 'Active',
      id
    );

    // If head_id is specified, promote that user to DepartmentHead role if they are currently an Employee
    if (head_id) {
      const user = await db.get('SELECT role FROM users WHERE id = ?', head_id);
      if (user && user.role === 'Employee') {
        await db.run(`UPDATE users SET role = 'DepartmentHead', department_id = ? WHERE id = ?`, id, head_id);
        // Add log and notification
        await db.run(
          `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
          req.user.id,
          'Promote User',
          `Promoted user ${head_id} to Department Head for department ${id}`
        );
        await db.run(
          `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
          head_id,
          'Role Update',
          `You have been promoted to Department Head of ${name}.`,
          'Role Update'
        );
      }
    }

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      req.user.id,
      'Update Department',
      `Updated department ${name} (ID: ${id})`
    );

    res.json({
      message: 'Department updated successfully',
      department: { id: parseInt(id), name, head_id, parent_id, status }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
