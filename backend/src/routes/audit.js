import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/audits
 * @desc Create a new Audit Cycle (scope: department/location, dates) and scope assets
 */
router.post('/', authenticateToken, requireRole(['AssetManager', 'Admin']), async (req, res, next) => {
  try {
    const { name, scope_department_id, scope_location, start_date, end_date, auditor_ids } = req.body;

    if (!name || !start_date || !end_date) {
      return res.status(400).json({ error: 'Name, start_date, and end_date are required' });
    }

    const db = getDb();

    // 1. Insert Audit Cycle (Draft status)
    const cycleResult = await db.run(
      `INSERT INTO audit_cycles (name, scope_department_id, scope_location, start_date, end_date, status) 
       VALUES (?, ?, ?, ?, ?, 'Draft')`,
      name,
      scope_department_id || null,
      scope_location || null,
      new Date(start_date).toISOString().split('T')[0],
      new Date(end_date).toISOString().split('T')[0]
    );
    const cycleId = cycleResult.lastID;

    // 2. Fetch assets matching the scope to populate the audit cycle
    let assetQuery = `SELECT id, location FROM assets WHERE status NOT IN ('Retired', 'Disposed')`;
    const params = [];

    if (scope_department_id) {
      assetQuery += ` AND EXISTS (
        SELECT 1 FROM allocations al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.asset_id = assets.id 
          AND al.status = 'Active' 
          AND (al.department_id = ? OR u.department_id = ?)
      )`;
      params.push(scope_department_id, scope_department_id);
    }

    if (scope_location) {
      assetQuery += ` AND location LIKE ?`;
      params.push(`%${scope_location}%`);
    }

    const assets = await db.all(assetQuery, ...params);

    // 3. Insert assets into audit_cycle_assets, distributing them among auditors
    const auditorsList = Array.isArray(auditor_ids) ? auditor_ids : [];
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const assignedAuditorId = auditorsList.length > 0 ? auditorsList[i % auditorsList.length] : null;

      await db.run(
        `INSERT INTO audit_cycle_assets (audit_cycle_id, asset_id, auditor_id, verification_status) 
         VALUES (?, ?, ?, 'Pending')`,
        cycleId,
        asset.id,
        assignedAuditorId
      );
    }

    // 4. Log the action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Create Audit Cycle', ?)`,
      req.user.id,
      `Created audit cycle ${name} (ID: ${cycleId}) with ${assets.length} scoped assets.`
    );

    res.status(201).json({
      message: 'Audit cycle created successfully in Draft status',
      cycle: {
        id: cycleId,
        name,
        scope_department_id,
        scope_location,
        start_date,
        end_date,
        status: 'Draft',
        assetsCount: assets.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/audits/:id/start
 * @desc Move audit cycle from 'Draft' to 'Active'
 */
router.post('/:id/start', authenticateToken, requireRole(['AssetManager', 'Admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const cycle = await db.get('SELECT * FROM audit_cycles WHERE id = ?', id);
    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found' });
    }

    if (cycle.status !== 'Draft') {
      return res.status(400).json({ error: `Cannot start a cycle that is in status: ${cycle.status}` });
    }

    await db.run(
      "UPDATE audit_cycles SET status = 'Active', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      id
    );

    // Log the start
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Start Audit Cycle', ?)`,
      req.user.id,
      `Started audit cycle: ${cycle.name} (ID: ${id})`
    );

    res.json({
      message: 'Audit cycle started successfully',
      cycleId: id,
      status: 'Active'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/audits/assets/:id/verify
 * @desc Verify an individual asset status in the audit cycle (Auditor only)
 */
router.post('/assets/:id/verify', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { verification_status, notes } = req.body; // 'Verified', 'Missing', 'Damaged'

    if (!['Verified', 'Missing', 'Damaged'].includes(verification_status)) {
      return res.status(400).json({ error: 'Verification status must be Verified, Missing, or Damaged' });
    }

    const db = getDb();

    // 1. Fetch asset audit record and cycle status
    const auditAsset = await db.get(
      `SELECT ca.*, c.status as cycle_status, a.name as asset_name 
       FROM audit_cycle_assets ca
       JOIN audit_cycles c ON ca.audit_cycle_id = c.id
       JOIN assets a ON ca.asset_id = a.id
       WHERE ca.id = ?`,
      id
    );

    if (!auditAsset) {
      return res.status(404).json({ error: 'Asset audit log not found' });
    }

    if (auditAsset.cycle_status !== 'Active') {
      return res.status(400).json({ error: 'Can only verify assets when the audit cycle is Active' });
    }

    // 2. Perform updates
    await db.run(
      `UPDATE audit_cycle_assets 
       SET verification_status = ?, notes = ?, auditor_id = ?, verified_at = NOW(), updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      verification_status,
      notes || null,
      req.user.id,
      id
    );

    res.json({
      message: 'Asset verified successfully in audit cycle',
      auditAssetId: id,
      assetName: auditAsset.asset_name,
      verification_status
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/audits/:id/discrepancies
 * @desc Generate discrepancy report for flagged assets (Missing / Damaged)
 */
router.get('/:id/discrepancies', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const cycle = await db.get('SELECT * FROM audit_cycles WHERE id = ?', id);
    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found' });
    }

    const discrepancies = await db.all(
      `SELECT ca.*, a.name as asset_name, a.asset_tag, a.serial_number, a.location, u.name as auditor_name
       FROM audit_cycle_assets ca
       JOIN assets a ON ca.asset_id = a.id
       LEFT JOIN users u ON ca.auditor_id = u.id
       WHERE ca.audit_cycle_id = ? AND ca.verification_status IN ('Missing', 'Damaged')`,
      id
    );

    res.json({
      cycleName: cycle.name,
      discrepancies
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/audits/:id/close
 * @desc Close the audit cycle, locking it and automatically updating affected asset statuses
 *       (e.g., status changes to 'Lost' for missing assets)
 */
router.post('/:id/close', authenticateToken, requireRole(['AssetManager', 'Admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // 1. Fetch audit cycle
    const cycle = await db.get('SELECT * FROM audit_cycles WHERE id = ?', id);
    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found' });
    }

    if (cycle.status !== 'Active') {
      return res.status(400).json({ error: 'Can only close an Active audit cycle' });
    }

    // 2. Fetch all flagged items to apply auto-updates
    const flaggedItems = await db.all(
      'SELECT asset_id, verification_status FROM audit_cycle_assets WHERE audit_cycle_id = ?',
      id
    );

    // Apply auto-updates on assets table
    for (const item of flaggedItems) {
      if (item.verification_status === 'Missing') {
        // Mark asset as Lost
        await db.run(
          "UPDATE assets SET status = 'Lost', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          item.asset_id
        );
      } else if (item.verification_status === 'Damaged') {
        // Mark asset condition as Damaged
        await db.run(
          "UPDATE assets SET condition = 'Damaged', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          item.asset_id
        );
      }
    }

    // 3. Mark cycle status as Completed
    await db.run(
      "UPDATE audit_cycles SET status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      id
    );

    // 4. Log the action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Close Audit Cycle', ?)`,
      req.user.id,
      `Closed audit cycle: ${cycle.name} (ID: ${id}) and reconciled discrepancy items.`
    );

    res.json({
      message: 'Audit cycle closed successfully. Asset statuses updated.',
      cycleId: id,
      status: 'Completed'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/audits
 * @desc Get list of all audit cycles
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const cycles = await db.all('SELECT * FROM audit_cycles ORDER BY id DESC');
    res.json({ cycles });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/audits/:id
 * @desc Get audit cycle details with associated scoped assets
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const cycle = await db.get(
      `SELECT c.*, d.name as department_name 
       FROM audit_cycles c 
       LEFT JOIN departments d ON c.scope_department_id = d.id 
       WHERE c.id = ?`,
      id
    );

    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found' });
    }

    const assets = await db.all(
      `SELECT ca.id as audit_asset_id, ca.verification_status, ca.notes, ca.verified_at,
              a.id as asset_id, a.name as asset_name, a.asset_tag, a.serial_number, a.location,
              u.name as auditor_name
       FROM audit_cycle_assets ca
       JOIN assets a ON ca.asset_id = a.id
       LEFT JOIN users u ON ca.auditor_id = u.id
       WHERE ca.audit_cycle_id = ?`,
      id
    );

    res.json({
      cycle,
      assets
    });
  } catch (error) {
    next(error);
  }
});

export default router;
