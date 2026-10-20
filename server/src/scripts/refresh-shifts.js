import { getDb } from '../db.js';

async function refreshShifts() {
  const db = await getDb();
  await db.query(`UPDATE shifts SET start_at = NOW() - INTERVAL '2 hours', end_at = NOW() + INTERVAL '24 hours'`);
  console.log('[SUCCESS] Shifts updated to active window.');
  const res = await db.query('SELECT * FROM v_zone_readiness_summary ORDER BY eligible_free_responders DESC');
  console.log('[Database] Zones in readiness view:', res.rows.length);
  for (const r of res.rows.slice(0, 5)) {
    console.log(` - ${r.zone_name}: free=${r.eligible_free_responders}, status=${r.readiness_status}`);
  }
  process.exit(0);
}

refreshShifts().catch(err => {
  console.error(err);
  process.exit(1);
});
