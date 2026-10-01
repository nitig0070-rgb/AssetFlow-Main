import { initDb, getDb } from '../config/db.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import authRoutes from '../routes/auth.js';
import dashboardRoutes from '../routes/dashboard.js';
import assetRoutes from '../routes/assets.js';
import bookingRoutes from '../routes/bookings.js';
import maintenanceRoutes from '../routes/maintenance.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Configure dotenv
dotenv.config();

const PORT = 5998;
const API_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('=== STARTING OPERATIONAL DASHBOARD & QUICK ACTIONS INTEGRATION TESTS ===');

  // Set up Express app programmatically with all routes
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/assets', assetRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/maintenance', maintenanceRoutes);
  
  app.use(errorHandler);

  const server = app.listen(PORT);
  console.log(`Test Express server running on port ${PORT}`);

  try {
    const db = await initDb();

    // Reset and seed database programmatically for clean test execution
    console.log('Resetting and seeding database for clean integration test...');
    await db.exec(`
      TRUNCATE TABLE 
        audit_logs, notifications, maintenance_requests, bookings, transfers, 
        allocations, assets, users, departments, categories 
      RESTART IDENTITY CASCADE
    `);

    const itDeptResult = await db.run(`INSERT INTO departments (name, status) VALUES ('IT Department', 'Active')`);
    const itDeptId = itDeptResult.lastID;
    const hrDeptResult = await db.run(`INSERT INTO departments (name, status) VALUES ('HR Department', 'Active')`);
    const hrDeptId = hrDeptResult.lastID;

    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash('admin123', salt);
    const priyaHash = await bcrypt.hash('employee123', salt);
    const managerHash = await bcrypt.hash('manager123', salt);
    const headHash = await bcrypt.hash('head123', salt);

    await db.run(`INSERT INTO users (name, email, password_hash, role, status) VALUES ('System Admin', 'admin@assetflow.com', ?, 'Admin', 'Active')`, adminHash);
    const priyaResult = await db.run(`INSERT INTO users (name, email, password_hash, role, department_id, status) VALUES ('Priya Sharma', 'priya@assetflow.com', ?, 'Employee', ?, 'Active')`, priyaHash, itDeptId);
    const priyaId = priyaResult.lastID;
    const managerResult = await db.run(`INSERT INTO users (name, email, password_hash, role, department_id, status) VALUES ('Asset Manager User', 'manager@assetflow.com', ?, 'AssetManager', ?, 'Active')`, managerHash, itDeptId);
    const managerId = managerResult.lastID;
    const headResult = await db.run(`INSERT INTO users (name, email, password_hash, role, department_id, status) VALUES ('Department Head User', 'head@assetflow.com', ?, 'DepartmentHead', ?, 'Active')`, headHash, itDeptId);
    const headId = headResult.lastID;

    await db.run('UPDATE departments SET head_id = ? WHERE id = ?', headId, itDeptId);

    const electronicsResult = await db.run(`INSERT INTO categories (name, custom_fields) VALUES ('Electronics', '{"warranty_period_months": 24}')`);
    const electronicsId = electronicsResult.lastID;
    const roomsResult = await db.run(`INSERT INTO categories (name, custom_fields) VALUES ('Rooms', '{"capacity": 10}')`);
    const roomsId = roomsResult.lastID;
    const vehiclesResult = await db.run(`INSERT INTO categories (name, custom_fields) VALUES ('Vehicles', '{"license_plate": true}')`);
    const vehiclesId = vehiclesResult.lastID;
    const furnitureResult = await db.run(`INSERT INTO categories (name, custom_fields) VALUES ('Furniture', '{"material": "Wood"}')`);
    const furnitureId = furnitureResult.lastID;

    const lenovoResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, condition, location, status) VALUES (?, ?, ?, ?, CURRENT_DATE - INTERVAL '1 year', 1200.0, 'Good', 'IT Office Room 101', 'Allocated')`, 'Lenovo ThinkPad X1 Carbon', electronicsId, 'AF-0001', 'SN-LENOVO12345');
    const lenovoId = lenovoResult.lastID;
    const dellResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, condition, location, status) VALUES (?, ?, ?, ?, CURRENT_DATE - INTERVAL '6 months', 1000.0, 'Good', 'IT Storage Locker', 'Available')`, 'Dell Latitude 5420', electronicsId, 'AF-0002', 'SN-DELL67890');
    const dellId = dellResult.lastID;
    const confRoomResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, condition, location, is_bookable, status) VALUES (?, ?, ?, 'New', 'HQ 2nd Floor Room A', 1, 'Available')`, 'Conference Room A', roomsId, 'AF-0003');
    const confRoomId = confRoomResult.lastID;
    const teslaResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, serial_number, condition, location, is_bookable, status) VALUES (?, ?, ?, ?, 'Fair', 'HQ Parking Lot B', 1, 'Under Maintenance')`, 'Tesla Model 3', vehiclesId, 'AF-0004', 'SN-TESLA777');
    const teslaId = teslaResult.lastID;
    const chairResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, condition, location, status) VALUES (?, ?, ?, 'Good', 'HR Office Cubicle 3', 'Allocated')`, 'Ergonomic Office Chair', furnitureId, 'AF-0005');
    const chairId = chairResult.lastID;

    await db.run(`INSERT INTO allocations (asset_id, user_id, allocated_by, allocation_date, expected_return_date, status) VALUES (?, ?, ?, NOW() - INTERVAL '15 days', NOW() - INTERVAL '5 days', 'Active')`, lenovoId, priyaId, managerId);
    await db.run(`INSERT INTO allocations (asset_id, user_id, allocated_by, allocation_date, expected_return_date, status) VALUES (?, ?, ?, NOW() - INTERVAL '2 days', NOW() + INTERVAL '3 days', 'Active')`, chairId, priyaId, managerId);

    await db.run(`INSERT INTO bookings (asset_id, user_id, start_time, end_time, status) VALUES (?, ?, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '90 minutes', 'Ongoing')`, confRoomId, priyaId);
    await db.run(`INSERT INTO bookings (asset_id, user_id, start_time, end_time, status) VALUES (?, ?, NOW() + INTERVAL '2 hours', NOW() + INTERVAL '5 hours', 'Upcoming')`, teslaId, headId);

    await db.run(`INSERT INTO maintenance_requests (asset_id, requested_by, description, priority, status) VALUES (?, ?, 'Squeaky brakes and minor alignment check', 'High', 'In Progress')`, teslaId, priyaId);
    await db.run(`INSERT INTO transfers (asset_id, from_user_id, to_department_id, requested_by, status, remarks) VALUES (?, ?, ?, ?, 'Pending', 'Request transfer to HR department for onboarding new recruiter')`, lenovoId, priyaId, hrDeptId, priyaId);
    await db.run(`INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'System Setup', 'Initial seed data successfully setup')`, managerId);

    console.log('Seeding completed successfully in test context.');

    // 1. Obtain JWTs
    console.log('\n[1] Logging in users to obtain tokens...');
    
    // Login Priya (Employee)
    const loginPriyaRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@assetflow.com', password: 'employee123' })
    });
    const priyaData = await loginPriyaRes.json();
    const priyaToken = priyaData.token;
    console.log('  -> Logged in Employee Priya Sharma.');

    // Login Manager
    const loginManagerRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'manager@assetflow.com', password: 'manager123' })
    });
    const managerData = await loginManagerRes.json();
    const managerToken = managerData.token;
    console.log('  -> Logged in Asset Manager.');

    // 2. Query Dashboard as Admin/Manager (Global View)
    console.log('\n[2] Testing Dashboard for Admin/Manager (Global View)...');
    const mgrDashRes = await fetch(`${API_URL}/dashboard`, {
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    const mgrDash = await mgrDashRes.json();
    
    console.log('Manager Dashboard Response Status:', mgrDashRes.status);
    console.log('Manager Dashboard Response Body:', mgrDash);

    if (
      !mgrDash.kpis ||
      mgrDash.kpis.assetsAvailable !== 2 ||
      mgrDash.kpis.assetsAllocated !== 2 ||
      mgrDash.kpis.maintenanceToday !== 1 ||
      mgrDash.kpis.activeBookings !== 1 ||
      mgrDash.kpis.pendingTransfers !== 1 ||
      mgrDash.kpis.upcomingReturns !== 1
    ) {
      throw new Error(`Manager Dashboard KPI mismatch or kpis undefined: ${JSON.stringify(mgrDash)}`);
    }

    if (mgrDash.overdueReturns[0].asset_tag !== 'AF-0001') {
      throw new Error('Overdue asset is incorrect, expected AF-0001');
    }
    if (mgrDash.upcomingReturns[0].asset_tag !== 'AF-0005') {
      throw new Error('Upcoming asset is incorrect, expected AF-0005');
    }
    console.log('  -> Global Dashboard verification passed!');

    // 3. Query Dashboard as Employee Priya (Personal View)
    console.log('\n[3] Testing Dashboard for Employee Priya (Personal View)...');
    const priyaDashRes = await fetch(`${API_URL}/dashboard`, {
      headers: { 'Authorization': `Bearer ${priyaToken}` }
    });
    const priyaDash = await priyaDashRes.json();

    console.log('Priya Dashboard KPIs:', priyaDash.kpis);
    console.log('Priya Overdue Returns Count:', priyaDash.overdueReturns.length);
    console.log('Priya Upcoming Returns Count:', priyaDash.upcomingReturns.length);

    // Employees should see only available bookable assets (1 room) and their own allocated assets/bookings
    if (
      priyaDash.kpis.assetsAvailable !== 1 || // Only Conference Room A is Available AND bookable
      priyaDash.kpis.assetsAllocated !== 2 || // ThinkPad X1 and Ergonomic Chair
      priyaDash.kpis.activeBookings !== 1 ||
      priyaDash.kpis.upcomingReturns !== 1
    ) {
      throw new Error(`Employee Dashboard KPI mismatch: ${JSON.stringify(priyaDash.kpis)}`);
    }
    console.log('  -> Personal Dashboard verification passed!');

    // 4. Quick Action: Register Asset (Success & Fail check)
    console.log('\n[4] Testing Quick Action: Register Asset...');
    
    // Register by Priya (should fail)
    console.log('  Attempting asset registration as Employee...');
    const regPriyaRes = await fetch(`${API_URL}/assets`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${priyaToken}`
      },
      body: JSON.stringify({ name: 'MacBook Pro', category_id: 1 })
    });
    console.log('  Register as employee status:', regPriyaRes.status);
    if (regPriyaRes.status !== 403) {
      throw new Error('Asset registration by employee should have been Forbidden (403)');
    }

    // Register by Manager (should succeed and increment tag to AF-0006)
    console.log('  Attempting asset registration as Asset Manager...');
    const regMgrRes = await fetch(`${API_URL}/assets`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${managerToken}`
      },
      body: JSON.stringify({ name: 'MacBook Pro M3', category_id: 1, serial_number: 'SN-MACBOOK99' })
    });
    const regMgrData = await regMgrRes.json();
    console.log('  Register status:', regMgrRes.status);
    console.log('  Register response:', regMgrData);
    if (regMgrRes.status !== 201 || regMgrData.asset.asset_tag !== 'AF-0006') {
      throw new Error(`Asset registration failed or tag did not increment to AF-0006: ${JSON.stringify(regMgrData)}`);
    }
    console.log('  -> Register Asset verification passed!');

    // 5. Quick Action: Book Resource (Overlap Validation check)
    console.log('\n[5] Testing Quick Action: Book Resource (Overlap Validation)...');
    
    // Get existing seeded booking info: starts -30m, ends +90m from now.
    // Try to book overlapping slot (e.g. now to +60m)
    const now = new Date();
    const overlapStart = new Date(now.getTime()).toISOString();
    const overlapEnd = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour later
    
    console.log(`  Attempting overlapping booking for Conf Room A (ID: 3) from ${overlapStart} to ${overlapEnd}...`);
    const overlapBookRes = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${priyaToken}`
      },
      body: JSON.stringify({ asset_id: 3, start_time: overlapStart, end_time: overlapEnd })
    });
    const overlapBookData = await overlapBookRes.json();
    console.log('  Overlap booking status:', overlapBookRes.status);
    console.log('  Overlap booking response:', overlapBookData);
    if (overlapBookRes.status !== 400 || !overlapBookData.error.includes('Overlap')) {
      throw new Error(`Overlapping booking was not rejected: ${JSON.stringify(overlapBookData)}`);
    }

    // Try to book non-overlapping slot (e.g. tomorrow 10:00 to 11:00)
    const tmrStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    tmrStart.setHours(10, 0, 0, 0);
    const tmrEnd = new Date(tmrStart.getTime() + 60 * 60 * 1000); // 1 hour later
    
    console.log(`  Attempting non-overlapping booking for Conf Room A (ID: 3) from ${tmrStart.toISOString()} to ${tmrEnd.toISOString()}...`);
    const validBookRes = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${priyaToken}`
      },
      body: JSON.stringify({ asset_id: 3, start_time: tmrStart.toISOString(), end_time: tmrEnd.toISOString() })
    });
    const validBookData = await validBookRes.json();
    console.log('  Valid booking status:', validBookRes.status);
    console.log('  Valid booking response:', validBookData);
    if (validBookRes.status !== 201) {
      throw new Error(`Valid booking failed: ${JSON.stringify(validBookData)}`);
    }
    console.log('  -> Book Resource verification passed!');

    // 6. Quick Action: Raise Maintenance Request
    console.log('\n[6] Testing Quick Action: Raise Maintenance Request...');
    const maintRes = await fetch(`${API_URL}/maintenance`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${priyaToken}`
      },
      body: JSON.stringify({ asset_id: 2, description: 'Keyboard keys sticky', priority: 'Low' })
    });
    const maintData = await maintRes.json();
    console.log('  Maintenance request status:', maintRes.status);
    console.log('  Maintenance request response:', maintData);
    if (maintRes.status !== 201) {
      throw new Error(`Failed to raise maintenance request: ${JSON.stringify(maintData)}`);
    }
    console.log('  -> Raise Maintenance Request verification passed!');

    console.log('\n=== ALL OPERATIONAL DASHBOARD & QUICK ACTION INTEGRATION TESTS PASSED! ===');

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
