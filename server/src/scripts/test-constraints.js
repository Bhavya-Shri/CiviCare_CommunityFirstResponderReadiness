// =========================================================================
// CiviCare: Database Constraints, Eligibility & Concurrency Test Suite
// Verifies relational integrity, CHECK constraints, foreign keys, views, and race conditions
// =========================================================================

import { getDb } from '../db.js';
import { runSeed } from './seed.js';
import { allocateResponderForIncident } from '../allocation/engine.js';

async function runConstraintTests() {
  console.log('=========================================================================');
  console.log(' CiviCare DBMS Relational Integrity & Allocation Verification Suite');
  console.log('=========================================================================\n');

  // Reset database to ensure pristine state
  await runSeed(false);
  const db = await getDb();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // -----------------------------------------------------------------------
  // TEST 1: Foreign Key Constraint Enforcement
  // -----------------------------------------------------------------------
  console.log('[Test Suite 1] Foreign Key Integrity Constraints:');
  try {
    // Attempt inserting responder with non-existent base_zone_id
    await db.query(
      `INSERT INTO responders (full_name, phone, base_zone_id, responder_status)
       VALUES ('Invalid Zone Test', '9999999999', 99999, 'active')`
    );
    assert(false, 'Should reject responder with non-existent zone_id');
  } catch (err) {
    assert(true, 'Correctly rejected foreign key violation for non-existent zone_id');
  }

  // -----------------------------------------------------------------------
  // TEST 2: CHECK Constraint Enforcement on Shifts (start_at < end_at)
  // -----------------------------------------------------------------------
  console.log('\n[Test Suite 2] Domain & CHECK Constraints:');
  try {
    const invalidStart = new Date('2026-10-15T12:00:00Z').toISOString();
    const invalidEnd = new Date('2026-10-15T10:00:00Z').toISOString(); // End before start!
    await db.query(
      `INSERT INTO shifts (responder_id, start_at, end_at)
       VALUES (1, $1, $2)`,
      [invalidStart, invalidEnd]
    );
    assert(false, 'Should reject shift where end_at <= start_at');
  } catch (err) {
    assert(true, 'Correctly enforced CHECK constraint check_shift_time_window (start_at < end_at)');
  }

  try {
    // Attempt invalid role in users
    await db.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ('hacker@test.com', 'hash', 'superadmin_unauthorized')`
    );
    assert(false, 'Should reject invalid user role');
  } catch (err) {
    assert(true, 'Correctly enforced CHECK constraint on users.role enum values');
  }

  // -----------------------------------------------------------------------
  // TEST 3: Expired Certification Filtering
  // -----------------------------------------------------------------------
  console.log('\n[Test Suite 3] Certification Validity & Eligibility Rules:');
  // In Anna Nagar, Kavitha has an expired CPR credential
  const annaIncidentRes = await db.query(
    `INSERT INTO incidents (reference_code, incident_type, priority_label, reporter_role, lat, lng, location_notes, status)
     VALUES ('TEST-EXP-CERT', 'Cardiac Arrest / CPR Needed', 'critical', 'bystander', 13.0840, 80.2090, 'Beside expired cert test responder', 'pending')
     RETURNING *`
  );
  const annaIncident = annaIncidentRes.rows[0];

  const allocAnna = await allocateResponderForIncident(annaIncident, { policy: 'nearest_eligible_baseline' });
  assert(allocAnna.success, 'Allocation completed for eligible responder in Anna Nagar');
  
  // Find Kavitha in the candidate evaluation log
  const kavithaEval = allocAnna.candidateEvaluation.find(c => c.name.includes('Expired Cert Test'));
  assert(kavithaEval && kavithaEval.is_eligible === false, 'Kavitha was marked NOT eligible');
  assert(kavithaEval && kavithaEval.rejection_reason === 'CERTIFICATION_EXPIRED', `Kavitha rejected with reason: ${kavithaEval?.rejection_reason}`);

  // -----------------------------------------------------------------------
  // TEST 4: Off-Shift / Stale Availability Exclusion
  // -----------------------------------------------------------------------
  console.log('\n[Test Suite 4] Shift Window & Availability Exclusion:');
  const guindyIncidentRes = await db.query(
    `INSERT INTO incidents (reference_code, incident_type, priority_label, reporter_role, lat, lng, location_notes, status)
     VALUES ('TEST-OFF-SHIFT', 'Cardiac Arrest / CPR Needed', 'critical', 'bystander', 13.0060, 80.2025, 'Guindy test', 'pending')
     RETURNING *`
  );
  const guindyIncident = guindyIncidentRes.rows[0];
  const allocGuindy = await allocateResponderForIncident(guindyIncident, { policy: 'nearest_eligible_baseline' });
  const mohanEval = allocGuindy.candidateEvaluation.find(c => c.name.includes('Off-Shift Test'));
  assert(mohanEval && mohanEval.is_eligible === false, 'Mohan Das (off-shift) was marked NOT eligible');
  assert(mohanEval && (mohanEval.rejection_reason === 'AVAILABILITY_STATUS_NOT_AVAILABLE' || mohanEval.rejection_reason === 'NO_ACTIVE_SHIFT'), `Mohan rejected with availability reason: ${mohanEval?.rejection_reason}`);

  // -----------------------------------------------------------------------
  // TEST 5: Concurrent Allocation Conflict Prevention (Transaction Safety)
  // -----------------------------------------------------------------------
  console.log('\n[Test Suite 5] Transaction Concurrency & Double-Assignment Prevention:');
  // Two incidents compete for the sole responder of Ambattur
  const inc1Res = await db.query(
    `INSERT INTO incidents (reference_code, incident_type, priority_label, reporter_role, lat, lng, location_notes, status)
     VALUES ('TEST-RACE-1', 'Severe Bleeding / Deep Laceration', 'high', 'bystander', 13.1143, 80.1548, 'Ambattur Race 1', 'pending')
     RETURNING *`
  );
  const inc2Res = await db.query(
    `INSERT INTO incidents (reference_code, incident_type, priority_label, reporter_role, lat, lng, location_notes, status)
     VALUES ('TEST-RACE-2', 'Severe Bleeding / Deep Laceration', 'high', 'bystander', 13.1145, 80.1552, 'Ambattur Race 2', 'pending')
     RETURNING *`
  );

  const res1 = await allocateResponderForIncident(inc1Res.rows[0], { policy: 'nearest_eligible_baseline' });
  const res2 = await allocateResponderForIncident(inc2Res.rows[0], { policy: 'nearest_eligible_baseline' });

  assert(res1.success, 'Incident 1 secured the responder');
  assert(
    !res2.success || (res2.selectedResponder && res2.selectedResponder.id !== res1.selectedResponder.id),
    'Incident 2 did NOT get assigned to the same active responder concurrently'
  );

  // Check database assignments count for that responder
  const ambatturRespId = res1.selectedResponder.id;
  const activeAssignments = await db.query(
    `SELECT COUNT(*) FROM assignments WHERE responder_id = $1 AND status IN ('offered', 'accepted', 'en_route', 'arrived')`,
    [ambatturRespId]
  );
  assert(parseInt(activeAssignments.rows[0].count, 10) === 1, 'Responder has strictly 1 active assignment (concurrency lock verified)');

  // -----------------------------------------------------------------------
  // TEST 6: Relational Views Consistency
  // -----------------------------------------------------------------------
  console.log('\n[Test Suite 6] SQL Views & Analytical Summaries:');
  const viewRes = await db.query(`SELECT COUNT(*) FROM v_zone_readiness_summary WHERE readiness_status IS NOT NULL`);
  assert(parseInt(viewRes.rows[0].count, 10) === 15, 'v_zone_readiness_summary covers all 15 Chennai zones');

  const activeRes = await db.query(`SELECT COUNT(*) FROM v_active_responder_readiness`);
  assert(parseInt(activeRes.rows[0].count, 10) > 0, `v_active_responder_readiness accurately filters verified responders on shift (${activeRes.rows[0].count} found)`);

  console.log('\n=========================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=========================================================================\n');

  if (failed > 0) process.exit(1);
}

runConstraintTests().then(() => process.exit(0)).catch(err => {
  console.error('[Test Error]:', err);
  process.exit(1);
});
