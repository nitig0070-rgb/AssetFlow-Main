import { initDb, getDb } from '../config/db.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import authRoutes from '../routes/auth.js';
import assetRoutes from '../routes/assets.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Configure dotenv
dotenv.config();

const PORT = 5996;
const API_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('=== STARTING ASSET REGISTRATION & DIRECTORY INTEGRATION TESTS ===');

  // Set up Express app programmatically with relevant routes
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  app.use('/api/auth', authRoutes);
  app.use('/api/assets', assetRoutes);
  
  app.use(errorHandler);

  const server = app.listen(PORT);
  console.log(`Test Express server running on port ${PORT}`);

  try {
    const db = await initDb();

    // Reset database state programmatically for clean test execution
    console.log('Resetting and seeding database for clean integration test...');
    await db.exec(`
      TRUNCATE TABLE 
        audit_logs, notifications, maintenance_requests, bookings, transfers, 
        allocations, assets, users, departments, categories 
      RESTART IDENTITY CASCADE
    `);

    // Seed departments, users, categories, assets, allocations, bookings, maintenance requests
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
    const roomsResult = await db.run(`INSERT INTO categories (name, custom_fields) VALUES ('Rooms', '{"capacity": 10}')`);
    const roomsId = roomsResult.lastID;
    const vehiclesResult = await db.run(`INSERT INTO categories (name, custom_fields) VALUES ('Vehicles', '{"license_plate": true}')`);
    const vehiclesId = vehiclesResult.lastID;

    // Assets
    const lenovoResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, serial_number, condition, location, status) VALUES (?, ?, ?, ?, 'Good', 'IT Office Room 101', 'Allocated')`, 'Lenovo ThinkPad X1 Carbon', electronicsId, 'AF-0001', 'SN-LENOVO12345');
    const lenovoId = lenovoResult.lastID;
    const dellResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, serial_number, condition, location, status) VALUES (?, ?, ?, ?, 'Good', 'IT Storage Locker', 'Available')`, 'Dell Latitude 5420', electronicsId, 'AF-0002', 'SN-DELL67890');
    const dellId = dellResult.lastID;
    const confRoomResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, condition, location, is_bookable, status) VALUES (?, ?, ?, 'New', 'HQ 2nd Floor Room A', 1, 'Available')`, 'Conference Room A', roomsId, 'AF-0003');
    const confRoomId = confRoomResult.lastID;
    const teslaResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, serial_number, condition, location, is_bookable, status) VALUES (?, ?, ?, ?, 'Fair', 'HQ Parking Lot B', 1, 'Under Maintenance')`, 'Tesla Model 3', vehiclesId, 'AF-0004', 'SN-TESLA777');
    const teslaId = teslaResult.lastID;

    // Allocations
    await db.run(`INSERT INTO allocations (asset_id, user_id, allocated_by, allocation_date, expected_return_date, status) VALUES (?, ?, ?, NOW() - INTERVAL '15 days', NOW() - INTERVAL '5 days', 'Active')`, lenovoId, priyaId, managerId);

    // Maintenance
    await db.run(`INSERT INTO maintenance_requests (asset_id, requested_by, description, priority, status) VALUES (?, ?, 'Squeaky brakes and minor alignment check', 'High', 'In Progress')`, teslaId, priyaId);

    console.log('Seeding completed successfully in test context.');

    // Obtain JWT
    const loginPriyaRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@assetflow.com', password: 'employee123' })
    });
    const priyaData = await loginPriyaRes.json();
    const priyaToken = priyaData.token;

    // 1. Verify Listing & Search
    console.log('\n[1] Testing Asset Directory Listing...');
    const listRes = await fetch(`${API_URL}/assets`, {
      headers: { 'Authorization': `Bearer ${priyaToken}` }
    });
    const listData = await listRes.json();
    console.log('  Total assets listed:', listData.assets.length);
    if (listData.assets.length !== 4) {
      throw new Error(`Expected 4 assets, got ${listData.assets.length}`);
    }

    // 2. Verify Department Filter
    console.log('\n[2] Testing Department Filtering...');
    const filteredRes = await fetch(`${API_URL}/assets?department_id=${itDeptId}`, {
      headers: { 'Authorization': `Bearer ${priyaToken}` }
    });
    const filteredData = await filteredRes.json();
    console.log('  Assets allocated to IT Department:', filteredData.assets.length);
    // Only Lenovo ThinkPad is active allocated to Priya who is in IT (itDeptId = 1)
    if (filteredData.assets.length !== 1 || filteredData.assets[0].asset_tag !== 'AF-0001') {
      throw new Error('Department filtering query failed to return correct active asset');
    }
    console.log('  -> Department filter verification passed!');

    // 3. Verify Single Asset Details by ID (Lenovo)
    console.log('\n[3] Testing Single Asset Details by ID (Lenovo ThinkPad)...');
    const detailIdRes = await fetch(`${API_URL}/assets/${lenovoId}`, {
      headers: { 'Authorization': `Bearer ${priyaToken}` }
    });
    const detailIdData = await detailIdRes.json();
    
    console.log('  Asset Name:', detailIdData.asset.name);
    console.log('  Active Allocation User:', detailIdData.activeAllocation ? detailIdData.activeAllocation.user_name : 'None');
    console.log('  Allocation History Count:', detailIdData.history.allocations.length);
    console.log('  Maintenance History Count:', detailIdData.history.maintenance.length);

    if (detailIdData.asset.asset_tag !== 'AF-0001') {
      throw new Error('Incorrect asset tag returned for details lookup');
    }
    if (!detailIdData.activeAllocation || detailIdData.activeAllocation.user_name !== 'Priya Sharma') {
      throw new Error('Active allocation missing or incorrect');
    }
    if (detailIdData.history.allocations.length !== 1 || detailIdData.history.maintenance.length !== 0) {
      throw new Error('Asset logs and history lists mismatch');
    }
    console.log('  -> Details lookup by ID and history logs passed!');

    // 4. Verify Single Asset Details by Tag (Tesla Model 3)
    console.log('\n[4] Testing Single Asset Details by Tag (Tesla Model 3)...');
    const detailTagRes = await fetch(`${API_URL}/assets/AF-0004`, {
      headers: { 'Authorization': `Bearer ${priyaToken}` }
    });
    const detailTagData = await detailTagRes.json();

    console.log('  Asset Name:', detailTagData.asset.name);
    console.log('  Active Allocation state:', detailTagData.activeAllocation ? 'Active' : 'None');
    console.log('  Maintenance History count:', detailTagData.history.maintenance.length);

    if (detailTagData.asset.id !== teslaId) {
      throw new Error('Incorrect asset returned for tag-based details lookup');
    }
    if (detailTagData.history.maintenance.length !== 1 || detailTagData.history.maintenance[0].priority !== 'High') {
      throw new Error('Maintenance request history missing or incorrect for details lookup');
    }
    console.log('  -> Details lookup by Tag and history logs passed!');

    // 5. Verify 404 Error State
    console.log('\n[5] Testing Asset Detail 404 Not Found error...');
    const errRes = await fetch(`${API_URL}/assets/9999`, {
      headers: { 'Authorization': `Bearer ${priyaToken}` }
    });
    console.log('  404 test status:', errRes.status);
    if (errRes.status !== 404) {
      throw new Error('Request to non-existing asset did not return 404');
    }
    console.log('  -> 404 error verification passed!');

    console.log('\n=== ALL ASSET REGISTRATION & DIRECTORY INTEGRATION TESTS PASSED! ===');

  } catch (error) {
    console.error('\n!!! Integration tests failed with error:', error);
    process.exitCode = 1;
  } finally {
    // Shut down server
    server.close(() => {
      console.log('Test Express server shut down.');
      console.log('=== END INTEGRATION TEST RUN ===');
    });
  }
}

runTests();
