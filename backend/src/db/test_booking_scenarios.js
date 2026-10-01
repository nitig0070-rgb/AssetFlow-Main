import { initDb, getDb } from '../config/db.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import authRoutes from '../routes/auth.js';
import bookingRoutes from '../routes/bookings.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Configure dotenv
dotenv.config();

const PORT = 5994;
const API_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('=== STARTING RESOURCE BOOKING WORKFLOW INTEGRATION TESTS ===');

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api/bookings', bookingRoutes);

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

    const salt = await bcrypt.genSalt(10);
    const priyaHash = await bcrypt.hash('employee123', salt);

    const priyaResult = await db.run(`INSERT INTO users (name, email, password_hash, role, department_id, status) VALUES ('Priya Sharma', 'priya@assetflow.com', ?, 'Employee', ?, 'Active')`, priyaHash, itDeptId);
    const priyaId = priyaResult.lastID;

    const roomsResult = await db.run(`INSERT INTO categories (name, custom_fields) VALUES ('Rooms', '{"capacity": 10}')`);
    const roomsId = roomsResult.lastID;

    // Assets: Conference Room B2 (is_bookable = 1)
    const confRoomResult = await db.run(`INSERT INTO assets (name, category_id, asset_tag, condition, location, is_bookable, status) VALUES (?, ?, ?, 'New', 'HQ 2nd Floor Room B2', 1, 'Available')`, 'Conference Room B2', roomsId, 'AF-0001');
    const confRoomId = confRoomResult.lastID;

    console.log('Seeding completed successfully in test context.');

    // Log in Priya
    const loginPriyaRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@assetflow.com', password: 'employee123' })
    });
    const priyaData = await loginPriyaRes.json();
    const priyaToken = priyaData.token;

    // 1. Create Booking 1: Room B2 (09:00 - 10:00)
    console.log('\n[1] Creating Booking 1 (09:00 to 10:00)...');
    const book1Res = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${priyaToken}` 
      },
      body: JSON.stringify({
        asset_id: confRoomId,
        start_time: '2026-07-13T09:00:00.000Z',
        end_time: '2026-07-13T10:00:00.000Z'
      })
    });
    console.log('  Booking 1 status:', book1Res.status);
    const book1Data = await book1Res.json();
    if (book1Res.status !== 201) {
      throw new Error(`Expected 201, got ${book1Res.status}: ${JSON.stringify(book1Data)}`);
    }
    const booking1Id = book1Data.booking.id;

    // 2. Validate Overlap booking block (09:30 - 10:30)
    console.log('\n[2] Testing Booking Overlap (09:30 to 10:30)...');
    const book2Res = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${priyaToken}` 
      },
      body: JSON.stringify({
        asset_id: confRoomId,
        start_time: '2026-07-13T09:30:00.000Z',
        end_time: '2026-07-13T10:30:00.000Z'
      })
    });
    console.log('  Booking 2 status:', book2Res.status);
    const book2Data = await book2Res.json();
    if (book2Res.status !== 400 || !book2Data.message.includes('already booked')) {
      throw new Error('Overlapping booking was not blocked or error message is incorrect');
    }
    console.log('  -> Overlap check successfully blocked request!');

    // 3. Create Booking 3: Room B2 (10:00 - 11:00) starts right after
    console.log('\n[3] Creating Booking 3 (10:00 to 11:00 - starts right after)...');
    const book3Res = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${priyaToken}` 
      },
      body: JSON.stringify({
        asset_id: confRoomId,
        start_time: '2026-07-13T10:00:00.000Z',
        end_time: '2026-07-13T11:00:00.000Z'
      })
    });
    console.log('  Booking 3 status:', book3Res.status);
    const book3Data = await book3Res.json();
    if (book3Res.status !== 201) {
      throw new Error(`Expected 201, got ${book3Res.status}`);
    }
    const booking3Id = book3Data.booking.id;

    // 4. Cancel Booking 3
    console.log('\n[4] Testing Cancellation Flow...');
    const cancelRes = await fetch(`${API_URL}/bookings/${booking3Id}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${priyaToken}` }
    });
    console.log('  Cancel status:', cancelRes.status);
    const cancelData = await cancelRes.json();
    if (cancelRes.status !== 200 || cancelData.status !== 'Cancelled') {
      throw new Error(`Cancellation failed. status: ${cancelRes.status}`);
    }
    
    // Check in database
    const dbBooking3 = await db.get('SELECT status FROM bookings WHERE id = ?', booking3Id);
    console.log('  Booking 3 status in DB:', dbBooking3.status);
    if (dbBooking3.status !== 'Cancelled') {
      throw new Error('Booking status was not updated to Cancelled in DB');
    }
    console.log('  -> Cancellation workflow passed!');

    // 5. Reschedule Booking 1 with Overlap Checks
    console.log('\n[5] Testing Rescheduling Flow...');
    // Create another active booking to check reschedule overlaps (11:00 - 12:00)
    const book4Res = await db.run(
      `INSERT INTO bookings (asset_id, user_id, start_time, end_time, status) VALUES (?, ?, '2026-07-13T11:00:00.000Z', '2026-07-13T12:00:00.000Z', 'Upcoming')`,
      confRoomId,
      priyaId
    );
    const booking4Id = book4Res.lastID;

    // Reschedule Booking 1 to an overlapping slot (11:30 - 12:30)
    const reschedFailRes = await fetch(`${API_URL}/bookings/${booking1Id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${priyaToken}` 
      },
      body: JSON.stringify({
        start_time: '2026-07-13T11:30:00.000Z',
        end_time: '2026-07-13T12:30:00.000Z'
      })
    });
    console.log('  Reschedule overlap check status:', reschedFailRes.status);
    const reschedFailData = await reschedFailRes.json();
    if (reschedFailRes.status !== 400 || !reschedFailData.message.includes('already booked')) {
      throw new Error('Reschedule overlap was not blocked or error message is incorrect');
    }

    // Reschedule Booking 1 to a valid slot (14:00 - 15:00)
    const reschedSuccessRes = await fetch(`${API_URL}/bookings/${booking1Id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${priyaToken}` 
      },
      body: JSON.stringify({
        start_time: '2026-07-13T14:00:00.000Z',
        end_time: '2026-07-13T15:00:00.000Z'
      })
    });
    console.log('  Reschedule valid check status:', reschedSuccessRes.status);
    if (reschedSuccessRes.status !== 200) {
      throw new Error(`Reschedule failed. status: ${reschedSuccessRes.status}`);
    }
    const dbBooking1 = await db.get('SELECT start_time, end_time FROM bookings WHERE id = ?', booking1Id);
    console.log('  Booking 1 new start_time in DB:', dbBooking1.start_time);
    const startStr = dbBooking1.start_time.replace(' ', 'T').substring(0, 19) + 'Z';
    if (new Date(startStr).toISOString() !== '2026-07-13T14:00:00.000Z') {
      throw new Error('Booking 1 was not updated correctly in database');
    }
    console.log('  -> Rescheduling workflow passed!');

    // 6. State Transitions & Start Reminders
    console.log('\n[6] Testing State Transitions & Start Reminders...');
    
    // Inject booking starting in 10 minutes (Upcoming)
    const reminderBookingId = (await db.run(
      `INSERT INTO bookings (asset_id, user_id, start_time, end_time, status) VALUES (?, ?, NOW() + INTERVAL '10 minutes', NOW() + INTERVAL '40 minutes', 'Upcoming')`,
      confRoomId,
      priyaId
    )).lastID;
    console.log(`  Injected soon-starting booking ID: ${reminderBookingId}`);

    // Trigger sync states
    console.log('  Triggering sync (fetching bookings list)...');
    const triggerRes = await fetch(`${API_URL}/bookings`, {
      headers: { 'Authorization': `Bearer ${priyaToken}` }
    });
    const triggerData = await triggerRes.json();
    console.log('  Bookings fetched:', triggerData.bookings.length);

    // Verify reminder notification is created
    const reminderNotify = await db.get(
      `SELECT * FROM notifications WHERE user_id = ? AND type = 'Booking Reminder' ORDER BY id DESC LIMIT 1`,
      priyaId
    );
    console.log('  Booking Reminder notification found:', reminderNotify ? 'Yes' : 'No');
    if (!reminderNotify || !reminderNotify.message.includes(`booking #${reminderBookingId}`)) {
      throw new Error('Booking reminder notification was not generated');
    }
    console.log('  Reminder Title:', reminderNotify.title);
    console.log('  Reminder Message:', reminderNotify.message);

    // Inject booking that ended 1 hour ago
    const endedBookingId = (await db.run(
      `INSERT INTO bookings (asset_id, user_id, start_time, end_time, status) VALUES (?, ?, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', 'Upcoming')`,
      confRoomId,
      priyaId
    )).lastID;
    console.log(`  Injected already-ended booking ID: ${endedBookingId}`);

    // Trigger sync again
    await fetch(`${API_URL}/bookings`, {
      headers: { 'Authorization': `Bearer ${priyaToken}` }
    });

    const dbEndedBooking = await db.get('SELECT status FROM bookings WHERE id = ?', endedBookingId);
    console.log('  Ended booking status in DB after sync:', dbEndedBooking.status);
    if (dbEndedBooking.status !== 'Completed') {
      throw new Error('Ended booking was not transitioned to Completed status');
    }
    console.log('  -> State transitions & start reminders passed!');

    console.log('\n=== ALL RESOURCE BOOKING WORKFLOW INTEGRATION TESTS PASSED! ===');

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
