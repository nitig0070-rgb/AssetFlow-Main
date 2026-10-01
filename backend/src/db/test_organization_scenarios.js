import { initDb, getDb } from '../config/db.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import authRoutes from '../routes/auth.js';
import organizationRoutes from '../routes/organization.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Configure dotenv
dotenv.config();

const PORT = 5997;
const API_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('=== STARTING ORGANIZATION SETUP ADMIN INTEGRATION TESTS ===');

  // Set up Express app programmatically with relevant routes
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  app.use('/api/auth', authRoutes);
  app.use('/api/organization', organizationRoutes);
  
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

    // Seed: 1 Admin and 1 Employee
    console.log('Seeding initial test users...');
    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash('admin123', salt);
    const employeeHash = await bcrypt.hash('employee123', salt);

    await db.run(
      `INSERT INTO users (name, email, password_hash, role, status) VALUES ('System Admin', 'admin@assetflow.com', ?, 'Admin', 'Active')`,
      adminHash
    );
    await db.run(
      `INSERT INTO users (name, email, password_hash, role, status) VALUES ('Priya Sharma', 'priya@assetflow.com', ?, 'Employee', 'Active')`,
      employeeHash
    );

    // Obtain JWTs
    const loginPriyaRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@assetflow.com', password: 'employee123' })
    });
    const priyaData = await loginPriyaRes.json();
    const priyaToken = priyaData.token;

    const loginAdminRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@assetflow.com', password: 'admin123' })
    });
    const adminData = await loginAdminRes.json();
    const adminToken = adminData.token;

    // 1. Access Control Verification
    console.log('\n[1] Testing Access Control (Employee Priya)...');
    const priyaGetRes = await fetch(`${API_URL}/organization/departments`, {
      headers: { 'Authorization': `Bearer ${priyaToken}` }
    });
    console.log('  Employee get departments status:', priyaGetRes.status);
    if (priyaGetRes.status !== 403) {
      throw new Error('Non-Admin was not blocked from querying organization setup APIs');
    }
    console.log('  -> Access control verification passed!');

    // 2. Department Management Verification
    console.log('\n[2] Testing Department Management...');
    
    // Create Department A (IT)
    const createDeptARes = await fetch(`${API_URL}/organization/departments`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'IT Department' })
    });
    const deptAData = await createDeptARes.json();
    const deptAId = deptAData.department.id;
    console.log('  Created Dept A:', deptAData.department);

    // Create Department B (DevOps, child of IT)
    const createDeptBRes = await fetch(`${API_URL}/organization/departments`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'DevOps Department', parent_id: deptAId })
    });
    const deptBData = await createDeptBRes.json();
    const deptBId = deptBData.department.id;
    console.log('  Created Dept B:', deptBData.department);

    // Test Circular Dependency Verification
    // Try to make Dept A a child of Dept B (which creates a loop since Dept B is already a child of Dept A)
    console.log(`  Testing loop prevention: Setting Dept A (ID: ${deptAId}) parent to Dept B (ID: ${deptBId})...`);
    const circularRes = await fetch(`${API_URL}/organization/departments/${deptAId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'IT Department', parent_id: deptBId, status: 'Active' })
    });
    const circularData = await circularRes.json();
    console.log('  Circular update response status:', circularRes.status);
    console.log('  Circular update response error:', circularData.error);
    if (circularRes.status !== 400 || !circularData.error.includes('Circular')) {
      throw new Error('Circular dependency loop was not blocked!');
    }

    console.log('  -> Department management & loop validation passed!');

    // 3. Category Management Verification
    console.log('\n[3] Testing Category Management...');
    
    const createCatRes = await fetch(`${API_URL}/organization/categories`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'Electronics', custom_fields: { warranty_period_months: 12 } })
    });
    const catData = await createCatRes.json();
    const catId = catData.category.id;
    console.log('  Created Category:', catData.category);

    const updateCatRes = await fetch(`${API_URL}/organization/categories/${catId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'Electronics Master', custom_fields: { warranty_period_months: 24 } })
    });
    const updateCatData = await updateCatRes.json();
    console.log('  Updated Category Name:', updateCatData.category.name);
    console.log('  Updated Category Fields:', updateCatData.category.custom_fields);
    if (updateCatData.category.name !== 'Electronics Master' || updateCatData.category.custom_fields.warranty_period_months !== 24) {
      throw new Error('Category updates did not apply correctly');
    }
    console.log('  -> Category management verification passed!');

    // 4. Employee Directory & Promotions Verification
    console.log('\n[4] Testing Employee Directory & Promotions...');
    
    // Create new Employee account directly
    const createEmpRes = await fetch(`${API_URL}/organization/employees`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Raj Patel',
        email: 'raj@assetflow.com',
        password: 'rajpassword',
        role: 'Employee',
        department_id: deptAId
      })
    });
    const empData = await createEmpRes.json();
    const empId = empData.employee.id;
    console.log('  Created Employee:', empData.employee);

    // Promote Employee to Department Head
    console.log(`  Promoting Raj (ID: ${empId}) to DepartmentHead...`);
    const promoteEmpRes = await fetch(`${API_URL}/organization/employees/${empId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Raj Patel',
        email: 'raj@assetflow.com',
        role: 'DepartmentHead',
        department_id: deptAId,
        status: 'Active'
      })
    });
    const promoteEmpData = await promoteEmpRes.json();
    console.log('  Promoted Employee details:', promoteEmpData.employee);
    if (promoteEmpData.employee.role !== 'DepartmentHead') {
      throw new Error('Failed to promote user to Department Head');
    }

    // List Employee Directory
    const listEmpRes = await fetch(`${API_URL}/organization/employees`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const listEmpData = await listEmpRes.json();
    console.log('  Employee Directory count:', listEmpData.employees.length);
    if (listEmpData.employees.length !== 3) {
      throw new Error(`Expected 3 employees in directory, got ${listEmpData.employees.length}`);
    }
    console.log('  -> Employee directory and promotion verification passed!');

    // 5. Admin Self-Preservation Verification
    console.log('\n[5] Testing Admin Self-Preservation (Last Admin safety checks)...');
    
    // Attempt to demote/deactivate the Admin (which is the only active Admin)
    const adminUserId = adminData.user.id;
    console.log(`  Attempting to demote the sole active Admin (ID: ${adminUserId}) to Employee...`);
    const demoteAdminRes = await fetch(`${API_URL}/organization/employees/${adminUserId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'System Admin',
        email: 'admin@assetflow.com',
        role: 'Employee',
        status: 'Active'
      })
    });
    const demoteAdminData = await demoteAdminRes.json();
    console.log('  Demote Admin status:', demoteAdminRes.status);
    console.log('  Demote Admin error:', demoteAdminData.error);
    if (demoteAdminRes.status !== 400 || !demoteAdminData.error.toLowerCase().includes('self-preservation')) {
      throw new Error('Safety check failed: System allowed demoting the last active Admin');
    }

    console.log('  -> Admin self-preservation verification passed!');

    console.log('\n=== ALL ORGANIZATION SETUP ADMIN INTEGRATION TESTS PASSED! ===');

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
