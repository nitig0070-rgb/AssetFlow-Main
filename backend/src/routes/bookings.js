import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * Helper: Sync booking states (Ongoing/Completed) based on current timestamp
 * and auto-dispatch Booking Reminders for slots starting in the next 30 minutes.
 */
async function syncBookingStatesAndReminders(db) {
  // 1. Transition upcoming bookings to ongoing if current time is within range
  await db.run(
    `UPDATE bookings 
     SET status = 'Ongoing', updated_at = CURRENT_TIMESTAMP 
     WHERE status = 'Upcoming' AND start_time <= NOW() AND end_time > NOW()`
  );

  // 2. Transition ongoing/upcoming bookings to completed if end_time has passed
  await db.run(
    `UPDATE bookings 
     SET status = 'Completed', updated_at = CURRENT_TIMESTAMP 
     WHERE status IN ('Upcoming', 'Ongoing') AND end_time <= NOW()`
  );

  // 3. Scan for bookings starting in the next 30 minutes to generate reminders
  const startingSoon = await db.all(
    `SELECT b.id, b.user_id, b.start_time, a.name as asset_name 
     FROM bookings b
     JOIN assets a ON b.asset_id = a.id
     WHERE b.status = 'Upcoming'
       AND b.start_time <= NOW() + INTERVAL '30 minutes'
       AND b.start_time > NOW()`
  );

  for (const booking of startingSoon) {
    const existingReminder = await db.get(
      `SELECT id FROM notifications 
       WHERE user_id = ? AND type = 'Booking Reminder' AND message LIKE ?
       LIMIT 1`,
      booking.user_id,
      `%booking #${booking.id}%`
    );

    if (!existingReminder) {
      const timeStr = new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
        booking.user_id,
        'Booking Reminder',
        `Reminder: Your booking for ${booking.asset_name} (booking #${booking.id}) is scheduled to start soon at ${timeStr}.`,
        'Booking Reminder'
      );
    }
  }
}

/**
 * @route POST /api/bookings
 * @desc Book a shared resource (Room/Vehicle/Equipment) with overlap validation
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { asset_id, start_time, end_time } = req.body;

    if (!asset_id || !start_time || !end_time) {
      return res.status(400).json({ error: 'Asset ID, start time, and end time are required' });
    }

    const startDt = new Date(start_time);
    const endDt = new Date(end_time);

    if (startDt >= endDt) {
      return res.status(400).json({ error: 'Start time must be before end time' });
    }

    const db = getDb();

    // Sync booking states
    await syncBookingStatesAndReminders(db);

    // 1. Verify asset exists, is bookable, and is not retired/disposed
    const asset = await db.get(
      'SELECT id, name, is_bookable, status FROM assets WHERE id = ?',
      asset_id
    );

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    if (asset.is_bookable !== 1) {
      return res.status(400).json({ error: 'This asset is not marked as a shared/bookable resource' });
    }

    if (['Retired', 'Disposed', 'Lost'].includes(asset.status)) {
      return res.status(400).json({ error: `Cannot book an asset that is currently ${asset.status}` });
    }

    // 2. Validate booking overlaps
    const overlappingBooking = await db.get(
      `SELECT b.*, u.name as user_name 
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE b.asset_id = ? 
         AND b.status != 'Cancelled'
         AND b.start_time < ? 
         AND b.end_time > ?
       LIMIT 1`,
      asset_id,
      endDt.toISOString(),
      startDt.toISOString()
    );

    if (overlappingBooking) {
      return res.status(400).json({
        error: 'Overlap validation failed',
        message: `This resource is already booked by ${overlappingBooking.user_name} from ${overlappingBooking.start_time} to ${overlappingBooking.end_time}.`
      });
    }

    // 3. Create the booking
    const result = await db.run(
      `INSERT INTO bookings (asset_id, user_id, start_time, end_time, status) VALUES (?, ?, ?, ?, 'Upcoming')`,
      asset_id,
      req.user.id,
      startDt.toISOString(),
      endDt.toISOString()
    );

    const newBookingId = result.lastID;

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Book Resource', ?)`,
      req.user.id,
      `Booked resource ${asset.name} (ID: ${asset_id}) from ${start_time} to ${end_time}`
    );

    // Send a notification to the user
    await db.run(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
      req.user.id,
      'Booking Confirmed',
      `Your booking for ${asset.name} has been confirmed for ${start_time} - ${end_time}`,
      'Booking Confirmed'
    );

    res.status(201).json({
      message: 'Booking created successfully',
      booking: {
        id: newBookingId,
        asset_id,
        user_id: req.user.id,
        start_time: startDt.toISOString(),
        end_time: endDt.toISOString(),
        status: 'Upcoming'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/bookings
 * @desc Get bookings (e.g. for calendar view)
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { asset_id } = req.query;
    const db = getDb();

    // Sync booking states
    await syncBookingStatesAndReminders(db);

    let query = `
      SELECT b.*, a.name as asset_name, a.asset_tag, u.name as user_name 
      FROM bookings b
      JOIN assets a ON b.asset_id = a.id
      JOIN users u ON b.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (asset_id) {
      query += ` AND b.asset_id = ?`;
      params.push(asset_id);
    }

    query += ` ORDER BY b.start_time ASC`;

    const bookings = await db.all(query, ...params);
    res.json({ bookings });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/bookings/:id/cancel
 * @desc Cancel a resource booking
 */
router.put('/:id/cancel', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // 1. Verify booking exists
    const booking = await db.get('SELECT * FROM bookings WHERE id = ?', id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking record not found' });
    }

    // 2. Permission check: Only creator, AssetManager, or Admin can cancel
    if (booking.user_id !== req.user.id && !['AssetManager', 'Admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to cancel this booking' });
    }

    if (booking.status === 'Cancelled') {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    // 3. Update status to Cancelled
    await db.run("UPDATE bookings SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", id);

    // Get asset details for audit/notifications
    const asset = await db.get('SELECT name FROM assets WHERE id = ?', booking.asset_id);

    // Log action
    await db.run(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'Cancel Booking', ?)`,
      req.user.id,
      `Cancelled booking ${id} for resource ${asset ? asset.name : ''}`
    );

    // Notify user
    await db.run(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
      booking.user_id,
      'Booking Cancelled',
      `Your booking for ${asset ? asset.name : ''} starting at ${booking.start_time} has been cancelled.`,
      'Booking Cancelled'
    );

    res.json({ message: 'Booking successfully cancelled' });
  } catch (error) {
    next(error);
  }
});

export default router;
