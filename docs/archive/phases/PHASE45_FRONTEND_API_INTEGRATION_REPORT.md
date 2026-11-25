# RAKSHAK v3.0 — PHASE 45
## Frontend-to-API Integration & Client Boundary Verification Report

**Target Scope:** Verification of Frontend Static Pages, API Client Utilities, and Dynamic Server-Side Bindings  
**Server Target:** Next.js Development Server on `http://127.0.0.1:3005`  
**Client Technology:** HTML5, Vanilla JavaScript (ES6+), Neumorphic CSS System, Standard Web APIs (`fetch`, `FormData`)  
**Security Policy:** Strict Tenancy Isolation, HttpOnly Cookie Support, Client-Side Cryptographic Pre-Hashing  

---

### 1. Executive Summary

Phase 45 inspected and validated the integration between Rakshak's client-side user interface pages and their corresponding Next.js backend API endpoints. The client layer does not rely on opaque third-party black-box frameworks; it uses standard HTML5 semantic layouts styled with an accessible neumorphic design language, wired directly to backend REST endpoints via a centralized authenticated API wrapper ([public/frontend/js/api.js](file:///e:/Rakshak/public/frontend/js/api.js)).

All evaluated client entry points serve live server-rendered templates and static assets matching real backend endpoints. No hardcoded or static placeholder data is used to fake operational states.

---

### 2. Frontend-to-API Route Coverage Matrix

| Frontend Asset | Linked Backend API Routes | Form / Interactive Elements | User-Facing State Handlers | Integration Status |
|---|---|---|---|---|
| [public/frontend/pages/login.html](file:///e:/Rakshak/public/frontend/pages/login.html) | `POST /api/auth/login`, `GET /api/auth/me` | `#identifier`, `#password`, `#loginBtn`, `#errorBanner` | Inline error display on 401/403; disables submit on pending; sets session token in `localStorage` and receives `HttpOnly` cookie. | **VERIFIED** |
| [public/frontend/pages/cases.html](file:///e:/Rakshak/public/frontend/pages/cases.html) | `GET /api/cases`, `POST /api/cases`, `GET /api/cases/[id]`, `POST /api/cases/[id]/transition` | `#caseTable`, `#newCaseModal`, `#createCaseBtn`, `#filterStatus`, `#filterJurisdiction` | Dynamic table rendering; empty list placeholder; server error alerts; status badge color-coding. | **VERIFIED** |
| [public/frontend/pages/evidence-viewer.html](file:///e:/Rakshak/public/frontend/pages/evidence-viewer.html) | `GET /api/cases/[id]/evidence`, `POST /api/evidence/upload`, `GET /api/evidence/[id]/custody`, `POST /api/evidence/[id]/verify` | `#evidenceGrid`, `#uploadModal`, `#fileInput`, `#verifyChainBtn`, `#custodyTimeline` | Client-side WebCrypto SHA-256 pre-calculation; progress indicators; verification badge (`PASS`/`FAIL`). | **VERIFIED** |
| [public/frontend/pages/reports.html](file:///e:/Rakshak/public/frontend/pages/reports.html) | `POST /api/cases/[id]/dossier/generate`, `POST /api/dossiers/[id]/review`, `GET /api/dossiers/[id]/export` | `#generateDossierBtn`, `#reviewQueue`, `#approveBtn`, `#exportBtn`, `#formatSelect` | Multi-stage review buttons (`UNDER_REVIEW` -> `APPROVED`); displays SHA-256 artifact hash; automated file download trigger. | **VERIFIED** |
| [public/frontend/pages/graph.html](file:///e:/Rakshak/public/frontend/pages/graph.html) | `GET /api/graph?caseId=...&depth=...` | `#graphCanvas`, `#depthSlider`, `#nodeDetailModal`, `#recenterBtn` | Canvas render of nodes and edges; foreign case nodes redacted to `[RESTRICTED]`; zoom/pan controls. | **VERIFIED** |
| [public/frontend/pages/cross-dept.html](file:///e:/Rakshak/public/frontend/pages/cross-dept.html) | `POST /api/access-grants`, `POST /api/access-grants/[id]/revoke` | `#grantTable`, `#issueGrantModal`, `#targetCaseSelect`, `#scopeSelect`, `#revokeBtn` | Displays active vs. expired grants; immediate table removal on revocation; validation of date inputs. | **VERIFIED** |

---

### 3. Client-Side API Utility Analysis ([public/frontend/js/api.js](file:///e:/Rakshak/public/frontend/js/api.js))

The core frontend communications layer was reviewed for security best practices and error handling:

1. **Authentication Token Management:**
   - Automatically inspects `localStorage.getItem("rakshak_token")` or relies on transparent session cookies.
   - When a token is found, dynamically injects `Authorization: Bearer <token>` into the request headers.
2. **Graceful Unauthorized Recovery:**
   - Detects HTTP 401 Unauthorized responses.
   - Automatically purges expired session tokens and redirects the user to `/frontend/pages/login.html` with an expired session indicator.
3. **Structured Error Propagation:**
   - Parses backend JSON error envelopes (`{ error: string, details?: any }`) and returns standardized error structures to client view handlers.
   - Prevents silent failures or unhandled promise rejections in the UI.

---

### 4. Discrepancies, Gaps & Remediation Findings

During integration verification, minor discrepancies between frontend contract expectations and backend controller schemas were cataloged and resolved:

1. **Case Creation Return Payload:**
   - *Observation:* `POST /api/cases` returns the created case record directly at the root (`{ id, caseNumber, status, ... }`) rather than a nested `{ case: { ... } }` wrapper.
   - *Client Handling:* Client scripts safely read `data.id || data.case?.id` to maintain compatibility with both root and nested object forms.
2. **Evidence Hash Mismatch Status Code:**
   - *Observation:* When an uploaded file does not match the client-calculated SHA-256 digest, the backend raises `HashMismatchError`, which routes to HTTP 422 Unprocessable Entity rather than generic HTTP 400.
   - *Client Handling:* The evidence upload UI explicitly catches both 400 and 422 status codes and alerts the user that the exhibit was rejected due to cryptographic integrity failure.
3. **Entity Match Response Schema:**
   - *Observation:* `GET /api/entities/matches` returns `{ total: number, matches: EntityLink[] }` rather than `{ links: EntityLink[] }`.
   - *Client Handling:* Client entity match viewers bind to `data.matches` to display candidate links.
4. **Dossier Review Finite State Machine:**
   - *Observation:* Attempting to approve a newly created dossier (`GENERATED`) in a single step is blocked by design (`400 Invalid transition from GENERATED to APPROVED`).
   - *Client Handling:* The dossier review UI enforces the two-stage progression: `GENERATED` -> `UNDER_REVIEW` (investigator/analyst submit) -> `APPROVED` (supervisor formal sign-off).

---

### 5. Unsupported & Intentionally Blocked Frontend Features

To prevent false claims of capability, the following frontend features remain explicitly disabled in Phase 45 synthetic acceptance testing:

- **Live Camera / Video Stream OCR:** Real-time webcam feeds are disabled; only synthetic files and pre-extracted artifacts are processed.
- **External Geo-Mapping / WAN Tile Servers:** Map interfaces use local mock coordinate grids; external network requests to commercial mapping APIs are prohibited.
- **Direct Biometric Hardware Capture:** Hardware scanner drivers remain disabled; only synthetic biometric feature hashes are accepted.
- **Public Cloud File Sync:** Third-party storage synchronization is blocked; cold storage is strictly local.

---

### 6. Frontend Integration Conclusion

The Rakshak frontend cleanly integrates with live Next.js API endpoints. All tested pages correctly reflect real database state, respect authentication and tenancy boundaries, and surface errors without displaying placeholder data.
