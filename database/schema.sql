-- =========================================================================
-- CiviCare: Community First Responder Readiness & Coordination System
-- Database: PostgreSQL (Relational DBMS Schema with Normalized Architecture)
-- Location: Chennai, India (Academic Research & Coordination Prototype)
-- =========================================================================

-- Drop existing views and tables if rebuilding
DROP VIEW IF EXISTS v_incident_assignment_overview CASCADE;
DROP VIEW IF EXISTS v_zone_readiness_summary CASCADE;
DROP VIEW IF EXISTS v_active_responder_readiness CASCADE;

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS experiment_results CASCADE;
DROP TABLE IF EXISTS experiment_runs CASCADE;
DROP TABLE IF EXISTS allocation_decision_logs CASCADE;
DROP TABLE IF EXISTS readiness_snapshots CASCADE;
DROP TABLE IF EXISTS assignment_events CASCADE;
DROP TABLE IF EXISTS incident_events CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS facility_capabilities CASCADE;
DROP TABLE IF EXISTS facilities CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS certifications CASCADE;
DROP TABLE IF EXISTS responder_skills CASCADE;
DROP TABLE IF EXISTS skills CASCADE;
DROP TABLE IF EXISTS responders CASCADE;
DROP TABLE IF EXISTS zones CASCADE;
DROP TABLE IF EXISTS organisations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- -------------------------------------------------------------------------
-- 1. Users table (Admin, Responder & Evaluator authentication)
-- -------------------------------------------------------------------------
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('responder', 'admin', 'evaluator')),
    account_status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (account_status IN ('pending', 'active', 'suspended', 'deactivated')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------
-- 2. Organisations (Voluntary groups, Red Cross, St John Ambulance, etc.)
-- -------------------------------------------------------------------------
CREATE TABLE organisations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    organisation_type VARCHAR(100) NOT NULL,
    verification_status VARCHAR(50) DEFAULT 'verified' CHECK (verification_status IN ('pending', 'verified', 'unverified')),
    contact_email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------
-- 3. Zones (Chennai administrative / project-defined zones)
-- -------------------------------------------------------------------------
CREATE TABLE zones (
    id SERIAL PRIMARY KEY,
    zone_name VARCHAR(150) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    boundary_geojson JSONB,
    center_lat DOUBLE PRECISION NOT NULL CHECK (center_lat BETWEEN -90 AND 90),
    center_lng DOUBLE PRECISION NOT NULL CHECK (center_lng BETWEEN -180 AND 180),
    radius_km DOUBLE PRECISION DEFAULT 3.5 CHECK (radius_km > 0),
    population_estimate INTEGER DEFAULT 120000 CHECK (population_estimate > 0),
    zone_source VARCHAR(255) DEFAULT 'Greater Chennai Corporation Open Data / Project Zone',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------
-- 4. Responders Profile
-- -------------------------------------------------------------------------
CREATE TABLE responders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    organisation_id INTEGER REFERENCES organisations(id) ON DELETE SET NULL,
    base_zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    current_lat DOUBLE PRECISION CHECK (current_lat BETWEEN -90 AND 90),
    current_lng DOUBLE PRECISION CHECK (current_lng BETWEEN -180 AND 180),
    responder_status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (responder_status IN ('pending_approval', 'active', 'suspended', 'inactive')),
    availability_status VARCHAR(50) NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'unavailable', 'on_break', 'offline')),
    availability_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------
-- 5. Skills Catalogue
-- -------------------------------------------------------------------------
CREATE TABLE skills (
    id SERIAL PRIMARY KEY,
    skill_code VARCHAR(50) UNIQUE NOT NULL,
    skill_name VARCHAR(150) NOT NULL,
    permitted_scope TEXT NOT NULL,
    description TEXT
);

-- -------------------------------------------------------------------------
-- 6. Responder-Skills Bridge Table (Normalized M:N relation)
-- -------------------------------------------------------------------------
CREATE TABLE responder_skills (
    responder_id INTEGER NOT NULL REFERENCES responders(id) ON DELETE CASCADE,
    skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    acquired_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (responder_id, skill_id)
);

-- -------------------------------------------------------------------------
-- 7. Certifications (Explicit validation, expiration, and audit verification)
-- -------------------------------------------------------------------------
CREATE TABLE certifications (
    id SERIAL PRIMARY KEY,
    responder_id INTEGER NOT NULL REFERENCES responders(id) ON DELETE CASCADE,
    skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    certification_number VARCHAR(100) NOT NULL,
    issuer_label VARCHAR(255) NOT NULL,
    verified_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (verified_status IN ('pending', 'verified', 'rejected', 'expired')),
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_valid_date_range CHECK (valid_from <= valid_until)
);

-- -------------------------------------------------------------------------
-- 8. Shifts (Scheduled and live availability windows)
-- -------------------------------------------------------------------------
CREATE TABLE shifts (
    id SERIAL PRIMARY KEY,
    responder_id INTEGER NOT NULL REFERENCES responders(id) ON DELETE CASCADE,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    availability_status VARCHAR(50) DEFAULT 'on_shift' CHECK (availability_status IN ('scheduled', 'on_shift', 'completed', 'cancelled')),
    last_confirmed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_shift_time_window CHECK (start_at < end_at)
);

-- -------------------------------------------------------------------------
-- 9. Facilities (Real sourced Chennai hospitals / emergency healthcare centers)
-- -------------------------------------------------------------------------
CREATE TABLE facilities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    facility_type VARCHAR(100) NOT NULL DEFAULT 'Government General Hospital',
    address TEXT NOT NULL,
    zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL,
    lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
    contact_phone VARCHAR(50) NOT NULL,
    source_name VARCHAR(255) DEFAULT 'OpenStreetMap / Data.gov.in Chennai Health Catalogue',
    source_url VARCHAR(500),
    source_checked_at DATE DEFAULT CURRENT_DATE,
    emergency_24x7 BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------
-- 10. Facility Capabilities (Documented services without fake live capacity)
-- -------------------------------------------------------------------------
CREATE TABLE facility_capabilities (
    id SERIAL PRIMARY KEY,
    facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    capability_code VARCHAR(100) NOT NULL,
    capability_name VARCHAR(255) NOT NULL,
    source_note TEXT
);

-- -------------------------------------------------------------------------
-- 11. Incidents (Emergency reports with guest / bystander entry path)
-- -------------------------------------------------------------------------
CREATE TABLE incidents (
    id SERIAL PRIMARY KEY,
    reference_code VARCHAR(50) UNIQUE NOT NULL,
    zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL,
    incident_type VARCHAR(100) NOT NULL,
    priority_label VARCHAR(50) NOT NULL DEFAULT 'standard' CHECK (priority_label IN ('low', 'standard', 'high', 'critical')),
    reporter_role VARCHAR(50) NOT NULL CHECK (reporter_role IN ('self', 'bystander')),
    lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
    location_notes TEXT,
    location_precision VARCHAR(50) DEFAULT 'approximate' CHECK (location_precision IN ('exact_gps', 'approximate', 'zone_center')),
    affected_count INTEGER DEFAULT 1 CHECK (affected_count >= 1),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'allocating', 'assigned', 'en_route', 'arrived', 'completed', 'cancelled', 'no_responder_found')),
    access_notes TEXT,
    reporter_contact VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------
-- 12. Assignments (Incident-to-responder allocation lifecycle)
-- -------------------------------------------------------------------------
CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    responder_id INTEGER NOT NULL REFERENCES responders(id) ON DELETE RESTRICT,
    policy_used VARCHAR(50) NOT NULL CHECK (policy_used IN ('nearest_eligible_baseline', 'coverage_aware_allocation')),
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'declined', 'en_route', 'arrived', 'completed', 'cancelled', 'expired')),
    outcome VARCHAR(100),
    estimated_distance_km DOUBLE PRECISION CHECK (estimated_distance_km >= 0),
    estimated_travel_minutes DOUBLE PRECISION CHECK (estimated_travel_minutes >= 0)
);

-- -------------------------------------------------------------------------
-- 13. Incident Events (Audit history of incident lifecycle)
-- -------------------------------------------------------------------------
CREATE TABLE incident_events (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note TEXT,
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------
-- 14. Assignment Events (Audit history of assignment changes)
-- -------------------------------------------------------------------------
CREATE TABLE assignment_events (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------
-- 15. Readiness Snapshots (Zone-level coverage metrics over time)
-- -------------------------------------------------------------------------
CREATE TABLE readiness_snapshots (
    id SERIAL PRIMARY KEY,
    zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    captured_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    eligible_count INTEGER NOT NULL CHECK (eligible_count >= 0),
    coverage_score DOUBLE PRECISION NOT NULL,
    policy_version VARCHAR(50) DEFAULT 'v1.0'
);

-- -------------------------------------------------------------------------
-- 16. Allocation Decision Logs (Transparent explainable AI/heuristic record)
-- -------------------------------------------------------------------------
CREATE TABLE allocation_decision_logs (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    policy_version VARCHAR(50) NOT NULL,
    candidate_summary JSONB NOT NULL,
    selected_responder_id INTEGER REFERENCES responders(id) ON DELETE SET NULL,
    reason_code VARCHAR(100) NOT NULL,
    score_details JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------
-- 17. Experiment Runs (Repeatable simulation evaluations)
-- -------------------------------------------------------------------------
CREATE TABLE experiment_runs (
    id SERIAL PRIMARY KEY,
    scenario_name VARCHAR(150) NOT NULL,
    seed INTEGER NOT NULL,
    policy_version VARCHAR(50) NOT NULL,
    parameters JSONB NOT NULL,
    total_incidents INTEGER DEFAULT 0,
    assigned_count INTEGER DEFAULT 0,
    avg_travel_km DOUBLE PRECISION DEFAULT 0,
    residual_coverage_avg DOUBLE PRECISION DEFAULT 0,
    underserved_zones_count INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ
);

-- -------------------------------------------------------------------------
-- 18. Experiment Results (Detailed breakdown per zone / metric)
-- -------------------------------------------------------------------------
CREATE TABLE experiment_results (
    id SERIAL PRIMARY KEY,
    run_id INTEGER NOT NULL REFERENCES experiment_runs(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DOUBLE PRECISION NOT NULL,
    zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL
);

-- -------------------------------------------------------------------------
-- 19. Audit Logs (Privileged admin actions and security records)
-- -------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER,
    metadata JSONB,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- INDEXES FOR PERFORMANCE & RELATIONAL INTEGRITY
-- =========================================================================
CREATE INDEX idx_responders_status_avail ON responders(responder_status, availability_status);
CREATE INDEX idx_responders_base_zone ON responders(base_zone_id);
CREATE INDEX idx_certifications_status_valid ON certifications(verified_status, valid_until);
CREATE INDEX idx_shifts_time_window ON shifts(start_at, end_at, availability_status);
CREATE INDEX idx_incidents_status_time ON incidents(status, created_at);
CREATE INDEX idx_assignments_incident_resp ON assignments(incident_id, responder_id);
CREATE INDEX idx_assignments_active ON assignments(responder_id, status) WHERE status IN ('offered', 'accepted', 'en_route', 'arrived');
CREATE INDEX idx_facilities_zone ON facilities(zone_id);
CREATE INDEX idx_allocation_logs_incident ON allocation_decision_logs(incident_id);

-- =========================================================================
-- DATABASE VIEWS
-- =========================================================================

-- View 1: Real-time eligible active responders currently on shift with valid verified certifications
CREATE VIEW v_active_responder_readiness AS
SELECT 
    r.id AS responder_id,
    r.full_name,
    r.phone,
    r.base_zone_id,
    z.zone_name,
    z.code AS zone_code,
    r.current_lat,
    r.current_lng,
    r.responder_status,
    r.availability_status,
    r.availability_updated_at,
    o.name AS organisation_name,
    sh.id AS active_shift_id,
    sh.start_at AS shift_start,
    sh.end_at AS shift_end,
    -- Count of verified valid certifications
    (
        SELECT COUNT(DISTINCT c.skill_id)
        FROM certifications c
        WHERE c.responder_id = r.id
          AND c.verified_status = 'verified'
          AND c.valid_from <= CURRENT_DATE
          AND c.valid_until >= CURRENT_DATE
    ) AS verified_skills_count,
    -- Check if responder has any active conflicting assignment
    (
        SELECT COUNT(*)
        FROM assignments a
        WHERE a.responder_id = r.id
          AND a.status IN ('offered', 'accepted', 'en_route', 'arrived')
    ) AS active_assignments_count
FROM responders r
JOIN zones z ON r.base_zone_id = z.id
LEFT JOIN organisations o ON r.organisation_id = o.id
LEFT JOIN shifts sh ON sh.responder_id = r.id 
    AND sh.start_at <= CURRENT_TIMESTAMP 
    AND sh.end_at >= CURRENT_TIMESTAMP
    AND sh.availability_status = 'on_shift'
WHERE r.responder_status = 'active'
  AND r.availability_status = 'available';

-- View 2: Zone-by-Zone Readiness Summary with Under-served Classification
CREATE VIEW v_zone_readiness_summary AS
SELECT 
    z.id AS zone_id,
    z.zone_name,
    z.code AS zone_code,
    z.center_lat,
    z.center_lng,
    z.population_estimate,
    COUNT(var.responder_id) FILTER (WHERE var.active_assignments_count = 0 AND var.active_shift_id IS NOT NULL AND var.verified_skills_count > 0) AS eligible_free_responders,
    COUNT(r.id) AS total_registered_responders,
    CASE 
        WHEN COUNT(var.responder_id) FILTER (WHERE var.active_assignments_count = 0 AND var.active_shift_id IS NOT NULL AND var.verified_skills_count > 0) = 0 THEN 'CRITICAL_ZERO'
        WHEN COUNT(var.responder_id) FILTER (WHERE var.active_assignments_count = 0 AND var.active_shift_id IS NOT NULL AND var.verified_skills_count > 0) = 1 THEN 'UNDERSERVED_SINGLE'
        WHEN COUNT(var.responder_id) FILTER (WHERE var.active_assignments_count = 0 AND var.active_shift_id IS NOT NULL AND var.verified_skills_count > 0) <= 3 THEN 'MODERATE'
        ELSE 'ADEQUATE'
    END AS readiness_status
FROM zones z
LEFT JOIN responders r ON r.base_zone_id = z.id
LEFT JOIN v_active_responder_readiness var ON var.responder_id = r.id
GROUP BY z.id, z.zone_name, z.code, z.center_lat, z.center_lng, z.population_estimate;

-- View 3: Complete Incident Assignment Overview with Policy and Timestamps
CREATE VIEW v_incident_assignment_overview AS
SELECT 
    i.id AS incident_id,
    i.reference_code,
    i.incident_type,
    i.priority_label,
    i.reporter_role,
    i.status AS incident_status,
    i.created_at AS incident_reported_at,
    z.zone_name AS incident_zone,
    a.id AS assignment_id,
    a.policy_used,
    a.status AS assignment_status,
    a.assigned_at,
    a.accepted_at,
    a.ended_at,
    a.estimated_distance_km,
    a.estimated_travel_minutes,
    r.id AS responder_id,
    r.full_name AS responder_name,
    rz.zone_name AS responder_base_zone
FROM incidents i
LEFT JOIN zones z ON i.zone_id = z.id
LEFT JOIN assignments a ON a.incident_id = i.id
LEFT JOIN responders r ON a.responder_id = r.id
LEFT JOIN zones rz ON r.base_zone_id = rz.id;
