import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/categories
 * @desc Get all asset categories
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const categories = await db.all('SELECT * FROM categories ORDER BY name ASC');
    
    // Parse custom_fields JSON if needed
    const formatted = categories.map(cat => ({
      ...cat,
      custom_fields: cat.custom_fields ? JSON.parse(cat.custom_fields) : {}
    }));

    res.json({ categories: formatted });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/categories
 * @desc Create a new category (Admin only)
 */
router.post('/', authenticateToken, requireRole(['Admin']), async (req, res, next) => {
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

    const fieldsString = custom_fields ? JSON.stringify(custom_fields) : null;

    const result = await db.run(
      `INSERT INTO categories (name, custom_fields) VALUES (?, ?)`,
      name,
      fieldsString
    );

    const newId = result.lastID;

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      req.user.id,
      'Create Category',
      `Created category ${name} (ID: ${newId})`
    );

    res.status(201).json({
      message: 'Category created successfully',
      category: { id: newId, name, custom_fields: custom_fields || {} }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/categories/:id
 * @desc Update a category (Admin only)
 */
router.put('/:id', authenticateToken, requireRole(['Admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, custom_fields } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const db = getDb();

    // Verify exists
    const category = await db.get('SELECT * FROM categories WHERE id = ?', id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check unique name excluding current
    const existing = await db.get('SELECT id FROM categories WHERE name = ? AND id != ?', name, id);
    if (existing) {
      return res.status(400).json({ error: 'Category name already exists' });
    }

    const fieldsString = custom_fields ? JSON.stringify(custom_fields) : null;

    await db.run(
      `UPDATE categories 
       SET name = ?, custom_fields = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      name,
      fieldsString,
      id
    );

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      req.user.id,
      'Update Category',
      `Updated category ${name} (ID: ${id})`
    );

    res.json({
      message: 'Category updated successfully',
      category: { id: parseInt(id), name, custom_fields: custom_fields || {} }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
