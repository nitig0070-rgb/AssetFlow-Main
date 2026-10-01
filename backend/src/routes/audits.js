import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/audits/cycles
 * @desc Get all audit cycles
 */
router.get('/cycles', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const query = `
      SELECT ac.*, d.name as department_name,
             (SELECT COUNT(*) FROM audit_cycle_assets WHERE audit_cycle_id = ac.id) as total_assets,
             (SELECT COUNT(*) FROM audit_cycle_assets WHERE audit_cycle_id = ac.id AND verification_status != 'Pending') as verified_assets
      FROM audit_cycles ac
      LEFT JOIN departments d ON ac.scope_department_id = d.id
      ORDER BY ac.created_at DESC
    `;
    const cycles = await db.all(query);
    res.json({ cycles });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/audits/cycles
 * @desc Create a new audit cycle and auto-populate assets in scope (Admin / AssetManager only)
 */
router.post('/cycles', authenticateToken, requireRole(['Admin', 'AssetManager']), async (req, res, next) => {
  try {
    const { name, scope_department_id, scope_location, start_date, end_date } = req.body;

    if (!name || !start_date || !end_date) {
      return res.status(400).json({ error: 'Cycle name, start date, and end date are required' });
    }

    const db = getDb();

    // 1. Create the Audit Cycle record (initial status: Active)
    const cycleResult = await db.run(
      `INSERT INTO audit_cycles (name, scope_department_id, scope_location, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, 'Active')`,
      name,
      scope_department_id || null,
      scope_location || null,
      start_date,
      end_date
    );

    const auditCycleId = cycleResult.lastID;

    // 2. Identify assets in scope
    let scopeQuery = `
      SELECT DISTINCT a.id 
      FROM assets a
      LEFT JOIN allocations al ON a.id = al.asset_id AND al.status = 'Active'
      LEFT JOIN users u ON al.user_id = u.id
      WHERE a.status NOT IN ('Retired', 'Disposed')
    `;
    const params = [];

    if (scope_department_id) {
      scopeQuery += ` AND (al.department_id = ? OR u.department_id = ?)`;
      params.push(scope_department_id, scope_department_id);
    }

    if (scope_location) {
      scopeQuery += ` AND a.location LIKE ?`;
      params.push(`%${scope_location}%`);
    }

    const assetsInScope = await db.all(scopeQuery, ...params);

    // 3. Insert in-scope assets into audit_cycle_assets
    if (assetsInScope.length > 0) {
      const stmt = await db.prepare(
        `INSERT INTO audit_cycle_assets (audit_cycle_id, asset_id, verification_status) VALUES (?, ?, 'Pending')`
      );
      for (const asset of assetsInScope) {
        await stmt.run(auditCycleId, asset.id);
      }
      await stmt.finalize();
    }

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      req.user.id,
      'Create Audit Cycle',
      `Created audit cycle ${name} (ID: ${auditCycleId}) with ${assetsInScope.length} assets in scope`
    );

    res.status(201).json({
      message: 'Audit cycle created successfully',
      cycleId: auditCycleId,
      assetsScopedCount: assetsInScope.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/audits/cycles/:id/assets
 * @desc Get all assets in scope for a specific audit cycle
 */
router.get('/cycles/:id/assets', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const query = `
      SELECT aca.*, 
             a.name as asset_name, a.asset_tag, a.serial_number, a.condition as current_condition, a.location, a.status as asset_status,
             u.name as auditor_name,
             d.name as allocated_department_name,
             al_user.name as allocated_user_name
      FROM audit_cycle_assets aca
      JOIN assets a ON aca.asset_id = a.id
      LEFT JOIN users u ON aca.auditor_id = u.id
      LEFT JOIN allocations al ON a.id = al.asset_id AND al.status = 'Active'
      LEFT JOIN departments d ON al.department_id = d.id
      LEFT JOIN users al_user ON al.user_id = al_user.id
      WHERE aca.audit_cycle_id = ?
      ORDER BY aca.id ASC
    `;
    const assets = await db.all(query, id);
    res.json({ assets });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/audits/cycles/:id/assets/:assetId
 * @desc Update verification status for a specific asset in an audit cycle (Auditors / Managers / Admins)
 */
router.put('/cycles/:id/assets/:assetId', authenticateToken, async (req, res, next) => {
  try {
    const { id, assetId } = req.params;
    const { verification_status, notes } = req.body;

    const allowedStatus = ['Pending', 'Verified', 'Missing', 'Damaged'];
    if (!verification_status || !allowedStatus.includes(verification_status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${allowedStatus.join(', ')}` });
    }

    const db = getDb();

    // Verify cycle is active
    const cycle = await db.get('SELECT status FROM audit_cycles WHERE id = ?', id);
    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found' });
    }

    if (cycle.status !== 'Active') {
      return res.status(400).json({ error: 'This audit cycle is locked or completed and cannot be updated.' });
    }

    // Verify record exists in cycle
    const record = await db.get(
      'SELECT id FROM audit_cycle_assets WHERE audit_cycle_id = ? AND asset_id = ?',
      id,
      assetId
    );

    if (!record) {
      return res.status(404).json({ error: 'Asset is not part of this audit cycle' });
    }

    // Update verification
    await db.run(
      `UPDATE audit_cycle_assets 
       SET verification_status = ?, notes = ?, auditor_id = ?, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE audit_cycle_id = ? AND asset_id = ?`,
      verification_status,
      notes || null,
      req.user.id,
      id,
      assetId
    );

    res.json({ message: 'Asset verification status updated successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/audits/cycles/:id/close
 * @desc Close audit cycle: lock updates and apply database changes for lost items (Admin / AssetManager only)
 */
router.post('/cycles/:id/close', authenticateToken, requireRole(['Admin', 'AssetManager']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // 1. Verify cycle exists
    const cycle = await db.get('SELECT * FROM audit_cycles WHERE id = ?', id);
    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found' });
    }

    if (cycle.status !== 'Active') {
      return res.status(400).json({ error: 'Audit cycle is already closed/completed' });
    }

    // 2. Query all missing and damaged assets in this cycle
    const items = await db.all(
      'SELECT asset_id, verification_status FROM audit_cycle_assets WHERE audit_cycle_id = ?',
      id
    );

    let missingCount = 0;
    let damagedCount = 0;

    for (const item of items) {
      if (item.verification_status === 'Missing') {
        // Mark asset as Lost in main inventory
        await db.run("UPDATE assets SET status = 'Lost', updated_at = CURRENT_TIMESTAMP WHERE id = ?", item.asset_id);
        missingCount++;
      } else if (item.verification_status === 'Damaged') {
        // Update condition to Damaged
        await db.run("UPDATE assets SET condition = 'Damaged', updated_at = CURRENT_TIMESTAMP WHERE id = ?", item.asset_id);
        damagedCount++;
      }
    }

    // 3. Lock cycle status to 'Completed'
    await db.run(
      `UPDATE audit_cycles SET status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      id
    );

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      req.user.id,
      'Close Audit Cycle',
      `Closed audit cycle ${cycle.name} (ID: ${id}). Flagged ${missingCount} assets as Lost and ${damagedCount} as Damaged.`
    );

    res.json({
      message: 'Audit cycle successfully closed and locked. Main assets inventory updated.',
      missingCount,
      damagedCount
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/audits/cycles/:id/report
 * @desc Get discrepancy report for a specific audit cycle
 */
router.get('/cycles/:id/report', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // Verify cycle exists
    const cycle = await db.get('SELECT * FROM audit_cycles WHERE id = ?', id);
    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found' });
    }

    // Discrepancy means items marked Missing or Damaged, or still Pending (if closed/ongoing)
    const discrepancies = await db.all(
      `SELECT aca.*, 
             a.name as asset_name, a.asset_tag, a.serial_number, a.condition as current_condition, a.location,
             u.name as auditor_name,
             al_user.name as allocated_user_name,
             d.name as allocated_department_name
      FROM audit_cycle_assets aca
      JOIN assets a ON aca.asset_id = a.id
      LEFT JOIN users u ON aca.auditor_id = u.id
      LEFT JOIN allocations al ON a.id = al.asset_id AND al.status = 'Active'
      LEFT JOIN departments d ON al.department_id = d.id
      LEFT JOIN users al_user ON al.user_id = al_user.id
      WHERE aca.audit_cycle_id = ? 
        AND aca.verification_status IN ('Missing', 'Damaged', 'Pending')
      ORDER BY aca.verification_status DESC`,
      id
    );

    res.json({
      cycle,
      discrepancies
    });
  } catch (error) {
    next(error);
  }
});

export default router;
