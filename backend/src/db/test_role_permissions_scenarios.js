import { initDb, getDb } from '../config/db.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import authRoutes from '../routes/auth.js';
import allocationRoutes from '../routes/allocations.js';
import transferRoutes from '../routes/transfers.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Configure dotenv
dotenv.config();

const PORT = 5990;
const API_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('=== STARTING USER ROLES & AUTHORIZATION WORKFLOW INTEGRATION TESTS ===');

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

    // Seed departments: IT Department (1) and HR Department (2)
    const itDeptResult = await db.run(`INSERT INTO departments (name, status) VALUES ('IT Department', 'Active')`);
    const itDeptId = itDeptResult.lastID;
    const hrDeptResult = await db.run(`INSERT INTO departments (name, status) VALUES ('HR Department', 'Active')`);
    const hrDeptId = hrDeptResult.lastID;

    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash('admin123', salt);
    const priyaHash = await bcrypt.hash('employee123', salt);
    const managerHash = await bcrypt.hash('manager123', salt);
    const rajHash = await bcrypt.hash('head123', salt);

    // Users: Admin (1), Employee Priya (2), Asset Manager (3), IT Head Raj (4)
    await db.run(`INSERT INTO users (name, email, password_hash, role, status) VALUES ('System Admin', 'admin@assetflow.com', ?, 'Admin', 'Active')`, adminHash);
    const priyaResult = await db.run(`INSERT INTO users (name, email, password_hash, role, department_id, status) VALUES ('Priya Sharma', 'priya@assetflow.com', ?, 'Employee', ?, 'Active')`, priyaHash, itDeptId);
    const priyaId = priyaResult.lastID;
    const managerResult = await db.run(`INSERT INTO users (name, email, password_hash, role, department_id, status) VALUES ('Asset Manager User', 'manager@assetflow.com', ?, 'AssetManager', ?, 'Active')`, managerHash, itDeptId);
    const managerId = managerResult.lastID;
    const rajResult = await db.run(`INSERT INTO users (name, email, password_hash, role, department_id, status) VALUES ('Raj Patel', 'raj@assetflow.com', ?, 'DepartmentHead', ?, 'Active')`, rajHash, itDeptId);
    const rajId = rajResult.lastID;

    // Set Raj as head of IT department
    await db.run('UPDATE departments SET head_id = ? WHERE id = ?', rajId, itDeptId);

    const electronicsResult = await db.run(`INSERT INTO categories (name, custom_fields) VALUES ('Electronics', '{"warranty_period_months": 24}')`);
    const electronicsId = electronicsResult.lastID;

    // Assets: Lenovo Laptop (IT asset), Dell Laptop (HR asset)
    const lenovoResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, serial_number, condition, location, status) VALUES (?, ?, ?, ?, 'Good', 'IT Office Room 101', 'Allocated')`, 'Lenovo ThinkPad X1 Carbon', electronicsId, 'AF-0001', 'SN-LENOVO12345');
    const lenovoId = lenovoResult.lastID;
    const dellResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, serial_number, condition, location, status) VALUES (?, ?, ?, ?, 'Good', 'HR Lounge Cubicle 4', 'Allocated')`, 'Dell Latitude 5420', electronicsId, 'AF-0002', 'SN-DELL67890');
    const dellId = dellResult.lastID;

    // Allocate Lenovo to Priya (in IT)
    const allocLenovoRes = await db.run(`INSERT INTO allocations (asset_id, user_id, allocated_by, allocation_date, status) VALUES (?, ?, ?, NOW(), 'Active')`, lenovoId, priyaId, managerId);
    const allocLenovoId = allocLenovoRes.lastID;

    // Allocate Dell to HR Department directly
    const allocDellRes = await db.run(`INSERT INTO allocations (asset_id, department_id, allocated_by, allocation_date, status) VALUES (?, ?, ?, NOW(), 'Active')`, dellId, hrDeptId, managerId);
    const allocDellId = allocDellRes.lastID;

    console.log('Seeding completed successfully in test context.');

    // Log in Priya (Employee)
    const loginPriyaRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@assetflow.com', password: 'employee123' })
    });
    const priyaData = await loginPriyaRes.json();
    const priyaToken = priyaData.token;

    // Log in Manager
    const loginManagerRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'manager@assetflow.com', password: 'manager123' })
    });
    const managerData = await loginManagerRes.json();
    const managerToken = managerData.token;

    // Log in Raj (IT Department Head)
    const loginRajRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'raj@assetflow.com', password: 'head123' })
    });
    const rajData = await loginRajRes.json();
    const rajToken = rajData.token;

    // 1. Verify Return Approval Lock (Priya blocked, Manager allowed)
    console.log('\n[1] Testing Return Approval Access Control...');
    const priyaReturnRes = await fetch(`${API_URL}/allocations/${allocLenovoId}/return`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${priyaToken}` 
      },
      body: JSON.stringify({ condition: 'Good' })
    });
    console.log('  Employee return processing status:', priyaReturnRes.status);
    if (priyaReturnRes.status !== 403) {
      throw new Error('Employees should be blocked from processing/approving returns');
    }

    const managerReturnRes = await fetch(`${API_URL}/allocations/${allocLenovoId}/return`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${managerToken}` 
      },
      body: JSON.stringify({ condition: 'Good', return_notes: 'Returned by employee' })
    });
    console.log('  Asset Manager return processing status:', managerReturnRes.status);
    if (managerReturnRes.status !== 200) {
      throw new Error('Asset Manager failed to process return');
    }
    console.log('  -> Return approval access controls passed!');

    // 2. Verify Return Request Initiation (Priya initiates return request on a new allocation)
    console.log('\n[2] Testing Employee Return Request Initiation...');
    // Re-allocate Lenovo to Priya
    const allocLenovo2Res = await db.run(`INSERT INTO allocations (asset_id, user_id, allocated_by, allocation_date, status) VALUES (?, ?, ?, NOW(), 'Active')`, lenovoId, priyaId, managerId);
    const allocLenovo2Id = allocLenovo2Res.lastID;
    // Set Lenovo asset status back to Allocated
    await db.run("UPDATE assets SET status = 'Allocated' WHERE id = ?", lenovoId);

    const requestReturnRes = await fetch(`${API_URL}/allocations/${allocLenovo2Id}/request-return`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${priyaToken}` }
    });
    console.log('  Employee return request initiation status:', requestReturnRes.status);
    const requestReturnData = await requestReturnRes.json();
    if (requestReturnRes.status !== 200) {
      throw new Error('Employee failed to initiate return request');
    }

    // Verify Manager received the notification alert
    const managerNotify = await db.get(
      `SELECT * FROM notifications 
       WHERE user_id = ? AND type = 'Return Requested' 
       ORDER BY id DESC LIMIT 1`,
      managerId
    );
    console.log('  Manager Return Requested notification found:', managerNotify ? 'Yes' : 'No');
    if (!managerNotify || !managerNotify.message.includes('Priya Sharma')) {
      throw new Error('Asset Manager did not receive correct alert notification');
    }
    console.log('  -> Return request alert notification passed!');

    // 3. Verify Department-Scoped Head Approvals
    console.log('\n[3] Testing Department Head Scoped Approvals...');
    // Request transfer for Lenovo (Priya's IT Laptop) to HR Department
    const transLenovoId = (await db.run(
      `INSERT INTO transfers (asset_id, from_user_id, to_department_id, requested_by, status) 
       VALUES (?, ?, ?, ?, 'Pending')`,
      lenovoId,
      priyaId,
      hrDeptId,
      priyaId
    )).lastID;

    // Request transfer for Dell (HR Department Laptop) to IT Department
    const transDellId = (await db.run(
      `INSERT INTO transfers (asset_id, to_department_id, requested_by, status) 
       VALUES (?, ?, ?, 'Pending')`,
      dellId,
      itDeptId,
      priyaId
    )).lastID;

    // Raj (IT Head) attempts to approve Lenovo transfer (from IT department)
    console.log('  IT Head Raj approving IT asset transfer...');
    const rajApproveLenovoRes = await fetch(`${API_URL}/transfers/${transLenovoId}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${rajToken}` }
    });
    console.log('  IT Head approval status on IT asset:', rajApproveLenovoRes.status);
    if (rajApproveLenovoRes.status !== 200) {
      throw new Error('Department Head failed to approve transfer within their department');
    }

    // Raj (IT Head) attempts to approve Dell transfer (from HR department)
    console.log('  IT Head Raj approving HR asset transfer...');
    const rajApproveDellRes = await fetch(`${API_URL}/transfers/${transDellId}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${rajToken}` }
    });
    console.log('  IT Head approval status on HR asset (foreign department):', rajApproveDellRes.status);
    if (rajApproveDellRes.status !== 403) {
      throw new Error('Department Head approved asset transfer belonging to another department');
    }
    console.log('  -> Department Head scoped transfer controls passed!');

    console.log('\n=== ALL USER ROLES & AUTHORIZATION WORKFLOW INTEGRATION TESTS PASSED! ===');

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
  app.use('/api/allocations', allocationRoutes);
  app.use('/api/transfers', transferRoutes);
  app.use(errorHandler);
  return app;
}

runTests();
