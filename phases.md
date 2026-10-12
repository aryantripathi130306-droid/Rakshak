# RAKSHAK v3.0 — IMPLEMENTATION PHASES & ROADMAP

> For the comprehensive technical and operational breakdown across all milestones, see [CONSOLIDATED_PHASES_REPORT.md](file:///e:/Rakshak/CONSOLIDATED_PHASES_REPORT.md).

---

## Phase 1–5: Core Platform Foundation & Ingestion
- [x] **Phase 1: Setup & Data Foundation** — Next.js setup, Prisma models (`Case`, `Evidence`, `ExtractedFact`, `TimelineEvent`, `CaseEntity`), client-side Web Crypto SHA-256.
- [x] **Phase 2: Evidence Dropzone & Ingestion Pipeline** — Drag-and-drop vault UI, dual-hash validation, regex extraction, cold immutable `.bin` storage.
- [x] **Phase 3: Timeline & Source-Traceability UI** — Interactive chronological timeline, Modus Operandi (MO) 4-stage progression tags, source document highlighting.
- [x] **Phase 4: Cross-Case Entity Graph** — D3 relationship network graph, real-time node resolution, crimson syndicate cross-case badges.
- [x] **Phase 5: Reports & Dossiers** — Single-click dossier export, chain of custody manifest, BSA § 63 digital compliance certificates.

---

## Phase 6–10: Syndicate Intelligence & Release Validation
- [x] **Phase 6: Syndicate Intelligence & Cross-Case Analysis** — Centralized graph resolver (`services/graphService.ts`), `/api/graph`, entity clustering.
- [x] **Phase 7: Legal Matrix & BSA § 63 Engine** — Legal provisions registry (`/api/legal/provisions`), BSA 2023 § 63 compliance generator.
- [x] **Phase 8: Reports, Analytics & RBAC Permissions** — Officer authentication, role hierarchy (`ADMIN`, `INVESTIGATOR`, `ANALYST`, `VIEWER`), audit trail exports.
- [x] **Phase 9: E2E OCR Extraction & Provenance Anchoring** — Dual OCR (`pdf-parse` v2 + `Tesseract.js` v5 offline via `eng.traineddata`), deterministic fact extraction.
- [x] **Phase 10: Platform Release Validation** — End-to-end integration stress tests, security boundary verification, latency benchmarks (<350ms SLA).

---

## Phase 11–15: Environment Isolation & Controlled Pilot
- [x] **Phase 11: Staging Smoke & Environment Isolation** — Non-destructive smoke verification, fail-closed safety assertions, staging sandboxes.
- [x] **Phase 12: Controlled Pilot Acceptance** — 15-scenario pilot acceptance matrix, Gate C readiness criteria, sandbox restore parity.
- [x] **Phase 13: Pilot Operations & Governance** — 10 SOP definitions, 10 training modules, feedback triage API (`/api/feedback`).
- [x] **Phase 14: Security Assessment & Infrastructure Gates** — 12-point invariant security audit, privilege escalation defenses, cold storage 404 protection.
- [x] **Phase 15: Controlled Synthetic Pilot** — Scenarios A–E synthetic validation, 100% precision/recall on ground-truth entities, negative control tests.

---

## Phase 16–20: Auditing, Storage Immutability & Migration
- [x] **Phase 16 & 16.5: Independent Audit Reconciliation & Full Application Inventory** — Mathematical assertion reconciliation (136 baseline assertions), bit-level check of 158 raw binaries.
- [x] **Phase 17: Evidence Store Integrity & WORM Immutability** — SHA-256 content addressing, zero-mutation assertions, anti-tampering guards.
- [x] **Phase 18: PostgreSQL Migration Baseline & Recovery** — Automated SQLite-to-PostgreSQL ETL engine (`scripts/migrate_sqlite_to_postgres.mjs`), disaster recovery rehearsal.
- [x] **Phase 19: Deployment Validation & Security Advisory** — Docker containerization, Nginx reverse proxy configuration, strict dependency audit.
- [x] **Phase 20: Product Acceptance & Enterprise Pilot Sign-Off** — Product acceptance criteria validation, operational readiness checklist.

---

## Phase 21–25: Strict Authentication & PostgreSQL Row-Level Security (RLS)
- [x] **Phase 21: Strict Authentication & Session Governance** — Strict auth enforcement (`STRICT_AUTH=true`), HttpOnly secure session cookies.
- [x] **Phase 22: Clean Deployment & Tenancy Baseline** — Tenancy boundaries baseline, department-level isolation architecture.
- [x] **Phase 23: PostgreSQL Row-Level Security (RLS)** — PostgreSQL 16 RLS policies on `cases`, `evidences`, `timeline_events`, `case_entities`.
- [x] **Phase 24: PostgreSQL Host Security & Threat Model** — Non-superuser app role enforcement, `pg_hba.conf` security, SQL injection boundaries.
- [x] **Phase 25: PostgreSQL Live Runtime Validation** — Active PostgreSQL connection verification, RLS bypass defense under concurrent sessions.

---

## Phase 26–29: Multi-Department Boundaries & Production Cutover
- [x] **Phase 26: Full Multi-Department RLS Policies** — Granular department-level RLS policies, cross-department grant/revoke workflows.
- [x] **Phase 27: Application-Layer Boundary Verification** — Seamless application integration with PostgreSQL RLS and fallback SQLite mode.
- [x] **Phase 28: Production Readiness & Release Gate Audit** — Automated 12-gate release engine, secrets scan, offline backup/restore verification.
- [x] **Phase 29: Cutover Runbook, Deployment Package & Preflight Verification** — Production cutover runbook, fail-closed environment validation, deployment preflight suite (`scripts/verify_phase29_preflight.mjs`).

---

## Phase 30: Unified Neumorphic UI & Legacy Feature Consolidation
- [x] **Phase 30: Canonical 10-Item Navigation & Cross-Department Onboarding** — Standardized canonical 10-item Neumorphic navigation across all 11 primary pages, eliminated layout shifts, ported institutional department onboarding modal into `cross-dept.html`, established zero-delay client-side forwarders for legacy URLs, and verified 100% frontend integrity.

