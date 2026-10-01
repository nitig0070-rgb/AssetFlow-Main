import { initDb, getDb } from '../config/db.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import authRoutes from '../routes/auth.js';
import maintenanceRoutes from '../routes/maintenance.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Configure dotenv
dotenv.config();

const PORT = 5993;
const API_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('=== STARTING MAINTENANCE WORKFLOW INTEGRATION TESTS ===');

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
    const managerHash = await bcrypt.hash('manager123', salt);

    await db.run(`INSERT INTO users (name, email, password_hash, role, status) VALUES ('System Admin', 'admin@assetflow.com', ?, 'Admin', 'Active')`, adminHash);
    const priyaResult = await db.run(`INSERT INTO users (name, email, password_hash, role, department_id, status) VALUES ('Priya Sharma', 'priya@assetflow.com', ?, 'Employee', ?, 'Active')`, priyaHash, itDeptId);
    const priyaId = priyaResult.lastID;
    const managerResult = await db.run(`INSERT INTO users (name, email, password_hash, role, department_id, status) VALUES ('Asset Manager User', 'manager@assetflow.com', ?, 'AssetManager', ?, 'Active')`, managerHash, itDeptId);
    const managerId = managerResult.lastID;

    const electronicsResult = await db.run(`INSERT INTO categories (name, custom_fields) VALUES ('Electronics', '{"warranty_period_months": 24}')`);
    const electronicsId = electronicsResult.lastID;

    // Assets: Dell Laptop
    const dellResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, serial_number, condition, location, status) VALUES (?, ?, ?, ?, 'Good', 'IT Storage Locker', 'Available')`, 'Dell Latitude 5420', electronicsId, 'AF-0002', 'SN-DELL67890');
    const dellId = dellResult.lastID;

    console.log('Seeding completed successfully in test context.');

    // Log in Asset Manager
    const loginManagerRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'manager@assetflow.com', password: 'manager123' })
    });
    const managerData = await loginManagerRes.json();
    const managerToken = managerData.token;

    // Log in Priya
    const loginPriyaRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@assetflow.com', password: 'employee123' })
    });
    const priyaData = await loginPriyaRes.json();
    const priyaToken = priyaData.token;

    // 1. Raise Maintenance Request (Priya)
    console.log('\n[1] Raising Maintenance Request (Priya)...');
    const raiseRes = await fetch(`${API_URL}/maintenance`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${priyaToken}` 
      },
      body: JSON.stringify({
        asset_id: dellId,
        description: 'Screen is flickering',
        priority: 'Medium'
      })
    });
    console.log('  Raise request status:', raiseRes.status);
    const raiseData = await raiseRes.json();
    if (raiseRes.status !== 201) {
      throw new Error(`Expected 201, got ${raiseRes.status}`);
    }
    const requestId = raiseData.request.id;

    // 2. Reject request
    console.log('\n[2] Rejecting Request as Manager...');
    const rejectRes = await fetch(`${API_URL}/maintenance/${requestId}/review`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${managerToken}` 
      },
      body: JSON.stringify({
        status: 'Rejected',
        rejection_remarks: 'Not a valid hardware issue'
      })
    });
    console.log('  Reject response status:', rejectRes.status);
    const rejectData = await rejectRes.json();
    if (rejectRes.status !== 200 || rejectData.status !== 'Rejected') {
      throw new Error('Failed to reject request');
    }

    // Raise another request to proceed with approval flow
    console.log('  Raising new request for approval...');
    const raise2Res = await fetch(`${API_URL}/maintenance`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${priyaToken}` 
      },
      body: JSON.stringify({
        asset_id: dellId,
        description: 'Battery swollen',
        priority: 'Critical'
      })
    });
    const raise2Data = await raise2Res.json();
    const request2Id = raise2Data.request.id;

    // 3. Approve Request 2 (Asset status updates to 'Under Maintenance')
    console.log('\n[3] Approving Request 2 as Manager...');
    const approveRes = await fetch(`${API_URL}/maintenance/${request2Id}/review`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${managerToken}` 
      },
      body: JSON.stringify({
        status: 'Approved'
      })
    });
    console.log('  Approve status:', approveRes.status);
    if (approveRes.status !== 200) {
      throw new Error('Failed to approve request');
    }

    // Verify asset status changed to Under Maintenance
    const assetStateApprove = await db.get('SELECT status FROM assets WHERE id = ?', dellId);
    console.log('  Asset status in DB after approval:', assetStateApprove.status);
    if (assetStateApprove.status !== 'Under Maintenance') {
      throw new Error('Asset status did not update to Under Maintenance');
    }
    console.log('  -> Approval and asset status updates passed!');

    // 4. Assign Technician
    console.log('\n[4] Assigning Technician to Request 2...');
    const assignRes = await fetch(`${API_URL}/maintenance/${request2Id}/assign`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${managerToken}` 
      },
      body: JSON.stringify({
        assigned_technician_id: managerId // Assigning to Manager User as a technician for simplicity
      })
    });
    console.log('  Assign status:', assignRes.status);
    if (assignRes.status !== 200) {
      throw new Error('Failed to assign technician');
    }
    const dbReqAssign = await db.get('SELECT status, assigned_technician_id FROM maintenance_requests WHERE id = ?', request2Id);
    console.log('  Request status in DB:', dbReqAssign.status);
    if (dbReqAssign.status !== 'Technician Assigned' || dbReqAssign.assigned_technician_id !== managerId) {
      throw new Error('Request assigned details were incorrect in DB');
    }
    console.log('  -> Technician routing verification passed!');

    // 5. Start Work
    console.log('\n[5] Transitioning Request to In Progress...');
    const startRes = await fetch(`${API_URL}/maintenance/${request2Id}/start`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    console.log('  Start status:', startRes.status);
    if (startRes.status !== 200) {
      throw new Error('Failed to start repair work');
    }
    const dbReqStart = await db.get('SELECT status FROM maintenance_requests WHERE id = ?', request2Id);
    console.log('  Request status in DB:', dbReqStart.status);
    if (dbReqStart.status !== 'In Progress') {
      throw new Error('Request status did not transition to In Progress');
    }
    console.log('  -> Start repair workflow passed!');

    // 6. Resolve Work (Asset status reverts to 'Available', condition changes to 'Fair')
    console.log('\n[6] Resolving Request and Reverting Asset status...');
    const resolveRes = await fetch(`${API_URL}/maintenance/${request2Id}/resolve`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${managerToken}` 
      },
      body: JSON.stringify({
        resolution_notes: 'Battery replaced successfully',
        condition: 'Good'
      })
    });
    console.log('  Resolve status:', resolveRes.status);
    if (resolveRes.status !== 200) {
      throw new Error('Failed to resolve request');
    }

    // Verify request is Resolved
    const dbReqFinal = await db.get('SELECT status, resolved_date, resolution_notes FROM maintenance_requests WHERE id = ?', request2Id);
    console.log('  Final request status in DB:', dbReqFinal.status);
    console.log('  Final request resolved date:', dbReqFinal.resolved_date);
    if (dbReqFinal.status !== 'Resolved' || !dbReqFinal.resolved_date) {
      throw new Error('Request did not resolve correctly in DB');
    }

    // Verify asset is Available and condition is Good
    const dbAssetFinal = await db.get('SELECT status, condition FROM assets WHERE id = ?', dellId);
    console.log('  Final Asset status in DB:', dbAssetFinal.status);
    console.log('  Final Asset condition in DB:', dbAssetFinal.condition);
    if (dbAssetFinal.status !== 'Available' || dbAssetFinal.condition !== 'Good') {
      throw new Error('Asset status or condition was not reverted correctly in DB');
    }
    console.log('  -> Resolution workflow passed!');

    console.log('\n=== ALL MAINTENANCE WORKFLOW INTEGRATION TESTS PASSED! ===');

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
  app.use('/api/maintenance', maintenanceRoutes);
  app.use(errorHandler);
  return app;
}

runTests();
