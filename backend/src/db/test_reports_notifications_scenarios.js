import { initDb, getDb } from '../config/db.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import authRoutes from '../routes/auth.js';
import reportRoutes from '../routes/reports.js';
import notificationRoutes from '../routes/notifications.js';
import auditLogsRoutes from '../routes/auditLogs.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Configure dotenv
dotenv.config();

const PORT = 5991;
const API_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('=== STARTING REPORTS, NOTIFICATIONS & AUDIT LOGS INTEGRATION TESTS ===');

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

    // Allocate Lenovo to Priya
    await db.run(`INSERT INTO allocations (asset_id, user_id, allocated_by, allocation_date, expected_return_date, status) VALUES (?, ?, ?, NOW() - INTERVAL '2 days', NOW() + INTERVAL '5 days', 'Active')`, lenovoId, priyaId, priyaId);

    // Add dummy notifications
    await db.run(`INSERT INTO notifications (user_id, title, message, type, is_read) VALUES (?, 'Test Title 1', 'Notification message 1', 'Test', 0)`, priyaId);
    const notifyId = (await db.run(`INSERT INTO notifications (user_id, title, message, type, is_read) VALUES (?, 'Test Title 2', 'Notification message 2', 'Test', 0)`, priyaId)).lastID;

    // Add dummy audit logs
    await db.run(`INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'System Setup', 'Initial seed data successfully setup')`, priyaId);

    console.log('Seeding completed successfully in test context.');

    // Log in Admin
    const loginAdminRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@assetflow.com', password: 'admin123' })
    });
    const adminData = await loginAdminRes.json();
    const adminToken = adminData.token;

    // Log in Priya (Employee helper)
    const loginPriyaRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@assetflow.com', password: 'employee123' })
    });
    const priyaData = await loginPriyaRes.json();
    const priyaToken = priyaData.token;

    // 1. Verify Summary Analytics (Admin access)
    console.log('\n[1] Testing Summary Analytics...');
    const summaryRes = await fetch(`${API_URL}/reports/summary`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.log('  Summary response status:', summaryRes.status);
    const summaryData = await summaryRes.json();
    
    if (summaryRes.status !== 200) {
      throw new Error(`Expected 200, got ${summaryRes.status}`);
    }
    console.log('  Analytics sections present:', Object.keys(summaryData).join(', '));
    if (!summaryData.utilization || !summaryData.heatmap || !summaryData.departments) {
      throw new Error('Analytics payload fields missing');
    }
    console.log('  -> Summary analytics passed!');

    // 2. Verify CSV Exporter (Admin access)
    console.log('\n[2] Testing CSV Exporter...');
    const exportRes = await fetch(`${API_URL}/reports/export`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.log('  Export response status:', exportRes.status);
    console.log('  Export Content-Type:', exportRes.headers.get('content-type'));
    const csvContent = await exportRes.text();
    console.log('  CSV lines count:', csvContent.trim().split('\n').length);
    
    if (exportRes.status !== 200 || !exportRes.headers.get('content-type').includes('text/csv')) {
      throw new Error('Export did not return 200 with text/csv header');
    }
    if (!csvContent.includes('Lenovo ThinkPad X1 Carbon')) {
      throw new Error('CSV contents do not include seeded asset info');
    }
    console.log('  -> CSV Exporter verification passed!');

    // 3. Verify Notifications
    console.log('\n[3] Testing Notifications feeds...');
    const notifyListRes = await fetch(`${API_URL}/notifications`, {
      headers: { 'Authorization': `Bearer ${priyaToken}` }
    });
    const notifyListData = await notifyListRes.json();
    console.log('  Priya notifications count:', notifyListData.notifications.length);
    if (notifyListData.notifications.length !== 2) {
      throw new Error('Expected 2 notifications');
    }

    // Mark single notification as read
    console.log('  Marking notification as read...');
    const readRes = await fetch(`${API_URL}/notifications/${notifyId}/read`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${priyaToken}` }
    });
    console.log('  Mark read status:', readRes.status);
    const dbNotify = await db.get('SELECT is_read FROM notifications WHERE id = ?', notifyId);
    console.log('  Notification state in DB:', dbNotify.is_read);
    if (dbNotify.is_read !== 1) {
      throw new Error('Notification was not updated to is_read = 1');
    }

    // Mark all notifications as read
    console.log('  Marking all notifications as read...');
    const readAllRes = await fetch(`${API_URL}/notifications/read-all`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${priyaToken}` }
    });
    console.log('  Mark read-all status:', readAllRes.status);
    const unreadCount = (await db.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', priyaId)).count;
    console.log('  Remaining unread notifications:', unreadCount);
    if (unreadCount !== 0) {
      throw new Error('Not all notifications were marked as read');
    }
    console.log('  -> Notifications workflow verification passed!');

    // 4. Verify Audit Logs
    console.log('\n[4] Testing Audit Logs Access Control...');
    const priyaLogsRes = await fetch(`${API_URL}/audit-logs`, {
      headers: { 'Authorization': `Bearer ${priyaToken}` }
    });
    console.log('  Employee access status:', priyaLogsRes.status);
    if (priyaLogsRes.status !== 403) {
      throw new Error('Employees should be blocked from viewing activity audit logs');
    }

    const adminLogsRes = await fetch(`${API_URL}/audit-logs`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.log('  Admin access status:', adminLogsRes.status);
    const logsData = await adminLogsRes.json();
    console.log('  Audit log items count:', logsData.logs.length);
    if (adminLogsRes.status !== 200 || logsData.logs.length === 0) {
      throw new Error('Admin failed to retrieve activity audit logs');
    }
    console.log('  Seeded audit log action in DB:', logsData.logs[0].action);
    console.log('  -> Audit logs access control passed!');

    console.log('\n=== ALL REPORTS, NOTIFICATIONS & AUDIT LOGS INTEGRATION TESTS PASSED! ===');

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
  app.use('/api/reports', reportRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/audit-logs', auditLogsRoutes);
  app.use(errorHandler);
  return app;
}

runTests();
