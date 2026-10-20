// =========================================================================
// CiviCare: Evaluation Simulator & Scenario Experiment Runner
// Executes Baseline vs. Coverage-Aware policies side-by-side on repeatable scenarios
// =========================================================================

import { getDb } from '../server/src/db.js';
import { runSeed } from '../server/src/scripts/seed.js';
import { allocateResponderForIncident } from '../server/src/allocation/engine.js';

export const SCENARIO_CATALOGUE = {
  NORMAL: {
    id: 'NORMAL',
    name: 'Normal Urban Distribution',
    description: 'Baseline scenario with regular distribution of incidents and available responders across Central Chennai.',
    incidents: [
      { type: 'Cardiac Arrest / CPR Needed', lat: 13.0418, lng: 80.2341, zone: 'T. Nagar' },
      { type: 'Severe Bleeding / Deep Laceration', lat: 13.0336, lng: 80.2687, zone: 'Mylapore' },
      { type: 'Pediatric Choking Emergency', lat: 12.9815, lng: 80.2180, zone: 'Velachery' },
    ]
  },
  SPARSE_ZONE: {
    id: 'SPARSE_ZONE',
    name: 'Sparse Zone Coverage Depletion Test',
    description: 'An incident occurs near the boundary of Ambattur (where only 1 responder exists) and Anna Nagar. Demonstrates how Coverage-Aware policy protects the sole responder of Ambattur from being drained.',
    incidents: [
      // Incident located between Ambattur and Anna Nagar (e.g. Mogappair / Padi)
      { type: 'Severe Bleeding / Deep Laceration', lat: 13.0980, lng: 80.1780, zone: 'Ambattur' },
      { type: 'Cardiac Arrest / CPR Needed', lat: 13.1100, lng: 80.1600, zone: 'Ambattur' }
    ]
  },
  EXPIRED_CERTIFICATION: {
    id: 'EXPIRED_CERTIFICATION',
    name: 'Expired Credential Enforcement Test',
    description: 'Incident in Anna Nagar right next to Kavitha (who has an expired CPR credential). Verifies that both policies strictly reject the expired responder regardless of proximity.',
    incidents: [
      { type: 'Cardiac Arrest / CPR Needed', lat: 13.0842, lng: 80.2095, zone: 'Anna Nagar' }
    ]
  },
  STALE_AVAILABILITY: {
    id: 'STALE_AVAILABILITY',
    name: 'Off-Shift / Stale Availability Enforcement',
    description: 'Incident in Guindy right next to Mohan Das (who is off-shift). Verifies that unconfirmed or completed shifts strictly disqualify candidates.',
    incidents: [
      { type: 'Cardiac Arrest / CPR Needed', lat: 13.0062, lng: 80.2028, zone: 'Guindy' }
    ]
  },
  SIMULTANEOUS_RACE: {
    id: 'SIMULTANEOUS_RACE',
    name: 'Simultaneous Incident Concurrency & Conflict Prevention',
    description: 'Two separate incidents are reported at the exact same second competing for the same nearest responder. Demonstrates database transaction locks preventing double allocation.',
    incidents: [
      { type: 'Cardiac Arrest / CPR Needed', lat: 13.0335, lng: 80.2685, zone: 'Mylapore' },
      { type: 'Severe Bleeding / Deep Laceration', lat: 13.0338, lng: 80.2689, zone: 'Mylapore' }
    ]
  },
  PEAK_HOUR: {
    id: 'PEAK_HOUR',
    name: 'Peak Hour Traffic Congestion Simulation',
    description: 'Elevated traffic multipliers representing Chennai evening peak hour. Measures resilience and travel penalty impact.',
    isPeakHour: true,
    incidents: [
      { type: 'Cardiac Arrest / CPR Needed', lat: 13.0420, lng: 80.2345, zone: 'T. Nagar' },
      { type: 'Severe Bleeding / Deep Laceration', lat: 13.0067, lng: 80.2030, zone: 'Guindy' },
      { type: 'Pediatric Choking Emergency', lat: 13.0515, lng: 80.2210, zone: 'Kodambakkam' }
    ]
  },
  NO_ELIGIBLE_RESPONDER: {
    id: 'NO_ELIGIBLE_RESPONDER',
    name: 'No Eligible Responder Scenario',
    description: 'Incident at the far edge of the metropolitan boundary beyond any volunteer radius. Verifies fail-safe handling and 112 fallback alert.',
    incidents: [
      { type: 'Cardiac Arrest / CPR Needed', lat: 13.3500, lng: 79.9500, zone: 'Ambattur' } // Out of radius
    ]
  }
};

/**
 * Run a repeatable scenario under a specific policy or compare both side-by-side.
 */
export async function runExperiment(scenarioKey = 'SPARSE_ZONE', options = {}) {
  const scenario = SCENARIO_CATALOGUE[scenarioKey] || SCENARIO_CATALOGUE.SPARSE_ZONE;
  const db = await getDb();
  const seed = options.seed || 42;
  const policiesToRun = options.policy ? [options.policy] : ['nearest_eligible_baseline', 'coverage_aware_allocation'];

  const runReports = [];

  for (const policy of policiesToRun) {
    // 1. Reset database to fresh seed state so both policies start with identical initial conditions
    await runSeed(false);

    const startTime = Date.now();
    const incidentResults = [];
    let assignedCount = 0;
    let totalTravelKm = 0;
    let constraintViolations = 0;

    for (let i = 0; i < scenario.incidents.length; i++) {
      const incData = scenario.incidents[i];
      const refCode = `EXP-${scenario.id}-${policy.substring(0, 4)}-${i + 1}`;

      // Insert test incident into DB
      const incRes = await db.query(
        `INSERT INTO incidents (reference_code, incident_type, priority_label, reporter_role, lat, lng, location_notes, status)
         VALUES ($1, $2, 'high', 'bystander', $3, $4, $5, 'pending') RETURNING *`,
        [refCode, incData.type, incData.lat, incData.lng, `Synthetic scenario: ${scenario.name}`]
      );
      const incident = incRes.rows[0];

      // Run allocation
      const allocRes = await allocateResponderForIncident(incident, {
        policy,
        isPeakHour: scenario.isPeakHour || false,
        maxRadiusKm: options.maxRadiusKm || 10.0,
        alpha: options.alpha || 0.45,
        beta: options.beta || 0.55
      });

      if (allocRes.success) {
        assignedCount++;
        totalTravelKm += allocRes.selectedResponder.distance_km;

        // Verify that NO hard constraint was violated (verification audit)
        if (allocRes.selectedResponder.distance_km > (options.maxRadiusKm || 10.0)) {
          constraintViolations++;
        }
      }

      incidentResults.push({
        incident_id: incident.id,
        reference_code: refCode,
        incident_type: incident.incident_type,
        zone_name: incData.zone,
        lat: incData.lat,
        lng: incData.lng,
        allocation_success: allocRes.success,
        selected_responder: allocRes.selectedResponder || null,
        candidate_evaluations: allocRes.candidateEvaluation || [],
        rejection_breakdown: allocRes.candidateEvaluation
          ? allocRes.candidateEvaluation.filter(c => !c.is_eligible).map(c => ({ name: c.name, reason: c.rejection_reason }))
          : []
      });
    }

    const durationMs = Date.now() - startTime;
    const avgTravelKm = assignedCount > 0 ? Math.round((totalTravelKm / assignedCount) * 100) / 100 : 0;

    // Check residual zone readiness
    const zoneReadinessRes = await db.query(`SELECT * FROM v_zone_readiness_summary`);
    let zeroCoverageCount = 0;
    let singleCoverageCount = 0;
    let totalResidualResponders = 0;

    for (const z of zoneReadinessRes.rows) {
      const freeCount = parseInt(z.eligible_free_responders, 10) || 0;
      totalResidualResponders += freeCount;
      if (freeCount === 0) zeroCoverageCount++;
      if (freeCount === 1) singleCoverageCount++;
    }

    const underservedCount = zeroCoverageCount + singleCoverageCount;
    const avgResidualCoverage = Math.round((totalResidualResponders / zoneReadinessRes.rows.length) * 100) / 100;

    // Store experiment run in DB
    const expRunRes = await db.query(
      `INSERT INTO experiment_runs (scenario_name, seed, policy_version, parameters, total_incidents, assigned_count, avg_travel_km, residual_coverage_avg, underserved_zones_count, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP) RETURNING id`,
      [
        scenario.name,
        seed,
        policy,
        JSON.stringify({ isPeakHour: scenario.isPeakHour || false, incidentCount: scenario.incidents.length }),
        scenario.incidents.length,
        assignedCount,
        avgTravelKm,
        avgResidualCoverage,
        underservedCount
      ]
    );
    const runId = expRunRes.rows[0].id;

    // Store metrics in experiment_results
    const metrics = [
      { name: 'ASSIGNMENT_RATE', value: Math.round((assignedCount / scenario.incidents.length) * 100) },
      { name: 'AVG_TRAVEL_KM', value: avgTravelKm },
      { name: 'UNDERSERVED_ZONES', value: underservedCount },
      { name: 'ZERO_COVERAGE_ZONES', value: zeroCoverageCount },
      { name: 'CONSTRAINT_VIOLATIONS', value: constraintViolations },
      { name: 'EXECUTION_DURATION_MS', value: durationMs }
    ];

    for (const m of metrics) {
      await db.query(
        `INSERT INTO experiment_results (run_id, metric_name, metric_value)
         VALUES ($1, $2, $3)`,
        [runId, m.name, m.value]
      );
    }

    runReports.push({
      runId,
      scenario: scenario.name,
      policy,
      totalIncidents: scenario.incidents.length,
      assignedCount,
      assignmentRatePercent: Math.round((assignedCount / scenario.incidents.length) * 100),
      avgTravelKm,
      underservedZonesCount: underservedCount,
      zeroCoverageZonesCount: zeroCoverageCount,
      constraintViolations,
      executionDurationMs: durationMs,
      incidentResults
    });
  }

  return {
    scenario: scenario.name,
    description: scenario.description,
    seed,
    runs: runReports
  };
}
