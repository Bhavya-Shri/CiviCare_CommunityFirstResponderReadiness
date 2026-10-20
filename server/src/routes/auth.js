import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  phone: z.string().min(10),
  baseZoneId: z.number().int().positive(),
  organisationId: z.number().int().positive().optional().nullable()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

// POST /api/auth/register (Responder Registration)
router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const db = await getDb();

    // Check duplicate email
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Duplicate Email', message: 'An account with this email already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(data.password, salt);

    const user = await db.transaction(async (tx) => {
      const uRes = await tx.query(
        `INSERT INTO users (email, password_hash, role, account_status)
         VALUES ($1, $2, 'responder', 'active')
         RETURNING id, email, role, created_at`,
        [data.email, passwordHash]
      );
      const newUser = uRes.rows[0];

      // Create responder profile
      const rRes = await tx.query(
        `INSERT INTO responders (user_id, organisation_id, base_zone_id, full_name, phone, responder_status, availability_status)
         VALUES ($1, $2, $3, $4, $5, 'active', 'available')
         RETURNING id, full_name, responder_status`,
        [newUser.id, data.organisationId || null, data.baseZoneId, data.fullName, data.phone]
      );

      // Audit log
      await tx.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
         VALUES ($1, 'RESPONDER_REGISTERED', 'responder', $2, $3)`,
        [newUser.id, rRes.rows[0].id, JSON.stringify({ email: newUser.email, zoneId: data.baseZoneId })]
      );

      return { ...newUser, responderId: rRes.rows[0].id };
    });

    const token = signToken(user);
    res.status(201).json({
      message: 'Responder registration successful',
      token,
      user
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', issues: err.errors });
    }
    console.error('[Register Error]:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to complete registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const db = await getDb();

    const uRes = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.role, u.account_status, r.id AS responder_id, r.full_name
       FROM users u
       LEFT JOIN responders r ON r.user_id = u.id
       WHERE u.email = $1`,
      [data.email]
    );

    if (uRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid Credentials', message: 'No account found with this email.' });
    }

    const user = uRes.rows[0];
    const isMatch = bcrypt.compareSync(data.password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid Credentials', message: 'Incorrect password.' });
    }

    if (user.account_status !== 'active') {
      return res.status(403).json({ error: 'Account Suspended', message: 'This account is currently inactive or suspended.' });
    }

    const token = signToken(user);
    res.json({
      message: 'Authentication successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
        responderId: user.responder_id
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', issues: err.errors });
    }
    console.error('[Login Error]:', err);
    res.status(500).json({ error: 'Server Error', message: 'Login failed.' });
  }
});

// GET /api/auth/me (Current user check)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const uRes = await db.query(
      `SELECT u.id, u.email, u.role, u.account_status, r.id AS responder_id, r.full_name, r.base_zone_id, z.zone_name
       FROM users u
       LEFT JOIN responders r ON r.user_id = u.id
       LEFT JOIN zones z ON r.base_zone_id = z.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (uRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
    }
    res.json({ user: uRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

export default router;
