import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../config/db.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new Employee (non-elevated signup)
 */
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, department_id } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const db = getDb();

    // Check if user already exists
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user with default role 'Employee' and status 'Active'
    const result = await db.run(
      `INSERT INTO users (name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, 'Employee', ?, 'Active')`,
      name,
      email,
      passwordHash,
      department_id || null
    );

    const newUserId = result.lastID;

    res.status(201).json({
      message: 'Registration successful. Please log in.',
      userId: newUserId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/auth/login
 * @desc Login user and return JWT
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = getDb();

    // Fetch user
    const user = await db.get('SELECT * FROM users WHERE email = ?', email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'Your account is deactivated. Please contact an administrator.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/auth/me
 * @desc Get current user details from token
 */
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const user = await db.get(
      `SELECT id, name, email, role, status FROM users WHERE id = ?`,
      req.user.id
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
