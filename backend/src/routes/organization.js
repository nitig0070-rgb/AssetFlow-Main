import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply Admin role gate to all routes in this file
router.use(authenticateToken);
router.use(requireRole(['Admin']));

// ==========================================
// TAB A: Department Management
// ==========================================

/**
 * @route GET /api/organization/departments
 * @desc Get all departments with head & parent info
 */
router.get('/departments', async (req, res, next) => {
  try {
    const db = getDb();
    const departments = await db.all(`
      SELECT d.*, 
             u.name as head_name, u.email as head_email,
             p.name as parent_name
      FROM departments d
      LEFT JOIN users u ON d.head_id = u.id
      LEFT JOIN departments p ON d.parent_id = p.id
      ORDER BY d.id ASC
    `);
    res.json({ departments });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/organization/departments
 * @desc Create a new department
 */
router.post('/departments', async (req, res, next) => {
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

    // Verify head_id if provided
    if (head_id) {
      const user = await db.get('SELECT id, status FROM users WHERE id = ?', head_id);
      if (!user) {
        return res.status(400).json({ error: 'Assigned Department Head user not found' });
      }
      if (user.status !== 'Active') {
        return res.status(400).json({ error: 'Department Head user must be Active' });
      }
    }

    // Verify parent_id if provided
    if (parent_id) {
      const parent = await db.get('SELECT id FROM departments WHERE id = ?', parent_id);
      if (!parent) {
        return res.status(400).json({ error: 'Parent department not found' });
      }
    }

    const result = await db.run(
      `INSERT INTO departments (name, head_id, parent_id, status) VALUES (?, ?, ?, ?)`,
      name,
      head_id || null,
      parent_id || null,
      status || 'Active'
    );

    const newDeptId = result.lastID;

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Create Department', ?)`,
      req.user.id,
      `Created department ${name} (ID: ${newDeptId})`
    );

    res.status(201).json({
      message: 'Department created successfully',
      department: {
        id: newDeptId,
        name,
        head_id,
        parent_id,
        status: status || 'Active'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/organization/departments/:id
 * @desc Edit an existing department (includes circular dependency check)
 */
router.put('/departments/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, head_id, parent_id, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const db = getDb();

    // Check department exists
    const dept = await db.get('SELECT id FROM departments WHERE id = ?', id);
    if (!dept) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Check unique name excluding this department
    const existing = await db.get('SELECT id FROM departments WHERE name = ? AND id != ?', name, id);
    if (existing) {
      return res.status(400).json({ error: 'Department name is already taken by another department' });
    }

    // Verify head_id if provided
    if (head_id) {
      const user = await db.get('SELECT id, status FROM users WHERE id = ?', head_id);
      if (!user) {
        return res.status(400).json({ error: 'Assigned Department Head user not found' });
      }
      if (user.status !== 'Active') {
        return res.status(400).json({ error: 'Department Head user must be Active' });
      }
    }

    // Verify parent_id & Circular dependency validation
    if (parent_id) {
      if (parseInt(parent_id, 10) === parseInt(id, 10)) {
        return res.status(400).json({ error: 'Circular dependency: A department cannot be its own parent.' });
      }

      // Verify parent department exists
      const parent = await db.get('SELECT id FROM departments WHERE id = ?', parent_id);
      if (!parent) {
        return res.status(400).json({ error: 'Parent department not found' });
      }

      // Trace parent hierarchy chain to ensure no circular reference is created
      let currentParentId = parent_id;
      while (currentParentId) {
        if (parseInt(currentParentId, 10) === parseInt(id, 10)) {
          return res.status(400).json({
            error: 'Circular dependency: Setting this parent would create a recursive loop in the department tree.'
          });
        }
        const parentDept = await db.get('SELECT parent_id FROM departments WHERE id = ?', currentParentId);
        currentParentId = parentDept ? parentDept.parent_id : null;
      }
    }

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

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Update Department', ?)`,
      req.user.id,
      `Updated department ${name} (ID: ${id})`
    );

    res.json({
      message: 'Department updated successfully',
      department: { id, name, head_id, parent_id, status }
    });
  } catch (error) {
    next(error);
  }
});


// ==========================================
// TAB B: Asset Category Management
// ==========================================

/**
 * @route GET /api/organization/categories
 * @desc Get all asset categories
 */
router.get('/categories', async (req, res, next) => {
  try {
    const db = getDb();
    const categories = await db.all('SELECT * FROM categories ORDER BY id ASC');
    
    // Parse custom_fields if they are stored as JSON string
    const parsedCategories = categories.map(cat => ({
      ...cat,
      custom_fields: cat.custom_fields ? JSON.parse(cat.custom_fields) : null
    }));

    res.json({ categories: parsedCategories });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/organization/categories
 * @desc Create a new asset category
 */
router.post('/categories', async (req, res, next) => {
  try {
    const { name, custom_fields } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const db = getDb();

    // Check unique name
    const existing = await db.get('SELECT id FROM categories WHERE name = ?', name);
    if (existing) {
      return res.status(400).json({ error: 'Category name already exists' });
    }

    let fieldsStr = null;
    if (custom_fields) {
      fieldsStr = typeof custom_fields === 'object' ? JSON.stringify(custom_fields) : custom_fields;
    }

    const result = await db.run(
      'INSERT INTO categories (name, custom_fields) VALUES (?, ?)',
      name,
      fieldsStr
    );

    const newCatId = result.lastID;

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Create Category', ?)`,
      req.user.id,
      `Created asset category ${name} (ID: ${newCatId})`
    );

    res.status(201).json({
      message: 'Category created successfully',
      category: {
        id: newCatId,
        name,
        custom_fields: custom_fields || null
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/organization/categories/:id
 * @desc Edit an existing category
 */
router.put('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, custom_fields } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const db = getDb();

    // Check category exists
    const cat = await db.get('SELECT id FROM categories WHERE id = ?', id);
    if (!cat) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check unique name excluding this one
    const existing = await db.get('SELECT id FROM categories WHERE name = ? AND id != ?', name, id);
    if (existing) {
      return res.status(400).json({ error: 'Category name is already taken' });
    }

    let fieldsStr = null;
    if (custom_fields) {
      fieldsStr = typeof custom_fields === 'object' ? JSON.stringify(custom_fields) : custom_fields;
    }

    await db.run(
      'UPDATE categories SET name = ?, custom_fields = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      name,
      fieldsStr,
      id
    );

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Update Category', ?)`,
      req.user.id,
      `Updated asset category ${name} (ID: ${id})`
    );

    res.json({
      message: 'Category updated successfully',
      category: {
        id,
        name,
        custom_fields: custom_fields || null
      }
    });
  } catch (error) {
    next(error);
  }
});


// ==========================================
// TAB C: Employee Directory & Role Promotion
// ==========================================

/**
 * @route GET /api/organization/employees
 * @desc Get all employee directory profiles
 */
router.get('/employees', async (req, res, next) => {
  try {
    const db = getDb();
    const employees = await db.all(`
      SELECT u.id, u.name, u.email, u.role, u.department_id, u.status, u.created_at,
             d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.id ASC
    `);
    res.json({ employees });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/organization/employees
 * @desc Admin creates/invites a new user account directly
 */
router.post('/employees', async (req, res, next) => {
  try {
    const { name, email, password, role, department_id, status } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const db = getDb();

    // Check unique email
    const existing = await db.get('SELECT id FROM users WHERE email = ?', email);
    if (existing) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    // Verify department_id if provided
    if (department_id) {
      const dept = await db.get('SELECT id FROM departments WHERE id = ?', department_id);
      if (!dept) {
        return res.status(400).json({ error: 'Assigned Department not found' });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.run(
      `INSERT INTO users (name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?)`,
      name,
      email,
      passwordHash,
      role || 'Employee',
      department_id || null,
      status || 'Active'
    );

    const newUserId = result.lastID;

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Create Employee', ?)`,
      req.user.id,
      `Created employee profile for ${name} (${email}) as ${role || 'Employee'}`
    );

    res.status(201).json({
      message: 'Employee account created successfully',
      employee: {
        id: newUserId,
        name,
        email,
        role: role || 'Employee',
        department_id,
        status: status || 'Active'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/organization/employees/:id
 * @desc Edit employee profile & roles promotion/demotion (with self-preservation checks)
 */
router.put('/employees/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, department_id, role, status } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const db = getDb();

    // Check user exists
    const targetUser = await db.get('SELECT * FROM users WHERE id = ?', id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check unique email excluding this user
    const existing = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', email, id);
    if (existing) {
      return res.status(400).json({ error: 'Email is already taken by another user' });
    }

    // Verify department_id if provided
    if (department_id) {
      const dept = await db.get('SELECT id FROM departments WHERE id = ?', department_id);
      if (!dept) {
        return res.status(400).json({ error: 'Assigned Department not found' });
      }
    }

    // Safety checks: Last Admin self-preservation rule
    if (targetUser.role === 'Admin' && targetUser.status === 'Active') {
      // If Admin role is being demoted, or deactivated, make sure we have at least one other active Admin
      if (role !== 'Admin' || status === 'Inactive') {
        const activeAdmins = await db.get("SELECT COUNT(*) as count FROM users WHERE role = 'Admin' AND status = 'Active'");
        if (activeAdmins.count <= 1) {
          return res.status(400).json({
            error: 'Self-preservation safety check: Cannot demote or deactivate the last active Admin in the system.'
          });
        }
      }
    }

    await db.run(
      `UPDATE users 
       SET name = ?, email = ?, department_id = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      name,
      email,
      department_id || null,
      role || targetUser.role,
      status || targetUser.status,
      id
    );

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Update Employee', ?)`,
      req.user.id,
      `Updated employee profile for ${name} (${email}) - Role: ${role || targetUser.role}, Status: ${status || targetUser.status}`
    );

    res.json({
      message: 'Employee updated successfully',
      employee: {
        id,
        name,
        email,
        role: role || targetUser.role,
        department_id,
        status: status || targetUser.status
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
