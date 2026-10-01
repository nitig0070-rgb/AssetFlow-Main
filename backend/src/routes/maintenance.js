import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/maintenance
 * @desc Quick Action: Raise a new Maintenance Request (Employee/Dept Head/Manager)
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { asset_id, description, priority, photo_url } = req.body;

    if (!asset_id || !description) {
      return res.status(400).json({ error: 'Asset ID and description are required' });
    }

    const db = getDb();

    // 1. Verify asset exists and is valid for maintenance
    const asset = await db.get('SELECT id, name, status FROM assets WHERE id = ?', asset_id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    if (['Retired', 'Disposed'].includes(asset.status)) {
      return res.status(400).json({ error: `Cannot raise maintenance for a ${asset.status} asset` });
    }

    // 2. Insert Maintenance Request (initial status is 'Pending')
    const result = await db.run(
      `INSERT INTO maintenance_requests (asset_id, requested_by, description, priority, status, photo_url) 
       VALUES (?, ?, ?, ?, 'Pending', ?)`,
      asset_id,
      req.user.id,
      description,
      priority || 'Medium',
      photo_url || null
    );

    const newRequestId = result.lastID;

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Raise Maintenance', ?)`,
      req.user.id,
      `Raised maintenance request (ID: ${newRequestId}) for asset ${asset.name} (ID: ${asset_id})`
    );

    // Get asset managers to notify them
    const managers = await db.all("SELECT id FROM users WHERE role = 'AssetManager'");
    for (const manager of managers) {
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
        manager.id,
        'New Maintenance Request',
        `A new maintenance request has been raised for ${asset.name} by ${req.user.email}`,
        'New Maintenance Request'
      );
    }

    res.status(201).json({
      message: 'Maintenance request raised successfully',
      request: {
        id: newRequestId,
        asset_id,
        requested_by: req.user.id,
        description,
        priority: priority || 'Medium',
        status: 'Pending'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/maintenance
 * @desc Get list of maintenance requests
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { status, asset_id } = req.query;
    const db = getDb();

    let query = `
      SELECT mr.*, 
             a.name as asset_name, a.asset_tag, a.serial_number, a.condition as asset_condition,
             u.name as requester_name, u.email as requester_email,
             tech.name as technician_name, tech.email as technician_email
      FROM maintenance_requests mr
      JOIN assets a ON mr.asset_id = a.id
      JOIN users u ON mr.requested_by = u.id
      LEFT JOIN users tech ON mr.assigned_technician_id = tech.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND mr.status = ?`;
      params.push(status);
    }

    if (asset_id) {
      query += ` AND mr.asset_id = ?`;
      params.push(asset_id);
    }

    // Employees only see their own requests unless elevated
    if (req.user.role === 'Employee') {
      query += ` AND (mr.requested_by = ? OR mr.assigned_technician_id = ?)`;
      params.push(req.user.id, req.user.id);
    }

    query += ` ORDER BY mr.id DESC`;

    const requests = await db.all(query, ...params);
    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/maintenance/:id/status
 * @desc Update the status of a maintenance request (approvals, technician assignment, resolution)
 */
router.put('/:id/status', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, assigned_technician_id, resolution_notes, condition } = req.body;
    const role = req.user.role;
    const userId = req.user.id;

    const allowedStatuses = ['Approved', 'Rejected', 'Technician Assigned', 'In Progress', 'Resolved'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
    }

    const db = getDb();

    // Fetch the request
    const request = await db.get('SELECT * FROM maintenance_requests WHERE id = ?', id);
    if (!request) {
      return res.status(404).json({ error: 'Maintenance request not found' });
    }

    const asset = await db.get('SELECT name, asset_tag, status FROM assets WHERE id = ?', request.asset_id);

    // Permission checks:
    // - Only Asset Manager or Admin can Approve, Reject, or Assign Technicians
    if (['Approved', 'Rejected', 'Technician Assigned'].includes(status) && !['AssetManager', 'Admin'].includes(role)) {
      return res.status(403).json({ error: 'Forbidden: Only Asset Managers can approve/reject or assign technicians' });
    }

    // - Tech can update In Progress or Resolved if assigned, or Manager/Admin
    if (['In Progress', 'Resolved'].includes(status)) {
      const isAssignedTech = request.assigned_technician_id === userId;
      if (!isAssignedTech && !['AssetManager', 'Admin'].includes(role)) {
        return res.status(403).json({ error: 'Forbidden: Only the assigned technician or Asset Manager can start or resolve repairs' });
      }
    }

    // Handle each status transition logic
    if (status === 'Approved') {
      // Set asset status to 'Under Maintenance'
      await db.run("UPDATE assets SET status = 'Under Maintenance', updated_at = CURRENT_TIMESTAMP WHERE id = ?", request.asset_id);
      
      // Update request status
      await db.run(
        `UPDATE maintenance_requests SET status = 'Approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        id
      );

      // Notify requester
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Maintenance Approved', ?, 'Maintenance Approved')`,
        request.requested_by,
        `Your maintenance request for asset ${asset ? asset.name : ''} has been approved.`
      );

      // Log action
      await db.run(
        `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Approve Maintenance', ?)`,
        userId,
        `Approved maintenance request ${id} (Asset: ${asset ? asset.name : ''})`
      );

    } else if (status === 'Rejected') {
      // Revert asset status back to its normal condition (usually remains whatever it was since not approved)
      // Update request status
      await db.run(
        `UPDATE maintenance_requests SET status = 'Rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        id
      );

      // Notify requester
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Maintenance Rejected', ?, 'Maintenance Rejected')`,
        request.requested_by,
        `Your maintenance request for asset ${asset ? asset.name : ''} was rejected.`
      );

      // Log action
      await db.run(
        `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Reject Maintenance', ?)`,
        userId,
        `Rejected maintenance request ${id} (Asset: ${asset ? asset.name : ''})`
      );

    } else if (status === 'Technician Assigned') {
      if (!assigned_technician_id) {
        return res.status(400).json({ error: 'Technician ID is required for assignment' });
      }

      // Verify technician exists
      const tech = await db.get('SELECT id, name, email FROM users WHERE id = ?', assigned_technician_id);
      if (!tech) {
        return res.status(404).json({ error: 'Technician user not found' });
      }

      await db.run(
        `UPDATE maintenance_requests 
         SET status = 'Technician Assigned', assigned_technician_id = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        assigned_technician_id,
        id
      );

      // Notify technician
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Maintenance Task Assigned', ?, 'Task Assigned')`,
        assigned_technician_id,
        `You have been assigned to repair asset ${asset ? asset.name : ''} (${asset ? asset.asset_tag : ''}). Description: ${request.description}`
      );

      // Log action
      await db.run(
        `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Assign Technician', ?)`,
        userId,
        `Assigned technician ${tech.name} (ID: ${assigned_technician_id}) to maintenance request ${id}`
      );

    } else if (status === 'In Progress') {
      await db.run(
        `UPDATE maintenance_requests SET status = 'In Progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        id
      );

      // Log action
      await db.run(
        `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Start Repair', ?)`,
        userId,
        `Technician started repair work for request ${id}`
      );

    } else if (status === 'Resolved') {
      if (!resolution_notes) {
        return res.status(400).json({ error: 'Resolution notes are required to resolve a request' });
      }

      // Update request status to Resolved and set date
      await db.run(
        `UPDATE maintenance_requests 
         SET status = 'Resolved', resolved_date = CURRENT_TIMESTAMP, resolution_notes = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        resolution_notes,
        id
      );

      // Update asset status back to 'Available' and set condition if provided
      const newCondition = condition || 'Good';
      await db.run(
        `UPDATE assets SET status = 'Available', condition = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        newCondition,
        request.asset_id
      );

      // Notify requester
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Maintenance Resolved', ?, 'Maintenance Resolved')`,
        request.requested_by,
        `The maintenance request for ${asset ? asset.name : ''} has been resolved: "${resolution_notes}"`
      );

      // Log action
      await db.run(
        `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Resolve Maintenance', ?)`,
        userId,
        `Resolved maintenance request ${id} for asset ID ${request.asset_id} with condition ${newCondition}`
      );
    }

    res.json({
      message: `Maintenance request successfully transitioned to ${status}`
    });

  } catch (error) {
    next(error);
  }
});

export default router;
