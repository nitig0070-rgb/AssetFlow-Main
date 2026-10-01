import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/dashboard
 * @desc Get real-time operational snapshot for KPIs and overdue/upcoming returns
 *       Tailored to the user's role:
 *       - Admin/AssetManager: Organization-wide
 *       - DepartmentHead: Department-scoped
 *       - Employee: Personal-scoped
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();

    // Auto-flag overdue returns: Find all active, overdue allocations, and auto-generate alerts
    const overdueAllocations = await db.all(
      `SELECT al.id, al.user_id, al.expected_return_date, a.name as asset_name 
       FROM allocations al 
       JOIN assets a ON al.asset_id = a.id 
       WHERE al.status = 'Active' 
         AND al.returned_date IS NULL 
         AND al.user_id IS NOT NULL 
         AND al.expected_return_date < NOW()`
    );

    for (const alloc of overdueAllocations) {
      // Check if an overdue return notification already exists for this user/allocation
      const existingNotify = await db.get(
        `SELECT id FROM notifications 
         WHERE user_id = ? AND type = 'Overdue Return Alert' AND message LIKE ? 
         LIMIT 1`,
        alloc.user_id,
        `%${alloc.asset_name}%`
      );

      if (!existingNotify) {
        const dateStr = new Date(alloc.expected_return_date).toLocaleDateString();
        await db.run(
          `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
          alloc.user_id,
          'Overdue Return Alert',
          `Alert: Your allocated asset ${alloc.asset_name} was expected to be returned by ${dateStr} and is now overdue.`,
          'Overdue Return Alert'
        );
      }
    }

    const userId = req.user.id;
    const role = req.user.role;

    // Fetch user's department
    const userRecord = await db.get('SELECT department_id FROM users WHERE id = ?', userId);
    const departmentId = userRecord ? userRecord.department_id : null;

    let assetsAvailableQuery = '';
    let assetsAllocatedQuery = '';
    let maintenanceTodayQuery = '';
    let activeBookingsQuery = '';
    let pendingTransfersQuery = '';
    let upcomingReturnsQuery = '';
    
    let overdueListQuery = '';
    let upcomingListQuery = '';

    const params = [];
    const listParams = [];

    if (role === 'Admin' || role === 'AssetManager') {
      // 1. Organization-wide queries
      assetsAvailableQuery = `SELECT COUNT(*) as count FROM assets WHERE status = 'Available'`;
      
      assetsAllocatedQuery = `SELECT COUNT(*) as count FROM assets WHERE status = 'Allocated'`;
      
      maintenanceTodayQuery = `
        SELECT COUNT(*) as count FROM maintenance_requests 
        WHERE status IN ('Approved', 'Technician Assigned', 'In Progress')
      `;
      
      activeBookingsQuery = `
        SELECT COUNT(*) as count FROM bookings 
        WHERE status = 'Ongoing' 
           OR (status = 'Upcoming' AND start_time <= NOW() AND end_time >= NOW())
      `;
      
      pendingTransfersQuery = `SELECT COUNT(*) as count FROM transfers WHERE status = 'Pending'`;
      
      upcomingReturnsQuery = `
        SELECT COUNT(*) as count FROM allocations 
        WHERE status = 'Active' 
          AND returned_date IS NULL 
          AND expected_return_date >= NOW() 
          AND expected_return_date <= NOW() + INTERVAL '7 days'
      `;

      overdueListQuery = `
        SELECT al.*, a.name as asset_name, a.asset_tag, u.name as user_name, u.email as user_email, d.name as department_name
        FROM allocations al 
        JOIN assets a ON al.asset_id = a.id 
        LEFT JOIN users u ON al.user_id = u.id 
        LEFT JOIN departments d ON al.department_id = d.id
        WHERE al.status = 'Active' 
          AND al.returned_date IS NULL 
          AND al.expected_return_date < NOW()
        ORDER BY al.expected_return_date ASC
      `;

      upcomingListQuery = `
        SELECT al.*, a.name as asset_name, a.asset_tag, u.name as user_name, u.email as user_email, d.name as department_name
        FROM allocations al 
        JOIN assets a ON al.asset_id = a.id 
        LEFT JOIN users u ON al.user_id = u.id 
        LEFT JOIN departments d ON al.department_id = d.id
        WHERE al.status = 'Active' 
          AND al.returned_date IS NULL 
          AND al.expected_return_date >= NOW() 
          AND al.expected_return_date <= NOW() + INTERVAL '7 days'
        ORDER BY al.expected_return_date ASC
      `;

    } else if (role === 'DepartmentHead') {
      // 2. Department-scoped queries
      // Available assets: all available assets company-wide (since they can book/request any available)
      assetsAvailableQuery = `SELECT COUNT(*) as count FROM assets WHERE status = 'Available'`;
      
      // Allocated to their department (directly or to users in their department)
      assetsAllocatedQuery = `
        SELECT COUNT(*) as count FROM allocations al 
        LEFT JOIN users u ON al.user_id = u.id 
        WHERE al.status = 'Active' 
          AND (al.department_id = ? OR u.department_id = ?)
      `;
      params.push(departmentId, departmentId);

      // Maintenance in progress for assets allocated to department or requested by department members
      maintenanceTodayQuery = `
        SELECT COUNT(*) as count FROM maintenance_requests mr
        JOIN assets a ON mr.asset_id = a.id
        LEFT JOIN users u ON mr.requested_by = u.id
        LEFT JOIN allocations al ON a.id = al.asset_id AND al.status = 'Active'
        WHERE mr.status IN ('Approved', 'Technician Assigned', 'In Progress')
          AND (u.department_id = ? OR al.department_id = ?)
      `;
      params.push(departmentId, departmentId);

      // Bookings active for users in their department
      activeBookingsQuery = `
        SELECT COUNT(*) as count FROM bookings b
        JOIN users u ON b.user_id = u.id
        WHERE (b.status = 'Ongoing' OR (b.status = 'Upcoming' AND b.start_time <= NOW() AND b.end_time >= NOW()))
          AND u.department_id = ?
      `;
      params.push(departmentId);

      // Pending transfers from/to their department
      pendingTransfersQuery = `
        SELECT COUNT(*) as count FROM transfers t
        LEFT JOIN users u_from ON t.from_user_id = u_from.id
        WHERE t.status = 'Pending' 
          AND (u_from.department_id = ? OR t.to_department_id = ?)
      `;
      params.push(departmentId, departmentId);

      // Upcoming returns in their department
      upcomingReturnsQuery = `
        SELECT COUNT(*) as count FROM allocations al 
        LEFT JOIN users u ON al.user_id = u.id 
        WHERE al.status = 'Active' 
          AND al.returned_date IS NULL 
          AND al.expected_return_date >= NOW() 
          AND al.expected_return_date <= NOW() + INTERVAL '7 days'
          AND (al.department_id = ? OR u.department_id = ?)
      `;
      params.push(departmentId, departmentId);

      overdueListQuery = `
        SELECT al.*, a.name as asset_name, a.asset_tag, u.name as user_name, u.email as user_email, d.name as department_name
        FROM allocations al 
        JOIN assets a ON al.asset_id = a.id 
        LEFT JOIN users u ON al.user_id = u.id 
        LEFT JOIN departments d ON al.department_id = d.id
        WHERE al.status = 'Active' 
          AND al.returned_date IS NULL 
          AND al.expected_return_date < NOW()
          AND (al.department_id = ? OR u.department_id = ?)
        ORDER BY al.expected_return_date ASC
      `;
      listParams.push(departmentId, departmentId);

      upcomingListQuery = `
        SELECT al.*, a.name as asset_name, a.asset_tag, u.name as user_name, u.email as user_email, d.name as department_name
        FROM allocations al 
        JOIN assets a ON al.asset_id = a.id 
        LEFT JOIN users u ON al.user_id = u.id 
        LEFT JOIN departments d ON al.department_id = d.id
        WHERE al.status = 'Active' 
          AND al.returned_date IS NULL 
          AND al.expected_return_date >= NOW() 
          AND al.expected_return_date <= NOW() + INTERVAL '7 days'
          AND (al.department_id = ? OR u.department_id = ?)
        ORDER BY al.expected_return_date ASC
      `;

    } else {
      // 3. Employee personal-scoped queries
      // Available bookable assets company-wide
      assetsAvailableQuery = `SELECT COUNT(*) as count FROM assets WHERE status = 'Available' AND is_bookable = 1`;
      
      // Allocated to this user specifically
      assetsAllocatedQuery = `SELECT COUNT(*) as count FROM allocations WHERE status = 'Active' AND user_id = ?`;
      params.push(userId);

      // Maintenance today requested by this user
      maintenanceTodayQuery = `
        SELECT COUNT(*) as count FROM maintenance_requests 
        WHERE status IN ('Approved', 'Technician Assigned', 'In Progress') AND requested_by = ?
      `;
      params.push(userId);

      // Bookings active for this user
      activeBookingsQuery = `
        SELECT COUNT(*) as count FROM bookings 
        WHERE (status = 'Ongoing' OR (status = 'Upcoming' AND start_time <= NOW() AND end_time >= NOW()))
          AND user_id = ?
      `;
      params.push(userId);

      // Pending transfers requested by this user
      pendingTransfersQuery = `SELECT COUNT(*) as count FROM transfers WHERE status = 'Pending' AND requested_by = ?`;
      params.push(userId);

      // Upcoming returns for this user
      upcomingReturnsQuery = `
        SELECT COUNT(*) as count FROM allocations 
        WHERE status = 'Active' 
          AND returned_date IS NULL 
          AND expected_return_date >= NOW() 
          AND expected_return_date <= NOW() + INTERVAL '7 days'
          AND user_id = ?
      `;
      params.push(userId);

      overdueListQuery = `
        SELECT al.*, a.name as asset_name, a.asset_tag, u.name as user_name, u.email as user_email, d.name as department_name
        FROM allocations al 
        JOIN assets a ON al.asset_id = a.id 
        LEFT JOIN users u ON al.user_id = u.id 
        LEFT JOIN departments d ON al.department_id = d.id
        WHERE al.status = 'Active' 
          AND al.returned_date IS NULL 
          AND al.expected_return_date < NOW()
          AND al.user_id = ?
        ORDER BY al.expected_return_date ASC
      `;
      listParams.push(userId);

      upcomingListQuery = `
        SELECT al.*, a.name as asset_name, a.asset_tag, u.name as user_name, u.email as user_email, d.name as department_name
        FROM allocations al 
        JOIN assets a ON al.asset_id = a.id 
        LEFT JOIN users u ON al.user_id = u.id 
        LEFT JOIN departments d ON al.department_id = d.id
        WHERE al.status = 'Active' 
          AND al.returned_date IS NULL 
          AND al.expected_return_date >= NOW() 
          AND al.expected_return_date <= NOW() + INTERVAL '7 days'
          AND al.user_id = ?
        ORDER BY al.expected_return_date ASC
      `;
    }

    // Execute KPI queries
    // We execute them sequentially to map values, passing sub-slices of params correctly
    const kpis = {
      assetsAvailable: 0,
      assetsAllocated: 0,
      maintenanceToday: 0,
      activeBookings: 0,
      pendingTransfers: 0,
      upcomingReturns: 0
    };

    let paramIdx = 0;
    
    // helper to get next parameters for a query
    const getParamsForCount = (query) => {
      // Basic heuristic to count placeholders in query
      const placeholders = (query.match(/\?/g) || []).length;
      const subParams = params.slice(paramIdx, paramIdx + placeholders);
      paramIdx += placeholders;
      return subParams;
    };

    const availRes = await db.get(assetsAvailableQuery, ...getParamsForCount(assetsAvailableQuery));
    kpis.assetsAvailable = availRes ? availRes.count : 0;

    const allocRes = await db.get(assetsAllocatedQuery, ...getParamsForCount(assetsAllocatedQuery));
    kpis.assetsAllocated = allocRes ? allocRes.count : 0;

    const maintRes = await db.get(maintenanceTodayQuery, ...getParamsForCount(maintenanceTodayQuery));
    kpis.maintenanceToday = maintRes ? maintRes.count : 0;

    const bookRes = await db.get(activeBookingsQuery, ...getParamsForCount(activeBookingsQuery));
    kpis.activeBookings = bookRes ? bookRes.count : 0;

    const transRes = await db.get(pendingTransfersQuery, ...getParamsForCount(pendingTransfersQuery));
    kpis.pendingTransfers = transRes ? transRes.count : 0;

    const upRes = await db.get(upcomingReturnsQuery, ...getParamsForCount(upcomingReturnsQuery));
    kpis.upcomingReturns = upRes ? upRes.count : 0;

    // Execute Overdue and Upcoming Lists
    const overdueReturns = await db.all(overdueListQuery, ...listParams);
    const upcomingReturnsList = await db.all(upcomingListQuery, ...listParams);

    // Fetch recent unread notifications for the user (to surface activity alerts directly on the dashboard)
    const notifications = await db.all(
      `SELECT id, title, message, type, is_read, created_at 
       FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 5`,
      userId
    );

    res.json({
      role,
      departmentId,
      kpis,
      overdueReturns,
      upcomingReturns: upcomingReturnsList,
      recentNotifications: notifications
    });

  } catch (error) {
    next(error);
  }
});

export default router;
