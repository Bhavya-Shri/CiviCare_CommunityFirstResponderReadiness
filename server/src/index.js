import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { getDb } from './db.js';
import authRoutes from './routes/auth.js';
import incidentRoutes from './routes/incidents.js';
import facilityRoutes from './routes/facilities.js';
import responderRoutes from './routes/responders.js';
import assignmentRoutes from './routes/assignments.js';
import adminRoutes from './routes/admin.js';
import dashboardRoutes from './routes/dashboard.js';
import experimentRoutes from './routes/experiments.js';
import dbDemoRoutes from './routes/db-demo.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl.startsWith('/api')) {
      console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/responders', responderRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/experiments', experimentRoutes);
app.use('/api/db', dbDemoRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.query('SELECT NOW() AS current_time');
    res.json({
      status: 'healthy',
      service: 'CiviCare API',
      database: 'PostgreSQL',
      serverTime: result.rows[0].current_time,
      version: '1.0.0'
    });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// Root disclaimer
app.get('/', (req, res) => {
  res.json({
    name: 'CiviCare API',
    subtitle: 'Community First Responder Readiness & Coordination System',
    location: 'Chennai Metropolitan Region Prototype',
    safetyDisclaimer: 'This system is an academic research prototype. For real medical emergencies, dial 112 immediately.',
    docs: '/api/health'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.'
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`================================================================`);
  console.log(` CiviCare API Server running on http://localhost:${PORT}`);
  console.log(` Community First Responder Readiness & Coordination System`);
  console.log(` Location: Chennai, India (Academic DBMS Prototype)`);
  console.log(`================================================================`);
  try {
    const db = await getDb();
    const test = await db.query("SELECT COUNT(*) FROM zones").catch(() => ({ rows: [{ count: 0 }] }));
    if (parseInt(test.rows[0]?.count, 10) === 0) {
      console.log('[Server Startup] Database empty, seeding default Chennai dataset...');
      const { runSeed } = await import('./scripts/seed.js');
      await runSeed(true);
    } else {
      console.log(`[Server Startup] Database active with ${test.rows[0].count} Chennai zones.`);
    }

    // Ensure Revathi Mohan and core responders have active user credentials
    try {
      const bcrypt = (await import('bcryptjs')).default;
      const respHash = bcrypt.hashSync('resp123', 10);
      const revUserCheck = await db.query("SELECT id FROM users WHERE email = 'revathi.m@civicare.in'");
      let revUserId;
      if (revUserCheck.rows.length === 0) {
        const uRes = await db.query(
          `INSERT INTO users (email, password_hash, role, account_status)
           VALUES ('revathi.m@civicare.in', $1, 'responder', 'active') RETURNING id`,
          [respHash]
        );
        revUserId = uRes.rows[0].id;
      } else {
        revUserId = revUserCheck.rows[0].id;
      }
      await db.query(
        "UPDATE responders SET user_id = $1 WHERE full_name ILIKE '%Revathi Mohan%' AND (user_id IS NULL OR user_id != $1)",
        [revUserId]
      );

      // Keep active shifts in a forward window so responders are on active duty
      await db.query(`UPDATE shifts SET start_at = NOW() - INTERVAL '2 hours', end_at = NOW() + INTERVAL '24 hours'`);
      console.log('[Server Startup] Core responder credentials and active shifts verified.');
    } catch (e) {
      console.warn('[Server Startup] Responder credentials sync note:', e.message);
    }
  } catch (e) {
    console.error('[Database Init Error]:', e);
  }
});
