import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/transfers
 * @desc Get lists of transfers based on roles
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const role = req.user.role;

    // Fetch user's department
    const userRecord = await db.get('SELECT department_id FROM users WHERE id = ?', userId);
    const departmentId = userRecord ? userRecord.department_id : null;

    let query = `
      SELECT t.*, 
             a.name as asset_name, a.asset_tag,
             uf.name as from_user_name, uf.email as from_user_email,
             ut.name as to_user_name, ut.email as to_user_email,
             d.name as to_department_name,
             ur.name as requested_by_name,
             ap.name as approved_by_name
      FROM transfers t
      JOIN assets a ON t.asset_id = a.id
      LEFT JOIN users uf ON t.from_user_id = uf.id
      LEFT JOIN users ut ON t.to_user_id = ut.id
      LEFT JOIN departments d ON t.to_department_id = d.id
      LEFT JOIN users ur ON t.requested_by = ur.id
      LEFT JOIN users ap ON t.approved_by = ap.id
      WHERE 1=1
    `;
    const params = [];

    if (role === 'Employee') {
      // Show where they are sender, receiver, or requester
      query += ` AND (t.from_user_id = ? OR t.to_user_id = ? OR t.requested_by = ?)`;
      params.push(userId, userId, userId);
    } else if (role === 'DepartmentHead') {
      // Show where from/to users are in their department, or to_department_id is their department
      query += ` AND (uf.department_id = ? OR ut.department_id = ? OR t.to_department_id = ?)`;
      params.push(departmentId, departmentId, departmentId);
    }

    query += ` ORDER BY t.created_at DESC`;

    const transfers = await db.all(query, ...params);
    res.json({ transfers });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/transfers
 * @desc Request a transfer of an asset
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { asset_id, to_user_id, to_department_id, remarks } = req.body;

    if (!asset_id) {
      return res.status(400).json({ error: 'Asset ID is required' });
    }

    if (!to_user_id && !to_department_id) {
      return res.status(400).json({ error: 'Target User ID or Department ID is required' });
    }

    const db = getDb();

    // 1. Verify asset exists and is currently allocated
    const asset = await db.get('SELECT * FROM assets WHERE id = ?', asset_id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    if (asset.status !== 'Allocated') {
      return res.status(400).json({ error: 'This asset is not currently allocated, so it cannot be transferred. Allocate it directly instead.' });
    }

    // 2. Find who currently holds the asset (from_user_id)
    const activeAlloc = await db.get(
      'SELECT id, user_id FROM allocations WHERE asset_id = ? AND status = "Active" LIMIT 1',
      asset_id
    );

    const fromUserId = activeAlloc ? activeAlloc.user_id : null;

    // Prevent transferring to same user
    if (to_user_id && fromUserId === parseInt(to_user_id)) {
      return res.status(400).json({ error: 'Cannot transfer an asset to the same user who currently holds it.' });
    }

    // 3. Create transfer request
    const result = await db.run(
      `INSERT INTO transfers (asset_id, from_user_id, to_user_id, to_department_id, requested_by, status, remarks)
       VALUES (?, ?, ?, ?, ?, 'Pending', ?)`,
      asset_id,
      fromUserId,
      to_user_id || null,
      to_department_id || null,
      req.user.id,
      remarks || null
    );

    const transferId = result.lastID;

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Request Transfer', ?)`,
      req.user.id,
      `Requested transfer for asset ${asset.name} (ID: ${asset_id})`
    );

    // Notify Asset Managers or Department Head
    const managers = await db.all("SELECT id FROM users WHERE role = 'AssetManager'");
    for (const manager of managers) {
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
        manager.id,
        'Transfer Requested',
        `A transfer request has been raised for ${asset.name} (${asset.asset_tag}) by ${req.user.name}.`,
        'Transfer Request'
      );
    }

    res.status(201).json({
      message: 'Transfer request submitted successfully',
      transferId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/transfers/:id/approve
 * @desc Approve a transfer request (AssetManager or DepartmentHead only)
 */
router.post('/:id/approve', authenticateToken, requireRole(['AssetManager', 'DepartmentHead', 'Admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // 1. Verify transfer request exists and is Pending
    const transfer = await db.get('SELECT * FROM transfers WHERE id = ?', id);
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer request not found' });
    }

    if (transfer.status !== 'Pending') {
      return res.status(400).json({ error: `Cannot approve a transfer request that is already ${transfer.status}` });
    }

    const asset = await db.get('SELECT name, asset_tag FROM assets WHERE id = ?', transfer.asset_id);

    // 2. Mark previous allocation as Returned (Transferred)
    await db.run(
      `UPDATE allocations 
       SET returned_date = CURRENT_TIMESTAMP, return_notes = 'Asset transferred via Request ID: ' || ?, status = 'Returned', updated_at = CURRENT_TIMESTAMP
       WHERE asset_id = ? AND status = 'Active'`,
      id,
      transfer.asset_id
    );

    // 3. Create new allocation
    await db.run(
      `INSERT INTO allocations (asset_id, user_id, department_id, allocated_by, status)
       VALUES (?, ?, ?, ?, 'Active')`,
      transfer.asset_id,
      transfer.to_user_id || null,
      transfer.to_department_id || null,
      req.user.id
    );

    // 4. Ensure asset status is set to Allocated
    await db.run(
      `UPDATE assets SET status = 'Allocated', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      transfer.asset_id
    );

    // 5. Update transfer request status
    await db.run(
      `UPDATE transfers 
       SET status = 'Approved', approved_by = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      req.user.id,
      id
    );

    // 6. Notify users
    // Notify previous holder
    if (transfer.from_user_id) {
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Transfer Approved', ?, 'Transfer Approved')`,
        transfer.from_user_id,
        `Asset ${asset ? asset.name : ''} has been transferred out of your possession.`
      );
    }

    // Notify new holder
    if (transfer.to_user_id) {
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Asset Assigned', ?, 'Asset Assigned')`,
        transfer.to_user_id,
        `Asset ${asset ? asset.name : ''} (${asset ? asset.asset_tag : ''}) has been transferred to you.`
      );
    }

    // Notify requester (if different)
    if (transfer.requested_by !== transfer.from_user_id && transfer.requested_by !== transfer.to_user_id) {
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Transfer Approved', ?, 'Transfer Approved')`,
        transfer.requested_by,
        `Your transfer request for ${asset ? asset.name : ''} has been approved.`
      );
    }

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      req.user.id,
      'Approve Transfer',
      `Approved transfer request ${id} for asset ID ${transfer.asset_id}`
    );

    res.json({
      message: 'Transfer request approved and asset successfully re-allocated'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/transfers/:id/reject
 * @desc Reject a transfer request (AssetManager or DepartmentHead only)
 */
router.post('/:id/reject', authenticateToken, requireRole(['AssetManager', 'DepartmentHead', 'Admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const db = getDb();

    // 1. Verify transfer request exists and is Pending
    const transfer = await db.get('SELECT * FROM transfers WHERE id = ?', id);
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer request not found' });
    }

    if (transfer.status !== 'Pending') {
      return res.status(400).json({ error: `Cannot reject a transfer request that is already ${transfer.status}` });
    }

    const asset = await db.get('SELECT name FROM assets WHERE id = ?', transfer.asset_id);

    // 2. Update transfer request status
    await db.run(
      `UPDATE transfers 
       SET status = 'Rejected', approved_by = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      req.user.id,
      remarks || 'Transfer rejected by manager',
      id
    );

    // 3. Notify requester
    await db.run(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Transfer Rejected', ?, 'Transfer Rejected')`,
      transfer.requested_by,
      `Your transfer request for ${asset ? asset.name : ''} was rejected. Reason: ${remarks || 'None provided'}.`
    );

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      req.user.id,
      'Reject Transfer',
      `Rejected transfer request ${id} for asset ID ${transfer.asset_id}`
    );

    res.json({
      message: 'Transfer request rejected successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
