import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/reports/summary
 * @desc Get aggregated analytics summary (restricted to AssetManager/Admin)
 */
router.get('/summary', authenticateToken, requireRole(['AssetManager', 'Admin']), async (req, res, next) => {
  try {
    const db = getDb();

    // 1. Asset Utilization
    const mostAllocated = await db.all(
      `SELECT a.id, a.name, a.asset_tag, COUNT(al.id) as allocation_count 
       FROM assets a 
       LEFT JOIN allocations al ON al.asset_id = a.id 
       GROUP BY a.id, a.name, a.asset_tag 
       ORDER BY allocation_count DESC LIMIT 5`
    );

    const mostBooked = await db.all(
      `SELECT a.id, a.name, a.asset_tag, COUNT(b.id) as booking_count 
       FROM assets a 
       LEFT JOIN bookings b ON b.asset_id = a.id 
       WHERE a.is_bookable = 1
       GROUP BY a.id, a.name, a.asset_tag 
       ORDER BY booking_count DESC LIMIT 5`
    );

    const idleAssets = await db.all(
      `SELECT a.id, a.name, a.asset_tag, a.status, a.location 
       FROM assets a 
       WHERE a.status = 'Available' 
         AND NOT EXISTS (
           SELECT 1 FROM allocations al 
           WHERE al.asset_id = a.id 
             AND al.allocation_date > NOW() - INTERVAL '90 days'
         )
       LIMIT 5`
    );

    // 2. Maintenance Frequency
    const maintenanceByCategory = await db.all(
      `SELECT c.name as category_name, COUNT(mr.id) as request_count 
       FROM categories c 
       JOIN assets a ON a.category_id = c.id 
       LEFT JOIN maintenance_requests mr ON mr.asset_id = a.id 
       GROUP BY c.id, c.name 
       ORDER BY request_count DESC`
    );

    const maintenanceByAsset = await db.all(
      `SELECT a.name as asset_name, a.asset_tag, COUNT(mr.id) as request_count 
       FROM assets a 
       LEFT JOIN maintenance_requests mr ON mr.asset_id = a.id 
       GROUP BY a.id, a.name, a.asset_tag 
       ORDER BY request_count DESC LIMIT 5`
    );

    // 3. Aging & Retirement
    const nearingRetirement = await db.all(
      `SELECT a.id, a.name, a.asset_tag, a.acquisition_date, a.status 
       FROM assets a 
       WHERE a.acquisition_date <= CURRENT_DATE - INTERVAL '3 years' 
         AND a.status NOT IN ('Retired', 'Disposed')`
    );

    const dueForMaintenance = await db.all(
      `SELECT a.id, a.name, a.asset_tag, a.condition, a.status 
       FROM assets a 
       WHERE a.condition IN ('Poor', 'Damaged') 
         AND a.status != 'Under Maintenance'`
    );

    // 4. Department Breakdowns
    const departmentSummary = await db.all(
      `SELECT d.id as department_id, d.name as department_name, 
              COUNT(CASE WHEN al.status = 'Active' THEN 1 END) as active_allocations_count,
              COUNT(DISTINCT al.asset_id) as total_assets_assigned
       FROM departments d
       LEFT JOIN users u ON u.department_id = d.id
       LEFT JOIN allocations al ON (al.user_id = u.id OR al.department_id = d.id) AND al.status = 'Active'
       GROUP BY d.id, d.name`
    );

    // 5. Booking Heatmaps
    // Peak Hour (0-23)
    const peakHours = await db.all(
      `SELECT EXTRACT(HOUR FROM start_time) as booking_hour, COUNT(*) as booking_count 
       FROM bookings 
       WHERE status != 'Cancelled' 
       GROUP BY booking_hour 
       ORDER BY booking_hour ASC`
    );

    // Peak Days of the Week (1 = Monday, 7 = Sunday)
    const peakDays = await db.all(
      `SELECT EXTRACT(ISODOW FROM start_time) as booking_dow, COUNT(*) as booking_count 
       FROM bookings 
       WHERE status != 'Cancelled' 
       GROUP BY booking_dow 
       ORDER BY booking_dow ASC`
    );

    res.json({
      utilization: {
        mostAllocated,
        mostBooked,
        idleAssets
      },
      maintenance: {
        byCategory: maintenanceByCategory,
        byAsset: maintenanceByAsset
      },
      aging: {
        nearingRetirement,
        dueForMaintenance
      },
      departments: departmentSummary,
      heatmap: {
        hours: peakHours,
        days: peakDays
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/reports/export
 * @desc Export asset directory as CSV (restricted to AssetManager/Admin)
 */
router.get('/export', authenticateToken, requireRole(['AssetManager', 'Admin']), async (req, res, next) => {
  try {
    const db = getDb();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="assets_report.csv"');

    const assets = await db.all(
      `SELECT a.*, c.name as category_name 
       FROM assets a 
       JOIN categories c ON a.category_id = c.id 
       ORDER BY a.id ASC`
    );

    let csv = 'ID,Name,Category,Asset Tag,Serial Number,Condition,Location,Status,Acquisition Date,Acquisition Cost,Is Bookable\n';
    
    for (const a of assets) {
      const escapedName = (a.name || '').replace(/"/g, '""');
      const escapedSerial = (a.serial_number || '').replace(/"/g, '""');
      const escapedLocation = (a.location || '').replace(/"/g, '""');
      
      csv += `"${a.id}","${escapedName}","${a.category_name}","${a.asset_tag}","${escapedSerial}","${a.condition}","${escapedLocation}","${a.status}","${a.acquisition_date || ''}","${a.acquisition_cost || 0}","${a.is_bookable}"\n`;
    }

    res.send(csv);
  } catch (error) {
    next(error);
  }
});

export default router;
