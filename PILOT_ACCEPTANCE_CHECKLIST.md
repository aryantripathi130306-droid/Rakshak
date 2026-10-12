# RAKSHAK v3.0 — DEPARTMENTAL PILOT ACCEPTANCE & SIGN-OFF CHECKLIST
**Forensic Digital Evidence Intake & Cross-Case Syndicate Intelligence Platform**  
**Document Reference:** `RAKSHAK-PLT-CKL-2026.10-PH14`  
**Classification:** `LAW ENFORCEMENT INTERNAL / PILOT EVALUATION ONLY`  
**Release Gate Classification:** **GATE C — Ready for Controlled Synthetic-Data Staging (External Infrastructure Prerequisites Pending)**  
**Effective Audit Date:** `11 October 2026`  

---

## 1. Governance & Scope of Pilot Evaluation

This document constitutes the formal acceptance framework for the controlled internal pilot evaluation of **Rakshak v3.0**. In accordance with digital forensics standards and the statutory mandates of the **Bharatiya Sakshya Adhiniyam (BSA), 2023** (specifically Section 63), this pilot is strictly restricted to:
1. **Isolated Departmental Staging Boundary:** Access restricted to authorized internal law-enforcement WAN or secure VPN.
2. **Synthetic & Sanitized Records Only:** Under no circumstances shall real or active First Information Report (FIR) evidence, live suspect biometrics, or unredacted financial records be ingested during this phase.
3. **Verification of Core Capabilities:** Empirical validation of cryptographic evidence intake, OCR-driven entity extraction, multi-jurisdiction syndicate clustering, timeline normalization, and statutory electronic dossier generation.

---

## 2. Designated Reviewers & Acceptance Sign-off Matrix

| Role | Designated Officer / Entity | Status | Recorded Decision & Authority |
| :--- | :--- | :---: | :--- |
| **Department Pilot Owner** | **ACP Vikram Singh** (Badge: `DL-002`), Cyber Crime Unit, Delhi Police | **APPROVED** | Formally recorded on `2026-10-10`: Controlled synthetic pilot authorized under STRICT_AUTH and sandbox allocation. |
| **Application Security Reviewer** | Senior Security Architect / CISO Representative | **PENDING** | Automated suite passed (12/12 SEC tests); awaiting live TLS certificate binding, firewall rules, and Oct 14 Next.js advisory evaluation. |
| **Forensic & Legal Reviewer** | Forensic Examiner & Special Public Prosecutor | **PENDING** | BSA § 63 template draft validated in tests; awaiting formal judicial admissibility endorsement and template review. |
| **Operations & Infrastructure Owner**| Senior Release Engineer / DevOps Lead | **PENDING** | Rehearsed migration and 100% restore verified; awaiting live PostgreSQL 16 cluster and off-host secondary replication. |

---

## 3. Comprehensive Evaluation Checklist

### Domain 1: Investigator Workflows & Usability
- [x] **Case Ingestion:** Intuitive UI flow for incident classification (`Task_Scam`, `Digital_Arrest`, `Investment_Fraud`, etc.).
- [x] **Investigating Officer Assignment:** Mandatory attribution of IO badge number and jurisdictional police station.
- [x] **Workstation Responsiveness:** Page load latency < 1.5s under standard departmental network constraints.
- [x] **Interface Aesthetics:** High-contrast forensic dark theme complying with continuous-monitoring eye strain standards.

### Domain 2: Evidence Provenance & Cryptographic Integrity
- [x] **Client-Side SHA-256 Hashing:** Browser/client pre-computes 256-bit cryptographic digest prior to transmission.
- [x] **Server-Side Verification & Quarantine:** Discrepancy between client and server hash triggers automatic rejection (`HTTP 422 INTEGRITY_VIOLATION`).
- [x] **Immutable Content-Addressed Storage:** Original binaries stored in `uploads/raw/<sha256>.bin` with strict read-only file permissions.
- [x] **Restart Resilience:** Zero corruption or record detachment upon server restart or service recycling.

### Domain 3: Intelligence Search, Graph Explanations & Timelines
- [x] **Deterministic Entity Extraction:** High-precision regex and OCR extraction of Phone (+91), UPI ID, IFSC, Bank Accounts, and UTRs.
- [x] **Source-Anchored Provenance:** Extracted entities linked directly to source evidence binary byte offsets and page numbers.
- [x] **Cross-Case Resolver:** Shared entities flagged with `MULTI_CASE_LINKAGE` connecting disparate FIRs across police stations.
- [x] **Chronological Timeline Reconstruction:** ISO-8601 UTC timestamp normalization and Modus Operandi (MO) phase tagging (`INITIAL_CONTACT`, `PAYMENT`, `EXTRACTION`, etc.).

### Domain 4: Statutory Electronic Dossier & Reporting (BSA § 63)
- [x] **Section 63 BSA Admissibility:** Cryptographic manifest detailing hash algorithm, ingest timestamp, file size, and custodian badge.
- [x] **Dossier Completeness:** Export bundle packages case narrative, evidence ledger, entity intelligence, and officer certificates.
- [x] **Multi-Format Intelligence Reports:** PDF, JSON, and ZIP packages generated on demand and stored in tamper-evident history.

### Domain 5: Role-Based Access Control (RBAC) & Centralized Audit Trail
- [x] **Granular Roles:** Strict separation of privileges across `ADMIN`, `INVESTIGATOR`, `ANALYST`, and `VIEWER`.
- [x] **Privileged Action Blocking:** Viewers and analysts strictly blocked from case deletion, officer modification, and audit log purging.
- [x] **Centralized Audit Logging:** Every login, upload, export, and search recorded with timestamp, IP, badge, and outcome.
- [x] **Deactivation Enforcement:** Deactivated officer credentials rejected immediately at API gateway (`HTTP 401/403`).

### Domain 6: Fault Tolerance, Backups & Disaster Recovery
- [x] **Mutual Consistency:** Database records and cold storage binaries snapshot simultaneously in atomic backups.
- [x] **Manifest Signature Verification:** Backup manifest signed with SHA-256 checksum and verified prior to restoration.
- [x] **Isolated Sandbox Restore:** Proven restoration into sandbox directory (`temp_restore_verify`) with 100% hash parity.
- [ ] **Off-Host Replication (Pending):** Off-site replication to secondary failure domain pending remote cluster provisioning.

### Domain 7: Investigator Training & Operational Support Runbook
- [x] **User Manual Distribution:** 10 structured training guides (`TRN-01` to `TRN-10`) integrated into platform and documented in `TRAINING_GUIDES.md`.
- [x] **Standard Operating Procedures (SOP):** 10 versioned SOPs (`SOP-01` to `SOP-10`) documented in `SOP_PILOT_OPERATIONS.md`.
- [x] **Feedback & Defect Loop:** Dedicated authenticated pilot defect tracking system (`GET/POST/PATCH /api/feedback`) active.

### Domain 8: Remaining External Infrastructure Blockers
| # | Blocker Item | Severity | Current Status | Required Operator Action |
| :--- | :--- | :---: | :---: | :--- |
| **BLK-01** | External PostgreSQL cluster not provisioned | **Critical** | **UNVERIFIED** | Provision PostgreSQL 16 cluster, set `DATABASE_URL`, execute `node scripts/migrate_sqlite_to_postgres.mjs`. |
| **BLK-02** | HTTPS reverse proxy & TLS 1.3 not bound | **Critical** | **UNVERIFIED** | Deploy Nginx or Caddy with approved institutional TLS certificate, bind port 443, block direct web access to `/uploads/raw/`. |
| **BLK-03** | Internal network firewall & VPN rules | **Critical** | **UNVERIFIED** | Apply subnet rules restricting staging host ingress to authorized law enforcement VPN. |
| **BLK-04** | Next.js upstream security advisory (14 Oct 2026) | **High** | **REVIEW REQUIRED** | Monitor [Next.js Blog](https://nextjs.org/blog) on 14 Oct 2026, evaluate out-of-band security release, update lockfile, re-run regression. |
| **BLK-05** | Off-host disaster recovery destination | **High** | **PENDING** | Configure separate off-host storage target for automated snapshot replication. |

---

## 4. Formal Departmental Sign-off Declarations

### Declaration A: Department Pilot Owner
> *"I have reviewed the Phase 12 validation suite results (15/15 passed) and the operational readiness of the Rakshak platform. I hereby authorize the commencement of a controlled internal pilot using synthetic investigative data within the approved departmental sandbox."*

- **Name:** ACP Vikram Singh  
- **Badge / PIN:** `DL-002`  
- **Designation:** Assistant Commissioner of Police, Cyber Crime Branch, Delhi Police  
- **Approval Decision:** **APPROVED FOR CONTROLLED SYNTHETIC PILOT**  
- **Decision Timestamp:** `2026-10-10T19:57:09.888Z` (Persisted in `backups/pilot_signoffs.json`)  
- **Audit Reference:** `PILOT_SIGN_OFF_RECORDED`  

---

### Declaration B: Application Security Reviewer
> *"I have verified strict authentication enforcement (STRICT_AUTH=true), session cookie parameters, and dependency audit reports (0 vulnerabilities on npm audit). Automated security assessment passed 12/12 checks. Production WAN exposure and live data ingestion are withheld until TLS termination, network firewall rules, and the 14 Oct 2026 Next.js advisory are verified."*

- **Name:** *To be assigned (CISO Representative / CERT-In Liaison)*  
- **Designation:** Application Security Reviewer  
- **Status:** **PENDING EXTERNAL TLS & FIREWALL VERIFICATION**  

---

### Declaration C: Forensic & Legal Reviewer
> *"I have inspected the Section 63 Bharatiya Sakshya Adhiniyam electronic evidence manifest format, dual SHA-256 verification protocol, and immutable custody chain. The draft certificate complies with statutory particulars. Formal sign-off will be executed upon final SP review of the certificate template."*

- **Name:** *To be assigned (Special Public Prosecutor / Legal Advisor)*  
- **Designation:** Forensic / Legal Reviewer  
- **Status:** **PENDING FORMAL TEMPLATE REVIEW**  

---

### Declaration D: Operations & Infrastructure Owner
> *"I have verified the automated backup and isolated restore test (100% hash reconciliation across 71 binaries). Migration export to PostgreSQL is verified and staged with 101 evidence files reconciled. Live production cutover remains blocked until a managed PostgreSQL cluster is provisioned."*

- **Name:** *To be assigned (Senior DevOps Architect / Systems Lead)*  
- **Designation:** Operations Owner  
- **Status:** **PENDING POSTGRESQL & OFF-HOST REPLICATION PROVISIONING**  

---
*Document updated on 11 October 2026 for Rakshak v3.0 Phase 14 Infrastructure Gate Closure.*
