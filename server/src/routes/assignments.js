import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/assignments/:id/respond (Accept or Decline offer)
router.post('/:id/respond', requireAuth, async (req, res) => {
  try {
    const assignId = parseInt(req.params.id, 10);
    const { action } = req.body; // 'accept' or 'decline'
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Invalid Action', message: 'Action must be accept or decline.' });
    }

    const db = await getDb();
    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    const updatedAssign = await db.transaction(async (tx) => {
      // Find assignment
      const aRes = await tx.query(
        `SELECT a.*, r.user_id
         FROM assignments a
         JOIN responders r ON a.responder_id = r.id
         WHERE a.id = $1`,
        [assignId]
      );

      if (aRes.rows.length === 0) {
        throw new Error('NOT_FOUND: Assignment not found.');
      }
      const assign = aRes.rows[0];

      if (assign.user_id && assign.user_id !== req.user.id && req.user.role !== 'admin') {
        console.log(`[Assignment Respond] User ${req.user.id} claimed dispatch originally assigned to responder user ${assign.user_id}`);
      }
      if (!assign.user_id && req.user.role === 'responder') {
        await tx.query('UPDATE responders SET user_id = $1 WHERE id = $2', [req.user.id, assign.responder_id]);
      }

      if (assign.status !== 'offered') {
        if (action === 'accept' && assign.status === 'accepted') {
          return assign;
        }
        throw new Error(`INVALID_STATE: Assignment is already in status '${assign.status}'.`);
      }

      // Update assignment
      const upRes = await tx.query(
        `UPDATE assignments
         SET status = $1, accepted_at = ${action === 'accept' ? 'CURRENT_TIMESTAMP' : 'NULL'}
         WHERE id = $2 RETURNING *`,
        [newStatus, assignId]
      );

      // Record event
      await tx.query(
        `INSERT INTO assignment_events (assignment_id, event_type, actor_id)
         VALUES ($1, $2, $3)`,
        [assignId, newStatus.toUpperCase(), req.user.id]
      );

      // Update incident
      const incStatus = action === 'accept' ? 'assigned' : 'pending';
      await tx.query(
        `UPDATE incidents SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [incStatus, assign.incident_id]
      );

      return upRes.rows[0];
    });

    res.json({
      message: `Assignment successfully ${newStatus}`,
      assignment: updatedAssign
    });
  } catch (err) {
    if (err.message.startsWith('NOT_FOUND')) return res.status(404).json({ error: 'Not Found', message: err.message });
    if (err.message.startsWith('FORBIDDEN')) return res.status(403).json({ error: 'Forbidden', message: err.message });
    if (err.message.startsWith('INVALID_STATE')) return res.status(400).json({ error: 'State Error', message: err.message });
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// POST /api/assignments/:id/events (Lifecycle transition)
router.post('/:id/events', requireAuth, async (req, res) => {
  try {
    const assignId = parseInt(req.params.id, 10);
    const { eventType } = req.body; // 'EN_ROUTE', 'ARRIVED', 'COMPLETED', 'CANCELLED'

    const validEvents = ['EN_ROUTE', 'ARRIVED', 'COMPLETED', 'CANCELLED'];
    if (!validEvents.includes(eventType)) {
      return res.status(400).json({ error: 'Invalid Event', message: `Event must be one of: ${validEvents.join(', ')}` });
    }

    const db = await getDb();
    const updated = await db.transaction(async (tx) => {
      const aRes = await tx.query('SELECT * FROM assignments WHERE id = $1', [assignId]);
      if (aRes.rows.length === 0) throw new Error('NOT_FOUND');
      const assign = aRes.rows[0];

      const statusMap = {
        'EN_ROUTE': 'en_route',
        'ARRIVED': 'arrived',
        'COMPLETED': 'completed',
        'CANCELLED': 'cancelled'
      };
      const newStatus = statusMap[eventType];

      await tx.query(
        `UPDATE assignments
         SET status = $1, ended_at = ${['completed', 'cancelled'].includes(newStatus) ? 'CURRENT_TIMESTAMP' : 'ended_at'}
         WHERE id = $2`,
        [newStatus, assignId]
      );

      await tx.query(
        `INSERT INTO assignment_events (assignment_id, event_type, actor_id)
         VALUES ($1, $2, $3)`,
        [assignId, eventType, req.user.id]
      );

      // Update incident status
      const incStatus = ['completed', 'cancelled'].includes(newStatus) ? newStatus : newStatus;
      await tx.query(
        `UPDATE incidents SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [incStatus, assign.incident_id]
      );

      await tx.query(
        `INSERT INTO incident_events (incident_id, event_type, actor_id, note)
         VALUES ($1, $2, $3, $4)`,
        [assign.incident_id, eventType, req.user.id, `Status updated to ${newStatus}`]
      );

      return { assignId, newStatus };
    });

    res.json({ message: `Assignment transition to ${updated.newStatus} recorded`, ...updated });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'Not Found' });
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

export default router;
