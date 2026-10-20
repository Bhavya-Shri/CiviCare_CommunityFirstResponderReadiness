import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// GET /api/db/stats (Table row counts & DBMS inspection)
router.get('/stats', async (req, res) => {
  try {
    const db = await getDb();
    const tables = [
      'users', 'organisations', 'zones', 'responders', 'skills',
      'responder_skills', 'certifications', 'shifts', 'facilities',
      'facility_capabilities', 'incidents', 'assignments',
      'incident_events', 'assignment_events', 'readiness_snapshots',
      'allocation_decision_logs', 'experiment_runs', 'experiment_results', 'audit_logs'
    ];

    const stats = {};
    for (const t of tables) {
      const countRes = await db.query(`SELECT COUNT(*) FROM ${t}`);
      stats[t] = parseInt(countRes.rows[0].count, 10);
    }

    res.json({
      engine: 'PostgreSQL (Relational DBMS)',
      tableCounts: stats,
      totalTables: tables.length,
      views: ['v_active_responder_readiness', 'v_zone_readiness_summary', 'v_incident_assignment_overview']
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// POST /api/db/explain (Run EXPLAIN plan on query)
router.post('/explain', async (req, res) => {
  try {
    const { queryKey = 'active_responders' } = req.body;
    const db = await getDb();

    let sql = '';
    if (queryKey === 'active_responders') {
      sql = `EXPLAIN SELECT * FROM v_active_responder_readiness WHERE zone_code = 'CHN-TNAGAR'`;
    } else if (queryKey === 'zone_readiness') {
      sql = `EXPLAIN SELECT * FROM v_zone_readiness_summary WHERE readiness_status = 'UNDERSERVED_SINGLE'`;
    } else if (queryKey === 'cert_validity') {
      sql = `EXPLAIN SELECT * FROM certifications WHERE verified_status = 'verified' AND valid_until >= CURRENT_DATE`;
    } else {
      sql = `EXPLAIN SELECT * FROM incidents WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10`;
    }

    const explainRes = await db.query(sql);
    res.json({
      queryKey,
      sql,
      plan: explainRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// GET /api/db/demo-queries (Curated academic relational queries)
router.get('/demo-queries', async (req, res) => {
  try {
    const db = await getDb();
    const q1 = await db.query(`
      -- Query 1: Join responders, organisations, certifications, and active shifts
      SELECT r.full_name, z.zone_name, o.name AS org, c.certification_number, c.valid_until
      FROM responders r
      JOIN zones z ON r.base_zone_id = z.id
      LEFT JOIN organisations o ON r.organisation_id = o.id
      JOIN certifications c ON c.responder_id = r.id
      WHERE c.verified_status = 'verified'
      LIMIT 5
    `);

    const q2 = await db.query(`
      -- Query 2: Aggregation by zone with population and responder density
      SELECT z.zone_name, z.population_estimate,
             COUNT(r.id) AS total_responders,
             ROUND((COUNT(r.id)::numeric / z.population_estimate * 100000), 2) AS responders_per_100k
      FROM zones z
      LEFT JOIN responders r ON r.base_zone_id = z.id
      GROUP BY z.id, z.zone_name, z.population_estimate
      ORDER BY total_responders DESC
      LIMIT 5
    `);

    res.json({
      query1_verified_certifications: q1.rows,
      query2_responder_density: q2.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

export default router;
