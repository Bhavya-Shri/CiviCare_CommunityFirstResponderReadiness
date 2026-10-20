import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/responders/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const respRes = await db.query(
      `SELECT r.*, z.zone_name, z.code AS zone_code, o.name AS organisation_name,
              u.email AS user_email
       FROM responders r
       JOIN zones z ON r.base_zone_id = z.id
       LEFT JOIN organisations o ON r.organisation_id = o.id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.user_id = $1`,
      [req.user.id]
    );

    if (respRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Responder profile not found.' });
    }

    const responder = respRes.rows[0];

    // Fetch skills & certifications
    const certsRes = await db.query(
      `SELECT c.*, sk.skill_code, sk.skill_name, sk.permitted_scope
       FROM certifications c
       JOIN skills sk ON c.skill_id = sk.id
       WHERE c.responder_id = $1
       ORDER BY c.created_at DESC`,
      [responder.id]
    );

    // Fetch active shift
    const shiftRes = await db.query(
      `SELECT * FROM shifts
       WHERE responder_id = $1
         AND start_at <= CURRENT_TIMESTAMP
         AND end_at >= CURRENT_TIMESTAMP
       ORDER BY end_at DESC LIMIT 1`,
      [responder.id]
    );

    // Fetch active assignments
    const activeAssignRes = await db.query(
      `SELECT a.*, i.reference_code, i.incident_type, i.priority_label,
              i.lat AS incident_lat, i.lng AS incident_lng, i.location_notes,
              z.zone_name AS incident_zone
       FROM assignments a
       JOIN incidents i ON a.incident_id = i.id
       LEFT JOIN zones z ON i.zone_id = z.id
       WHERE a.responder_id = $1
         AND a.status IN ('offered', 'accepted', 'en_route', 'arrived')
       ORDER BY a.assigned_at DESC`,
      [responder.id]
    );

    // Fetch any active calls in Chennai network (useful for demo & mutual aid)
    const networkCallsRes = await db.query(
      `SELECT a.*, i.reference_code, i.incident_type, i.priority_label,
              i.lat AS incident_lat, i.lng AS incident_lng, i.location_notes,
              z.zone_name AS incident_zone, r.full_name AS allocated_responder_name
       FROM assignments a
       JOIN incidents i ON a.incident_id = i.id
       JOIN responders r ON a.responder_id = r.id
       LEFT JOIN zones z ON i.zone_id = z.id
       WHERE a.status IN ('offered', 'accepted', 'en_route', 'arrived')
       ORDER BY a.assigned_at DESC LIMIT 5`
    );

    res.json({
      responder,
      certifications: certsRes.rows,
      activeShift: shiftRes.rows[0] || null,
      activeAssignments: activeAssignRes.rows,
      networkAssignments: networkCallsRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// PATCH /api/responders/me/availability
router.patch('/me/availability', requireAuth, async (req, res) => {
  try {
    const { availabilityStatus } = req.body;
    if (!['available', 'unavailable', 'on_break', 'offline'].includes(availabilityStatus)) {
      return res.status(400).json({ error: 'Invalid Status', message: 'Status must be available, unavailable, on_break, or offline.' });
    }

    const db = await getDb();
    const updateRes = await db.query(
      `UPDATE responders
       SET availability_status = $1, availability_updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING id, full_name, availability_status, availability_updated_at`,
      [availabilityStatus, req.user.id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Responder profile not found.' });
    }

    res.json({
      message: `Availability updated to ${availabilityStatus}`,
      responder: updateRes.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// POST /api/responders/me/certifications (Submit certification for review)
router.post('/me/certifications', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      skillId: z.number().int().positive(),
      certificationNumber: z.string().min(3),
      issuerLabel: z.string().min(2),
      validFrom: z.string(),
      validUntil: z.string()
    });
    const data = schema.parse(req.body);
    const db = await getDb();

    // Find responder ID
    const rRes = await db.query('SELECT id FROM responders WHERE user_id = $1', [req.user.id]);
    if (rRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Responder profile not found.' });
    }
    const responderId = rRes.rows[0].id;

    // Check valid date range
    if (new Date(data.validFrom) > new Date(data.validUntil)) {
      return res.status(400).json({ error: 'Date Range Error', message: 'validFrom must precede validUntil.' });
    }

    // Add responder_skills bridge
    await db.query(
      `INSERT INTO responder_skills (responder_id, skill_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [responderId, data.skillId]
    );

    // Insert certification in pending state
    const certRes = await db.query(
      `INSERT INTO certifications (
        responder_id, skill_id, certification_number, issuer_label,
        verified_status, valid_from, valid_until
      ) VALUES ($1, $2, $3, $4, 'pending', $5, $6)
      RETURNING *`,
      [responderId, data.skillId, data.certificationNumber, data.issuerLabel, data.validFrom, data.validUntil]
    );

    res.status(201).json({
      message: 'Certification submitted for verification review.',
      certification: certRes.rows[0]
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', issues: err.errors });
    }
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// POST /api/responders/me/shifts (Start / Schedule Shift)
router.post('/me/shifts', requireAuth, async (req, res) => {
  try {
    const { hours = 4 } = req.body;
    const db = await getDb();
    const rRes = await db.query('SELECT id FROM responders WHERE user_id = $1', [req.user.id]);
    if (rRes.rows.length === 0) return res.status(404).json({ error: 'Not Found' });

    const responderId = rRes.rows[0].id;
    const now = new Date();
    const end = new Date(now.getTime() + hours * 3600 * 1000);

    const shiftRes = await db.query(
      `INSERT INTO shifts (responder_id, start_at, end_at, availability_status)
       VALUES ($1, $2, $3, 'on_shift')
       RETURNING *`,
      [responderId, now.toISOString(), end.toISOString()]
    );

    await db.query(
      `UPDATE responders SET availability_status = 'available', availability_updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [responderId]
    );

    res.status(201).json({
      message: `Active shift started for ${hours} hours.`,
      shift: shiftRes.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

export default router;
