# RAKSHAK v3.0 — INVESTIGATOR & OPERATIONAL TRAINING MANUAL
**Forensic Digital Evidence Intake & Cross-Case Syndicate Intelligence Platform**  
**Document Identifier:** `TRN-RAKSHAK-v3.0`  
**Classification:** `LAW ENFORCEMENT INTERNAL / PILOT TRAINING`  
**Target Roles:** Investigating Officers (IO), Forensic Analysts, Supervising Officers, System Administrators  

---

## Important Forensic & Legal Disclaimers

> [!IMPORTANT]
> **CRYPTOGRAPHIC HASH INTEGRITY vs. FACTUAL TRUTH:**  
> A successful SHA-256 hash match proves exclusively that the digital file ingested onto the server is byte-for-byte identical to the file hashed on the client workstation. **It establishes technical integrity and chain-of-custody preservation. It does NOT prove the truth, authenticity, or legal veracity of the statements or contents within the file.**

> [!NOTE]
> **STATUTORY DOSSIER vs. JUDICIAL ADMISSIBILITY:**  
> The generated BSA Section 63 Electronic Evidence Certificate and Dossier provide a standardized, procedural compliance draft conforming to the requirements of the Bharatiya Sakshya Adhiniyam, 2023. **The platform cannot and does not guarantee that a court of law will admit the evidence.** Admissibility remains subject to judicial scrutiny, oral examination of certifying custodians, and corroborating investigative facts.

---

## Table of Contents
1. [Module 1: Authentication, Session Management & Access Responsibilities](#module-1-authentication-session-management--access-responsibilities)
2. [Module 2: Case Creation, IO Assignment & Lifecycle Tracking](#module-2-case-creation-io-assignment--lifecycle-tracking)
3. [Module 3: Evidence Intake, Category Selection & SHA-256 Verification](#module-3-evidence-intake-category-selection--sha-256-verification)
4. [Module 4: Chain of Custody & Hash Mismatch / Tamper Quarantine](#module-4-chain-of-custody--hash-mismatch--tamper-quarantine)
5. [Module 5: Evidence Viewer & Source-Linked Entity Extraction](#module-5-evidence-viewer--source-linked-entity-extraction)
6. [Module 6: Forensic Timeline Reconstruction & Timezone Normalization](#module-6-forensic-timeline-reconstruction--timezone-normalization)
7. [Module 7: Cross-Case Syndicate Resolution & Graph Intelligence](#module-7-cross-case-syndicate-resolution--graph-intelligence)
8. [Module 8: Legal Matrix Review & BSA Section 63 Dossier Preparation](#module-8-legal-matrix-review--bsa-section-63-dossier-preparation)
9. [Module 9: Intelligence Report Generation & Secure Archival](#module-9-intelligence-report-generation--secure-archival)
10. [Module 10: Centralized Audit Trail Inspection & Incident Escalation](#module-10-centralized-audit-trail-inspection--incident-escalation)

---

### Module 1: Authentication, Session Management & Access Responsibilities
- **Purpose:** Ensure secure, attributable access to the platform; understand session lifetime and role boundaries.
- **Prerequisites:** Valid departmental Badge Number (`DL-001` through `DL-020`) and assigned password.
- **Workflow:**
  1. Open browser to `http://localhost:3000/frontend/pages/reports.html`.
  2. Click **🔑 Switch Officer / Login** in the upper-right session header.
  3. Enter assigned Badge Number (e.g. `DL-002`) and password (`Rakshak@2026`). Click **Sign In**.
  4. Confirm that your Name, Badge Number, and Role (`ADMIN`, `INVESTIGATOR`, `ANALYST`, or `VIEWER`) appear in the active session badge.
  5. When leaving your workstation, click **Sign Out** to revoke your cryptographic session cookie immediately.
- **Expected Result:** Secure `HttpOnly` session cookie issued with 12-hour TTL; actions attributed to your badge in the audit ledger.
- **Common Failure Cases:**
  - `HTTP 401 Unauthorized`: Invalid badge number or password.
  - `HTTP 403 Account Deactivated`: Administrative lock applied due to credential compromise or reassignment.
- **Escalation Route:** Contact Department Pilot Owner (`ACP Vikram Singh`) for password reset.

---

### Module 2: Case Creation, IO Assignment & Lifecycle Tracking
- **Purpose:** Register new cybercrime inquiries, map incident classifications, and assign responsible investigating officers.
- **Prerequisites:** `INVESTIGATOR` or `ADMIN` role.
- **Workflow:**
  1. Navigate to **Cases** (`/frontend/pages/cases.html`).
  2. Click **+ New Case** in the page header.
  3. Fill out required fields:
     - Incident Type: Select `Task_Scam`, `Digital_Arrest`, `Investment_Fraud`, `KYC_Freeze`, or `Romance_Scam`.
     - Complainant Name & Contact reference.
     - Jurisdiction: e.g. `Cyber Crime PS — South Delhi`.
     - Amount Defrauded (INR): Approximate complainant loss.
     - Assigned Investigating Officer: Select officer from the departmental roster.
  4. Click **Create Case**. The platform generates a unique case ID (e.g. `CASE-2026-1167`).
- **Expected Result:** Case appears in active inquiry list; status initialized to `UNDER_INQUIRY`.
- **Common Failure Cases:** Duplicate case number (`HTTP 409 Conflict`); missing mandatory complainant name (`HTTP 400`).
- **Escalation Route:** Station House Officer (SHO) or Supervisory Inspector.

---

### Module 3: Evidence Intake, Category Selection & SHA-256 Verification
- **Purpose:** Ingest raw digital exhibits while establishing cryptographic provenance at the exact moment of intake.
- **Prerequisites:** Active case selected in header; digital artifact on local workstation media.
- **Workflow:**
  1. Navigate to **Evidence Vault** (`/frontend/pages/index.html`).
  2. Click **Upload Evidence** in the top action bar.
  3. Choose the appropriate Evidence Category:
     - `UPI_FINANCIAL`: Bank statement, passbook photo, payment gateway slip.
     - `CHAT`: WhatsApp, Telegram, or Signal conversation export.
     - `CALL_LOG`: Telco CDR, VoIP call history.
     - `IDENTITY_DATA`: Aadhaar/PAN image, KYC document.
     - `CRIME_SCENE_PHOTO`: Screenshot of fraudulent web portal.
  4. Select file. The client interface automatically pre-computes the 64-character SHA-256 digest in the browser.
  5. Click **Submit Evidence**.
- **Expected Result:** Server verifies hash parity; displays green `VERIFIED` badge with server digest; stores file in `uploads/raw/<sha256>.bin`.
- **Common Failure Cases:** `HTTP 422 INTEGRITY_VIOLATION` (file modified or truncated in transit); file exceeds 100 MB (`HTTP 413`).
- **Escalation Route:** Follow [SOP-02](#sop-02) for suspected evidence tampering.

---

### Module 4: Chain of Custody & Hash Mismatch / Tamper Quarantine
- **Purpose:** Review custody transitions, verify continuous evidence integrity, and handle quarantine events.
- **Prerequisites:** Any role for viewing; `ADMIN`/`INVESTIGATOR` for custody transfers.
- **Workflow:**
  1. In the **Evidence Vault**, locate the target item and click **Custody Ledger**.
  2. Inspect the chronological chain of custody:
     - Acquisition timestamp (UTC).
     - Receiving Officer & Jurisdictional Unit.
     - Purpose of transfer (Intake, Forensic Extraction, Court Production).
  3. Review the Verification Status: `VERIFIED` confirms current binary matches recorded genesis hash.
  4. If an item displays `TAMPER_DETECTED` or `MISMATCH`, the file is immediately quarantined from further processing.
- **Expected Result:** Complete, unbroken chronological chain from acquisition to archive.
- **Common Failure Cases:** Missing custody transfer record when evidence is passed to external forensic laboratory.
- **Escalation Route:** Chief Forensic Examiner / Special Public Prosecutor.

---

### Module 5: Evidence Viewer & Source-Linked Entity Extraction
- **Purpose:** View documents in the secure viewer and audit deterministically extracted entities with source byte anchoring.
- **Prerequisites:** Valid case and ingested evidence record.
- **Workflow:**
  1. Click **View** on any evidence record to open the **Evidence Viewer** (`/frontend/pages/evidence-viewer.html?id=<id>`).
  2. The left pane renders the document (PDF or OCR text); the right pane lists Extracted Entities.
  3. Click any extracted entity (e.g. UPI ID `syndicate.mule@okaxis` or Phone `+91 98110 99887`).
  4. The viewer automatically highlights the exact source bounding box and byte offset where the entity was identified.
  5. Check extraction confidence score (e.g. `98%`). If an entity is incorrect, click **Flag for Review**.
- **Expected Result:** Verified link between raw document text and structured investigation database.
- **Common Failure Cases:** Poor scan resolution causing low OCR confidence (< 60%).
- **Escalation Route:** Re-run OCR with enhanced threshold or file a pilot feedback defect.

---

### Module 6: Forensic Timeline Reconstruction & Timezone Normalization
- **Purpose:** Reconstruct the chronological sequence of criminal actions across disparate telco, bank, and chat artifacts.
- **Prerequisites:** At least two dated evidence items or extracted timestamp facts.
- **Workflow:**
  1. Navigate to **Forensic Timeline** (`/frontend/pages/timeline.html`).
  2. The system renders normalized UTC events alongside local Indian Standard Time (IST / UTC+5:30).
  3. Inspect the Modus Operandi (MO) phase filters:
     - `INITIAL_CONTACT`: Phishing SMS, Telegram invitation, spoofed call.
     - `GROOMING`: Task instructions, fake trading dashboard setup.
     - `PAYMENT`: Mule account UPI transfer, RTGS wire.
     - `EXTORTION`: Threat of arrest, forged Supreme Court/CBI warrant.
     - `LAUNDERING`: Crypto off-ramp, cash ATM withdrawal.
  4. Click any event to jump directly to the source evidence and custody certificate.
- **Expected Result:** Clear chronological visualization exposing time gaps and syndicate operational speed.
- **Common Failure Cases:** CDR records with non-standard datetime formats requiring manual date mask entry.
- **Escalation Route:** Lead Intelligence Analyst.

---

### Module 7: Cross-Case Syndicate Resolution & Graph Intelligence
- **Purpose:** Discover hidden links connecting your case to other FIRs across jurisdictions via shared mule infrastructure.
- **Prerequisites:** Completed entity extraction across multiple cases.
- **Workflow:**
  1. Navigate to **Syndicate & Clusters** (`/frontend/pages/graph.html`).
  2. Search for a suspect identifier (Phone, Bank Account, UPI ID, or Domain).
  3. The interactive graph renders node networks: Case nodes (blue), Entities (teal/amber), Syndicate Clusters (purple).
  4. Look for the `MULTI_CASE_LINKAGE` alert badge on entity nodes.
  5. Click a shared entity node to inspect:
     - Linked FIR numbers and police stations across states (e.g. Delhi, Punjab, Maharashtra).
     - Aggregated defrauded amount across the entire syndicate funnel.
     - Central mule cluster coefficient.
- **Expected Result:** Identification of organized crime syndicates operating multi-jurisdiction mule accounts.
- **Common Failure Cases:** Orphan nodes with zero links (indicates novel identifier not yet seen in repository).
- **Escalation Route:** Inter-State Cyber Crime Coordination Centre (I4C) Desk.

---

### Module 8: Legal Matrix Review & BSA Section 63 Dossier Preparation
- **Purpose:** Prepare statutory electronic evidence compliance dossiers under Section 63 of the Bharatiya Sakshya Adhiniyam, 2023.
- **Prerequisites:** Assigned Investigating Officer with completed case evidence intake.
- **Workflow:**
  1. Navigate to **Legal Matrix** (`/frontend/pages/legal.html`).
  2. Review statutory penal provisions mapped to the case (e.g. BNS Section 318(4) Cheating, IT Act Section 66D).
  3. Verify evidence mappings under BSA Section 63 requirements:
     - Electronic Device Details (Make, Model, Serial, Custodian).
     - Cryptographic Hash Ledger (Original Ingestion SHA-256).
     - Operating System and Hashing Software details.
  4. Click **Export BSA § 63 Electronic Dossier**.
  5. Select export format: **Official JSON Archive** or **Formal Certificate PDF Draft**.
- **Expected Result:** Download of complete statutory dossier with digital evidence manifest and IO declaration draft.
- **Common Failure Cases:** Unverified evidence items present in case; missing device serial in evidence metadata.
- **Escalation Route:** Department Legal Advisor / Special Public Prosecutor.

---

### Module 9: Intelligence Report Generation & Secure Archival
- **Purpose:** Generate executive summaries, comprehensive charge-sheet appendices, and syndicate briefing packages.
- **Prerequisites:** `INVESTIGATOR`, `ANALYST`, or `ADMIN` role.
- **Workflow:**
  1. Navigate to **Reports & RBAC** (`/frontend/pages/reports.html`).
  2. Click **Generate Intelligence Report**.
  3. Select Report Template:
     - `INVESTIGATION_COMPLETE`: Full dossier with evidence, entities, graph, and timeline.
     - `INVESTIGATION_SUMMARY`: Executive 3-page summary for senior officers.
     - `EVIDENCE_INTEGRITY`: Chain-of-custody and hash verification ledger.
     - `SYNDICATE_INTELLIGENCE`: Multi-case link analysis and cluster breakdown.
  4. Choose Sections to include and click **Generate**.
  5. The platform compiles the report asynchronously and stores it in the **Report History** table.
  6. Click **Download PDF** or **Download JSON**.
- **Expected Result:** Tamper-evident report issued unique tracking number (e.g. `RPT-2026-613`); logged in audit ledger.
- **Common Failure Cases:** Viewers receive `HTTP 403 Forbidden` if attempting unauthorized report creation.
- **Escalation Route:** Supervising Superintendent of Police (SP).

---

### Module 10: Centralized Audit Trail Inspection & Incident Escalation
- **Purpose:** Monitor all user actions, verify forensic non-repudiation, and audit system integrity.
- **Prerequisites:** `ADMIN` or `INVESTIGATOR` role.
- **Workflow:**
  1. Navigate to **Reports & RBAC** and switch to the **Audit Logs** tab (`/frontend/pages/reports.html#audit`).
  2. Filter by:
     - Time Range (Past 24 Hours, 7 Days, Custom).
     - Action Type (`LOGIN`, `UPLOAD_EVIDENCE`, `EXPORT_DOSSIER`, `GENERATE_REPORT`).
     - Officer Badge Number.
  3. Inspect the record details: Timestamp (UTC), IP Address, Target ID, Outcome (`SUCCESS` / `FAILED` / `BLOCKED`).
  4. Click **Export Audit Log** (CSV or JSON) for independent forensic archival.
  5. If unauthorized actions or anomalous export spikes are detected, trigger immediate account lock.
- **Expected Result:** 100% immutable, searchable activity ledger reflecting every state modification.
- **Common Failure Cases:** Non-admin users cannot export full log slices (restricted to viewing own actions).
- **Escalation Route:** Chief Information Security Officer (CISO) Liaison.

---
*Manual Version: 3.0.0 (Phase 13 Pilot Operations) · Classification: LAW ENFORCEMENT INTERNAL*
