import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// GET /api/facilities
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const { zoneId, capability } = req.query;

    let sql = `
      SELECT f.*, z.zone_name,
             COALESCE(
               json_agg(
                 json_build_object('code', fc.capability_code, 'name', fc.capability_name)
               ) FILTER (WHERE fc.id IS NOT NULL), '[]'
             ) AS capabilities
      FROM facilities f
      LEFT JOIN zones z ON f.zone_id = z.id
      LEFT JOIN facility_capabilities fc ON fc.facility_id = f.id
    `;
    const whereClauses = [];
    const params = [];

    if (zoneId) {
      params.push(parseInt(zoneId, 10));
      whereClauses.push(`f.zone_id = $${params.length}`);
    }

    if (capability) {
      params.push(capability);
      whereClauses.push(`EXISTS (SELECT 1 FROM facility_capabilities fc2 WHERE fc2.facility_id = f.id AND fc2.capability_code = $${params.length})`);
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    sql += ' GROUP BY f.id, z.zone_name ORDER BY f.name ASC';

    const facRes = await db.query(sql, params);

    res.json({
      facilities: facRes.rows,
      meta: {
        total: facRes.rows.length,
        dataSource: 'Chennai Public Health Catalogue / OpenStreetMap',
        disclaimer: 'Facility records show sourced capabilities and contact numbers. CiviCare does NOT claim live available bed counts or emergency room wait times.'
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// GET /api/facilities/capabilities (Distinct catalogue)
router.get('/capabilities', async (req, res) => {
  try {
    const db = await getDb();
    const capsRes = await db.query(`
      SELECT DISTINCT capability_code, capability_name
      FROM facility_capabilities
      ORDER BY capability_name ASC
    `);
    res.json({ capabilities: capsRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

export default router;
