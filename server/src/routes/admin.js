import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/admin/certifications (Review Queue)
router.get('/certifications', requireAuth, requireRole('admin', 'evaluator'), async (req, res) => {
  try {
    const db = await getDb();
    const status = req.query.status || 'pending';

    const certsRes = await db.query(
      `SELECT c.*, r.full_name AS responder_name, r.phone AS responder_phone,
              z.zone_name, sk.skill_name, sk.skill_code, sk.permitted_scope,
              u.email AS reviewer_email
       FROM certifications c
       JOIN responders r ON c.responder_id = r.id
       JOIN zones z ON r.base_zone_id = z.id
       JOIN skills sk ON c.skill_id = sk.id
       LEFT JOIN users u ON c.reviewed_by = u.id
       WHERE c.verified_status = $1
       ORDER BY c.created_at ASC`,
      [status]
    );

    res.json({ certifications: certsRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// PATCH /api/admin/certifications/:id (Approve or Reject verification)
router.patch('/certifications/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const certId = parseInt(req.params.id, 10);
    const { status, reviewNotes } = req.body; // 'verified' or 'rejected'

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid Status', message: 'Status must be verified or rejected.' });
    }

    const db = await getDb();
    const updated = await db.transaction(async (tx) => {
      const upRes = await tx.query(
        `UPDATE certifications
         SET verified_status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, review_notes = $3
         WHERE id = $4
         RETURNING *`,
        [status, req.user.id, reviewNotes || `Decision marked by ${req.user.email}`, certId]
      );

      if (upRes.rows.length === 0) {
        throw new Error('NOT_FOUND');
      }

      const cert = upRes.rows[0];

      // Audit log
      await tx.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'certification', $3, $4)`,
        [
          req.user.id,
          `CERTIFICATION_${status.toUpperCase()}`,
          certId,
          JSON.stringify({ responderId: cert.responder_id, status, notes: reviewNotes })
        ]
      );

      return cert;
    });

    res.json({
      message: `Certification has been marked as ${status}.`,
      certification: updated
    });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'Not Found' });
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', requireAuth, requireRole('admin', 'evaluator'), async (req, res) => {
  try {
    const db = await getDb();
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const logsRes = await db.query(
      `SELECT al.*, u.email AS actor_email
       FROM audit_logs al
       LEFT JOIN users u ON al.actor_id = u.id
       ORDER BY al.timestamp DESC LIMIT $1`,
      [limit]
    );

    res.json({ auditLogs: logsRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// GET /api/admin/decision-logs
router.get('/decision-logs', requireAuth, requireRole('admin', 'evaluator'), async (req, res) => {
  try {
    const db = await getDb();
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);

    const logsRes = await db.query(
      `SELECT dl.*, i.reference_code, i.incident_type, r.full_name AS selected_responder_name
       FROM allocation_decision_logs dl
       JOIN incidents i ON dl.incident_id = i.id
       LEFT JOIN responders r ON dl.selected_responder_id = r.id
       ORDER BY dl.created_at DESC LIMIT $1`,
      [limit]
    );

    res.json({ decisionLogs: logsRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// GET /api/admin/responders
router.get('/responders', requireAuth, requireRole('admin', 'evaluator'), async (req, res) => {
  try {
    const db = await getDb();
    const respondersRes = await db.query(
      `SELECT r.*, z.zone_name, o.name AS organisation_name,
              COUNT(DISTINCT c.id) FILTER (WHERE c.verified_status = 'verified') AS verified_certs_count
       FROM responders r
       JOIN zones z ON r.base_zone_id = z.id
       LEFT JOIN organisations o ON r.organisation_id = o.id
       LEFT JOIN certifications c ON c.responder_id = r.id
       GROUP BY r.id, z.zone_name, o.name
       ORDER BY r.full_name ASC`
    );
    res.json({ responders: respondersRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

export default router;
