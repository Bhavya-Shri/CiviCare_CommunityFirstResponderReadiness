// =========================================================================
// CiviCare: Community First Responder Allocation Engine
// Core Policies: Nearest-Eligible Baseline & Coverage-Aware Allocation
// =========================================================================

import { getDb } from '../db.js';

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371;

/**
 * Calculate Haversine distance between two coordinates in kilometers.
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return 999.0;
  }
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
}

/**
 * Estimate travel time in minutes based on urban Chennai road proxy.
 * Default urban speed: ~22 km/h (~2.73 minutes/km).
 * Peak hour multiplier: ~1.5x (~4.1 minutes/km).
 */
export function estimateTravelMinutes(distanceKm, isPeakHour = false) {
  const minPerKm = isPeakHour ? 4.1 : 2.73;
  // Add base 1.5 minute dispatch/reaction delay
  return Math.round((1.5 + distanceKm * minPerKm) * 10) / 10;
}

/**
 * Map incident types to required skill codes in CiviCare.
 */
export function getRequiredSkillForIncident(incidentType) {
  const typeLower = (incidentType || '').toLowerCase();
  if (typeLower.includes('cardiac') || typeLower.includes('cpr') || typeLower.includes('unconscious') || typeLower.includes('collapse')) {
    return 'CPR_AED';
  }
  if (typeLower.includes('bleed') || typeLower.includes('laceration') || typeLower.includes('trauma') || typeLower.includes('cut')) {
    return 'BLEEDING_CTRL';
  }
  if (typeLower.includes('chok') || typeLower.includes('airway')) {
    return 'CHOKING_RELIEF';
  }
  if (typeLower.includes('fracture') || typeLower.includes('fall') || typeLower.includes('sprain')) {
    return 'FRACTURE_STABILIZE';
  }
  if (typeLower.includes('allergy') || typeLower.includes('anaphylaxis') || typeLower.includes('bee')) {
    return 'ANAPHYLAXIS_CARE';
  }
  return 'BASIC_FIRST_AID';
}

/**
 * Allocation Orchestrator
 * Evaluates candidate responders against hard safety constraints,
 * then applies either the 'nearest_eligible_baseline' or 'coverage_aware_allocation' policy.
 * 
 * @param {Object} incident - Incident record { id, incident_type, lat, lng, zone_id }
 * @param {Object} options - { policy, maxRadiusKm, alpha, beta, isPeakHour, dbClient }
 */
export async function allocateResponderForIncident(incident, options = {}) {
  const {
    policy = 'coverage_aware_allocation',
    maxRadiusKm = 10.0,
    alpha = 0.45, // Weight for travel time
    beta = 0.55,  // Weight for residual zone coverage preservation
    isPeakHour = false,
    actorId = null
  } = options;

  const db = options.dbClient || (await getDb());
  const incidentId = incident.id;
  const incidentLat = incident.lat;
  const incidentLng = incident.lng;
  const requiredSkillCode = getRequiredSkillForIncident(incident.incident_type);
  const now = new Date();

  // 1. Fetch current zone coverage counts (for evaluating residual coverage impact)
  const zoneSummaryRes = await db.query(`SELECT * FROM v_zone_readiness_summary`);
  const zoneCoverageMap = {};
  for (const z of zoneSummaryRes.rows) {
    zoneCoverageMap[z.zone_id] = parseInt(z.eligible_free_responders, 10) || 0;
  }

  // 2. Query ALL registered responders with their full relation details:
  //    base zone, certifications, active shifts, and active assignments
  const respondersQuery = `
    SELECT 
      r.id AS responder_id,
      r.full_name,
      r.phone,
      r.base_zone_id,
      z.zone_name AS base_zone_name,
      z.code AS base_zone_code,
      COALESCE(r.current_lat, z.center_lat) AS lat,
      COALESCE(r.current_lng, z.center_lng) AS lng,
      r.responder_status,
      r.availability_status,
      r.availability_updated_at,
      -- Check current active shift
      (
        SELECT COUNT(*)
        FROM shifts sh
        WHERE sh.responder_id = r.id
          AND sh.start_at <= $1
          AND sh.end_at >= $1
          AND sh.availability_status = 'on_shift'
      ) AS active_shift_count,
      -- Check certification for required skill
      (
        SELECT json_build_object(
          'cert_id', c.id,
          'verified_status', c.verified_status,
          'valid_from', c.valid_from,
          'valid_until', c.valid_until,
          'is_valid', (c.verified_status = 'verified' AND c.valid_from <= CURRENT_DATE AND c.valid_until >= CURRENT_DATE)
        )
        FROM certifications c
        JOIN skills sk ON c.skill_id = sk.id
        WHERE c.responder_id = r.id
          AND sk.skill_code = $2
        ORDER BY c.valid_until DESC
        LIMIT 1
      ) AS cert_info,
      -- Check if responder holds the required skill
      (
        SELECT COUNT(*)
        FROM responder_skills rs
        JOIN skills sk ON rs.skill_id = sk.id
        WHERE rs.responder_id = r.id
          AND sk.skill_code = $2
      ) AS has_skill,
      -- Check concurrent active assignments (concurrency lock check)
      (
        SELECT COUNT(*)
        FROM assignments a
        WHERE a.responder_id = r.id
          AND a.status IN ('offered', 'accepted', 'en_route', 'arrived')
      ) AS active_assignments_count
    FROM responders r
    JOIN zones z ON r.base_zone_id = z.id;
  `;

  const candidatesRes = await db.query(respondersQuery, [now.toISOString(), requiredSkillCode]);
  const allCandidates = candidatesRes.rows;

  const candidateEvaluation = [];
  const eligibleCandidates = [];

  for (const c of allCandidates) {
    const distKm = calculateHaversineDistance(incidentLat, incidentLng, c.lat, c.lng);
    const travelMins = estimateTravelMinutes(distKm, isPeakHour);
    const certInfo = c.cert_info || null;

    const evalRecord = {
      responder_id: c.responder_id,
      name: c.full_name,
      base_zone: c.base_zone_name,
      base_zone_id: c.base_zone_id,
      distance_km: distKm,
      estimated_travel_minutes: travelMins,
      is_eligible: false,
      rejection_reason: null
    };

    // HARD ELIGIBILITY FILTERS:
    // Filter 1: Responder account must be active
    if (c.responder_status !== 'active') {
      evalRecord.rejection_reason = 'ACCOUNT_NOT_ACTIVE';
      candidateEvaluation.push(evalRecord);
      continue;
    }

    // Filter 2: Availability status must be 'available'
    if (c.availability_status !== 'available') {
      evalRecord.rejection_reason = 'AVAILABILITY_STATUS_NOT_AVAILABLE';
      candidateEvaluation.push(evalRecord);
      continue;
    }

    // Filter 3: Must be on an active shift right now
    if (parseInt(c.active_shift_count, 10) === 0) {
      evalRecord.rejection_reason = 'NO_ACTIVE_SHIFT';
      candidateEvaluation.push(evalRecord);
      continue;
    }

    // Filter 4: Must have required skill in profile
    if (parseInt(c.has_skill, 10) === 0) {
      evalRecord.rejection_reason = `LACKS_REQUIRED_SKILL_${requiredSkillCode}`;
      candidateEvaluation.push(evalRecord);
      continue;
    }

    // Filter 5: Certification must be verified and non-expired
    if (!certInfo) {
      evalRecord.rejection_reason = `NO_CERTIFICATION_FOR_${requiredSkillCode}`;
      candidateEvaluation.push(evalRecord);
      continue;
    }
    if (certInfo.verified_status !== 'verified') {
      evalRecord.rejection_reason = `CERTIFICATION_${certInfo.verified_status.toUpperCase()}`;
      candidateEvaluation.push(evalRecord);
      continue;
    }
    if (!certInfo.is_valid) {
      evalRecord.rejection_reason = 'CERTIFICATION_EXPIRED';
      candidateEvaluation.push(evalRecord);
      continue;
    }

    // Filter 6: No conflicting active assignment
    if (parseInt(c.active_assignments_count, 10) > 0) {
      evalRecord.rejection_reason = 'ALREADY_ASSIGNED_CONFLICT';
      candidateEvaluation.push(evalRecord);
      continue;
    }

    // Filter 7: Distance threshold limit
    if (distKm > maxRadiusKm) {
      evalRecord.rejection_reason = `EXCEEDS_MAX_RADIUS_${maxRadiusKm}KM`;
      candidateEvaluation.push(evalRecord);
      continue;
    }

    // Passed all hard eligibility criteria!
    evalRecord.is_eligible = true;
    candidateEvaluation.push(evalRecord);
    eligibleCandidates.push({
      ...c,
      distance_km: distKm,
      travel_minutes: travelMins,
      evalRecord
    });
  }

  // 3. If NO eligible candidate exists
  if (eligibleCandidates.length === 0) {
    // Record explainable decision log
    await db.query(
      `INSERT INTO allocation_decision_logs (incident_id, policy_version, candidate_summary, selected_responder_id, reason_code, score_details)
       VALUES ($1, $2, $3, NULL, 'NO_ELIGIBLE_CANDIDATE', $4)`,
      [
        incidentId,
        policy,
        JSON.stringify(candidateEvaluation),
        JSON.stringify({ reason: 'All registered responders were excluded by hard safety constraints.', requiredSkill: requiredSkillCode })
      ]
    );

    // Update incident status
    await db.query(`UPDATE incidents SET status = 'no_responder_found', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [incidentId]);

    return {
      success: false,
      reason: 'NO_ELIGIBLE_CANDIDATE',
      message: 'No community first responder satisfies all eligibility, valid certification, shift, and proximity constraints. Official 112 emergency response remains the primary lifeline.',
      candidateEvaluation
    };
  }

  // 4. Score and Rank eligible candidates according to policy
  let selectedCandidate = null;
  const maxPossibleTravel = estimateTravelMinutes(maxRadiusKm, isPeakHour);

  if (policy === 'nearest_eligible_baseline') {
    // Policy A: Nearest-Eligible Baseline
    // Strictly sorts by estimated travel time / distance
    eligibleCandidates.sort((a, b) => a.travel_minutes - b.travel_minutes);
    selectedCandidate = eligibleCandidates[0];

    for (const ec of eligibleCandidates) {
      ec.evalRecord.baseline_rank = eligibleCandidates.indexOf(ec) + 1;
      ec.evalRecord.score = ec.travel_minutes;
    }
  } else {
    // Policy B: Coverage-Aware Responder Allocation
    // Scores = alpha * (travel_minutes / maxPossibleTravel) + beta * (coverage_loss_penalty)
    // Minimizes total cost
    for (const ec of eligibleCandidates) {
      const currentZoneCount = zoneCoverageMap[ec.base_zone_id] || 0;
      let coverageLossPenalty = 0.1;

      if (currentZoneCount <= 1) {
        // High penalty: removing this responder leaves the zone at 0!
        coverageLossPenalty = 1.0;
      } else if (currentZoneCount === 2) {
        // Moderate penalty: leaves zone with only 1 responder (underserved)
        coverageLossPenalty = 0.5;
      } else {
        // Adequate coverage in zone: safe to deploy
        coverageLossPenalty = 0.1;
      }

      const normalizedTravel = Math.min(ec.travel_minutes / maxPossibleTravel, 1.0);
      const combinedScore = Math.round((alpha * normalizedTravel + beta * coverageLossPenalty) * 1000) / 1000;

      ec.coverage_loss_penalty = coverageLossPenalty;
      ec.current_zone_count = currentZoneCount;
      ec.combined_score = combinedScore;
      ec.evalRecord.normalized_travel = normalizedTravel;
      ec.evalRecord.coverage_loss_penalty = coverageLossPenalty;
      ec.evalRecord.combined_score = combinedScore;
      ec.evalRecord.current_zone_eligible = currentZoneCount;
    }

    // Sort by combined score ascending (lowest penalty first)
    eligibleCandidates.sort((a, b) => a.combined_score - b.combined_score);
    selectedCandidate = eligibleCandidates[0];
  }

  // 5. Atomic Assignment within Database Transaction to prevent race condition
  let assignmentRecord = null;
  try {
    assignmentRecord = await db.transaction(async (tx) => {
      // Re-verify that selected responder is still uncommitted (concurrency lock)
      const lockCheck = await tx.query(
        `SELECT id FROM assignments 
         WHERE responder_id = $1 
           AND status IN ('offered', 'accepted', 'en_route', 'arrived')`,
        [selectedCandidate.responder_id]
      );

      if (lockCheck.rows.length > 0) {
        throw new Error('CONCURRENCY_CONFLICT: Responder was claimed by another incident.');
      }

      // Create Assignment
      const assignRes = await tx.query(
        `INSERT INTO assignments (incident_id, responder_id, policy_used, status, estimated_distance_km, estimated_travel_minutes)
         VALUES ($1, $2, $3, 'offered', $4, $5)
         RETURNING *`,
        [
          incidentId,
          selectedCandidate.responder_id,
          policy,
          selectedCandidate.distance_km,
          selectedCandidate.travel_minutes
        ]
      );
      const assign = assignRes.rows[0];

      // Update Incident Status
      await tx.query(
        `UPDATE incidents SET status = 'assigned', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [incidentId]
      );

      // Record Incident Event
      await tx.query(
        `INSERT INTO incident_events (incident_id, event_type, actor_id, note)
         VALUES ($1, 'ASSIGNED', $2, $3)`,
        [
          incidentId,
          actorId,
          `Allocated to responder ${selectedCandidate.full_name} via ${policy}`
        ]
      );

      // Record Assignment Event
      await tx.query(
        `INSERT INTO assignment_events (assignment_id, event_type, actor_id)
         VALUES ($1, 'OFFERED', $2)`,
        [assign.id, actorId]
      );

      // Log explainable decision details
      const scoreDetails = {
        policy,
        selected_responder_id: selectedCandidate.responder_id,
        selected_responder_name: selectedCandidate.full_name,
        selected_distance_km: selectedCandidate.distance_km,
        selected_travel_minutes: selectedCandidate.travel_minutes,
        alpha,
        beta,
        combined_score: selectedCandidate.combined_score || null,
        coverage_loss_penalty: selectedCandidate.coverage_loss_penalty || null,
        base_zone: selectedCandidate.base_zone_name,
        residual_zone_count: (zoneCoverageMap[selectedCandidate.base_zone_id] || 1) - 1,
        total_eligible_considered: eligibleCandidates.length
      };

      await tx.query(
        `INSERT INTO allocation_decision_logs (incident_id, policy_version, candidate_summary, selected_responder_id, reason_code, score_details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          incidentId,
          policy,
          JSON.stringify(candidateEvaluation),
          selectedCandidate.responder_id,
          policy === 'coverage_aware_allocation' ? 'COVERAGE_AWARE_OPTIMAL' : 'NEAREST_ELIGIBLE_OPTIMAL',
          JSON.stringify(scoreDetails)
        ]
      );

      return assign;
    });
  } catch (err) {
    if (err.message.includes('CONCURRENCY_CONFLICT')) {
      console.warn('[Allocation Conflict]:', err.message);
      return {
        success: false,
        reason: 'CONCURRENCY_CONFLICT',
        message: 'A race condition occurred: candidate was claimed simultaneously. Retrying allocation with residual candidates.',
        candidateEvaluation
      };
    }
    throw err;
  }

  // 6. Capture updated zone readiness snapshot post-assignment
  const postZoneSummaryRes = await db.query(`SELECT * FROM v_zone_readiness_summary`);
  for (const z of postZoneSummaryRes.rows) {
    const count = parseInt(z.eligible_free_responders, 10) || 0;
    const score = count >= 3 ? 1.0 : count === 2 ? 0.7 : count === 1 ? 0.35 : 0.0;
    await db.query(
      `INSERT INTO readiness_snapshots (zone_id, eligible_count, coverage_score, policy_version)
       VALUES ($1, $2, $3, $4)`,
      [z.zone_id, count, score, policy]
    );
  }

  return {
    success: true,
    policy,
    assignment: assignmentRecord,
    selectedResponder: {
      id: selectedCandidate.responder_id,
      name: selectedCandidate.full_name,
      base_zone: selectedCandidate.base_zone_name,
      distance_km: selectedCandidate.distance_km,
      travel_minutes: selectedCandidate.travel_minutes,
      combined_score: selectedCandidate.combined_score || null,
      coverage_loss_penalty: selectedCandidate.coverage_loss_penalty || null
    },
    candidateEvaluation
  };
}
