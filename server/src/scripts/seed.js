import { getDb, initSchema } from '../db.js';
import bcrypt from 'bcryptjs';

export async function runSeed(verbose = true) {
  if (verbose) console.log('[Seed] Starting database seed for CiviCare...');
  await initSchema();
  const db = await getDb();

  // 1. Password hashes
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('admin123', salt);
  const evalHash = bcrypt.hashSync('eval123', salt);
  const respHash = bcrypt.hashSync('resp123', salt);

  // 2. Insert Users
  if (verbose) console.log('[Seed] Creating core administrative, evaluator, and responder users...');
  const usersToInsert = [
    { email: 'admin@civicare.in', hash: adminHash, role: 'admin' },
    { email: 'evaluator@civicare.in', hash: evalHash, role: 'evaluator' },
    { email: 'dr.arun@civicare.in', hash: respHash, role: 'responder' },
    { email: 'priya.k@civicare.in', hash: respHash, role: 'responder' },
    { email: 'karthik.s@civicare.in', hash: respHash, role: 'responder' },
    { email: 'deepa.r@civicare.in', hash: respHash, role: 'responder' },
    { email: 'suresh.m@civicare.in', hash: respHash, role: 'responder' },
    { email: 'ananya.v@civicare.in', hash: respHash, role: 'responder' },
    { email: 'rajesh.b@civicare.in', hash: respHash, role: 'responder' },
    { email: 'meena.t@civicare.in', hash: respHash, role: 'responder' },
  ];

  const userIds = {};
  for (const u of usersToInsert) {
    const res = await db.query(
      `INSERT INTO users (email, password_hash, role, account_status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id, email`,
      [u.email, u.hash, u.role]
    );
    userIds[u.email] = res.rows[0].id;
  }

  // 3. Organisations
  if (verbose) console.log('[Seed] Creating certified community volunteer organisations...');
  const orgs = [
    { name: 'Indian Red Cross Society - Tamil Nadu Branch', type: 'Humanitarian Volunteer Corps', email: 'ircs-tn@civicare.org' },
    { name: 'St John Ambulance Association Chennai', type: 'First Aid & Emergency Training', email: 'stjohn-chennai@civicare.org' },
    { name: 'Chennai Community First Responders Guild', type: 'Grassroots Community Network', email: 'guild@civicare.org' },
    { name: 'Aarogya Life Support Volunteers', type: 'Community Medical Volunteers', email: 'aarogya@civicare.org' }
  ];

  const orgIds = [];
  for (const org of orgs) {
    const res = await db.query(
      `INSERT INTO organisations (name, organisation_type, verification_status, contact_email)
       VALUES ($1, $2, 'verified', $3) RETURNING id`,
      [org.name, org.type, org.email]
    );
    orgIds.push(res.rows[0].id);
  }

  // 4. Chennai Zones
  if (verbose) console.log('[Seed] Inserting 15 Chennai metropolitan zones with geographic coordinates...');
  const zones = [
    { name: 'T. Nagar', code: 'CHN-TNAGAR', lat: 13.0418, lng: 80.2341, pop: 185000, rad: 2.8 },
    { name: 'Anna Nagar', code: 'CHN-ANNANAGAR', lat: 13.0850, lng: 80.2100, pop: 210000, rad: 3.2 },
    { name: 'Adyar', code: 'CHN-ADYAR', lat: 13.0012, lng: 80.2565, pop: 140000, rad: 3.0 },
    { name: 'Mylapore', code: 'CHN-MYLAPORE', lat: 13.0336, lng: 80.2687, pop: 165000, rad: 2.5 },
    { name: 'Royapuram / George Town', code: 'CHN-ROYAPURAM', lat: 13.0970, lng: 80.2925, pop: 240000, rad: 2.7 },
    { name: 'Guindy', code: 'CHN-GUINDY', lat: 13.0067, lng: 80.2030, pop: 130000, rad: 3.1 },
    { name: 'Velachery', code: 'CHN-VELACHERY', lat: 12.9815, lng: 80.2180, pop: 195000, rad: 3.3 },
    { name: 'Kodambakkam', code: 'CHN-KODAMBAKKAM', lat: 13.0515, lng: 80.2210, pop: 175000, rad: 2.6 },
    { name: 'Alandur', code: 'CHN-ALANDUR', lat: 12.9975, lng: 80.1915, pop: 125000, rad: 2.9 },
    { name: 'Ambattur', code: 'CHN-AMBATTUR', lat: 13.1143, lng: 80.1548, pop: 250000, rad: 4.5 },
    { name: 'Kilpauk', code: 'CHN-KILPAUK', lat: 13.0827, lng: 80.2437, pop: 145000, rad: 2.4 },
    { name: 'Thiruvanmiyur', code: 'CHN-THIRUVANMIYUR', lat: 12.9830, lng: 80.2594, pop: 120000, rad: 2.8 },
    { name: 'Porur', code: 'CHN-PORUR', lat: 13.0382, lng: 80.1565, pop: 160000, rad: 3.8 },
    { name: 'Tambaram', code: 'CHN-TAMBARAM', lat: 12.9249, lng: 80.1000, pop: 220000, rad: 4.2 },
    { name: 'Sholinganallur', code: 'CHN-SHOLINGANALLUR', lat: 12.9010, lng: 80.2279, pop: 180000, rad: 4.0 },
  ];

  const zoneIds = {};
  for (const z of zones) {
    const res = await db.query(
      `INSERT INTO zones (zone_name, code, center_lat, center_lng, radius_km, population_estimate)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, zone_name`,
      [z.name, z.code, z.lat, z.lng, z.rad, z.pop]
    );
    zoneIds[z.name] = res.rows[0].id;
  }

  // 5. Skills
  if (verbose) console.log('[Seed] Inserting skills catalogue with defined clinical scopes...');
  const skillsList = [
    { code: 'CPR_AED', name: 'Cardiopulmonary Resuscitation & AED', scope: 'Basic life support, high-quality chest compressions, automated external defibrillator usage for adult and pediatric cardiac arrest victims.' },
    { code: 'BLEEDING_CTRL', name: 'Severe Bleeding Control', scope: 'Direct pressure, pressure dressing, hemostatic gauze wound packing, arterial tourniquet application.' },
    { code: 'BASIC_FIRST_AID', name: 'Basic First Aid & Triage', scope: 'Wound disinfection, burn initial dressing, recovery position, heat stroke cooling, fainting recovery.' },
    { code: 'CHOKING_RELIEF', name: 'Airway Obstruction & Choking Relief', scope: 'Back blows and abdominal thrusts (Heimlich maneuver) for conscious adults, children, and infants.' },
    { code: 'FRACTURE_STABILIZE', name: 'Fracture & Sprain Stabilization', scope: 'Splinting, limb immobilization, sling preparation, safe positioning without traction.' },
    { code: 'ANAPHYLAXIS_CARE', name: 'Anaphylaxis Emergency Assistance', scope: 'Positioning, airway monitoring, assisting patient with authorized autoinjector.' }
  ];

  const skillIds = {};
  for (const s of skillsList) {
    const res = await db.query(
      `INSERT INTO skills (skill_code, skill_name, permitted_scope, description)
       VALUES ($1, $2, $3, $4) RETURNING id, skill_code`,
      [s.code, s.name, s.scope, s.scope]
    );
    skillIds[s.code] = res.rows[0].id;
  }

  // 6. Real Sourced Chennai Facilities
  if (verbose) console.log('[Seed] Inserting 15 real public healthcare facilities with documented capabilities...');
  const facilities = [
    {
      name: 'Rajiv Gandhi Government General Hospital (RGGGH)',
      type: 'Government Tertiary Teaching Hospital & Level 1 Trauma',
      address: 'EVR Periyar Salai, Park Town, Chennai, Tamil Nadu 600003',
      zone: 'Royapuram / George Town',
      lat: 13.0805, lng: 80.2798,
      phone: '044-25305000',
      caps: ['TRAUMA_LVL1', 'CARDIOLOGY_24X7', 'BURNS_ICU', 'NEURO_EMERGENCY', 'STROKE_UNIT']
    },
    {
      name: 'Government Stanley Medical College Hospital',
      type: 'Government Teaching Hospital & Specialized Plastic/Trauma',
      address: 'Old Jail Rd, Royapuram, Chennai, Tamil Nadu 600001',
      zone: 'Royapuram / George Town',
      lat: 13.1075, lng: 80.2880,
      phone: '044-25281351',
      caps: ['TRAUMA_LVL1', 'BURNS_ICU', 'RECONSTRUCTIVE_EMERGENCY', '24X7_CASUALTY']
    },
    {
      name: 'Government Kilpauk Medical College Hospital',
      type: 'Government Specialist Burns & Emergency Care Center',
      address: '822, Poonamallee High Rd, Kilpauk, Chennai, Tamil Nadu 600010',
      zone: 'Kilpauk',
      lat: 13.0820, lng: 80.2430,
      phone: '044-28364951',
      caps: ['BURNS_CENTER', 'TRAUMA_CARE', 'PEDIATRIC_EMERGENCY']
    },
    {
      name: 'Government Multi Super Speciality Hospital (Omandurar)',
      type: 'Government Super Speciality Tertiary Center',
      address: 'Omandurar Government Estate, Anna Salai, Triplicane, Chennai 600002',
      zone: 'Mylapore',
      lat: 13.0673, lng: 80.2736,
      phone: '044-25666000',
      caps: ['CARDIOLOGY_24X7', 'NEURO_EMERGENCY', 'VASCULAR_EMERGENCY']
    },
    {
      name: 'Apollo Hospitals Greams Road',
      type: 'Private Multi-Speciality Tertiary Care',
      address: '21 Greams Lane, Thousand Lights, Chennai, Tamil Nadu 600006',
      zone: 'T. Nagar',
      lat: 13.0583, lng: 80.2519,
      phone: '044-28290200',
      caps: ['CATH_LAB_24X7', 'ADVANCED_TRAUMA', 'STROKE_UNIT', 'PEDIATRIC_ICU']
    },
    {
      name: 'Fortis Malar Hospital',
      type: 'Private Cardiac & Critical Care Hospital',
      address: 'No. 52, 1st Main Rd, Gandhi Nagar, Adyar, Chennai, Tamil Nadu 600020',
      zone: 'Adyar',
      lat: 13.0076, lng: 80.2571,
      phone: '044-42892222',
      caps: ['CARDIAC_EMERGENCY', 'TRAUMA_CARE', 'CRITICAL_CARE_ICU']
    },
    {
      name: 'MIOT International Hospital',
      type: 'Private Orthopedic & Advanced Trauma Hospital',
      address: '4/112, Mount Poonamallee Rd, Manapakkam, Chennai, Tamil Nadu 600089',
      zone: 'Guindy',
      lat: 13.0238, lng: 80.1794,
      phone: '044-42002288',
      caps: ['ORTHOPEDIC_TRAUMA', 'POLYTRAUMA_UNIT', 'CARDIOTHORACIC_ICU']
    },
    {
      name: 'Sri Ramachandra Medical Centre (SRMC)',
      type: 'Private University Teaching Hospital & Comprehensive Trauma',
      address: 'No.1 Ramachandra Nagar, Porur, Chennai, Tamil Nadu 600116',
      zone: 'Porur',
      lat: 13.0353, lng: 80.1465,
      phone: '044-45928500',
      caps: ['TRAUMA_LVL1', 'PEDIATRIC_EMERGENCY', 'BURNS_CARE', 'CATH_LAB_24X7']
    },
    {
      name: 'SIMS Hospital Vadapalani',
      type: 'Private Multi-Super Speciality Hospital',
      address: '1, Jawaharlal Nehru Salai, Vadapalani, Chennai, Tamil Nadu 600026',
      zone: 'Kodambakkam',
      lat: 13.0505, lng: 80.2105,
      phone: '044-20002001',
      caps: ['EMERGENCY_TRAUMA', 'CARDIO_STROKE_FAST_TRACK', 'ICU_SUPPORT']
    },
    {
      name: 'Gleneagles Health City Chennai',
      type: 'Private Multi-Organ Transplant & Critical Care',
      address: '439, Cheran Nagar, Perumbakkam, Chennai, Tamil Nadu 600100',
      zone: 'Sholinganallur',
      lat: 12.9090, lng: 80.2015,
      phone: '044-44777000',
      caps: ['CRITICAL_CARE', 'HEPATOBILIARY_EMERGENCY', 'TRAUMA_STABILIZATION']
    },
    {
      name: 'Kauvery Hospital Alwarpet',
      type: 'Private Emergency & Critical Care Hospital',
      address: '81, TT Krishnamachari Rd, Alwarpet, Chennai, Tamil Nadu 600018',
      zone: 'Mylapore',
      lat: 13.0375, lng: 80.2520,
      phone: '044-40006000',
      caps: ['GERIATRIC_EMERGENCY', 'STROKE_FAST_TRACK', 'EMERGENCY_RESUSCITATION']
    },
    {
      name: 'Prashanth Super Speciality Hospital',
      type: 'Private Multi-Speciality Care',
      address: 'No. 36 & 36A, Velachery Main Rd, Velachery, Chennai 600042',
      zone: 'Velachery',
      lat: 12.9790, lng: 80.2215,
      phone: '044-46805555',
      caps: ['24X7_CASUALTY', 'EMERGENCY_ICU', 'NEONATAL_EMERGENCY']
    },
    {
      name: 'Hindu Mission Hospital Tambaram',
      type: 'Non-Profit Charitable Multi-Speciality Hospital',
      address: '103, Grand Southern Trunk Rd, Tambaram West, Chennai 600045',
      zone: 'Tambaram',
      lat: 12.9300, lng: 80.1160,
      phone: '044-22262244',
      caps: ['DIALYSIS_EMERGENCY', 'TRAUMA_CARE', 'BLOOD_BANK_SUPPORT']
    },
    {
      name: 'Billroth Hospital Shenoy Nagar',
      type: 'Private Multi-Speciality Hospital',
      address: '43, 4th Cross St, Shenoy Nagar, Chennai, Tamil Nadu 600030',
      zone: 'Anna Nagar',
      lat: 13.0760, lng: 80.2260,
      phone: '044-26641777',
      caps: ['EMERGENCY_CASUALTY', 'SURGICAL_ICU', 'AMBULANCE_DISPATCH']
    },
    {
      name: 'Apollo Speciality Hospital OMR',
      type: 'Private Multi-Speciality Trauma Care',
      address: '5/639, Rajiv Gandhi Salai, Perungudi, Chennai 600096',
      zone: 'Thiruvanmiyur',
      lat: 12.9640, lng: 80.2450,
      phone: '044-33221111',
      caps: ['CORONARY_CARE', 'HIGHWAY_TRAUMA', 'STROKE_UNIT']
    }
  ];

  for (const f of facilities) {
    const fRes = await db.query(
      `INSERT INTO facilities (name, facility_type, address, zone_id, lat, lng, contact_phone, source_name, source_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'OpenStreetMap / Data.gov.in Chennai Directory', 'https://www.openstreetmap.org')
       RETURNING id`,
      [f.name, f.type, f.address, zoneIds[f.zone] || null, f.lat, f.lng, f.phone]
    );
    const fid = fRes.rows[0].id;
    for (const cap of f.caps) {
      await db.query(
        `INSERT INTO facility_capabilities (facility_id, capability_code, capability_name, source_note)
         VALUES ($1, $2, $3, 'Documented public hospital capability register')`,
        [fid, cap, cap.replace(/_/g, ' ')]
      );
    }
  }

  // 7. Synthetic Responders across Chennai
  // We model varied conditions:
  // - Responders with active shifts, valid certifications
  // - Sparse Zone (Ambattur has only 1 responder)
  // - Expired Certification edge case (Kavitha in Anna Nagar)
  // - Stale Availability / Off-shift (Mohan in Guindy)
  // - Pending review responder (Vikram in Adyar)
  if (verbose) console.log('[Seed] Generating synthetic responders and certification profiles...');

  const respondersData = [
    // T. Nagar (Dense Zone with 3 responders)
    { name: 'Dr. Arun Kumar', phone: '+91 98401 11201', zone: 'T. Nagar', lat: 13.0425, lng: 80.2335, status: 'active', avail: 'available', orgIdx: 0, email: 'dr.arun@civicare.in', skills: ['CPR_AED', 'BLEEDING_CTRL', 'BASIC_FIRST_AID'], certState: 'verified', validDeltaDays: 180 },
    { name: 'Priya Kalyani', phone: '+91 98402 11202', zone: 'T. Nagar', lat: 13.0405, lng: 80.2350, status: 'active', avail: 'available', orgIdx: 1, email: 'priya.k@civicare.in', skills: ['CPR_AED', 'CHOKING_RELIEF'], certState: 'verified', validDeltaDays: 90 },
    { name: 'Karthik Subbaraj', phone: '+91 98403 11203', zone: 'T. Nagar', lat: 13.0440, lng: 80.2320, status: 'active', avail: 'available', orgIdx: 2, email: 'karthik.s@civicare.in', skills: ['BLEEDING_CTRL', 'FRACTURE_STABILIZE'], certState: 'verified', validDeltaDays: 120 },

    // Anna Nagar (Special test: Kavitha with EXPIRED certification!)
    { name: 'Deepa Ramanathan', phone: '+91 98404 11204', zone: 'Anna Nagar', lat: 13.0855, lng: 80.2110, status: 'active', avail: 'available', orgIdx: 0, email: 'deepa.r@civicare.in', skills: ['CPR_AED', 'BLEEDING_CTRL'], certState: 'verified', validDeltaDays: 200 },
    { name: 'Kavitha Srinivasan (Expired Cert Test)', phone: '+91 98405 11205', zone: 'Anna Nagar', lat: 13.0840, lng: 80.2090, status: 'active', avail: 'available', orgIdx: 1, email: null, skills: ['CPR_AED'], certState: 'expired', validDeltaDays: -15 }, // EXPIRED 15 days ago!

    // Ambattur (SPARSE ZONE TEST: Only 1 responder!)
    { name: 'Suresh Mani (Sole Ambattur Responder)', phone: '+91 98406 11206', zone: 'Ambattur', lat: 13.1145, lng: 80.1550, status: 'active', avail: 'available', orgIdx: 2, email: 'suresh.m@civicare.in', skills: ['CPR_AED', 'BLEEDING_CTRL', 'BASIC_FIRST_AID'], certState: 'verified', validDeltaDays: 150 },

    // Adyar (Special test: Vikram with PENDING certification!)
    { name: 'Ananya Venkatesh', phone: '+91 98407 11207', zone: 'Adyar', lat: 13.0015, lng: 80.2570, status: 'active', avail: 'available', orgIdx: 0, email: 'ananya.v@civicare.in', skills: ['CPR_AED', 'BASIC_FIRST_AID', 'ANAPHYLAXIS_CARE'], certState: 'verified', validDeltaDays: 140 },
    { name: 'Vikram Chandran (Pending Verification)', phone: '+91 98408 11208', zone: 'Adyar', lat: 13.0020, lng: 80.2550, status: 'pending_approval', avail: 'available', orgIdx: 3, email: null, skills: ['CPR_AED'], certState: 'pending', validDeltaDays: 365 },

    // Mylapore (Normal & Simultaneous test candidate)
    { name: 'Rajesh Balaji', phone: '+91 98409 11209', zone: 'Mylapore', lat: 13.0330, lng: 80.2690, status: 'active', avail: 'available', orgIdx: 1, email: 'rajesh.b@civicare.in', skills: ['CPR_AED', 'BLEEDING_CTRL', 'CHOKING_RELIEF'], certState: 'verified', validDeltaDays: 240 },
    { name: 'Meena Thiyagarajan', phone: '+91 98410 11210', zone: 'Mylapore', lat: 13.0345, lng: 80.2675, status: 'active', avail: 'available', orgIdx: 2, email: 'meena.t@civicare.in', skills: ['BASIC_FIRST_AID', 'FRACTURE_STABILIZE'], certState: 'verified', validDeltaDays: 160 },

    // Guindy (Special test: Mohan who is OFF-SHIFT / UNAVAILABLE)
    { name: 'Gopal Krishnan', phone: '+91 98411 11211', zone: 'Guindy', lat: 13.0070, lng: 80.2035, status: 'active', avail: 'available', orgIdx: 0, email: null, skills: ['CPR_AED', 'BLEEDING_CTRL'], certState: 'verified', validDeltaDays: 180 },
    { name: 'Mohan Das (Off-Shift Test)', phone: '+91 98412 11212', zone: 'Guindy', lat: 13.0060, lng: 80.2025, status: 'active', avail: 'unavailable', orgIdx: 1, email: null, skills: ['CPR_AED'], certState: 'verified', validDeltaDays: 180, offShift: true },

    // Velachery
    { name: 'Harish Shankar', phone: '+91 98413 11213', zone: 'Velachery', lat: 12.9820, lng: 80.2185, status: 'active', avail: 'available', orgIdx: 2, email: null, skills: ['CPR_AED', 'BLEEDING_CTRL', 'BASIC_FIRST_AID'], certState: 'verified', validDeltaDays: 300 },
    { name: 'Bhavani Shankar', phone: '+91 98414 11214', zone: 'Velachery', lat: 12.9810, lng: 80.2170, status: 'active', avail: 'available', orgIdx: 3, email: null, skills: ['CHOKING_RELIEF', 'BASIC_FIRST_AID'], certState: 'verified', validDeltaDays: 190 },

    // Kodambakkam
    { name: 'Naveen Prakash', phone: '+91 98415 11215', zone: 'Kodambakkam', lat: 13.0520, lng: 80.2215, status: 'active', avail: 'available', orgIdx: 0, email: null, skills: ['CPR_AED', 'BLEEDING_CTRL'], certState: 'verified', validDeltaDays: 110 },
    { name: 'Revathi Mohan', phone: '+91 98416 11216', zone: 'Kodambakkam', lat: 13.0510, lng: 80.2200, status: 'active', avail: 'available', orgIdx: 1, email: null, skills: ['BASIC_FIRST_AID', 'FRACTURE_STABILIZE'], certState: 'verified', validDeltaDays: 130 },

    // Kilpauk
    { name: 'Dr. Sanjay Natesan', phone: '+91 98417 11217', zone: 'Kilpauk', lat: 13.0830, lng: 80.2440, status: 'active', avail: 'available', orgIdx: 0, email: null, skills: ['CPR_AED', 'BLEEDING_CTRL', 'ANAPHYLAXIS_CARE'], certState: 'verified', validDeltaDays: 360 },

    // Royapuram
    { name: 'Muruganandam P', phone: '+91 98418 11218', zone: 'Royapuram / George Town', lat: 13.0975, lng: 80.2930, status: 'active', avail: 'available', orgIdx: 2, email: null, skills: ['CPR_AED', 'BLEEDING_CTRL'], certState: 'verified', validDeltaDays: 210 },
    { name: 'Farooq Ahmed', phone: '+91 98419 11219', zone: 'Royapuram / George Town', lat: 13.0965, lng: 80.2915, status: 'active', avail: 'available', orgIdx: 3, email: null, skills: ['BASIC_FIRST_AID', 'CHOKING_RELIEF'], certState: 'verified', validDeltaDays: 180 },

    // Thiruvanmiyur
    { name: 'Sandhya Swaminathan', phone: '+91 98420 11220', zone: 'Thiruvanmiyur', lat: 12.9835, lng: 80.2598, status: 'active', avail: 'available', orgIdx: 0, email: null, skills: ['CPR_AED', 'BLEEDING_CTRL'], certState: 'verified', validDeltaDays: 170 },

    // Porur
    { name: 'Manoj Daniel', phone: '+91 98421 11221', zone: 'Porur', lat: 13.0385, lng: 80.1570, status: 'active', avail: 'available', orgIdx: 1, email: null, skills: ['CPR_AED', 'BASIC_FIRST_AID', 'FRACTURE_STABILIZE'], certState: 'verified', validDeltaDays: 220 },

    // Tambaram
    { name: 'Siddharth Varma', phone: '+91 98422 11222', zone: 'Tambaram', lat: 12.9255, lng: 80.1005, status: 'active', avail: 'available', orgIdx: 2, email: null, skills: ['CPR_AED', 'BLEEDING_CTRL'], certState: 'verified', validDeltaDays: 140 },

    // Sholinganallur
    { name: 'Preeti Venkatesh', phone: '+91 98423 11223', zone: 'Sholinganallur', lat: 12.9015, lng: 80.2285, status: 'active', avail: 'available', orgIdx: 3, email: null, skills: ['CPR_AED', 'CHOKING_RELIEF', 'BASIC_FIRST_AID'], certState: 'verified', validDeltaDays: 260 }
  ];

  const adminUserId = userIds['admin@civicare.in'];
  const now = new Date();

  for (const r of respondersData) {
    const uId = r.email ? userIds[r.email] : null;
    const zId = zoneIds[r.zone];
    const oId = orgIds[r.orgIdx];

    const rRes = await db.query(
      `INSERT INTO responders (user_id, organisation_id, base_zone_id, full_name, phone, current_lat, current_lng, responder_status, availability_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [uId, oId, zId, r.name, r.phone, r.lat, r.lng, r.status, r.avail]
    );
    const respId = rRes.rows[0].id;

    // Insert responder skills and certifications
    for (const skCode of r.skills) {
      const sId = skillIds[skCode];
      await db.query(
        `INSERT INTO responder_skills (responder_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [respId, sId]
      );

      // Certification dates
      const validFrom = new Date(now.getTime() - 90 * 24 * 3600 * 1000).toISOString().split('T')[0];
      const validUntil = new Date(now.getTime() + r.validDeltaDays * 24 * 3600 * 1000).toISOString().split('T')[0];

      await db.query(
        `INSERT INTO certifications (responder_id, skill_id, certification_number, issuer_label, verified_status, valid_from, valid_until, reviewed_by, reviewed_at)
         VALUES ($1, $2, $3, 'St John Ambulance / Red Cross India', $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
        [respId, sId, `CERT-TN-2026-${respId}-${sId}`, r.certState, validFrom, validUntil, r.certState === 'verified' ? adminUserId : null]
      );
    }

    // Insert Shift:
    // If not offShift, give them a shift spanning now (-4 hours to +8 hours)
    if (!r.offShift) {
      const shiftStart = new Date(now.getTime() - 4 * 3600 * 1000).toISOString();
      const shiftEnd = new Date(now.getTime() + 8 * 3600 * 1000).toISOString();
      await db.query(
        `INSERT INTO shifts (responder_id, start_at, end_at, availability_status)
         VALUES ($1, $2, $3, 'on_shift')`,
        [respId, shiftStart, shiftEnd]
      );
    } else {
      // Off shift: shift ended 2 hours ago
      const shiftStart = new Date(now.getTime() - 10 * 3600 * 1000).toISOString();
      const shiftEnd = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
      await db.query(
        `INSERT INTO shifts (responder_id, start_at, end_at, availability_status)
         VALUES ($1, $2, $3, 'completed')`,
        [respId, shiftStart, shiftEnd]
      );
    }
  }

  // 8. Initial test incidents for demonstration
  if (verbose) console.log('[Seed] Generating sample active and completed incidents...');
  const sampleIncidents = [
    {
      code: 'CIVI-CHN-2026-001',
      zone: 'T. Nagar',
      type: 'Cardiac Arrest / CPR Needed',
      priority: 'critical',
      role: 'bystander',
      lat: 13.0410, lng: 80.2330,
      notes: 'Near Panagal Park bus terminus, adult male collapsed, bystander initiating calls.',
      precision: 'exact_gps',
      affected: 1,
      status: 'pending'
    },
    {
      code: 'CIVI-CHN-2026-002',
      zone: 'Ambattur',
      type: 'Industrial Laceration & Bleeding',
      priority: 'high',
      role: 'bystander',
      lat: 13.1130, lng: 80.1540,
      notes: 'Ambattur Industrial Estate 3rd Main Rd, deep forearm cut, arterial bleeding.',
      precision: 'approximate',
      affected: 1,
      status: 'pending'
    },
    {
      code: 'CIVI-CHN-2026-003',
      zone: 'Anna Nagar',
      type: 'Choking / Airway Obstruction',
      priority: 'critical',
      role: 'bystander',
      lat: 13.0845, lng: 80.2105,
      notes: 'Food court near Anna Nagar Tower Park, elderly person choking.',
      precision: 'exact_gps',
      affected: 1,
      status: 'pending'
    }
  ];

  for (const inc of sampleIncidents) {
    const incRes = await db.query(
      `INSERT INTO incidents (reference_code, zone_id, incident_type, priority_label, reporter_role, lat, lng, location_notes, location_precision, affected_count, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [inc.code, zoneIds[inc.zone], inc.type, inc.priority, inc.role, inc.lat, inc.lng, inc.notes, inc.precision, inc.affected, inc.status]
    );
    const incId = incRes.rows[0].id;

    await db.query(
      `INSERT INTO incident_events (incident_id, event_type, note)
       VALUES ($1, 'REPORTED', 'Incident submitted via CiviCare Emergency Intake')`,
      [incId]
    );
  }

  // 9. Initial Readiness Snapshot capture for each zone
  if (verbose) console.log('[Seed] Capturing initial zone readiness snapshots...');
  const zoneSummary = await db.query(`SELECT * FROM v_zone_readiness_summary`);
  for (const z of zoneSummary.rows) {
    const count = parseInt(z.eligible_free_responders, 10) || 0;
    const score = count >= 3 ? 1.0 : count === 2 ? 0.7 : count === 1 ? 0.35 : 0.0;
    await db.query(
      `INSERT INTO readiness_snapshots (zone_id, eligible_count, coverage_score, policy_version)
       VALUES ($1, $2, $3, 'v1.0')`,
      [z.zone_id, count, score]
    );
  }

  if (verbose) {
    console.log('[Seed] Seeding completed successfully!');
    console.log(`[Seed] Summary:`);
    console.log(`  - Users: ${usersToInsert.length}`);
    console.log(`  - Organisations: ${orgs.length}`);
    console.log(`  - Chennai Zones: ${zones.length}`);
    console.log(`  - Sourced Facilities: ${facilities.length}`);
    console.log(`  - Skills: ${skillsList.length}`);
    console.log(`  - Synthetic Responders: ${respondersData.length}`);
    console.log(`  - Incidents: ${sampleIncidents.length}`);
  }
  return true;
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  runSeed().then(() => process.exit(0)).catch(e => {
    console.error('[Seed Error]:', e);
    process.exit(1);
  });
}
