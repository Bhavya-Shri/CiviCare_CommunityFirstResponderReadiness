# CiviCare — Relational Database Data Dictionary

Comprehensive specification of all relations, attribute types, domains, primary keys, foreign keys, and integrity constraints.

---

## 1. `users`
Identity accounts for administrators, evaluators, and registered volunteers.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unique user identifier. |
| `email` | `VARCHAR(255)` | `UNIQUE NOT NULL` | Login email address. |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | Bcrypt password hash. Plaintext strictly forbidden. |
| `role` | `VARCHAR(50)` | `CHECK IN ('responder', 'admin', 'evaluator')` | Access control role. |
| `account_status` | `VARCHAR(50)` | `DEFAULT 'active' CHECK IN ('pending', 'active', 'suspended', 'deactivated')` | Lifecycle status. |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Account creation timestamp. |

---

## 2. `organisations`
Affiliated voluntary first-aid corps.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unique organization identifier. |
| `name` | `VARCHAR(255)` | `NOT NULL` | Legal entity name (e.g. Red Cross Society). |
| `organisation_type` | `VARCHAR(100)` | `NOT NULL` | Classification (e.g. Humanitarian, Volunteer Corps). |
| `verification_status` | `VARCHAR(50)` | `DEFAULT 'verified'` | Verification standing. |
| `contact_email` | `VARCHAR(255)` | `NULLABLE` | Official point of contact. |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Registration date. |

---

## 3. `zones`
Geographic partitions representing Chennai metropolitan wards/zones.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unique zone identifier. |
| `zone_name` | `VARCHAR(150)` | `UNIQUE NOT NULL` | Name (e.g. T. Nagar, Anna Nagar, Ambattur). |
| `code` | `VARCHAR(50)` | `UNIQUE NOT NULL` | Project zone code (e.g. CHN-TNAGAR). |
| `boundary_geojson` | `JSONB` | `NULLABLE` | Spatial boundary polygons. |
| `center_lat` | `DOUBLE PRECISION` | `CHECK (-90 TO 90)` | Center latitude. |
| `center_lng` | `DOUBLE PRECISION` | `CHECK (-180 TO 180)` | Center longitude. |
| `radius_km` | `DOUBLE PRECISION` | `DEFAULT 3.5 CHECK (> 0)` | Operational zone radius proxy. |
| `population_estimate`| `INTEGER` | `DEFAULT 120000 CHECK (> 0)` | Public census population denominator. |
| `zone_source` | `VARCHAR(255)` | `DEFAULT GCC Open Data` | Provenance data source note. |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Creation date. |

---

## 4. `responders`
Community first responders readiness profile.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unique responder identifier. |
| `user_id` | `INTEGER` | `UNIQUE REFERENCES users(id)` | Associated login credentials. |
| `organisation_id` | `INTEGER` | `REFERENCES organisations(id)` | Optional volunteer affiliation. |
| `base_zone_id` | `INTEGER` | `REFERENCES zones(id) NOT NULL` | Primary coverage zone. |
| `full_name` | `VARCHAR(255)` | `NOT NULL` | Legal responder name. |
| `phone` | `VARCHAR(50)` | `NOT NULL` | Secure dispatch phone. |
| `current_lat` | `DOUBLE PRECISION` | `NULLABLE` | Optional current GPS latitude. |
| `current_lng` | `DOUBLE PRECISION` | `NULLABLE` | Optional current GPS longitude. |
| `responder_status` | `VARCHAR(50)` | `CHECK IN ('pending_approval', 'active', 'suspended', 'inactive')` | Account status. |
| `availability_status`| `VARCHAR(50)`| `CHECK IN ('available', 'unavailable', 'on_break', 'offline')` | Real-time availability flag. |
| `availability_updated_at`| `TIMESTAMPTZ`| `DEFAULT CURRENT_TIMESTAMP` | Freshness timestamp. |

---

## 5. `skills` & `responder_skills`
Normalized catalogue of emergency first responder competencies.
- `skills`: `id`, `skill_code` (e.g. `CPR_AED`, `BLEEDING_CTRL`), `skill_name`, `permitted_scope`, `description`.
- `responder_skills`: Composite PK `(responder_id, skill_id)` linking volunteers to approved competencies.

---

## 6. `certifications`
Verified training credentials.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unique certification identifier. |
| `responder_id` | `INTEGER` | `REFERENCES responders(id)` | Volunteer holding certificate. |
| `skill_id` | `INTEGER` | `REFERENCES skills(id)` | Certified skill. |
| `certification_number` | `VARCHAR(100)` | `NOT NULL` | Official certificate ID. |
| `issuer_label` | `VARCHAR(255)` | `NOT NULL` | Training institute (e.g. St John Ambulance). |
| `verified_status` | `VARCHAR(50)` | `CHECK IN ('pending', 'verified', 'rejected', 'expired')` | Review status. |
| `valid_from` | `DATE` | `NOT NULL` | Start of certification. |
| `valid_until` | `DATE` | `NOT NULL` | Expiration date. |
| `reviewed_by` | `INTEGER` | `REFERENCES users(id)` | Admin reviewer. |
| `reviewed_at` | `TIMESTAMPTZ` | `NULLABLE` | Admin review timestamp. |
| `CONSTRAINT` | `CHECK (valid_from <= valid_until)` | Enforces temporal consistency. |

---

## 7. `shifts`
Time-bounded availability windows.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unique shift identifier. |
| `responder_id` | `INTEGER` | `REFERENCES responders(id)` | Volunteer on duty. |
| `start_at` | `TIMESTAMPTZ` | `NOT NULL` | Shift start. |
| `end_at` | `TIMESTAMPTZ` | `NOT NULL` | Shift conclusion. |
| `availability_status`| `VARCHAR(50)`| `CHECK IN ('scheduled', 'on_shift', 'completed', 'cancelled')` | Shift status. |
| `CONSTRAINT` | `CHECK (start_at < end_at)` | Prohibits inverted time windows. |

---

## 8. `facilities` & `facility_capabilities`
Real sourced Chennai healthcare facilities and documented capabilities.
- `facilities`: `id`, `name`, `facility_type`, `address`, `zone_id`, `lat`, `lng`, `contact_phone`, `source_name`, `source_url`, `source_checked_at`.
- `facility_capabilities`: `id`, `facility_id`, `capability_code`, `capability_name`, `source_note`.

---

## 9. `incidents` & `assignments`
Emergency reports and coordination life-cycles.
- `incidents`: `id`, `reference_code` (`CIVI-CHN-2026-XXXX`), `zone_id`, `incident_type`, `priority_label`, `reporter_role`, `lat`, `lng`, `location_notes`, `location_precision`, `affected_count`, `status`, `reporter_contact`, `created_at`, `updated_at`.
- `assignments`: `id`, `incident_id`, `responder_id`, `policy_used`, `assigned_at`, `accepted_at`, `ended_at`, `status`, `estimated_distance_km`, `estimated_travel_minutes`.

---

## 10. `allocation_decision_logs`
Explainable transparent record of algorithmic decisions.
| Column | Type | Description |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | Unique decision identifier. |
| `incident_id` | `INTEGER REFERENCES incidents(id)` | Target incident. |
| `policy_version` | `VARCHAR(50)` | Policy used (`baseline` or `coverage_aware`). |
| `candidate_summary` | `JSONB` | Full array of candidates evaluated, with rejection reasons. |
| `selected_responder_id` | `INTEGER REFERENCES responders(id)` | Chosen responder. |
| `reason_code` | `VARCHAR(100)` | Standard code (e.g. `COVERAGE_AWARE_OPTIMAL`). |
| `score_details` | `JSONB` | Normalized travel cost, coverage loss score, parameters. |
| `created_at` | `TIMESTAMPTZ` | Timestamp of allocation execution. |
