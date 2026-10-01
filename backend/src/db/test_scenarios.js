import { initDb, getDb } from '../config/db.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import authRoutes from '../routes/auth.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Configure dotenv
dotenv.config();

const PORT = 5999;
const API_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('=== STARTING AUTH INTEGRATION TEST RUN ===');

  // Initialize DB and reset state
  await initDb();
  const db = getDb();
  console.log('Resetting users table for clean test run...');
  await db.run('DELETE FROM users');

  // Set up Express app programmatically with auth routes only
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);

  const server = app.listen(PORT);
  console.log(`Test Express server running on port ${PORT}`);

  try {
    // 1. Seed Admin
    console.log('\n[1/4] Seeding default admin user...');
    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash('admin123', salt);
    await db.run(
      `INSERT INTO users (name, email, password_hash, role, status) VALUES ('System Admin', 'admin@assetflow.com', ?, 'Admin', 'Active')`,
      adminHash
    );

    // 2. Signup Priya
    console.log('\n[2/4] Testing Employee registration...');
    const regRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Priya Sharma',
        email: 'priya@assetflow.com',
        password: 'employee123'
      })
    });
    const regData = await regRes.json();
    console.log('Register Response Status:', regRes.status);
    console.log('Register Response Data:', regData);

    if (regRes.status !== 201) {
      throw new Error(`Failed to register Priya: ${JSON.stringify(regData)}`);
    }

    // 3. Login Priya
    console.log('\n[3/4] Testing login...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'priya@assetflow.com',
        password: 'employee123'
      })
    });
    const loginData = await loginRes.json();
    console.log('Login Response Status:', loginRes.status);
    
    if (loginRes.status !== 200) {
      throw new Error(`Failed to login Priya: ${JSON.stringify(loginData)}`);
    }
    
    const token = loginData.token;
    console.log('Priya Login Successful. Token received.');

    // 4. Fetch Profile
    console.log('\n[4/4] Testing Profile fetch (/me)...');
    const profileRes = await fetch(`${API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const profileData = await profileRes.json();
    console.log('Profile Response Status:', profileRes.status);
    console.log('Profile User Details:', profileData.user);

    if (profileRes.status !== 200 || !profileData.user || profileData.user.email !== 'priya@assetflow.com') {
      throw new Error(`Failed to fetch correct profile: ${JSON.stringify(profileData)}`);
    }

    console.log('\n=== ALL AUTH E2E TEST SCENARIOS PASSED SUCCESSFULLY! ===');

  } catch (error) {
    console.error('Test run failed with error:', error);
  } finally {
    // Shut down server
    server.close(() => {
      console.log('Test Express server shut down.');
      console.log('=== END INTEGRATION TEST RUN ===');
    });
  }
}

runTests();
