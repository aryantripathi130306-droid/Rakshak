# RAKSHAK v3.0 — STANDARD OPERATING PROCEDURES (SOP)
**Controlled Pilot Operations, Evidence Handling & Incident Response**  
**Document Identifier:** `SOP-RAKSHAK-PLT-v3.0`  
**Classification:** `LAW ENFORCEMENT INTERNAL / PILOT EVALUATION ONLY`  
**Effective Date:** `11 October 2026`  
**Permitted Operational Scope:** `SYNTHETIC INVESTIGATIVE DATA ONLY`  

> [!CAUTION]
> **PRIMARY EVIDENCE IMMUTABILITY RULE:**
> Under no circumstances shall an operator or investigator modify, rename, or delete original files within cold evidence storage (`uploads/raw/<sha256>.bin`) while troubleshooting. All corrective workflows must preserve the content-addressed immutable repository.

---

## SOP-01: Evidence Intake & Dual-Hash Verification Protocol
- **Trigger / Condition:** Ingestion of electronic evidence artifact (PDF, image, audio, financial CSV/statement).
- **Responsible Role:** Investigating Officer (IO) / Digital Forensics Technician.
- **Immediate Action:**
  1. Verify the active case number and assign the appropriate evidence category (`UPI_FINANCIAL`, `CHAT`, `CRIME_SCENE_PHOTO`, etc.).
  2. The client workstation calculates the 256-bit SHA-256 digest prior to transmission.
  3. Upload the artifact through the Evidence Vault interface (`/frontend/pages/index.html`).
  4. The server recalculates the digest byte-for-byte upon receipt and compares it with the client-supplied hash.
  5. Confirm that the status indicator reflects `VERIFIED` and the file is assigned an immutable path `uploads/raw/<sha256>.bin`.
- **Evidence & Logging Required:**
  - Automated `AuditLog` entry (`action: "UPLOAD_EVIDENCE"`, officer badge, IP address, file size, SHA-256 digest).
  - Initial `CustodyEvent` generated with `IN_CUSTODY` state and verifying officer badge.
- **Escalation Path:** If upload times out (> 30s) or gateway returns `504 Gateway Timeout`, escalate to `[DEVOPS_LEAD_PLACEHOLDER]` and check network bandwidth.
- **Recovery / Closure Criteria:** Evidence displays with matching SHA-256 digest in Evidence Vault and is queryable across analysis modules.

---

## SOP-02: Hash Mismatch & Suspected Evidence Tampering Response
- **Trigger / Condition:** Upload returns `HTTP 422 INTEGRITY_VIOLATION` ("Hash mismatch during transit").
- **Responsible Role:** Investigating Officer & Lead Forensic Reviewer.
- **Immediate Action:**
  1. **DO NOT** attempt repeated unverified uploads of the corrupted file.
  2. Inspect the local file on the investigator workstation: re-run standalone hashing using OS utility (`certutil -hashfile <path> SHA256` or `sha256sum <path>`).
  3. Verify whether network transmission corruption, proxy payload truncation, or active proxy interference occurred.
  4. If hash mismatch persists across multiple network retries, quarantine the source storage media (USB drive, forensic image).
  5. Check workstation for malware or unauthorized file tampering.
- **Evidence & Logging Required:**
  - Server automatically logs `INTEGRITY_VIOLATION` in `AuditLog` with client hash vs. computed server hash.
  - Officer must file an incident memo recording the artifact name, source device serial number, and observed hash delta.
- **Escalation Path:** Escalate to `[FORENSIC_LEAD_PLACEHOLDER]` and `[APPLICATION_SECURITY_OFFICER_PLACEHOLDER]`.
- **Recovery / Closure Criteria:** Re-acquire clean bit-stream forensic image from write-blocked source media and re-ingest with verified matching digest.

---

## SOP-03: Failed or Interrupted Evidence Processing (OCR / Extraction)
- **Trigger / Condition:** Evidence uploaded successfully, but OCR processing status displays `FAILED` or entity extraction yields zero entities on text-dense documents.
- **Responsible Role:** Forensic Analyst / Case IO.
- **Immediate Action:**
  1. Open the Evidence Detail page (`/frontend/pages/evidence-viewer.html?id=<id>`).
  2. Check the extraction telemetry modal: inspect OCR engine (`PDF_PARSE_V1` or `TESSERACT_V5`), confidence score, and error text.
  3. If failure was due to timeout or scan skew, click **Re-run Extraction**.
  4. For multi-page PDFs exceeding memory bounds, verify page count (recommended limit: ≤ 50 pages per batch).
- **Evidence & Logging Required:**
  - Server logs `OCR_EXTRACTION` in `AuditLog` with result `FAILED` and error metadata.
- **Escalation Path:** Escalate to `[PLATFORM_MAINTENANCE_ENGINEER_PLACEHOLDER]`.
- **Recovery / Closure Criteria:** Extraction completes with status `SUCCESS` and source-anchored entities appear in the Entity Analysis table.

---

## SOP-04: Unauthorized Access Attempt & Credential Revocation
- **Trigger / Condition:** Multiple failed login attempts (5+ consecutive), suspicious IP origin, or notification of compromised officer credentials.
- **Responsible Role:** System Administrator / Department Pilot Owner (`DL-002`).
- **Immediate Action:**
  1. Access the Officer Access Control panel (`/frontend/pages/reports.html#officers`).
  2. Locate the affected officer record and click **Deactivate Officer**.
  3. Deactivation immediately invalidates all active sessions in `OfficerSession` table and sets officer status to `DEACTIVATED`.
  4. API calls using the revoked token are immediately blocked with `HTTP 403 Forbidden`.
- **Evidence & Logging Required:**
  - `AuditLog` records `DEACTIVATE_OFFICER` with executing admin badge and target badge.
  - Export audit log slice for the past 24 hours for security review.
- **Escalation Path:** Escalate to `[CISO_REPRESENTATIVE_PLACEHOLDER]` and Cyber Crime Vigilance Cell.
- **Recovery / Closure Criteria:** Officer identity re-verified in person; new cryptographically random password issued; account reactivated by Admin.

---

## SOP-05: Report or BSA § 63 Dossier Export Failure Handling
- **Trigger / Condition:** Intelligence report generation fails (`HTTP 500`) or PDF download stream returns empty/corrupted document.
- **Responsible Role:** Investigating Officer / Administrative Lead.
- **Immediate Action:**
  1. Check browser console and server application log for `jsPDF` or canvas memory allocation errors.
  2. For large cases with > 50 evidence items, generate report in **JSON format** first to verify data completeness.
  3. If generating Section 63 Dossier, verify that all included evidence items possess valid SHA-256 entries in the database.
- **Evidence & Logging Required:**
  - Audit log captures `GENERATE_REPORT` failure event.
- **Escalation Path:** Submit ticket via Pilot Feedback Tracker (`/frontend/pages/pilot-readiness.html#feedback`) with case number and report type.
- **Recovery / Closure Criteria:** Report record created with status `COMPLETED` and valid downloadable PDF/JSON archive.

---

## SOP-06: Database & Evidence Cold Storage Disaster Recovery
- **Trigger / Condition:** Local database corruption, file system volume detachment, or accidental server fault.
- **Responsible Role:** Operations Lead / DevOps Architect.
- **Immediate Action:**
  1. Stop application server process: `pm2 stop rakshak-staging` (or terminate dev task).
  2. Locate the most recent validated snapshot directory in `backups/snapshots/`.
  3. Verify the snapshot manifest integrity signature:
     ```bash
     node scripts/restore_evidence_db.mjs
     ```
  4. Ensure isolated restore succeeds in sandbox `temp_restore_verify/` with 100% hash reconciliation.
  5. Replace active `prisma/dev.db` with validated snapshot `database/dev.db`.
  6. Reconcile `uploads/raw/` with snapshot `evidence_raw/`.
  7. Start application server and run smoke verification: `node scripts/test_phase11_staging_smoke.mjs`.
- **Evidence & Logging Required:**
  - Full restore log and hash reconciliation report saved to `backups/restore_verification_<timestamp>.log`.
- **Escalation Path:** Escalate to `[DEPARTMENT_INFRASTRUCTURE_DIRECTOR_PLACEHOLDER]`.
- **Recovery / Closure Criteria:** `/api/health` returns `HEALTHY` and case/evidence counts match snapshot manifest exactly.

---

## SOP-07: Service Outage, Crash Recovery & Data Reconciliation
- **Trigger / Condition:** Platform process terminates unexpectedly or HTTP requests fail with connection refused.
- **Responsible Role:** DevOps On-Call / Systems Engineer.
- **Immediate Action:**
  1. Inspect process termination reason in application error logs.
  2. Verify system resources (RAM, disk space in `uploads/` volume).
  3. Restart platform using supervisor: `npm run dev` or `pm2 restart rakshak-staging`.
  4. Query operational monitor: `curl -s http://localhost:3000/api/health`.
  5. Check database integrity using SQLite PRAGMA checks: `PRAGMA integrity_check;`.
- **Evidence & Logging Required:**
  - Record system uptime, crash timestamp, error stack trace, and restart latency in ops log.
- **Escalation Path:** Escalate to `[RELEASE_ENGINEERING_LEAD_PLACEHOLDER]`.
- **Recovery / Closure Criteria:** Zero active error logs, process stable for > 15 minutes, health check latency < 10ms.

---

## SOP-08: Suspected Data Disclosure & Incident Containment
- **Trigger / Condition:** Unintended dissemination of case intelligence, unauthorized network query, or suspicion of export leak.
- **Responsible Role:** Application Security Officer & Pilot Owner (`ACP Vikram Singh`).
- **Immediate Action:**
  1. **IMMEDIATE CONTAINMENT:** Re-evaluate firewall rules; sever staging network connectivity to prevent external exfiltration.
  2. Enforce strict auth mode: verify `STRICT_AUTH=true` in `.env`.
  3. Export tamper-evident audit logs:
     ```bash
     curl -H "Cookie: rakshak_session=..." "http://localhost:3000/api/audit/export?format=json" > audit_forensic_dump.json
     ```
  4. Filter audit logs by `action: "EXPORT_DOSSIER"` and `action: "DOWNLOAD_REPORT"` to identify exporting badge and timestamp.
  5. Review network egress logs for destination IP addresses.
- **Evidence & Logging Required:**
  - Signed audit log export snapshot and session history dump.
- **Escalation Path:** Immediate escalation to `[CISO_REPRESENTATIVE_PLACEHOLDER]` and Departmental Vigilance Directorate.
- **Recovery / Closure Criteria:** Vulnerable access point neutralized; unauthorized session tokens revoked; formal forensic audit completed.

---

## SOP-09: Pilot Defect Reporting & Severity Escalation Workflow
- **Trigger / Condition:** Encountering a bug, unexpected UI behavior, or incorrect entity extraction during pilot usage.
- **Responsible Role:** All Authorized Pilot Testers.
- **Immediate Action:**
  1. Navigate to the **Pilot Readiness & Operations Portal** (`/frontend/pages/pilot-readiness.html`).
  2. Select the **Feedback & Defect Tracker** tab.
  3. Click **Submit Pilot Feedback / Defect**.
  4. Fill out the structured form:
     - Title, Module, Severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
     - Clear reproduction steps, expected behavior, actual behavior.
     - **DO NOT include real personal data, passwords, or credentials in descriptions.**
  5. Click **Submit**. Server assigns a tracking number (e.g. `FDB-2026-001`).
- **Evidence & Logging Required:**
  - Item persisted in database; `AuditLog` records `FEEDBACK_SUBMITTED`.
- **Escalation Path:**
  - `CRITICAL` (blocks testing/integrity issue): Immediate notification to QA Lead within 2 hours.
  - `HIGH`: Triaged within 24 hours.
  - `MEDIUM` / `LOW`: Reviewed in weekly sprint triage.
- **Recovery / Closure Criteria:** Fix deployed to staging; QA lead verifies fix and updates ticket status to `RESOLVED` / `CLOSED`.

---

## SOP-10: Controlled Pilot Decommissioning & Synthetic Data Sanitization
- **Trigger / Condition:** Conclusion of pilot evaluation period or transition to production infrastructure.
- **Responsible Role:** Department Pilot Owner & Operations Lead.
- **Immediate Action:**
  1. Execute final automated backup snapshot: `node scripts/backup_evidence_db.mjs`.
  2. Archive all synthetic test dossiers, report histories, and feedback tickets.
  3. Verify that zero real investigative records were ingested during the pilot period.
  4. Run SQLite sanitization scripts or prepare fresh production PostgreSQL cluster using `prisma/schema.postgresql.prisma`.
  5. Revoke all pilot test credentials and generate unique production credentials for authorized deployment officers.
- **Evidence & Logging Required:**
  - Final Pilot Acceptance Sign-off Certificate signed by all 4 authorities (`PILOT_ACCEPTANCE_CHECKLIST.md`).
- **Escalation Path:** Formal handover to `[PRODUCTION_OPERATIONS_DIRECTOR_PLACEHOLDER]`.
- **Recovery / Closure Criteria:** All pilot artifacts securely archived; production gates approved; formal release certificate executed.

---
*Document Version: 3.0.0 (Phase 13 Pilot Operations) · Classification: LAW ENFORCEMENT INTERNAL*
