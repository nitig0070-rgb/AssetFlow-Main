import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/allocations
 * @desc Get all active allocations
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const query = `
      SELECT al.*, 
             a.name as asset_name, a.asset_tag, a.serial_number,
             u.name as user_name, u.email as user_email,
             d.name as department_name
      FROM allocations al
      JOIN assets a ON al.asset_id = a.id
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN departments d ON al.department_id = d.id
      WHERE al.status = 'Active'
      ORDER BY al.allocation_date DESC
    `;
    const allocations = await db.all(query);
    res.json({ allocations });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/allocations/history/:assetId
 * @desc Get allocation history for a specific asset
 */
router.get('/history/:assetId', authenticateToken, async (req, res, next) => {
  try {
    const { assetId } = req.params;
    const db = getDb();
    const query = `
      SELECT al.*, 
             u.name as user_name, u.email as user_email,
             d.name as department_name,
             ab.name as allocated_by_name
      FROM allocations al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN departments d ON al.department_id = d.id
      LEFT JOIN users ab ON al.allocated_by = ab.id
      WHERE al.asset_id = ?
      ORDER BY al.allocation_date DESC
    `;
    const history = await db.all(query, assetId);
    res.json({ history });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/allocations
 * @desc Allocate asset to an employee or department (AssetManager / Admin only)
 */
router.post('/', authenticateToken, requireRole(['AssetManager', 'Admin']), async (req, res, next) => {
  try {
    const { asset_id, user_id, department_id, expected_return_date } = req.body;

    if (!asset_id) {
      return res.status(400).json({ error: 'Asset ID is required' });
    }

    if (!user_id && !department_id) {
      return res.status(400).json({ error: 'Either User ID or Department ID must be selected' });
    }

    const db = getDb();

    // 1. Verify asset exists
    const asset = await db.get('SELECT * FROM assets WHERE id = ?', asset_id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    if (['Retired', 'Disposed', 'Lost'].includes(asset.status)) {
      return res.status(400).json({ error: `Cannot allocate an asset that is currently ${asset.status}` });
    }

    // 2. Check conflict: You can't allocate an asset that's already taken (Double-Allocation check)
    if (asset.status === 'Allocated') {
      const activeAlloc = await db.get(
        `SELECT al.*, u.name as user_name, d.name as department_name 
         FROM allocations al 
         LEFT JOIN users u ON al.user_id = u.id
         LEFT JOIN departments d ON al.department_id = d.id
         WHERE al.asset_id = ? AND al.status = 'Active' 
         LIMIT 1`,
        asset_id
      );

      const holder = activeAlloc 
        ? (activeAlloc.user_name || activeAlloc.department_name || 'Another User/Dept')
        : 'another entity';

      return res.status(409).json({
        error: 'Double-Allocation Conflict',
        message: `Asset ${asset.name} (${asset.asset_tag}) is currently held by ${holder}.`,
        currentlyHeldBy: holder,
        allocationId: activeAlloc ? activeAlloc.id : null
      });
    }

    // 3. Create active allocation record
    const result = await db.run(
      `INSERT INTO allocations (asset_id, user_id, department_id, allocated_by, expected_return_date, status)
       VALUES (?, ?, ?, ?, ?, 'Active')`,
      asset_id,
      user_id || null,
      department_id || null,
      req.user.id,
      expected_return_date || null
    );

    const allocationId = result.lastID;

    // 4. Update asset status to 'Allocated'
    await db.run("UPDATE assets SET status = 'Allocated', updated_at = CURRENT_TIMESTAMP WHERE id = ?", asset_id);

    // Create notifications for the allocated user
    if (user_id) {
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
        user_id,
        'Asset Assigned',
        `Asset ${asset.name} (${asset.asset_tag}) has been allocated to you. Expected return date: ${expected_return_date || 'N/A'}.`,
        'Asset Assigned'
      );
    }

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      req.user.id,
      'Allocate Asset',
      `Allocated asset ${asset.name} (${asset.asset_tag}) to ${user_id ? 'user ' + user_id : 'department ' + department_id}`
    );

    res.status(201).json({
      message: 'Asset allocated successfully',
      allocationId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/allocations/:id/return
 * @desc Return an allocated asset (AssetManager / Admin only)
 */
router.post('/:id/return', authenticateToken, requireRole(['AssetManager', 'Admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { condition, return_notes } = req.body;

    const db = getDb();

    // 1. Verify allocation exists and is active
    const alloc = await db.get('SELECT * FROM allocations WHERE id = ? AND status = "Active"', id);
    if (!alloc) {
      return res.status(404).json({ error: 'Active allocation record not found' });
    }

    const asset = await db.get('SELECT name, asset_tag FROM assets WHERE id = ?', alloc.asset_id);

    // 2. Update allocation record
    await db.run(
      `UPDATE allocations 
       SET returned_date = CURRENT_TIMESTAMP, return_notes = ?, status = 'Returned', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      return_notes || null,
      id
    );

    // 3. Revert asset status back to 'Available' and update its condition if changed
    const newCondition = condition || 'Good';
    await db.run(
      `UPDATE assets 
       SET status = 'Available', condition = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      newCondition,
      alloc.asset_id
    );

    // Notify user
    if (alloc.user_id) {
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
        alloc.user_id,
        'Asset Returned',
        `The return of asset ${asset ? asset.name : ''} (${asset ? asset.asset_tag : ''}) has been checked in by the manager.`,
        'Asset Returned'
      );
    }

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      req.user.id,
      'Return Asset',
      `Checked in return for asset ID ${alloc.asset_id} with condition ${newCondition}`
    );

    res.json({
      message: 'Asset returned successfully and set to Available'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
