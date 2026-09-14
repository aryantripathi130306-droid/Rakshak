# NyayaSetu (न्यायसेतु) - Project Health & Audit Report

## 1. Project Overview: What is being built?

**NyayaSetu** is a "Forensic Digital Evidence Intake & Cross-Case Syndicate Intelligence Platform" tailored for cybercrime cells, forensic investigators, and law enforcement agencies. 

At its core, the platform is designed to:
- **Ingest Digital Evidence:** Take unstructured evidence from victims (like WhatsApp chats, UPI receipts, call logs).
- **Establish Chain of Custody:** Compute cryptographic hashes (SHA-256) of uploaded files directly in the browser (client-side) and verify them on the server, ensuring evidence remains immutable and legally sound.
- **Extract Forensic Entities:** Deterministically extract key identifiers like UPI IDs, Phone Numbers, Bank Accounts, and IFSC codes from the evidence.
- **Cross-Case Intelligence Graph:** Automatically map these entities in an in-memory graph to find links between disparate cases, identifying hidden fraud syndicates.
- **Generate Legal Dossiers:** Export structured, audit-ready PDF reports that align with legal standards (like BSA §63 electronic evidence certificates).

The tech stack uses Next.js (App Router), Prisma (SQLite/PostgreSQL), Tailwind CSS, and React Flow for graph visualization.

---

## 2. Issues

1. **Extraction Worker Limitations:** The extraction process relies heavily on a `bufferToText` and deterministic Regex matching. As noted in the architecture, an OCR / Vision Engine (like Tesseract.js or Multimodal LLMs) is planned but currently appears to lack robust full-scale implementation in the API routes. 
2. **Synchronous/Blocking Potential in Workers:** The `runExtractionWorker` in `/api/evidence/upload/route.ts` is called asynchronously (fire-and-forget), which prevents blocking the upload response, but heavy CPU-bound regex or OCR tasks on the Node.js event loop could still degrade server performance under high load.
3. **Database Concurrency:** In the extraction worker, `upsert` is wrapped in a `.catch()` to ignore unique constraint violations on concurrent uploads. This is a fragile way to handle concurrency and might lead to missed entity mappings under high volume.
4. **Local Storage Scalability:** Evidence files are stored locally in `/uploads/raw/`. While fine for a hackathon/demo, this will not scale for production use and lacks the redundancy of object storage like AWS S3.

---

## 3. Unimplemented Features

1. **Full OCR & Multimodal LLM Extraction:** The architectural plan lists Tesseract.js and Multimodal LLMs for extracting text from images, but the current dependencies do not reflect robust OCR capabilities.
2. **Advanced Timeline Generation:** While the timeline UI exists, the automated, reliable extraction of multi-format ISO-8601 timestamps from diverse sources (EXIF, WhatsApp headers) into the normalized timeline is partially implemented or relies on mock data.
3. **Authentication & Authorization:** The platform lacks a role-based access control (RBAC) system for isolating citizen portals from investigator views.
4. **Cloud Storage Integration:** Migration from local file system (`fs/promises`) to cloud-native storage (e.g., AWS S3, Google Cloud Storage) is required for production.

---

## 4. Upcoming Features

1. **Automated Syndicate Alerting:** Enhancing the real-time syndicate alert system to notify officers instantly when a new piece of evidence matches an existing fraud network.
2. **Production Database Migration:** Moving from SQLite to PostgreSQL for robust concurrent handling and scaling.
3. **Dossier PDF Generation:** Full implementation of the "Single-Click PDF Dossier Export" utilizing the `jspdf` and `html2canvas` packages defined in `package.json`.
4. **Enhanced Legal Compliance Guardrails:** Strict programmatic enforcement to ensure the AI output uses qualified language (e.g., "Potential Match" instead of "Confirmed Guilt").

---

## 5. Vulnerabilities

1. **Denial of Service (DoS) via Unrestricted Uploads:** The file upload endpoint (`/api/evidence/upload/route.ts`) allows up to 50MB files but lacks rate limiting. Malicious users could easily exhaust the server's disk space (`/uploads/raw/`) or CPU (via the extraction worker).
2. **Lack of Authentication:** API endpoints currently do not appear to enforce authentication, meaning anyone could potentially upload evidence or query case data if deployed publicly.
3. **Regex Denial of Service (ReDoS):** The deterministic extraction engine relies on Regex to parse large text buffers. If the Regex patterns are not carefully crafted, a specially formulated malicious file could cause catastrophic backtracking and crash the Node.js event loop.

---

## 6. Security Issues

1. **Path Traversal / Arbitrary File Write:** While the SHA-256 hash is validated to be a 64-char hex string, any weakness in filename generation could lead to path traversal. Currently, the storage path is generated via `path.join(UPLOAD_DIR, ${serverHash}.bin)`, which is safe due to the hex validation, but should be closely monitored if filename structures change.
2. **Insufficient Input Sanitization on Case IDs:** The upload route checks if the `caseId` exists, but does not sanitize the input aggressively before querying the database, relying entirely on Prisma's parameterized queries. While Prisma protects against SQL injection, business-logic bypasses might occur.
3. **Unencrypted Local Storage at Rest:** Files are written in plain `.bin` format on the local disk. In a production forensics environment, files at rest must be encrypted (e.g., using AES-256) to prevent unauthorized local access.
4. **No CORS or CSRF Protection:** If the Next.js API routes are exposed, the lack of explicit CSRF protection on mutation endpoints (like file uploads) could allow cross-site request forgery attacks.
