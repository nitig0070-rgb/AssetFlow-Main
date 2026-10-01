import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { initDb, getDb } from '../config/db.js';

dotenv.config();

async function seed() {
  console.log('Starting database seeding...');
  await initDb();
  const db = getDb();

  // Clear existing data & restart sequences recursively
  console.log('Clearing existing tables & restarting sequences (PostgreSQL)...');
  await db.exec(`
    TRUNCATE TABLE 
      audit_logs, notifications, maintenance_requests, bookings, transfers, 
      allocations, assets, users, departments, categories 
    RESTART IDENTITY CASCADE
  `);

  console.log('Seeding departments...');
  const itDeptResult = await db.run(`INSERT INTO departments (name, status) VALUES ('IT Department', 'Active')`);
  const itDeptId = itDeptResult.lastID;

  const hrDeptResult = await db.run(`INSERT INTO departments (name, status) VALUES ('HR Department', 'Active')`);
  const hrDeptId = hrDeptResult.lastID;

  console.log('Seeding users...');
  const salt = await bcrypt.genSalt(10);
  const adminHash = await bcrypt.hash('admin123', salt);
  const priyaHash = await bcrypt.hash('employee123', salt);
  const managerHash = await bcrypt.hash('manager123', salt);
  const headHash = await bcrypt.hash('head123', salt);

  // Admin
  await db.run(
    `INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)`,
    'System Admin',
    'admin@assetflow.com',
    adminHash,
    'Admin',
    'Active'
  );

  // Employee
  const priyaResult = await db.run(
    `INSERT INTO users (name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?)`,
    'Priya Sharma',
    'priya@assetflow.com',
    priyaHash,
    'Employee',
    itDeptId,
    'Active'
  );
  const priyaId = priyaResult.lastID;

  // Asset Manager
  const managerResult = await db.run(
    `INSERT INTO users (name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?)`,
    'Asset Manager User',
    'manager@assetflow.com',
    managerHash,
    'AssetManager',
    itDeptId,
    'Active'
  );
  const managerId = managerResult.lastID;

  // Department Head
  const headResult = await db.run(
    `INSERT INTO users (name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?)`,
    'Department Head User',
    'head@assetflow.com',
    headHash,
    'DepartmentHead',
    itDeptId,
    'Active'
  );
  const headId = headResult.lastID;

  // Update IT Department head_id
  await db.run('UPDATE departments SET head_id = ? WHERE id = ?', headId, itDeptId);

  console.log('Seeding asset categories...');
  const electronicsResult = await db.run(
    `INSERT INTO categories (name, custom_fields) VALUES ('Electronics', '{"warranty_period_months": 24}')`
  );
  const electronicsId = electronicsResult.lastID;

  const roomsResult = await db.run(
    `INSERT INTO categories (name, custom_fields) VALUES ('Rooms', '{"capacity": 10}')`
  );
  const roomsId = roomsResult.lastID;

  const vehiclesResult = await db.run(
    `INSERT INTO categories (name, custom_fields) VALUES ('Vehicles', '{"license_plate": true}')`
  );
  const vehiclesId = vehiclesResult.lastID;

  const furnitureResult = await db.run(
    `INSERT INTO categories (name, custom_fields) VALUES ('Furniture', '{"material": "Wood"}')`
  );
  const furnitureId = furnitureResult.lastID;

  console.log('Seeding assets...');
  // Asset 1: Lenovo Laptop (Allocated)
  const lenovoResult = await db.run(
    `INSERT INTO assets (name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, condition, location, status) 
     VALUES (?, ?, ?, ?, CURRENT_DATE - INTERVAL '1 year', 1200.0, 'Good', 'IT Office Room 101', 'Allocated')`,
    'Lenovo ThinkPad X1 Carbon',
    electronicsId,
    'AF-0001',
    'SN-LENOVO12345'
  );
  const lenovoId = lenovoResult.lastID;

  // Asset 2: Dell Laptop (Available)
  const dellResult = await db.run(
    `INSERT INTO assets (name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, condition, location, status) 
     VALUES (?, ?, ?, ?, CURRENT_DATE - INTERVAL '6 months', 1000.0, 'Good', 'IT Storage Locker', 'Available')`,
    'Dell Latitude 5420',
    electronicsId,
    'AF-0002',
    'SN-DELL67890'
  );
  const dellId = dellResult.lastID;

  // Asset 3: Conference Room A (Available, bookable)
  const confRoomResult = await db.run(
    `INSERT INTO assets (name, category_id, asset_tag, condition, location, is_bookable, status) 
     VALUES (?, ?, ?, 'New', 'HQ 2nd Floor Room A', 1, 'Available')`,
    'Conference Room A',
    roomsId,
    'AF-0003'
  );
  const confRoomId = confRoomResult.lastID;

  // Asset 4: Tesla Model 3 (Under Maintenance, bookable)
  const teslaResult = await db.run(
    `INSERT INTO assets (name, category_id, asset_tag, serial_number, condition, location, is_bookable, status) 
     VALUES (?, ?, ?, ?, 'Fair', 'HQ Parking Lot B', 1, 'Under Maintenance')`,
    'Tesla Model 3',
    vehiclesId,
    'AF-0004',
    'SN-TESLA777'
  );
  const teslaId = teslaResult.lastID;

  // Asset 5: Ergonomic Office Chair (Allocated)
  const chairResult = await db.run(
    `INSERT INTO assets (name, category_id, asset_tag, condition, location, status) 
     VALUES (?, ?, ?, 'Good', 'HR Office Cubicle 3', 'Allocated')`,
    'Ergonomic Office Chair',
    furnitureId,
    'AF-0005'
  );
  const chairId = chairResult.lastID;

  console.log('Seeding allocations...');
  // Overdue allocation (Lenovo Laptop to Priya)
  await db.run(
    `INSERT INTO allocations (asset_id, user_id, allocated_by, allocation_date, expected_return_date, status) 
     VALUES (?, ?, ?, NOW() - INTERVAL '15 days', NOW() - INTERVAL '5 days', 'Active')`,
    lenovoId,
    priyaId,
    managerId
  );

  // Active upcoming return allocation (Office Chair to Priya)
  await db.run(
    `INSERT INTO allocations (asset_id, user_id, allocated_by, allocation_date, expected_return_date, status) 
     VALUES (?, ?, ?, NOW() - INTERVAL '2 days', NOW() + INTERVAL '3 days', 'Active')`,
    chairId,
    priyaId,
    managerId
  );

  console.log('Seeding resource bookings...');
  // Ongoing booking (Conference Room A booked by Priya)
  await db.run(
    `INSERT INTO bookings (asset_id, user_id, start_time, end_time, status) 
     VALUES (?, ?, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '90 minutes', 'Ongoing')`,
    confRoomId,
    priyaId
  );

  // Upcoming booking (Tesla Model 3 booked by Dept Head)
  await db.run(
    `INSERT INTO bookings (asset_id, user_id, start_time, end_time, status) 
     VALUES (?, ?, NOW() + INTERVAL '2 hours', NOW() + INTERVAL '5 hours', 'Upcoming')`,
    teslaId,
    headId
  );

  console.log('Seeding maintenance requests...');
  // High priority maintenance in progress today for Tesla
  await db.run(
    `INSERT INTO maintenance_requests (asset_id, requested_by, description, priority, status) 
     VALUES (?, ?, 'Squeaky brakes and minor alignment check', 'High', 'In Progress')`,
    teslaId,
    priyaId
  );

  console.log('Seeding transfer requests...');
  // Pending transfer request for Lenovo Laptop from Priya to HR Department
  await db.run(
    `INSERT INTO transfers (asset_id, from_user_id, to_department_id, requested_by, status, remarks) 
     VALUES (?, ?, ?, ?, 'Pending', 'Request transfer to HR department for onboarding new recruiter')`,
    lenovoId,
    priyaId,
    hrDeptId,
    priyaId
  );

  console.log('Seeding audit logs...');
  await db.run(
    `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'System Setup', 'Initial seed data successfully setup')`,
    managerId
  );

  console.log('Database seeding completed successfully.');
}

seed().catch(err => {
  console.error('Error seeding database:', err);
  process.exit(1);
});
