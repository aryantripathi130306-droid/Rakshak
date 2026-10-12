# RAKSHAK v3.0 — INVESTIGATOR USER GUIDE
## Forensic Digital Evidence Intake & Cross-Case Syndicate Intelligence Platform

**Target Audience**: Authorized Law-Enforcement Investigators, CID Officers, Cybercrime Analysts  
**Operational Environment**: Controlled Synthetic-Data Staging Sandbox  
**Classification**: OFFICIAL — POLICE PROCEDURAL USE ONLY  

---

> [!IMPORTANT]
> **SYNTHETIC PILOT USE ONLY**  
> This environment operates exclusively with synthetic investigation records. Real citizen FIRs, actual suspect PII, and unredacted citizen financial data must NOT be ingested into this system.

---

## 1. AUTHENTICATION & SESSION MANAGEMENT

### 1.1 Accessing the Platform
1. Open your designated web browser (Chrome, Chromium, Firefox, or Edge).
2. Navigate to the Rakshak staging URL: `http://localhost:3000/frontend/pages/dashboard.html`.
3. If no active session exists, you will be prompted to authenticate with your official credentials.

### 1.2 User Roles & Permissions
Rakshak enforces strict Role-Based Access Control (RBAC):
- **ADMIN** (e.g., ACP Vikram Singh): Complete platform authority, user management, full audit inspection, case registration, evidence intake, and legal certification.
- **INVESTIGATOR** (e.g., Inspector Priya Sharma): Case management, evidence upload, OCR triggering, syndicate analysis, timeline creation, and report compilation.
- **VIEWER** (e.g., Officer Meera Joshi): Read-only dossier inspection, evidence preview, and timeline viewing. Restricted from creating cases, uploading files, or downloading raw evidence.

### 1.3 Session Security & Logout
- Sessions use cryptographic tokens transmitted via secure `HttpOnly; SameSite=Lax` cookies.
- To safely terminate your workstation session, click the **Logout** button located at the bottom of the navigation sidebar or top-right profile menu.

---

## 2. NAVIGATION & WORKSPACE OVERVIEW

The Rakshak interface consists of a collapsible navigation sidebar, live telemetry header, and dedicated module workspaces:

| Module Icon | Workspace | Navigation Path | Primary Investigator Purpose |
|---|---|---|---|
| 📊 | **Dashboard** | `/frontend/pages/dashboard.html` | High-level metrics, active syndicate alerts, and recent activities. |
| 📁 | **Cases** | `/frontend/pages/cases.html` | Master case registry, search, filters, and new case registration. |
| 📋 | **Case Detail** | `/frontend/pages/case-detail.html?id=<num>` | Comprehensive case dossier, linked evidence, timeline, and legal matrix. |
| 🗄️ | **Evidence Vault** | `/frontend/pages/index.html` | Forensic file repository, dual-hash upload gateway, and custody records. |
| 👁️ | **Evidence Viewer** | `/frontend/pages/evidence-viewer.html?id=<id>` | Visual evidence inspection, bounding box OCR annotations, and source facts. |
| 🏷️ | **Entity Intelligence** | `/frontend/pages/entities.html` | Cross-case entity directory (UPIs, Bank Accounts, Phone Numbers, Mule Names). |
| 🕸️ | **Syndicate Graph** | `/frontend/pages/graph.html` | Interactive React-Flow network diagram showing cross-jurisdiction crime links. |
| ⏱️ | **Timeline** | `/frontend/pages/timeline.html` | Chronological event sequencing with UTC/IST normalization and MO stages. |
| ⚖️ | **Legal Matrix** | `/frontend/pages/legal.html` | BSA § 63 compliance checklist, evidence mapping, and certificate generator. |
| 💬 | **Communications** | `/frontend/pages/comms.html` | Suspect communication transcripts, WhatsApp logs, and call records. |
| 📑 | **Reports** | `/frontend/pages/reports.html` | Intelligence report compilation, PDF/JSON generation, and automated schedules. |
| 🛡️ | **Pilot Readiness** | `/frontend/pages/pilot-readiness.html` | Operational health telemetry, training curriculum, and system verification status. |

---

## 3. CASE REGISTRATION & DOSSIER MANAGEMENT

### 3.1 Searching and Filtering Cases
- **Full-Text Search**: Enter case numbers (`CASE-2026-0891`), victim names, FIR numbers, or keywords in the search bar.
- **Status Filtering**: Filter by `OPEN`, `UNDER_INQUIRY`, `CHARGESHEETED`, or `CLOSED`.
- **Incident Categorization**: Select cybercrime categories:
  - `Task_Scam` (Work-from-home Telegram/WhatsApp fraudulent tasks)
  - `Digital_Arrest` (Impersonation of CBI/Customs/Police via video call)
  - `Investment_Fraud` (Fake crypto/stock trading platforms)
  - `KYC_Freeze` (Bank account suspension and credential phishing)
  - `Romance_Scam` (Dating app deception and gift-fee extortion)

### 3.2 Registering a New Investigation Dossier
1. Navigate to **Cases** (`cases.html`).
2. Click **+ Register Case** in the top action bar.
3. Complete the mandatory fields:
   - **Complainant Name**: Citizen or reporting victim name.
   - **Incident Type**: Select appropriate typology from dropdown.
   - **Jurisdiction**: Police station / cyber cell handling the matter.
   - **Defrauded Amount (INR)**: Approximate reported loss in Indian Rupees.
   - **Assigned Investigating Officer**: Officer badge and name.
   - **Narrative / Incident Summary**: Brief summary of modus operandi.
4. Click **Register Case**. The system assigns a unique, sequential case number (e.g. `CASE-2026-7835`).

---

## 4. FORENSIC EVIDENCE INTAKE & HASH INTEGRITY

### 4.1 Ingestion Gateway
1. Navigate to **Evidence Vault** (`index.html`) or the **Evidence** tab within a Case Detail view.
2. Click **+ Ingest Evidence**.
3. Select the target **Case Dossier**.
4. Choose the **Evidence Category** (`UPI_FINANCIAL`, `DOCUMENT`, `CHAT`, `CALL_LOG`, `CRIME_SCENE_PHOTO`, `OTHER`).
5. Select the forensic exhibit file from your workstation.

### 4.2 Client/Server Dual SHA-256 Verification
- Before the file transmits, Rakshak computes its **SHA-256 cryptographic digest** locally in your browser using the Web Crypto API.
- The raw byte stream and client hash are submitted to `/api/evidence/upload`.
- The server independently computes the SHA-256 digest on the received buffer.
- **Integrity Invariant**:
  - If both hashes match: The file is saved as an immutable content-addressed binary (`/uploads/raw/<hash>.bin`) and recorded with status `VERIFIED`.
  - If any byte was altered in transit: The server rejects the upload immediately with HTTP 422 `INTEGRITY_VIOLATION`. The corrupted file is never stored.

### 4.3 Downloading & Chain-of-Custody Tracking
- Every download operation is recorded in the tamper-evident `CustodyEvent` ledger with timestamp, downloading officer ID, IP address, and purpose.
- Unauthorized users or revoked sessions attempting evidence downloads are blocked with HTTP 401/403.

---

## 5. OCR & SOURCE PROVENANCE ANCHORING

1. Open any ingested document or image in the **Evidence Viewer** (`evidence-viewer.html?id=<evidenceId>`).
2. The viewer executes or displays pre-extracted text using Rakshak's on-premises OCR pipeline.
3. **Bounding Box Anchoring**: Hover over detected entities (UPI IDs, bank IFSC codes, mobile numbers) to see exact bounding box coordinates on the original image.
4. **Source Hash Provenance**: Every extracted fact retains an immutable link (`sourceHash`) to the exact SHA-256 hash of the originating evidence binary.

---

## 6. CROSS-CASE SYNDICATE INTELLIGENCE

1. Navigate to **Syndicate Graph** (`graph.html`).
2. The interactive force-directed graph automatically correlates entities appearing across multiple FIRs:
   - **Blue Nodes**: Independent Case Dossiers.
   - **Teal / Yellow Nodes**: Extracted Mule Accounts, UPI IDs, Phone Numbers.
   - **Purple Clusters**: Identified Coordinated Syndicates.
3. Click any entity node to inspect:
   - Multi-case linkage count.
   - Risk score (0–100) and flags (e.g. `HIGH_FREQUENCY_MULE`).
   - Combined defrauded amounts across all linked jurisdictions.

---

## 7. BSA SECTION 63 DOSSIER EXPORT & REPORTING

### 7.1 Statutory BSA Section 63 Electronic Evidence Certificate
Under Section 63 of the Bharatiya Sakshya Adhiniyam, 2023 (formerly § 65B of Indian Evidence Act), electronic evidence must be accompanied by an integrity certificate.
1. Navigate to the case dossier in **Case Detail** (`case-detail.html?id=<num>`).
2. Open the **Legal Matrix** tab.
3. Review statutory provisions (BSA § 63, IT Act § 43/66D, BNS § 318).
4. Click **Export BSA § 63 Dossier**.
5. The system generates a signed, cryptographic compliance package containing:
   - Exact hash manifest of all exhibits.
   - Timestamp and officer attribution.
   - Statutory certificate ready for judicial submission.

### 7.2 Intelligence Reports
1. Navigate to **Reports** (`reports.html`).
2. Click **+ Generate Report**.
3. Choose template (`INVESTIGATION_COMPLETE`, `INTERIM_UPDATE`, or `SYNDICATE_BRIEF`).
4. Select desired output format (`PDF` or `JSON`).
5. Download the cryptographically hashed report artifact.

---

## 8. PILOT FEEDBACK & DEFECT REPORTING

1. If you encounter an unexpected UI behavior, error message, or workflow gap, navigate to **Pilot Readiness** (`pilot-readiness.html`).
2. Open the **Submit Feedback** form.
3. Select Severity: `CRITICAL` (Blocks investigation), `HIGH`, `MEDIUM`, or `LOW`.
4. Provide a descriptive summary and reproducing steps.
5. Your ticket will be logged in the tamper-evident audit ledger and tracked by the engineering lead.
