# RAKSHAK v3.0 — PHASE 45
## Comprehensive Application Workflow Inventory & Route-to-Feature Map

**Phase Target:** Phase 45 — System Integration Acceptance & End-to-End Workflow Verification  
**Database Target:** `rakshak_phase45_test` (PostgreSQL 17.6 on `127.0.0.1:5432`)  
**Server Target:** Next.js 16.0.7 / Node.js v24.15.0 on `http://127.0.0.1:3005`  
**Evaluation Mode:** Synthetic Data Acceptance Testing Only (Non-Production, Isolated Staging)  

---

### 1. Executive Summary & Architecture Overview

The Rakshak investigative analysis system was systematically surveyed and validated across all active application entry points. This document inventories every real route, backend controller, database persistence model, authorization enforcement layer, and frontend client page.

The application architecture couples a Next.js full-stack application with PostgreSQL Row-Level Security (RLS) enforcement. Dual-client routing is managed via [lib/prisma.ts](file:///e:/Rakshak/lib/prisma.ts), dynamically dispatching between PostgreSQL (`@prisma/client-pg` with pg-adapter pooling) and SQLite (`@prisma/client` for legacy standalone dev tools).

```
                      ┌───────────────────────────────────────────────┐
                      │             Frontend Client Pages             │
                      │  (login.html, cases.html, evidence-viewer.html│
                      │   reports.html, graph.html, syndicate.html)   │
                      └──────────────────────┬────────────────────────┘
                                             │ Bearer JWT / HttpOnly Cookie
                                             ▼
                      ┌───────────────────────────────────────────────┐
                      │          Next.js Route Handlers (API)         │
                      │   /api/auth, /api/cases, /api/evidence, etc.  │
                      └──────────────┬─────────────────┬──────────────┘
                                     │                 │
            Session Auth / RBAC      │                 │ Storage Path Adapter
         [services/authService.ts]   │                 │ [services/storageAdapter.ts]
                                     ▼                 ▼
             ┌───────────────────────────────┐  ┌─────────────────────┐
             │       Application Core        │  │ Cold Evidence Store │
             │  • lib/accessControl.ts       │  │ uploads/raw/ (Prod) │
             │  • lib/caseLifecycle.ts       │  │ uploads/synth/ (Test│
             │  • lib/custodyChain.ts        │  └─────────────────────┘
             │  • lib/entityResolution.ts    │
             │  • lib/dossierReview.ts       │
             └───────────────┬───────────────┘
                             │
                             ▼
             ┌───────────────────────────────┐
             │  PostgreSQL Database (Prisma) │
             │  • 31 Application Tables      │
             │  • 20 Row-Level Security (RLS)│
             │  • 20 FORCE RLS Constraints   │
             │  • 21 Security Policies       │
             └───────────────────────────────┘
```

---

### 2. Route-to-Feature & Persistence Inventory

| Feature Domain | Method & Endpoint | Controller / Service | Primary Database Entities | Authorization & RLS Controls |
|---|---|---|---|---|
| **Authentication** | `POST /api/auth/login` | [app/api/auth/login/route.ts](file:///e:/Rakshak/app/api/auth/login/route.ts) | `Officer`, `OfficerSession`, `AuditLog` | bcrypt password verification; HttpOnly secure session cookie; rejected on `SUSPENDED` status. |
| **Authentication** | `GET /api/auth/me` | [app/api/auth/me/route.ts](file:///e:/Rakshak/app/api/auth/me/route.ts) | `Officer`, `OfficerSession` | Bearer token or cookie session check; active session validity verification. |
| **Authentication** | `POST /api/auth/logout` | [app/api/auth/logout/route.ts](file:///e:/Rakshak/app/api/auth/logout/route.ts) | `OfficerSession`, `AuditLog` | Session revocation in database (`revoked = true`); cookie clearance. |
| **Case Lifecycle** | `POST /api/cases` | [app/api/cases/route.ts](file:///e:/Rakshak/app/api/cases/route.ts) | `Case`, `CaseAssignmentHistory`, `AuditLog` | Role check `case:create`; sets initial status to `OPEN`; department binding. |
| **Case Lifecycle** | `GET /api/cases` | [app/api/cases/route.ts](file:///e:/Rakshak/app/api/cases/route.ts) | `Case` | Department boundary filtering (`departmentId` match or cross-department grant). |
| **Case Lifecycle** | `GET /api/cases/[id]` | [app/api/cases/[caseId]/route.ts](file:///e:/Rakshak/app/api/cases/%5BcaseId%5D/route.ts) | `Case`, `Evidence`, `TimelineEvent`, `CaseEntity` | Granular `canAccessCase` evaluation (`CASE_READ` / `METADATA_READ`). |
| **Case Assignment** | `POST /api/cases/[id]/assignment` | [app/api/cases/[caseId]/assignment/route.ts](file:///e:/Rakshak/app/api/cases/%5BcaseId%5D/assignment/route.ts) | `Case`, `CaseAssignmentHistory`, `AuditLog` | Role `case:assign`; records historical timeline; closes previous assignment. |
| **Case Transitions** | `POST /api/cases/[id]/transition` | [app/api/cases/[caseId]/transition/route.ts](file:///e:/Rakshak/app/api/cases/%5BcaseId%5D/transition/route.ts) | `Case`, `SupervisorApproval`, `AuditLog` | State machine enforcement ([lib/caseLifecycle.ts](file:///e:/Rakshak/lib/caseLifecycle.ts)); chargesheet requires supervisor sign-off. |
| **Supervisor Sign-off** | `POST /api/cases/[id]/approval` | [app/api/cases/[caseId]/approval/route.ts](file:///e:/Rakshak/app/api/cases/%5BcaseId%5D/approval/route.ts) | `SupervisorApproval`, `Case`, `AuditLog` | `SUPERVISOR` role gate; cryptographic approval record; state promotion. |
| **Evidence Intake** | `POST /api/evidence/upload` | [app/api/evidence/upload/route.ts](file:///e:/Rakshak/app/api/evidence/upload/route.ts) | `Evidence`, `CustodyEvent`, `AuditLog` | Client SHA-256 pre-hash verification; cold storage write; genesis custody event creation. |
| **Evidence Custody** | `POST /api/evidence/[id]/custody` | [app/api/evidence/[id]/custody/route.ts](file:///e:/Rakshak/app/api/evidence/%5Bid%5D/custody/route.ts) | `CustodyEvent`, `AuditLog` | Sequential `prevEventHash` chaining; unique index constraint on `(evidenceId, sequenceNumber)`. |
| **Evidence Verify** | `POST /api/evidence/[id]/verify` | [app/api/evidence/[id]/verify/route.ts](file:///e:/Rakshak/app/api/evidence/%5Bid%5D/verify/route.ts) | `CustodyEvent`, `Evidence`, `AuditLog` | Cryptographic verification of full hash chain; disk payload re-hashing against database digest. |
| **Evidence Text** | `GET /api/evidence/[id]/text` | [app/api/evidence/[id]/text/route.ts](file:///e:/Rakshak/app/api/evidence/%5Bid%5D/text/route.ts) | `Evidence`, Cold File System | Access check; reads raw bytes from cold store (`EVIDENCE_STORAGE_PATH`); returns utf8 text. |
| **Fact Review** | `POST /api/facts/[id]/review` | [app/api/facts/[id]/review/route.ts](file:///e:/Rakshak/app/api/facts/%5Bid%5D/review/route.ts) | `ExtractedFact`, `FactReviewHistory`, `AuditLog` | Decisions: `ACCEPT`, `REJECT`, `CORRECT`; preserves full historical provenance and previous values. |
| **Entity Resolve** | `POST /api/entities/resolve` | [app/api/entities/resolve/route.ts](file:///e:/Rakshak/app/api/entities/resolve/route.ts) | `CaseEntity`, `EntityLink`, `AuditLog` | Normalizes identifiers; matches cross-case entities; generates `CANDIDATE` links with rule explanations. |
| **Entity Matches** | `GET /api/entities/matches` | [app/api/entities/matches/route.ts](file:///e:/Rakshak/app/api/entities/matches/route.ts) | `EntityLink`, `Case` | Bounded pagination; tenant security filter (redacts unauthorized foreign case identifiers). |
| **Entity Review** | `POST /api/entities/links/[id]/review` | [app/api/entities/links/[id]/review/route.ts](file:///e:/Rakshak/app/api/entities/links/%5Bid%5D/review/route.ts) | `EntityLink`, `EntityLinkReview`, `AuditLog` | Transition: `CANDIDATE -> CONFIRMED / REJECTED`; captures mandatory justification; version lock. |
| **Cross-Case Graph** | `GET /api/graph` | [app/api/graph/route.ts](file:///e:/Rakshak/app/api/graph/route.ts) | `Case`, `EntityLink`, `CaseEntity` | Bounded graph traversal (depth <= 3); extracts nodes and edges scoped to accessible cases. |
| **Dossier Create** | `POST /api/cases/[id]/dossier/generate` | [app/api/cases/[caseId]/dossier/generate/route.ts](file:///e:/Rakshak/app/api/cases/%5BcaseId%5D/dossier/generate/route.ts) | `InvestigativeDossier`, `Case`, `AuditLog` | Compiles case claims, verified facts, and custody records; computes SHA-256 content digest. |
| **Dossier Review** | `POST /api/dossiers/[id]/review` | [app/api/dossiers/[id]/review/route.ts](file:///e:/Rakshak/app/api/dossiers/%5Bid%5D/review/route.ts) | `InvestigativeDossier`, `AuditLog` | Finite state machine (`GENERATED -> UNDER_REVIEW -> APPROVED`); requires supervisor role for approval. |
| **Dossier Export** | `GET /api/dossiers/[id]/export` | [app/api/dossiers/[id]/export/route.ts](file:///e:/Rakshak/app/api/dossiers/%5Bid%5D/export/route.ts) | `InvestigativeDossier`, `AuditLog` | Formats: JSON, CSV; computes and injects `X-Artifact-Hash` header; verified before transmission. |
| **Audit Log Query** | `GET /api/audit` | [app/api/audit/route.ts](file:///e:/Rakshak/app/api/audit/route.ts) | `AuditLog` | Restricted to `SUPERVISOR` and `ADMIN` roles; paginated chronological event feed. |
| **Access Grants** | `POST /api/access-grants` | [app/api/access-grants/route.ts](file:///e:/Rakshak/app/api/access-grants/route.ts) | `AccessGrant`, `AuditLog` | Issues time-bounded inter-department access grants (`scope`, `expiresAt`, `reason`). |
| **Access Revoke** | `POST /api/access-grants/[id]/revoke` | [app/api/access-grants/[id]/revoke/route.ts](file:///e:/Rakshak/app/api/access-grants/%5Bid%5D/revoke/route.ts) | `AccessGrant`, `AuditLog` | Immediately invalidates grant (`revokedAt = NOW()`); terminates cross-department reads. |
| **Service Health** | `GET /api/health` | [app/api/health/route.ts](file:///e:/Rakshak/app/api/health/route.ts) | PostgreSQL Catalog | Readiness probe (`probe=ready`), liveness probe (`probe=liveness`), deep diagnostics. |

---

### 3. Frontend Pages & API Dependency Mapping

| Frontend Page | Purpose & Interface Elements | Actual Backend API Calls | State Handling & Error Boundaries |
|---|---|---|---|
| [public/frontend/pages/login.html](file:///e:/Rakshak/public/frontend/pages/login.html) | Officer Authentication Form (Badge Number / Email, Password) | `POST /api/auth/login` | Renders inline error on 401/403; stores session token; redirects to dashboard. |
| [public/frontend/pages/cases.html](file:///e:/Rakshak/public/frontend/pages/cases.html) | Case Registry, Case Creation Modal, Case Status Timeline | `GET /api/cases`, `POST /api/cases`, `GET /api/cases/[id]` | Table render with pagination; empty states; error banners; status chips. |
| [public/frontend/pages/evidence-viewer.html](file:///e:/Rakshak/public/frontend/pages/evidence-viewer.html) | Evidence Exhibits, Upload Modal, Custody Chain Visualizer | `GET /api/cases/[id]/evidence`, `POST /api/evidence/upload`, `GET /api/evidence/[id]/custody`, `POST /api/evidence/[id]/verify` | Client-side file hashing prior to upload; chain verification badges (PASS/FAIL). |
| [public/frontend/pages/reports.html](file:///e:/Rakshak/public/frontend/pages/reports.html) | Investigative Dossier Management, Review Queue, Export Action | `POST /api/cases/[id]/dossier/generate`, `POST /api/dossiers/[id]/review`, `GET /api/dossiers/[id]/export` | Multi-stage review buttons; SHA-256 artifact hash verification; direct download link. |
| [public/frontend/pages/graph.html](file:///e:/Rakshak/public/frontend/pages/graph.html) | Cross-Case Syndicate Link Graph & Entity Relationship Network | `GET /api/graph?caseId=...&depth=...` | Interactive node-link canvas; redacts foreign restricted cases. |
| [public/frontend/js/api.js](file:///e:/Rakshak/public/frontend/js/api.js) | Centralized authenticated fetch wrapper | Intercepts all requests | Automatically attaches `Authorization: Bearer <token>` and handles 401 redirection. |

---

### 4. Implementation vs. Unavailable Workflow Analysis

```
┌────────────────────────────────────────────────────────┐
│             WORKFLOW IMPLEMENTATION STATUS             │
├────────────────────────────────────────────────────────┤
│ [IMPLEMENTED & VERIFIED]                               │
│ • Officer Authentication (Bearer JWT & HttpOnly)       │
│ • Department Tenant Isolation & Grant Delegation       │
│ • Case Creation, Assignment & Finite-State Transitions │
│ • Supervisor Formal Approval Gate                      │
│ • Evidence Intake with Client SHA-256 Verification     │
│ • Cryptographic Hash-Chained Chain-of-Custody          │
│ • Independent Cold Storage Routing via Adapter         │
│ • Offline Text Extraction & Fact Retrieval             │
│ • Human Fact Correction & Provenance History           │
│ • Cross-Case Entity Resolution & Normalization         │
│ • Candidate Link Review (Confirm / Reject / Revoke)    │
│ • Bounded Cross-Case Intelligence Graph Traversal      │
│ • Evidence-Backed Dossier Generation & Versioning      │
│ • Two-Stage Dossier Approval State Machine             │
│ • Authenticated Dossier Export with Artifact Digest    │
│ • System Audit Logging for All Forensic Actions        │
│ • PostgreSQL Direct RLS & FORCE RLS Policies           │
├────────────────────────────────────────────────────────┤
│ [INTENTIONALLY BLOCKED / UNAVAILABLE IN PHASE 45]      │
│ ✗ External WAN Intelligence Feeds (Blocked by safety)  │
│ ✗ Real Personally Identifiable Information Ingestion   │
│ ✗ Production Digital Signing Hardware (HSM / Token)   │
│ ✗ Public Network Ingress / Production Cutover          │
│ ✗ Statutory / Judicial Admissibility Certifications    │
└────────────────────────────────────────────────────────┘
```

---

### 5. Integration Architecture Conclusions

1. **Deterministic Separation of Concerns:** Database access, storage path resolution, and security context initialization are cleanly partitioned into standard utility modules (`lib/accessControl.ts`, `services/storageAdapter.ts`, `lib/prisma.ts`).
2. **True Full-Stack Cohesion:** Frontends consume real endpoints rather than stubs. All verified endpoints return structured JSON schemas with authoritative error handling and audit entries.
3. **Safety Baseline Intact:** No external feeds or production keys are initialized. All test fixtures remain confined to synthetic IDs and isolated test directories.
