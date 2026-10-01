import { initDb, getDb } from '../config/db.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import authRoutes from '../routes/auth.js';
import allocationRoutes from '../routes/allocations.js';
import transferRoutes from '../routes/transfers.js';
import dashboardRoutes from '../routes/dashboard.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Configure dotenv
dotenv.config();

const PORT = 5995;
const API_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('=== STARTING ASSET ALLOCATION & TRANSFER WORKFLOW INTEGRATION TESTS ===');

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api/allocations', allocationRoutes);
  app.use('/api/transfers', transferRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  app.use(errorHandler);

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
    const hrDeptResult = await db.run(`INSERT INTO departments (name, status) VALUES ('HR Department', 'Active')`);
    const hrDeptId = hrDeptResult.lastID;

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

    // Assets
    const lenovoResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, serial_number, condition, location, status) VALUES (?, ?, ?, ?, 'Good', 'IT Office Room 101', 'Allocated')`, 'Lenovo ThinkPad X1 Carbon', electronicsId, 'AF-0001', 'SN-LENOVO12345');
    const lenovoId = lenovoResult.lastID;
    const dellResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, serial_number, condition, location, status) VALUES (?, ?, ?, ?, 'Good', 'IT Storage Locker', 'Available')`, 'Dell Latitude 5420', electronicsId, 'AF-0002', 'SN-DELL67890');
    const dellId = dellResult.lastID;

    // Existing active allocation (Lenovo Laptop to Priya)
    const initAllocRes = await db.run(`INSERT INTO allocations (asset_id, user_id, allocated_by, allocation_date, status) VALUES (?, ?, ?, NOW(), 'Active')`, lenovoId, priyaId, managerId);
    const initAllocId = initAllocRes.lastID;

    console.log('Seeding completed successfully in test context.');

    // Log in Asset Manager to get token
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

    // 1. Allocate Available Asset (Dell Laptop to Priya)
    console.log('\n[1] Testing Allocation of Available Asset...');
    const allocRes = await fetch(`${API_URL}/allocations`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${managerToken}` 
      },
      body: JSON.stringify({
        asset_id: dellId,
        user_id: priyaId,
        expected_return_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days out
      })
    });
    console.log('  Allocation status:', allocRes.status);
    const allocData = await allocRes.json();
    if (allocRes.status !== 201) {
      throw new Error(`Expected 210, got ${allocRes.status}: ${JSON.stringify(allocData)}`);
    }
    const dellAllocId = allocData.allocation.id;
    console.log(`  Allocation success. Allocation ID: ${dellAllocId}`);

    // Verify Asset status changed to 'Allocated'
    const dellAsset = await db.get('SELECT status FROM assets WHERE id = ?', dellId);
    console.log('  Dell Laptop status in database:', dellAsset.status);
    if (dellAsset.status !== 'Allocated') {
      throw new Error('Dell Laptop status was not updated to Allocated');
    }

    // 2. Conflict Rule Check (Trying to allocate Dell Laptop again)
    console.log('\n[2] Testing Conflict Check (allocating already-taken asset)...');
    const conflictRes = await fetch(`${API_URL}/allocations`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${managerToken}` 
      },
      body: JSON.stringify({
        asset_id: dellId,
        user_id: managerId
      })
    });
    console.log('  Conflict response status:', conflictRes.status);
    const conflictData = await conflictRes.json();
    console.log('  Conflict response body:', JSON.stringify(conflictData));
    
    if (conflictRes.status !== 400 || conflictData.error !== 'Conflict') {
      throw new Error('Overlapping allocation was not blocked with 400 Conflict');
    }
    if (!conflictData.message.includes('currently held by Priya Sharma')) {
      throw new Error('Conflict message did not indicate the current holder');
    }
    console.log('  -> Conflict rule check passed!');

    // 3. Return Flow
    console.log('\n[3] Testing Return Flow...');
    const returnRes = await fetch(`${API_URL}/allocations/${dellAllocId}/return`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${managerToken}` 
      },
      body: JSON.stringify({
        return_notes: 'Returned with minor scratches on screen',
        condition: 'Fair'
      })
    });
    console.log('  Return status:', returnRes.status);
    const returnData = await returnRes.json();
    if (returnRes.status !== 200) {
      throw new Error(`Expected 200, got ${returnRes.status}: ${JSON.stringify(returnData)}`);
    }

    // Verify allocation in DB is marked Returned
    const dbAlloc = await db.get('SELECT status, return_notes, returned_date FROM allocations WHERE id = ?', dellAllocId);
    console.log('  Allocation status in DB:', dbAlloc.status);
    console.log('  Allocation returned date:', dbAlloc.returned_date);
    if (dbAlloc.status !== 'Returned' || !dbAlloc.returned_date) {
      throw new Error('Allocation record was not updated correctly in database');
    }

    // Verify asset status reverted to Available and condition updated to Fair
    const dbAsset = await db.get('SELECT status, condition FROM assets WHERE id = ?', dellId);
    console.log('  Asset status in DB:', dbAsset.status);
    console.log('  Asset condition in DB:', dbAsset.condition);
    if (dbAsset.status !== 'Available' || dbAsset.condition !== 'Fair') {
      throw new Error('Asset status or condition was not reverted correctly in database');
    }
    console.log('  -> Return flow verification passed!');

    // 4. Transfer Workflow
    console.log('\n[4] Testing Transfer Workflow...');
    // Request a transfer for Lenovo Laptop (currently allocated to Priya) to the HR Department (hrDeptId = 2)
    const transferReqRes = await fetch(`${API_URL}/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${priyaToken}` // Priya requests transfer
      },
      body: JSON.stringify({
        asset_id: lenovoId,
        to_department_id: hrDeptId,
        remarks: 'Priya transferring IT department laptop to HR for new hire onboarding'
      })
    });
    console.log('  Transfer request status:', transferReqRes.status);
    const transferReqData = await transferReqRes.json();
    if (transferReqRes.status !== 201) {
      throw new Error(`Expected 201, got ${transferReqRes.status}: ${JSON.stringify(transferReqData)}`);
    }
    const transferId = transferReqData.transfer.id;
    console.log(`  Transfer request created. ID: ${transferId}`);

    // Verify in list
    const listTransfersRes = await fetch(`${API_URL}/transfers?status=Pending`, {
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    const listTransfersData = await listTransfersRes.json();
    console.log('  Pending transfers count:', listTransfersData.transfers.length);
    if (listTransfersData.transfers.length !== 1 || listTransfersData.transfers[0].id !== transferId) {
      throw new Error('Transfer was not retrieved in pending transfer list');
    }

    // Approve the transfer request (as Asset Manager)
    console.log('  Approving transfer request...');
    const approveRes = await fetch(`${API_URL}/transfers/${transferId}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    console.log('  Approve status:', approveRes.status);
    const approveData = await approveRes.json();
    if (approveRes.status !== 200) {
      throw new Error(`Expected 200, got ${approveRes.status}: ${JSON.stringify(approveData)}`);
    }

    // Verify transfer record status is Approved
    const dbTransfer = await db.get('SELECT status FROM transfers WHERE id = ?', transferId);
    console.log('  Transfer status in DB:', dbTransfer.status);
    if (dbTransfer.status !== 'Approved') {
      throw new Error('Transfer status in DB is not Approved');
    }

    // Verify Priya's allocation was marked Returned
    const formerAlloc = await db.get('SELECT status, return_notes FROM allocations WHERE id = ?', initAllocId);
    console.log('  Former allocation status:', formerAlloc.status);
    console.log('  Former allocation return notes:', formerAlloc.return_notes);
    if (formerAlloc.status !== 'Returned' || !formerAlloc.return_notes.includes('Transferred to Department')) {
      throw new Error('Former allocation was not closed correctly');
    }

    // Verify new active allocation exists for HR Department
    const newActiveAlloc = await db.get(
      `SELECT * FROM allocations 
       WHERE asset_id = ? AND department_id = ? AND status = 'Active' AND returned_date IS NULL`,
      lenovoId,
      hrDeptId
    );
    console.log('  New allocation generated:', newActiveAlloc ? 'Yes' : 'No');
    if (!newActiveAlloc) {
      throw new Error('No new active allocation found for the target department');
    }
    console.log('  -> Transfer workflow verification passed!');

    // 5. Overdue Returns Auto-flagging & Alerts
    console.log('\n[5] Testing Overdue Returns Auto-flagging...');
    // Manually insert an overdue allocation (yesterday)
    const overdueAllocId = (await db.run(
      `INSERT INTO allocations (asset_id, user_id, allocated_by, allocation_date, expected_return_date, status) 
       VALUES (?, ?, ?, NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day', 'Active')`,
      dellId,
      priyaId,
      managerId
    )).lastID;
    console.log(`  Injected overdue allocation ID: ${overdueAllocId}`);

    // Call dashboard endpoint to trigger auto-flagging
    console.log('  Accessing Priya dashboard (triggers check)...');
    const dashRes = await fetch(`${API_URL}/dashboard`, {
      headers: { 'Authorization': `Bearer ${priyaToken}` }
    });
    console.log('  Dashboard trigger status:', dashRes.status);

    // Verify that a notification has been generated in database for Priya
    const overdueNotification = await db.get(
      `SELECT * FROM notifications 
       WHERE user_id = ? AND type = 'Overdue Return Alert' 
       ORDER BY id DESC LIMIT 1`,
      priyaId
    );

    console.log('  Overdue Alert Notification found:', overdueNotification ? 'Yes' : 'No');
    if (overdueNotification) {
      console.log('  Notification Title:', overdueNotification.title);
      console.log('  Notification Message:', overdueNotification.message);
    }
    
    if (!overdueNotification || !overdueNotification.message.includes('overdue')) {
      throw new Error('Overdue return alert notification was not generated automatically');
    }
    console.log('  -> Overdue auto-flagging passed!');

    console.log('\n=== ALL ASSET ALLOCATION & TRANSFER WORKFLOW INTEGRATION TESTS PASSED! ===');

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

runTests();
