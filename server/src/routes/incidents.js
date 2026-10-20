import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { allocateResponderForIncident } from '../allocation/engine.js';

const router = Router();

const incidentCreateSchema = z.object({
  reporterRole: z.enum(['self', 'bystander']),
  incidentType: z.string().min(2),
  priorityLabel: z.enum(['low', 'standard', 'high', 'critical']).default('standard'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  zoneId: z.number().int().positive().optional().nullable(),
  locationNotes: z.string().optional().default(''),
  locationPrecision: z.enum(['exact_gps', 'approximate', 'zone_center']).default('approximate'),
  affectedCount: z.number().int().min(1).default(1),
  accessNotes: z.string().optional().default(''),
  reporterContact: z.string().optional().default(''),
  autoAllocate: z.boolean().default(true),
  policy: z.enum(['nearest_eligible_baseline', 'coverage_aware_allocation']).default('coverage_aware_allocation')
});

// POST /api/incidents (Guest incident intake)
router.post('/', async (req, res) => {
  try {
    const data = incidentCreateSchema.parse(req.body);
    const db = await getDb();

    // Generate unique random reference code: CIVI-CHN-2026-XXXX
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const referenceCode = `CIVI-CHN-2026-${randomSuffix}`;

    // If zoneId was not specified, match to nearest zone by coordinates
    let zoneId = data.zoneId;
    if (!zoneId) {
      const zonesRes = await db.query('SELECT id, center_lat, center_lng FROM zones');
      let minDistance = Infinity;
      for (const z of zonesRes.rows) {
        const d = Math.hypot(z.center_lat - data.lat, z.center_lng - data.lng);
        if (d < minDistance) {
          minDistance = d;
          zoneId = z.id;
        }
      }
    }

    // Insert incident into DB
    const incRes = await db.query(
      `INSERT INTO incidents (
        reference_code, zone_id, incident_type, priority_label, reporter_role,
        lat, lng, location_notes, location_precision, affected_count,
        access_notes, reporter_contact, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
      RETURNING *`,
      [
        referenceCode,
        zoneId,
        data.incidentType,
        data.priorityLabel,
        data.reporterRole,
        data.lat,
        data.lng,
        data.locationNotes,
        data.locationPrecision,
        data.affectedCount,
        data.accessNotes,
        data.reporterContact
      ]
    );

    const incident = incRes.rows[0];

    // Record incident event
    await db.query(
      `INSERT INTO incident_events (incident_id, event_type, note)
       VALUES ($1, 'REPORTED', $2)`,
      [incident.id, `Reported via CiviCare Intake (${data.reporterRole})`]
    );

    let allocationResult = null;
    if (data.autoAllocate) {
      allocationResult = await allocateResponderForIncident(incident, {
        policy: data.policy
      });
    }

    res.status(201).json({
      message: 'Emergency incident report registered successfully.',
      incident: {
        id: incident.id,
        referenceCode: incident.reference_code,
        status: allocationResult?.success ? 'assigned' : incident.status,
        incidentType: incident.incident_type,
        priorityLabel: incident.priority_label,
        createdAt: incident.created_at
      },
      allocation: allocationResult,
      safetyNotice: {
        urgentAction: 'CALL 112 IMMEDIATELY',
        details: 'CiviCare is an academic first-responder coordination prototype and NOT an official replacement for Emergency Services. If life is in danger, dial 112 immediately.'
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', issues: err.errors });
    }
    console.error('[Create Incident Error]:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to record incident.' });
  }
});

// GET /api/incidents/:idOrRef/status (Safe public tracking)
router.get('/:idOrRef/status', async (req, res) => {
  try {
    const db = await getDb();
    const param = req.params.idOrRef;

    const isNumeric = /^\d+$/.test(param);
    const query = isNumeric
      ? `SELECT i.*, z.zone_name,
                a.id AS assignment_id, a.status AS assignment_status, a.policy_used,
                a.estimated_distance_km, a.estimated_travel_minutes,
                r.full_name AS responder_display_name,
                o.name AS responder_organisation
         FROM incidents i
         LEFT JOIN zones z ON i.zone_id = z.id
         LEFT JOIN assignments a ON a.incident_id = i.id
         LEFT JOIN responders r ON a.responder_id = r.id
         LEFT JOIN organisations o ON r.organisation_id = o.id
         WHERE i.id = $1
         ORDER BY a.assigned_at DESC LIMIT 1`
      : `SELECT i.*, z.zone_name,
                a.id AS assignment_id, a.status AS assignment_status, a.policy_used,
                a.estimated_distance_km, a.estimated_travel_minutes,
                r.full_name AS responder_display_name,
                o.name AS responder_organisation
         FROM incidents i
         LEFT JOIN zones z ON i.zone_id = z.id
         LEFT JOIN assignments a ON a.incident_id = i.id
         LEFT JOIN responders r ON a.responder_id = r.id
         LEFT JOIN organisations o ON r.organisation_id = o.id
         WHERE i.reference_code = $1
         ORDER BY a.assigned_at DESC LIMIT 1`;

    const incRes = await db.query(query, [param]);
    if (incRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Incident reference not found.' });
    }

    const row = incRes.rows[0];

    // Fetch timeline events
    const eventsRes = await db.query(
      `SELECT event_type, note, recorded_at
       FROM incident_events
       WHERE incident_id = $1
       ORDER BY recorded_at ASC`,
      [row.id]
    );

    res.json({
      incident: {
        id: row.id,
        referenceCode: row.reference_code,
        status: row.status,
        incidentType: row.incident_type,
        priorityLabel: row.priority_label,
        zoneName: row.zone_name,
        lat: row.lat,
        lng: row.lng,
        locationNotes: row.location_notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      },
      assignment: row.assignment_id ? {
        id: row.assignment_id,
        status: row.assignment_status,
        policyUsed: row.policy_used,
        estimatedDistanceKm: row.estimated_distance_km,
        estimatedTravelMinutes: row.estimated_travel_minutes,
        responderName: row.responder_display_name,
        responderOrg: row.responder_organisation
      } : null,
      timeline: eventsRes.rows,
      safetyReminder: 'Always maintain communication with India Emergency Response 112.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// GET /api/incidents (List incidents with filter)
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const status = req.query.status;

    let sql = `
      SELECT i.*, z.zone_name,
             a.id AS assignment_id, a.status AS assignment_status, a.policy_used,
             r.full_name AS responder_name
      FROM incidents i
      LEFT JOIN zones z ON i.zone_id = z.id
      LEFT JOIN assignments a ON a.incident_id = i.id
      LEFT JOIN responders r ON a.responder_id = r.id
    `;
    const params = [];

    if (status) {
      sql += ` WHERE i.status = $1`;
      params.push(status);
    }

    sql += ` ORDER BY i.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const listRes = await db.query(sql, params);
    res.json({ incidents: listRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// POST /api/incidents/:id/allocate (Explicit trigger)
router.post('/:id/allocate', async (req, res) => {
  try {
    const db = await getDb();
    const incId = parseInt(req.params.id, 10);
    const policy = req.body.policy || 'coverage_aware_allocation';
    const isPeakHour = Boolean(req.body.isPeakHour);
    const alpha = req.body.alpha ? parseFloat(req.body.alpha) : 0.45;
    const beta = req.body.beta ? parseFloat(req.body.beta) : 0.55;
    const maxRadiusKm = req.body.maxRadiusKm ? parseFloat(req.body.maxRadiusKm) : 10.0;

    const incRes = await db.query('SELECT * FROM incidents WHERE id = $1', [incId]);
    if (incRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Incident not found' });
    }

    const incident = incRes.rows[0];
    const allocResult = await allocateResponderForIncident(incident, {
      policy,
      isPeakHour,
      alpha,
      beta,
      maxRadiusKm
    });

    res.json(allocResult);
  } catch (err) {
    console.error('[Allocate Endpoint Error]:', err);
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

export default router;
