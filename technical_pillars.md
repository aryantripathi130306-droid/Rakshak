# Technical Architecture & Core Forensic Pillars — Rakshak

This document outlines the 5 core technical innovations and forensic architecture systems implemented in Rakshak:

---

### 1. Client-Side Cryptographic Hashing & Forensic Isolation

* **Deterministic Integrity (SHA-256):**
  Before any file is transmitted to the server or processed by an LLM, the browser calculates its cryptographic hash via the Web Crypto API (`crypto.subtle.digest('SHA-256')`).
* **Air-Gapped Processing Copy:**
  The original binary blob is stored immutably in read-only cold storage alongside its upload timestamp, mime-type, and checksum (`/uploads/raw/${serverHash}.bin`). All downstream OCR, text extraction, and model prompts operate exclusively on decoupled worker copies, preventing accidental metadata or pixel tampering.
* **Tamper-Evident Audit Log:**
  Generates an immutable, append-only verification manifest containing file origin hashes, making evidence audit-ready and aligned with statutory electronic evidence requirements (e.g., Bharatiya Sakshya Adhiniyam — BSA §63).

---

### 2. Deterministic Entity Extraction with Multi-Engine Validation

* **Hybrid Extraction Pipeline:**
  Avoids pure LLM extraction for critical identifiers. Employs strict RegEx, Named Entity Recognition (NER), and contextual regex routines to parse:
  * **Financial Identifiers:** UPI VPAs (e.g., `[\w.-]+@[\w.-]+`), IFSC codes (`^[A-Z]{4}0[A-Z0-9]{6}$`), Bank Account Numbers, and UTR/Transaction reference IDs.
  * **Communication & Network Artifacts:** E.164 phone formats (`+91[6-9]\d{9}`), Telegram usernames/chat IDs (`@username`), suspect URLs/domains, and APK package identifiers.
* **Schema-Constrained Ingestion:**
  Extracted tokens are forced through a structured validation schema (Zod `ExtractedPayloadSchema`) to eliminate invalid data types before entering the database.

---

### 3. Bidirectional Source-Traceability Architecture (Zero-Hallucination Guard)

* **Ground-Truth Fact Mapping:**
  Rather than generating an unanchored text summary, every extracted statement is indexed as a discrete fact object:
  ```json
  {
    "fact_id": "F-204",
    "assertion": "₹19,999 transferred to suspect@upi",
    "source_evidence_id": "EV-1024",
    "source_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "bounding_box": [120, 450, 600, 520],
    "extraction_confidence": 0.99
  }
  ```
* **One-Click Reverse Lookup:**
  The UI binds each claim in the final dossier directly to the coordinate location or document segment of the original evidence file in the Evidence Inspector drawer, allowing investigators to visually verify assertions instantly.

---

### 4. Real-Time Cross-Case Entity Graph Engine

* **Graph-Based Multi-Tenancy Linking:**
  Uses a graph data model with dual-node topologies: `CaseNode`, `VictimNode`, and `EntityNode` (UPI, Phone, Account, Domain).
* **Automated Node Resolution:**
  $$\text{Degree}(\text{EntityNode}) > 1 \implies \text{Syndicate Trigger}$$
  The moment an entity node matches an existing record in the graph, it computes shortest paths and clustering coefficients across jurisdictions.
* **Syndicate Clustered Alerts:**
  Instantly surfaces sub-graphs linking seemingly isolated complaints to common money-mule clusters without requiring manual cross-station database queries.

---

### 5. Chronological Event-State Normalization Engine

* **Multi-Format Timestamp Alignment:**
  Parses heterogeneous temporal evidence (WhatsApp 12-hour timestamps, banking UTC logs, SMS gateway formats, EXIF metadata) and maps them into an ISO-8601 standardized temporal queue with IST (`UTC+5:30`) offset correction.
* **State Transition Trajectory:**
  Classifies events into programmatic crime states:
  $$\text{Contact\_Initiated} \longrightarrow \text{Trust\_Building} \longrightarrow \text{Initial\_Payout} \longrightarrow \text{High\_Value\_Demand} \longrightarrow \text{Communication\_Severed}$$
  Maps the temporal sequence directly against known Modus Operandi (MO) fraud vector signatures for automated incident classification.
