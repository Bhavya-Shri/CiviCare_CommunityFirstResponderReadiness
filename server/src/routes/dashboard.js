import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// GET /api/dashboard/readiness
router.get('/readiness', async (req, res) => {
  try {
    const db = await getDb();

    // 1. Zone readiness summary from PostgreSQL View
    const zonesRes = await db.query(
      `SELECT * FROM v_zone_readiness_summary ORDER BY eligible_free_responders DESC, zone_name ASC`
    );

    // 2. Active responders
    const activeRespondersRes = await db.query(
      `SELECT * FROM v_active_responder_readiness`
    );

    // 3. Aggregate totals
    let totalEligible = 0;
    let criticalCount = 0;
    let singleCount = 0;

    for (const z of zonesRes.rows) {
      const free = parseInt(z.eligible_free_responders, 10) || 0;
      totalEligible += free;
      if (z.readiness_status === 'CRITICAL_ZERO') criticalCount++;
      if (z.readiness_status === 'UNDERSERVED_SINGLE') singleCount++;
    }

    // 4. Latest readiness snapshots
    const snapshotsRes = await db.query(
      `SELECT rs.*, z.zone_name
       FROM readiness_snapshots rs
       JOIN zones z ON rs.zone_id = z.id
       ORDER BY rs.captured_at DESC LIMIT 30`
    );

    res.json({
      zones: zonesRes.rows,
      activeResponders: activeRespondersRes.rows,
      summary: {
        totalZones: zonesRes.rows.length,
        totalEligibleFreeResponders: totalEligible,
        criticalZeroZones: criticalCount,
        underservedSingleZones: singleCount,
        timestamp: new Date().toISOString()
      },
      latestSnapshots: snapshotsRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// GET /api/dashboard/zones
router.get('/zones', async (req, res) => {
  try {
    const db = await getDb();
    const zonesRes = await db.query(
      `SELECT z.*, vz.eligible_free_responders, vz.readiness_status
       FROM zones z
       LEFT JOIN v_zone_readiness_summary vz ON vz.zone_id = z.id
       ORDER BY z.zone_name ASC`
    );
    res.json({ zones: zonesRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// GET /api/dashboard/overview (High-level metrics)
router.get('/overview', async (req, res) => {
  try {
    const db = await getDb();

    const counts = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM responders) AS total_responders,
        (SELECT COUNT(*) FROM responders WHERE responder_status = 'active') AS active_responders,
        (SELECT COUNT(*) FROM certifications WHERE verified_status = 'verified' AND valid_until >= CURRENT_DATE) AS verified_certs,
        (SELECT COUNT(*) FROM facilities) AS facilities_count,
        (SELECT COUNT(*) FROM incidents) AS total_incidents,
        (SELECT COUNT(*) FROM incidents WHERE status = 'assigned') AS assigned_incidents,
        (SELECT COUNT(*) FROM assignments) AS total_assignments,
        (SELECT ROUND(AVG(estimated_distance_km)::numeric, 2) FROM assignments WHERE status != 'declined') AS avg_travel_km
    `);

    res.json({ stats: counts.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

export default router;
