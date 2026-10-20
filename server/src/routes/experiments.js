import { Router } from 'express';
import { SCENARIO_CATALOGUE, runExperiment } from '../../../simulator/runner.js';
import { getDb } from '../db.js';

const router = Router();

// GET /api/experiments/scenarios
router.get('/scenarios', (req, res) => {
  res.json({ scenarios: Object.values(SCENARIO_CATALOGUE) });
});

// POST /api/experiments/run (Run scenario simulation)
router.post('/run', async (req, res) => {
  try {
    const { scenarioId, policy, seed, maxRadiusKm, alpha, beta } = req.body;
    const result = await runExperiment(scenarioId || 'SPARSE_ZONE', {
      policy: policy || null, // null means run BOTH baseline and coverage-aware
      seed: seed ? parseInt(seed, 10) : 42,
      maxRadiusKm: maxRadiusKm ? parseFloat(maxRadiusKm) : 10.0,
      alpha: alpha ? parseFloat(alpha) : 0.45,
      beta: beta ? parseFloat(beta) : 0.55
    });
    res.json(result);
  } catch (err) {
    console.error('[Experiment Runner Error]:', err);
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// GET /api/experiments/history
router.get('/history', async (req, res) => {
  try {
    const db = await getDb();
    const runsRes = await db.query(
      `SELECT er.*,
              COALESCE(
                json_agg(
                  json_build_object('metric', res.metric_name, 'value', res.metric_value)
                ) FILTER (WHERE res.id IS NOT NULL), '[]'
              ) AS metrics
       FROM experiment_runs er
       LEFT JOIN experiment_results res ON res.run_id = er.id
       GROUP BY er.id
       ORDER BY er.started_at DESC LIMIT 20`
    );
    res.json({ runs: runsRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

export default router;
