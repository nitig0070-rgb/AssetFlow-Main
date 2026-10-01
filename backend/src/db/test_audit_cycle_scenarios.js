import { initDb, getDb } from '../config/db.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import authRoutes from '../routes/auth.js';
import auditRoutes from '../routes/audit.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Configure dotenv
dotenv.config();

const PORT = 5992;
const API_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('=== STARTING ASSET AUDIT WORKFLOW INTEGRATION TESTS ===');

  const app = reportAppSetup();
  const server = app.listen(PORT);
  console.log(`Test Express server running on port ${PORT}`);

  try {
    const db = await initDb();

    // Reset database state programmatically for clean test execution
    console.log('Resetting database tables (PostgreSQL)...');
    await db.exec(`
      TRUNCATE TABLE 
        audit_logs, notifications, maintenance_requests, bookings, transfers, 
        allocations, assets, users, departments, categories 
      RESTART IDENTITY CASCADE
    `);

    // Seed data
    const itDeptResult = await db.run(`INSERT INTO departments (name, status) VALUES ('IT Department', 'Active')`);
    const itDeptId = itDeptResult.lastID;

    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash('admin123', salt);
    const priyaHash = await bcrypt.hash('employee123', salt);

    await db.run(`INSERT INTO users (name, email, password_hash, role, status) VALUES ('System Admin', 'admin@assetflow.com', ?, 'Admin', 'Active')`, adminHash);
    const priyaResult = await db.run(`INSERT INTO users (name, email, password_hash, role, department_id, status) VALUES ('Priya Sharma', 'priya@assetflow.com', ?, 'Employee', ?, 'Active')`, priyaHash, itDeptId);
    const priyaId = priyaResult.lastID;

    const electronicsResult = await db.run(`INSERT INTO categories (name, custom_fields) VALUES ('Electronics', '{"warranty_period_months": 24}')`);
    const electronicsId = electronicsResult.lastID;

    // Assets
    const lenovoResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, serial_number, condition, location, status) VALUES (?, ?, ?, ?, 'Good', 'IT Office Room 101', 'Allocated')`, 'Lenovo ThinkPad X1 Carbon', electronicsId, 'AF-0001', 'SN-LENOVO12345');
    const lenovoId = lenovoResult.lastID;
    const dellResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, serial_number, condition, location, status) VALUES (?, ?, ?, ?, 'Good', 'IT Storage Locker', 'Available')`, 'Dell Latitude 5420', electronicsId, 'AF-0002', 'SN-DELL67890');
    const dellId = dellResult.lastID;

    // Allocate Lenovo to Priya (in IT department)
    await db.run(`INSERT INTO allocations (asset_id, user_id, allocated_by, allocation_date, status) VALUES (?, ?, ?, NOW(), 'Active')`, lenovoId, priyaId, priyaId);

    console.log('Seeding completed successfully in test context.');

    // Log in Admin
    const loginAdminRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@assetflow.com', password: 'admin123' })
    });
    const adminData = await loginAdminRes.json();
    const adminToken = adminData.token;

    // Log in Priya (Auditor helper)
    const loginPriyaRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@assetflow.com', password: 'employee123' })
    });
    const priyaData = await loginPriyaRes.json();
    const priyaToken = priyaData.token;

    // 1. Create Audit Cycle (Unscoped - includes all assets)
    console.log('\n[1] Creating Unscoped Audit Cycle...');
    const cycleRes = await fetch(`${API_URL}/audits`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}` 
      },
      body: JSON.stringify({
        name: 'Quarterly General Inventory Audit Q3',
        start_date: '2026-07-01',
        end_date: '2026-07-31',
        auditor_ids: [priyaId]
      })
    });
    console.log('  Create cycle status:', cycleRes.status);
    const cycleData = await cycleRes.json();
    if (cycleRes.status !== 201) {
      throw new Error(`Expected 201, got ${cycleRes.status}: ${JSON.stringify(cycleData)}`);
    }
    const cycleId = cycleData.cycle.id;
    console.log(`  Cycle created successfully. ID: ${cycleId}, Scoped assets: ${cycleData.cycle.assetsCount}`);
    if (cycleData.cycle.assetsCount !== 2) {
      throw new Error(`Expected 2 scoped assets, got ${cycleData.cycle.assetsCount}`);
    }

    // 2. Start the Audit Cycle
    console.log('\n[2] Starting Audit Cycle (Draft -> Active)...');
    const startRes = await fetch(`${API_URL}/audits/${cycleId}/start`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.log('  Start cycle status:', startRes.status);
    const startData = await startRes.json();
    if (startRes.status !== 200 || startData.status !== 'Active') {
      throw new Error('Failed to start cycle');
    }

    // 3. Auditor verifies individual assets
    console.log('\n[3] Auditor verifies assets in cycle...');
    // Retrieve list of scoped audit assets in cycle
    const cycleDetailsRes = await fetch(`${API_URL}/audits/${cycleId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const cycleDetailsData = await cycleDetailsRes.json();
    
    // Find audit asset IDs
    const lenovoAuditAsset = cycleDetailsData.assets.find(a => a.asset_id === lenovoId);
    const dellAuditAsset = cycleDetailsData.assets.find(a => a.asset_id === dellId);

    // Verify Lenovo as 'Verified'
    console.log('  Verifying Lenovo as Verified...');
    const verifyLenovoRes = await fetch(`${API_URL}/audits/assets/${lenovoAuditAsset.audit_asset_id}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${priyaToken}`
      },
      body: JSON.stringify({
        verification_status: 'Verified',
        notes: 'In perfect working condition'
      })
    });
    console.log('  Verify Lenovo status:', verifyLenovoRes.status);

    // Verify Dell as 'Missing'
    console.log('  Verifying Dell as Missing...');
    const verifyDellRes = await fetch(`${API_URL}/audits/assets/${dellAuditAsset.audit_asset_id}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${priyaToken}`
      },
      body: JSON.stringify({
        verification_status: 'Missing',
        notes: 'Locker is empty. Searched everywhere.'
      })
    });
    console.log('  Verify Dell status:', verifyDellRes.status);

    if (verifyLenovoRes.status !== 200 || verifyDellRes.status !== 200) {
      throw new Error('Verification request(s) failed');
    }
    console.log('  -> Auditor check-ins verification passed!');

    // 4. Retrieve Discrepancy Report
    console.log('\n[4] Generating Discrepancy Report...');
    const discRes = await fetch(`${API_URL}/audits/${cycleId}/discrepancies`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.log('  Report retrieval status:', discRes.status);
    const discData = await discRes.json();
    console.log('  Discrepancy items count:', discData.discrepancies.length);
    
    if (discData.discrepancies.length !== 1 || discData.discrepancies[0].asset_id !== dellId) {
      throw new Error('Discrepancy report did not accurately isolate the missing Dell Laptop');
    }
    console.log('  Discrepancy Item details:', discData.discrepancies[0].notes);
    console.log('  -> Discrepancy reporting verification passed!');

    // 5. Close Cycle (updates Dell status to 'Lost' automatically)
    console.log('\n[5] Closing Audit Cycle & Reconciling Asset Statuses...');
    const closeRes = await fetch(`${API_URL}/audits/${cycleId}/close`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.log('  Close cycle status:', closeRes.status);
    if (closeRes.status !== 200) {
      throw new Error('Failed to close audit cycle');
    }

    // Verify Dell Laptop status is updated to Lost in DB
    const finalDellAsset = await db.get('SELECT status FROM assets WHERE id = ?', dellId);
    console.log('  Final Dell Laptop status in database:', finalDellAsset.status);
    if (finalDellAsset.status !== 'Lost') {
      throw new Error('Dell Laptop status was not updated to Lost on cycle closure');
    }

    // Verify Lenovo status remains Allocated
    const finalLenovoAsset = await db.get('SELECT status FROM assets WHERE id = ?', lenovoId);
    console.log('  Final Lenovo status in database:', finalLenovoAsset.status);
    if (finalLenovoAsset.status !== 'Allocated') {
      throw new Error('Lenovo Laptop status changed unexpectedly');
    }

    console.log('  -> Reconciliations & cycle closure passed!');

    console.log('\n=== ALL ASSET AUDIT WORKFLOW INTEGRATION TESTS PASSED! ===');

  } catch (error) {
    console.error('\n!!! Integration tests failed with error:', error);
    process.exitCode = 1;
  } finally {
    server.close(() => {
      console.log('Test Express server shut down.');
      console.log('=== END INTEGRATION TEST RUN ===');
    });
  }
}

function reportAppSetup() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/audits', auditRoutes);
  app.use(errorHandler);
  return app;
}

runTests();
