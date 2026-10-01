import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/assets
 * @desc Quick Action: Register a new Asset (AssetManager or Admin only)
 */
router.post('/', authenticateToken, requireRole(['AssetManager', 'Admin']), async (req, res, next) => {
  try {
    const {
      name,
      category_id,
      serial_number,
      acquisition_date,
      acquisition_cost,
      condition,
      location,
      photo_url,
      documents_url,
      is_bookable
    } = req.body;

    if (!name || !category_id) {
      return res.status(400).json({ error: 'Asset Name and Category are required' });
    }

    const db = getDb();

    // Verify category exists
    const category = await db.get('SELECT id FROM categories WHERE id = ?', category_id);
    if (!category) {
      return res.status(400).json({ error: 'Invalid Category ID' });
    }

    // Auto-generate Asset Tag (sequential prefix AF-xxxx)
    const maxAsset = await db.get("SELECT asset_tag FROM assets ORDER BY id DESC LIMIT 1");
    let nextNum = 1;
    if (maxAsset && maxAsset.asset_tag) {
      const match = maxAsset.asset_tag.match(/AF-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const asset_tag = `AF-${String(nextNum).padStart(4, '0')}`;

    // Insert Asset
    const result = await db.run(
      `INSERT INTO assets (
        name, category_id, asset_tag, serial_number, acquisition_date, 
        acquisition_cost, condition, location, photo_url, documents_url, 
        is_bookable, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available')`,
      name,
      category_id,
      asset_tag,
      serial_number || null,
      acquisition_date || new Date().toISOString().split('T')[0],
      acquisition_cost || 0.0,
      condition || 'Good',
      location || null,
      photo_url || null,
      documents_url || null,
      is_bookable ? 1 : 0
    );

    const newAssetId = result.lastID;

    // Log the action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      req.user.id,
      'Register Asset',
      `Registered new asset ${name} with tag ${asset_tag}`
    );

    res.status(201).json({
      message: 'Asset registered successfully',
      asset: {
        id: newAssetId,
        name,
        category_id,
        asset_tag,
        serial_number,
        status: 'Available'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/assets
 * @desc Get lists of assets with filtering & searching
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { category_id, status, is_bookable, department_id, search } = req.query;
    const db = getDb();

    let query = `
      SELECT a.*, c.name as category_name 
      FROM assets a
      JOIN categories c ON a.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (category_id) {
      query += ` AND a.category_id = ?`;
      params.push(category_id);
    }

    if (status) {
      query += ` AND a.status = ?`;
      params.push(status);
    }

    if (is_bookable !== undefined) {
      query += ` AND a.is_bookable = ?`;
      params.push(is_bookable === 'true' || is_bookable === '1' ? 1 : 0);
    }

    if (department_id) {
      query += ` AND EXISTS (
        SELECT 1 FROM allocations al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.asset_id = a.id 
          AND al.status = 'Active' 
          AND (al.department_id = ? OR u.department_id = ?)
      )`;
      params.push(department_id, department_id);
    }

    if (search) {
      query += ` AND (a.name LIKE ? OR a.asset_tag LIKE ? OR a.serial_number LIKE ? OR a.location LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ` ORDER BY a.id DESC`;

    const assets = await db.all(query, ...params);
    res.json({ assets });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/assets/:idOrTag
 * @desc Get single asset details, current allocation state, allocation history, and maintenance history
 */
router.get('/:idOrTag', authenticateToken, async (req, res, next) => {
  try {
    const { idOrTag } = req.params;
    const db = getDb();

    // 1. Fetch core asset details (supports ID or Tag lookup)
    let assetQuery = `
      SELECT a.*, c.name as category_name 
      FROM assets a 
      JOIN categories c ON a.category_id = c.id 
      WHERE 
    `;
    const isTag = idOrTag.toString().toUpperCase().startsWith('AF-');
    if (isTag) {
      assetQuery += `a.asset_tag = ?`;
    } else {
      assetQuery += `a.id = ?`;
    }

    const asset = await db.get(assetQuery, idOrTag);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // 2. Fetch current active allocation (if any)
    const activeAllocation = await db.get(
      `SELECT al.*, u.name as user_name, u.email as user_email, d.name as department_name, allocator.name as allocator_name
       FROM allocations al
       LEFT JOIN users u ON al.user_id = u.id
       LEFT JOIN departments d ON al.department_id = d.id
       LEFT JOIN users allocator ON al.allocated_by = allocator.id
       WHERE al.asset_id = ? AND al.status = 'Active' AND al.returned_date IS NULL
       LIMIT 1`,
      asset.id
    );

    // 3. Fetch full allocation history (newest first)
    const allocationHistory = await db.all(
      `SELECT al.*, u.name as user_name, u.email as user_email, d.name as department_name, allocator.name as allocator_name
       FROM allocations al
       LEFT JOIN users u ON al.user_id = u.id
       LEFT JOIN departments d ON al.department_id = d.id
       LEFT JOIN users allocator ON al.allocated_by = allocator.id
       WHERE al.asset_id = ?
       ORDER BY al.id DESC`,
      asset.id
    );

    // 4. Fetch full maintenance history (newest first)
    const maintenanceHistory = await db.all(
      `SELECT mr.*, u.name as requester_name, u.email as requester_email, tech.name as technician_name
       FROM maintenance_requests mr
       JOIN users u ON mr.requested_by = u.id
       LEFT JOIN users tech ON mr.assigned_technician_id = tech.id
       WHERE mr.asset_id = ?
       ORDER BY mr.id DESC`,
      asset.id
    );

    res.json({
      asset,
      activeAllocation: activeAllocation || null,
      history: {
        allocations: allocationHistory,
        maintenance: maintenanceHistory
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
