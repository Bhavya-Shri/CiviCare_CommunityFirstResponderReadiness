# CiviCare — Evaluation, Demonstration & Viva Guide

This guide provides step-by-step instructions for professors, evaluators, and examiners to test and verify all aspects of the **CiviCare** database design, allocation algorithms, constraints, and web application.

---

## 1. Quick Launch

From the project root directory:

```bash
# 1. Reset and seed database with clean deterministic test data
npm run seed

# 2. Run automated relational constraints and concurrency test suite
npm run test:constraints

# 3. Start Backend API (Port 5000)
npm run server

# 4. In a second terminal, start React Web Interface (Port 5173 / 5175)
npm run client
```

Open your browser to: **http://localhost:5175/** (or port shown by Vite).

---

## 2. Pre-Configured Demo Accounts

| Role | Email | Password | What to Inspect |
|---|---|---|---|
| **Administrator** | `admin@civicare.in` | `admin123` | Certification review queue, audit logs, decision logs |
| **Evaluator** | `evaluator@civicare.in` | `eval123` | Simulation runs, metrics comparison |
| **Volunteer (Dense Zone)** | `dr.arun@civicare.in` | `resp123` | T. Nagar (3 responders). Active shift, CPR certified. |
| **Volunteer (Dense Zone)** | `priya.k@civicare.in` | `resp123` | T. Nagar. Choking relief certified. |
| **Volunteer (Sparse Zone)** | `suresh.m@civicare.in` | `resp123` | Ambattur (Sole responder!). Tests coverage preservation. |

---

## 3. Recommended 9-Step Viva Demonstration Sequence

### Step 1: Explain the Core Problem
- Open the **Zone Readiness** tab.
- Point out that **Ambattur** has only 1 eligible responder (`UNDERSERVED_SINGLE`), while **T. Nagar** has 3 (`ADEQUATE`).
- Explain that a pure "nearest-eligible" rule can pull the only responder out of Ambattur to a boundary incident, leaving an entire industrial satellite zone with zero responders.

### Step 2: Show PostgreSQL Relational Design & Constraints
- Open the **DBMS Inspector** tab.
- Show live table counts across all 19 normalized tables.
- Run the **EXPLAIN Execution Plan Inspector** on the active responders query to demonstrate index scan efficiency.
- Review Query 1 and Query 2 showing multi-table SQL joins and group-by calculations.

### Step 3: Test Guest Incident Intake & 112 Priority
- Open the **Report Emergency** tab.
- Demonstrate that reporting works as either an affected person ("I need help") or bystander without requiring an account.
- Point out the prominent red **CALL 112** action, emphasizing the prototype's safety boundaries.
- Submit a test incident in T. Nagar; observe the generated reference code (e.g. `CIVI-CHN-2026-XXXX`).

### Step 4: Demonstrate Expired Credential Exclusion
- In **Algorithm Lab**, select scenario: **Expired Credential Enforcement Test**.
- Run the comparison.
- Notice candidate `Kavitha Srinivasan` in Anna Nagar: although she is geographically closest (0.1 km away), she is strictly excluded with reason `CERTIFICATION_EXPIRED`.
- Verify that hard safety rules are never bypassed.

### Step 5: Demonstrate Sparse Zone Protection (Baseline vs. Coverage-Aware)
- In **Algorithm Lab**, select scenario: **Sparse Zone Coverage Depletion Test**.
- Run the side-by-side comparison.
- **Baseline Policy**: picks Suresh Mani because he is marginally closer, reducing Ambattur's residual coverage to **0** (desertification).
- **Coverage-Aware Policy**: recognizes that Ambattur is a single-responder zone, applies the coverage-loss penalty, and selects an alternate eligible candidate from an adequately covered neighbouring zone within the acceptable distance bound.

### Step 6: Concurrency & Race Condition Prevention
- In the terminal, run: `npm run test:constraints`.
- Observe **Test Suite 5**: two simulated incidents occur simultaneously competing for the same responder.
- The PostgreSQL transaction lock prevents conflicting active assignments, guaranteeing that each responder has strictly $\le 1$ active assignment.

### Step 7: Sourced Chennai Hospital Directory
- Open the **Chennai Hospitals** tab.
- Show the 15 real public hospitals (RGGGH, Stanley, Kilpauk, Apollo, Fortis Malar, MIOT, SRMC, etc.) on the interactive Leaflet map.
- Filter by capability (e.g. `Burns ICU` or `Trauma Level 1`).
- Point out the data provenance note: no fabricated live bed counts.

### Step 8: Volunteer Portal Workflow
- Open the **Responder Portal** tab.
- Click quick demo login as `dr.arun@civicare.in`.
- Toggle availability (`Available` $\rightarrow$ `On Break` $\rightarrow$ `Available`); verify timestamp update.
- Accept or progress a simulated incident offer through `En Route` $\rightarrow$ `Arrived` $\rightarrow$ `Completed`.

### Step 9: Administrator Verification Queue & Audit Trail
- Open the **Admin & Verification** tab.
- Inspect the pending verification queue for new credentials.
- Click **Approve (Verified)** with review notes; observe immediate write to `audit_logs` table.
- Inspect the **Allocation Decision Logs** to view the candidate evaluation tree.
