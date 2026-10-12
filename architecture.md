# Rakshak v3.0 — System Architecture Specification

> **Platform:** Digital Forensics, Chain of Custody & Cross-Case Syndicate Intelligence Platform  
> **Target Audience:** Cybercrime Investigation Units, Law Enforcement Agencies, State Forensic Laboratories  
> **Status:** Production-Ready (Verified through Phase 29 Preflight & Phase 30 Unified Neumorphic UI)

---

## 1. High-Level Architecture Flow

```
                                  [ INVESTIGATOR / CLIENT BROWSER ]
                                                 │
                  ┌──────────────────────────────┴──────────────────────────────┐
                  ▼                                                             ▼
     [ Interactive Neumorphic Console ]                            [ Web Crypto API Worker ]
     • Dashboard & Analytics                                       • Client SHA-256 Digest
     • Case & Evidence Vault                                       • Client-side Metadata Extraction
     • Cross-Case Intelligence Graph                               • Zero-trust file pre-validation
     • Timeline & Event Normalizer                                              │
     • Cross-Dept Collaboration & Onboarding                                    │
     • Audit Logs & Administration                                              │
                  │                                                             │
                  └──────────────────────────────┬──────────────────────────────┘
                                                 │ HTTPS / Strict Session Cookie
                                                 ▼
                             [ NEXT.JS BACKEND GATEWAY & API ROUTER ]
                                                 │
     ┌───────────────────────────────────────────┼───────────────────────────────────────────┐
     ▼                                           ▼                                           ▼
[ Ingestion & WORM Vault ]              [ Extraction & AI Pipeline ]               [ Governance & Auth ]
• Server SHA-256 Hash Digest            • Dual-OCR Engine                          • RBAC Role Hierarchy
• Dual-hash Validation Invariant         (pdf-parse + Tesseract.js offline)        • HttpOnly Session Governance
• Bit-level WORM Storage                • Deterministic Regex Extractor            • Multi-Tenancy Enforcement
  (/uploads/raw/<hash>.bin)              (UPI, Phone, IFSC, UTR, Accounts)         • Append-Only Audit Trail
• Working-copy buffer creation          • Zod Structured Fact Output Validator     • Department Boundary Checks
     │                                           │                                           │
     └───────────────────────────────────────────┼───────────────────────────────────────────┘
                                                 │
                                                 ▼
                                  [ FORENSIC RESOLUTION ENGINES ]
                                                 │
                  ┌──────────────────────────────┴──────────────────────────────┐
                  ▼                                                             ▼
     [ Timeline Normalizer Engine ]                                [ Cross-Case Graph Resolver ]
     • Multi-source timestamp parser                               • Global Entity Matching (MATCH c-e)
       (WhatsApp, SMS, Bank statements, Logs)                      • Degree-of-connectivity thresholding
     • ISO-8601 UTC normalization + IST offset                     • Crimson Syndicate Alert clustering
     • Modus Operandi (MO) 4-stage classifier                      • Shared mule account & phone tracing
       (Reconnaissance ➔ Bait ➔ Transaction ➔ Laundering)          • D3/SVG Force-Directed visualizer
                  │                                                             │
                  └──────────────────────────────┬──────────────────────────────┘
                                                 │
                                                 ▼
                                     [ DATA PERSISTENCE LAYER ]
                                                 │
                  ┌──────────────────────────────┴──────────────────────────────┐
                  ▼                                                             ▼
     [ SQLite Embedded / Air-Gapped ]                              [ PostgreSQL 16 Enterprise ]
     • Prisma ORM (`prisma/dev.db`)                                • Native Row-Level Security (RLS)
     • Zero-dependency offline field deployment                    • Tenant isolation via `app.current_department_id`
     • Pre-seeded synthetic syndicate cases                        • Migration engine (`scripts/migrate_sqlite_to_postgres.mjs`)
```

---

## 2. Core Architectural Pillars

### 2.1 Dual-Engine Database Architecture
The platform is architected with dual persistence modes to accommodate both field investigators in air-gapped forensic environments and centralized state police command centers:
- **Development & Air-Gapped Staging:** Fully self-contained local SQLite (`prisma/dev.db`) pre-seeded with verified cybercrime syndicate cases, entities, timeline milestones, and audit trails.
- **Enterprise Multi-Agency Production:** PostgreSQL 16 with native **Row-Level Security (RLS)**. Every database session configures `app.current_department_id` dynamically, preventing cross-agency data leaks at the database engine level.
- **Automated Migration Engine:** `scripts/migrate_sqlite_to_postgres.mjs` provides an idempotent, verifiable ETL pipeline with SHA-256 bit-level checksum validation before and after transfer.

### 2.2 Content-Addressed Cold Storage (WORM Immutability)
Evidentiary files uploaded to Rakshak follow strict Write-Once-Read-Many (WORM) principles:
- **Content Addressing:** Binary files are identified and persisted exclusively by their hexadecimal SHA-256 digest: `/uploads/raw/<sha256>.bin`.
- **Dual-Hash Invariant:** Files are hashed client-side via the Web Crypto API (`crypto.subtle.digest`) prior to transmission and recalculated server-side using Node.js `crypto.createHash('sha256')`. If digests disagree by even a single bit, upload is rejected (`400 Bad Request`).
- **Read-Time Verification:** The storage adapter (`services/storageAdapter.ts`) validates exhibit hashes upon every retrieval. Any detected bit-level alteration raises an immediate `HashMismatchError` and creates a high-priority audit alarm.
- **Repository Cleanliness:** Binary exhibits are strictly excluded from git tracking via `.gitignore`, while folder structure is preserved via `.gitkeep`.

### 2.3 Deterministic & Hybrid Entity Extraction
To prevent artificial intelligence hallucinations in court proceedings:
- **Regex-First Determinism:** High-confidence regex extraction extracts statutory banking and telecom identifiers:
  - **UPI VPA:** `^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`
  - **Indian Mobile:** `^(?:\+91|0)?[6-9]\d{9}$`
  - **Bank IFSC:** `^[A-Z]{4}0[A-Z0-9]{6}$`
  - **Transaction UTR:** `\b(?:\d{12}|[A-Z0-9]{12,22})\b`
  - **SHA-256 Checksum:** `^[a-fA-F0-9]{64}$`
- **Dual OCR Engine:** Combines `pdf-parse` for structured digital PDF documents and `Tesseract.js` (v5 offline with local `eng.traineddata`) for scanned images, screenshots, and receipts.
- **Bidirectional Grounding:** Extracted facts are anchored to specific evidence IDs with character offsets or bounding coordinates. Unanchored assertions are categorically discarded.

### 2.4 Timeline Normalization & Modus Operandi (MO) Mapping
- **Chronological Normalization:** Parses disparate timestamp formats (WhatsApp exports, bank SMS, gateway receipts, server logs) into standard ISO-8601 UTC series with IST (+05:30) offset adjustments.
- **Modus Operandi Tagging:** Classifies events into the standard cybercrime operational lifecycle:
  1. `Reconnaissance` — Initial target identification, profile scanning, malicious link deployment.
  2. `Bait & Impersonation` — Fraudulent identity establishment, APK distribution, phishing dialogue.
  3. `Transaction & Extraction` — Fraudulent debit, OTP harvesting, fund transfer via UPI/IMPS.
  4. `Laundering & Cashout` — Multi-hop mule routing, ATM withdrawal, crypto swap.

### 2.5 Cross-Case Syndicate Graph Engine
- **Graph Resolver:** Analyzes the global bipartite graph of Cases and Entities (`services/graphService.ts`).
- **Degree Triggering:** When an identifier (UPI, Phone, Account, Device IMEI) appears across more than one case, the resolver flags it as a cross-case entity and computes syndicate clusters.
- **Force-Directed Visualization:** In-memory graph canvas rendering nodes with distinct colors (Amber for single-case entities, Crimson for cross-case syndicate nodes) and interactive relationship inspectors.

### 2.6 Statutory Admissibility (BSA 2023 §63)
- **Automated Electronic Record Certificates:** Generates digital certificates adhering to Section 63 of Bharatiya Sakshya Adhiniyam (BSA) 2023 (formerly Section 65B of the Indian Evidence Act).
- **Certificate Content:** Captures evidence hash, capture timestamp, extracting officer name and badge number, source device hash, SHA-256 algorithm signature, and an unbroken chain-of-custody ledger.

---

## 3. Frontend Architecture & Design System

### 3.1 Neumorphic Design Language
The entire user interface is constructed with a bespoke forensic Neumorphic design system:
- **Base Surface:** `#E9EEF5`
- **Elevated Cards:** `#F5F8FC`
- **Primary Text:** `#172B4D`
- **Subtle Accents:** Dark Slate Blue `#1B2559`, Muted Blue `#4318FF`, Alert Crimson `#E53E3E`, Success Emerald `#059669`.
- **Elevation Shadows:** Dual-drop soft shadows (`6px 6px 14px rgba(166, 180, 200, 0.45), -6px -6px 14px rgba(255, 255, 255, 0.85)`).

### 3.2 Unified 10-Item Navigation Architecture
All 11 primary HTML modules share an identical, synchronized left navigation bar to eliminate UI layout shifts:
1. **Dashboard** (`dashboard.html`) — Operational metrics, real-time telemetry, syndicate alerts, recent evidence ingestions.
2. **Cases** (`cases.html`) — Master case directory, status/severity filters, new case creation modal, case detail drawer.
3. **Evidence** (`evidence.html`) — Dual-hash evidence vault, drag-and-drop intake, WORM integrity verification, OCR text inspection.
4. **Reports** (`reports.html`) — Statutory BSA §63 digital certificates, comprehensive forensic dossiers, automated PDF generation.
5. **Intelligence** (`graph.html`) — Interactive D3/SVG cross-case entity network, syndicate clusters, link discovery.
6. **Entities** (`entities.html`) — Global intelligence directory (Mule accounts, Phone numbers, UPI VPAs, IFSC, Devices).
7. **Timeline** (`timeline.html`) — Unified chronological event stream, MO stage progression, source document traceability.
8. **Cross-Department** (`cross-dept.html`) — Inter-agency intelligence exchange, case-sharing workflows, institutional department onboarding modal.
9. **Administration** (`admin.html`) — Officer directory, role-based access control (RBAC), department management, security controls.
10. **Audit Logs** (`audit.html`) — Append-only tamper-evident security activity monitor, filter by actor/action/severity, CSV/JSON export.
* **Authentication Portal:** (`index.html` / `login.html`) — Officer login gateway, session token governance.

### 3.3 Seamless Legacy URL Forwarding
To ensure 100% backward compatibility with existing bookmarks, legacy URLs feature zero-delay client forwarders:
- `onboard-request.html` &rarr; `cross-dept.html?action=onboard`
- `case-detail.html` &rarr; `cases.html?caseId=...`
- `evidence-viewer.html` &rarr; `evidence.html?id=...`
- `pilot-readiness.html` &rarr; `admin.html`
- `legal.html` &rarr; `reports.html`
- `comms.html` &rarr; `evidence.html`

---

## 4. Backend Gateway & API Structure

```
app/api/
├── auth/
│   ├── login/route.ts                # Session cookie generation & credential validation
│   ├── logout/route.ts               # Session revocation & cookie teardown
│   └── me/route.ts                   # Current officer session profile & permissions
├── cases/
│   ├── route.ts                      # Case listing & case registration
│   └── [id]/
│       ├── route.ts                  # Case detail, update, and soft deletion
│       └── export/route.ts           # Case dossier compilation
├── evidence/
│   ├── route.ts                      # Evidence listing & multipart upload
│   └── [id]/
│       ├── route.ts                  # Exhibit metadata & custody ledger
│       ├── download/route.ts         # Secure binary download with hash check
│       ├── verify/route.ts           # On-demand WORM hash integrity verification
│       └── text/route.ts             # OCR text extraction inspection
├── entities/
│   ├── route.ts                      # Global entity repository & cross-case counts
│   └── [id]/route.ts                 # Specific entity dossier & linked cases
├── graph/
│   └── route.ts                      # Bipartite network graph nodes & edges generator
├── timeline/
│   └── route.ts                      # Multi-case chronological event stream
├── reports/
│   ├── route.ts                      # Report catalog & generation triggers
│   └── [id]/
│       ├── route.ts                  # Report details & metadata
│       └── pdf/route.ts              # BSA §63 PDF certificate compiler
├── cross-dept/
│   ├── requests/route.ts             # Inter-agency access request workflows
│   └── onboard/route.ts              # Institutional department onboarding intake
├── admin/
│   ├── users/route.ts                # Officer lifecycle & RBAC administration
│   └── departments/route.ts          # Department tenancy & jurisdiction management
└── audit/
    ├── route.ts                      # Tamper-evident audit log query & filtering
    └── export/route.ts               # Audit trail CSV/JSON compliance export
```

---

## 5. Security Invariant Matrix

| Invariant # | Invariant Description | Enforcement Mechanism |
|:---:|:---|:---|
| **INV-01** | **WORM Immutability** | Uploaded binaries are written once to `/uploads/raw/<sha256>.bin` and never updated or rewritten. |
| **INV-02** | **Dual-Hash Integrity** | Client SHA-256 (Web Crypto) must match server SHA-256 (`crypto`) exactly or transaction fails. |
| **INV-03** | **Zero Unanchored Facts** | Extracted facts must possess a verified `evidenceId` and provenance location; unanchored facts are discarded. |
| **INV-04** | **Tenant Isolation** | Multi-department queries in PostgreSQL require `app.current_department_id` session configuration. |
| **INV-05** | **Immutable Audit Log** | Audit log records can only be appended (`INSERT`); `UPDATE` and `DELETE` operations are strictly blocked. |
| **INV-06** | **Session Governance** | Strict authentication utilizes `HttpOnly`, `SameSite=Lax`, and `Secure` cookies with cryptographic validation. |
| **INV-07** | **Directory Traversal Defense** | Evidence access validates hashes against strict `^[a-fA-F0-9]{64}$` regex before filesystem resolution. |

---

## 6. Verification & Automated Quality Assurance

The codebase includes an extensive suite of automated test and validation scripts:
- `scripts/check_frontend_integrity.mjs` — Validates all HTML pages for valid link targets, script bindings, and missing assets.
- `scripts/check_frontend_imports.mjs` — Checks all modular JavaScript imports and static paths.
- `scripts/verify_phase29_preflight.mjs` — Executes pre-deployment health check across database, storage, environment variables, and build artifacts.
- `scripts/test_phase17_verifier.mjs` — Validates WORM immutability and anti-tamper defenses on cold storage exhibits.
- `tsc --noEmit` — Validates strict TypeScript compilation across all API routes, database models, and service classes.
