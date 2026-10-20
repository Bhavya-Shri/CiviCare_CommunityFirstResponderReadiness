# CiviCare — Community First Responder Readiness & Coordination System

> **Academic DBMS Project Blueprint • Chennai-Focused Prototype**  
> *Formerly conceptualized under the working title RESPOND; now officially implemented as **CiviCare**.*  
> Version 1.0 | October 2026

---

## 1. Project Overview & Research Motivation

In sudden medical emergencies (such as out-of-hospital cardiac arrest or severe hemorrhage), professional ambulance response may take critical minutes to navigate dense urban traffic. Community first responders—civilians with verified first-aid and CPR training—can bridge this gap.

However, coordinating a volunteer network requires more than finding the nearest person on a map. A responder may have an expired certification, be outside their available shift window, lack the skill needed for that incident class, or be the **sole volunteer protecting a vulnerable, low-density zone**.

### Core Problem:
How can a city-level system use a structured relational database and explainable allocation rules to identify eligible community responders without stripping scarce residual coverage from surrounding zones?

### Distinguishing Contribution:
**Coverage-Aware Responder Allocation**: Under selected boundary conditions, an allocation strategy that considers residual zone coverage preserves better area-level readiness than a naive nearest-eligible rule, while respecting hard safety constraints (valid certification, active shift, travel distance bound).

---

## 2. Safety Boundaries & Non-Goals

1. **Prominent 112 Emergency Priority:** CiviCare is a research and coordination prototype, **not** an official emergency dispatch replacement. Official Emergency Services (112 / 108) take absolute priority.
2. **No Clinical Diagnosis:** The system does not triage or diagnose medical conditions.
3. **No Fabricated Live Capacity:** Sourced hospital records document verified capabilities and casualty phone lines; they do not invent real-time bed or specialist availability.
4. **Data Minimization:** Guest incident reporters are not forced to register accounts or provide medical history.

---

## 3. Technology Stack

- **Relational Database:** PostgreSQL (supports standard remote/local PostgreSQL server via `DATABASE_URL` as well as zero-setup embedded PostgreSQL engine with persistence in `./database/data_pglite`).
- **Backend API:** Node.js, Express, Zod validation, JWT authentication, bcrypt password hashing.
- **Frontend Client:** React 18, Vite, Tailwind CSS, Lucide Icons, Leaflet & React-Leaflet interactive mapping.
- **Evaluation Simulator:** Repeatable scenario benchmarks with deterministic random seeds and metric logging.

---

## 4. Database Architecture (19 Tables & 3 Views)

### Core Normalized Tables:
- `users`: Identity accounts with role-based access (`responder`, `admin`, `evaluator`).
- `organisations`: Sourced volunteer bodies (Red Cross, St John Ambulance).
- `zones`: 15 Chennai metropolitan zones with spatial coordinates and population estimates.
- `responders`: Verified volunteer profiles and live availability status.
- `skills`: Controlled vocabulary of emergency skills (`CPR_AED`, `BLEEDING_CTRL`, etc.).
- `responder_skills`: Normalized M:N bridge relation.
- `certifications`: Explicit credential validation dates and admin review states.
- `shifts`: Temporal duty windows with CHECK constraint (`start_at < end_at`).
- `facilities`: Sourced Chennai hospitals (RGGGH, Stanley, Kilpauk, Apollo, Fortis, MIOT, etc.).
- `facility_capabilities`: Documented emergency service capabilities.
- `incidents`: Emergency reports with guest and bystander entry paths.
- `assignments`: Concurrency-safe incident-to-responder allocations.
- `incident_events` & `assignment_events`: Append-only audit histories.
- `readiness_snapshots`: Zone readiness history over time.
- `allocation_decision_logs`: Explainable decision logs with candidate evaluation trees.
- `experiment_runs` & `experiment_results`: Repeatable benchmark metrics.
- `audit_logs`: Immutable security records.

### Analytical SQL Views:
- `v_active_responder_readiness`: Eligible responders on active shift with verified certifications.
- `v_zone_readiness_summary`: Zone-level eligible count and readiness classification (`CRITICAL_ZERO`, `UNDERSERVED_SINGLE`, `MODERATE`, `ADEQUATE`).
- `v_incident_assignment_overview`: Multi-table relational overview of incidents and responders.

---

## 5. Quick Start Instructions

### Prerequisites:
- Node.js (v18+) and npm.

### Installation & Setup:

```bash
# 1. Reset and populate database with Chennai zones, real hospitals, and test responders
npm run seed

# 2. Run automated relational integrity and concurrency test suite
npm run test:constraints

# 3. Start Backend Server (runs on http://localhost:5000)
npm run server

# 4. In a separate terminal, start Frontend Client (runs on http://localhost:5175)
npm run client
```

### Pre-Configured Demo Accounts:

- **Administrator:** `admin@civicare.in` / `admin123`
- **Evaluator:** `evaluator@civicare.in` / `eval123`
- **Volunteer (Dense Zone):** `dr.arun@civicare.in` / `resp123`
- **Volunteer (Sparse Zone):** `suresh.m@civicare.in` / `resp123`

---

## 6. Project Layout

```
dbms_project_civicare/
├── client/              # React + Vite + Tailwind CSS + Leaflet Frontend
│   ├── src/
│   │   ├── pages/       # ReportEmergency, FacilityDirectory, ReadinessDashboard,
│   │   │                # ExperimentLab, DatabaseInspector, ResponderPortal, AdminCenter
│   │   ├── components/  # Navbar, Footer
│   │   ├── api.js       # Centralized REST API client
│   │   └── App.jsx      # Navigation router
├── server/              # Express REST API Server
│   ├── src/
│   │   ├── routes/      # auth, incidents, facilities, responders, admin, dashboard, experiments, db-demo
│   │   ├── allocation/  # Baseline & Coverage-Aware Allocation Engine
│   │   ├── scripts/     # seed.js, test-constraints.js
│   │   ├── db.js        # PostgreSQL connector (Dual Native + Embedded)
│   │   └── index.js     # Server entrypoint
├── database/            # Relational DBMS Artifacts
│   ├── schema.sql       # PostgreSQL DDL, constraints, indexes, views
│   └── data_pglite/     # Embedded PostgreSQL data directory
├── simulator/           # Repeatable Scenario Simulator & Benchmark Runner
│   └── runner.js        # Repeatable scenario benchmarks
├── docs/                # Comprehensive Documentation
│   ├── ERD.md           # Entity-Relationship Diagram (Mermaid)
│   ├── DATA_DICTIONARY.md # Column specifications & domain constraints
│   └── EVALUATION_GUIDE.md # 9-step viva demonstration walkthrough
└── package.json         # Workspace orchestration scripts
```

---

## 7. License & Attribution

- Public facility and geographic data: [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL) and Chennai Public Health Open Data Catalogue.
- Emergency guidance references: Official WHO Community First Responder Guidelines & St John Ambulance India standards.
- Designed and built as an Academic DBMS Research Prototype.
