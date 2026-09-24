# Rakshak (रक्षक)

> **Forensic Digital Evidence Intake & Cross-Case Syndicate Intelligence Platform**  
> Built for cybercrime cells, forensic investigators, and law enforcement agencies to eliminate AI hallucinations, automate cross-jurisdiction fraud syndicate discovery, and establish statutory cryptographic chain of custody.

---

## 📑 Table of Contents
- [🏛️ System Architecture](#️-system-architecture)
- [🗄️ Entity-Relationship (ER) Diagram & Data Models](#️-entity-relationship-er-diagram--data-models)
  - [Visual ER Diagram](#visual-er-diagram)
  - [Entity Dictionary](#entity-dictionary)
  - [Graph & Relational Models](#graph--relational-models)
  - [Validation & Regular Expressions](#validation--regular-expressions)
- [⚖️ System Rules & Forensic Constraints](#️-system-rules--forensic-constraints)
  - [1. Forensic Integrity Rules](#1-forensic-integrity-rules)
  - [2. Legal Boundaries & Guardrails](#2-legal-boundaries--guardrails)
  - [3. Engineering Directives](#3-engineering-directives)
- [🚀 Quick Start & Installation](#-quick-start--installation)
- [📚 Core Documentation References](#-core-documentation-references)

---

## 🏛️ System Architecture

Rakshak implements an immutable, verifiable ingestion pipeline designed to prevent data tampering, ensure deterministic entity extraction, and resolve fraud syndicates in real time.

### Pipeline Flow

```
[Browser / Client]
│
├── 1. Compute Client SHA-256 (Web Crypto API)
├── 2. Decoupled Upload to Storage
▼
[Next.js API Routes / Backend Gateway]
│
├── Ingestion & Verification Worker
│     ├── File Hash Validation Check (Client vs Server Digest)
│     └── Buffer Duplication (Original Immutable vs Working Copy)
│
├── Extraction Engine (Hybrid Pipeline)
│     ├── OCR / Vision Engine (Tesseract.js / Multimodal LLM)
│     ├── Deterministic Regex Filtering (UPI, Phone, Accounts, IFSC)
│     └── Named Entity Structuring (Zod Output Validation)
│
├── Timeline Normalizer Engine
│     └── Multi-format Date-time parsing to ISO-8601 UTC series
│
├── Cross-Case Graph Resolver
│     ├── Query: MATCH (c:Case)-[:HAS]->(e:Entity {value: $val})
│     └── Degree Trigger (>1) ➔ Generate Syndicate Alert Node
│
▼
[SQLite / PostgreSQL Database via Prisma] + [In-Memory Graph Engine / React Flow]
```

### Component Stack
* **Frontend:** Next.js (App Router), Vanilla CSS / Tailwind CSS, Lucide Icons, Custom High-Security Forensic Theme.
* **Graph Visualization:** `@xyflow/react` (React Flow) / Interactive In-Memory Graph Canvas.
* **Security & Ingestion:** Browser Native Web Crypto API (`crypto.subtle.digest`), Node.js `crypto` server verification, Local/S3 cold storage.
* **Extraction:** Hybrid deterministic Regex-first extraction, contextual NER, strictly validated via Zod schemas.
* **Timeline Engine:** Multi-format parser (WhatsApp, Bank SMS, Gateway logs) normalized to ISO-8601 UTC with IST offset correction and Modus Operandi phase mapping.
* **PDF & Dossier Engine:** Automated BSA §63 electronic evidence certificate and audit-ready dossier generator.

---

## 🗄️ Entity-Relationship (ER) Diagram & Data Models

### Visual ER Diagram

```mermaid
erDiagram
    CASE ||--o{ EVIDENCE : "contains"
    CASE ||--o{ TIMELINE_EVENT : "has chronological"
    CASE ||--o{ CASE_ENTITY : "links indexed"
    CASE ||--o{ CLUSTER_MEMBERSHIP : "participates in"
    
    CASE_CLUSTER ||--o{ CLUSTER_MEMBERSHIP : "groups"
    
    EVIDENCE ||--o{ EXTRACTED_FACT : "yields"
    EVIDENCE ||--o{ TIMELINE_EVENT : "sources"
    EVIDENCE ||--o{ TRANSCRIPTION : "produces"
    EVIDENCE ||--o{ CHAT_TRANSLATION : "translates"

    CASE {
        string id PK "UUID"
        string caseNumber UK "e.g., CASE-2026-0891"
        string incidentType "Task_Scam | Digital_Arrest | etc."
        string complainantName "Victim / Complainant"
        string jurisdiction "Police Station / Cell"
        string status "OPEN | UNDER_INQUIRY | CLOSED"
        int amountDefrauded "Loss in INR"
        datetime createdAt
        datetime updatedAt
    }

    EVIDENCE {
        string id PK "UUID"
        string caseId FK "Cascade onDelete"
        string fileName "Original File Name"
        string fileType "PNG | TXT | PDF | MP3"
        string mimeType "MIME Type"
        int fileSize "Bytes"
        string sha256Hash "Canonical Server SHA-256"
        string clientHash "Client WebCrypto SHA-256"
        string storagePath "Immutable /uploads/raw/"
        string evidenceCategory "CHAT | UPI | CALL_LOG | etc."
        string metadata "JSON blob"
        datetime uploadedAt
    }

    EXTRACTED_FACT {
        string id PK "UUID"
        string evidenceId FK "Source Evidence"
        string caseId "Denormalized Case ID"
        string factAssertion "Human-readable assertion"
        string entityType "UPI | PHONE | ACC | IFSC | IP"
        string rawValue "Original Extracted Text"
        string normalizedValue "Canonical Form"
        float confidence "0.0 to 1.0"
        string sourceHash "Provenance SHA-256"
        string verificationStatus "UNVERIFIED | VERIFIED | DISPUTED"
        string verifiedBy "Officer ID"
        string boundingBox "JSON Coordinates"
        datetime extractedAt
    }

    TIMELINE_EVENT {
        string id PK "UUID"
        string caseId FK "Case ID"
        string evidenceId FK "Source Evidence ID"
        datetime timestamp "Normalized UTC Time"
        string description "Event Description"
        string sourceType "WHATSAPP | BANK_SMS | RECEIPT"
        string phase "CONTACT | TRUST | PAYMENT | SEVERED"
        datetime createdAt
    }

    CASE_ENTITY {
        string id PK "UUID"
        string caseId FK "Case ID"
        string entityType "UPI | PHONE | ACCOUNT | DOMAIN"
        string normalizedValue "Canonical Indexed Value"
        string rawValue "Raw Value"
        datetime firstSeenAt
    }

    TRANSCRIPTION {
        string id PK "UUID"
        string evidenceId FK "Source Audio Evidence"
        string originalLanguage "Source Lang (hi)"
        string originalText "Verbatim Text"
        string translatedText "English Translation"
        string targetLanguage "Target Lang (en)"
        int speakerCount "Diarized Speakers"
        string segments "JSON Segment Array"
        string transcriptionMethod "WHISPER_AI"
        float confidence
        datetime createdAt
    }

    CHAT_TRANSLATION {
        string id PK "UUID"
        string evidenceId FK "Source Chat Evidence"
        string originalLanguage "hinglish"
        string messages "JSON ChatMessage[]"
        string translationMethod "INDIC_TRANS_AI"
        datetime createdAt
    }

    CASE_CLUSTER {
        string id PK "UUID"
        string name "Syndicate Identifier"
        string theme "Modus Operandi Theme"
        string status "ACTIVE | ARCHIVED | MERGED"
        string confidence "POTENTIAL | PROBABLE | CONFIRMED"
        string notes "Investigator Notes"
        datetime createdAt
        datetime updatedAt
    }

    CLUSTER_MEMBERSHIP {
        string id PK "UUID"
        string clusterId FK "Cluster ID"
        string caseId FK "Case ID"
        datetime addedAt
        string reason "Matching UPI / Phone Identifier"
    }
```

### Entity Dictionary

| Model | Description | Primary Key | Key Foreign Keys & Cardinality |
| :--- | :--- | :--- | :--- |
| **`Case`** | Core cybercrime incident registered in the system. | `id` (UUID) | Has many `Evidence` (1:N), `TimelineEvent` (1:N), `CaseEntity` (1:N), `ClusterMembership` (1:N) |
| **`Evidence`** | Binary evidence vault item with cryptographic hashes. | `id` (UUID) | Belongs to `Case` (N:1). Has many `ExtractedFact` (1:N), `TimelineEvent` (1:N), `Transcription` (1:N), `ChatTranslation` (1:N) |
| **`ExtractedFact`** | Verified/unverified entity assertions with bounding coordinates. | `id` (UUID) | Belongs to `Evidence` (N:1) |
| **`TimelineEvent`** | Normalized chronologically ordered investigation milestones. | `id` (UUID) | Belongs to `Case` (N:1) and `Evidence` (N:1) |
| **`CaseEntity`** | Unique entity indicator indexed for cross-case matching. | `id` (UUID) | Belongs to `Case` (N:1). Unique index: `(caseId, entityType, normalizedValue)` |
| **`Transcription`** | Speech-to-text diarized transcript for audio evidence. | `id` (UUID) | Belongs to `Evidence` (N:1) |
| **`ChatTranslation`** | Multilingual chat parser and translation record. | `id` (UUID) | Belongs to `Evidence` (N:1) |
| **`CaseCluster`** | Grouping of related cases representing a fraud syndicate. | `id` (UUID) | Has many `ClusterMembership` (1:N) |
| **`ClusterMembership`** | Junction resolving many-to-many relationship between Cases and Clusters. | `id` (UUID) | Belongs to `CaseCluster` (N:1) and `Case` (N:1). Unique: `(clusterId, caseId)` |

### Graph & Relational Models
* **Nodes:** `CaseNode` (`{ id, caseNumber, incidentType }`), `EntityNode` (`{ id, type, value }`), `VictimNode` (`{ id, name, location }`)
* **Edges:**
  * `(CaseNode)-[:HAS_ENTITY]->(EntityNode)`
  * `(VictimNode)-[:FILED]->(CaseNode)`
  * `(EntityNode)-[:LINKED_TO]->(CaseNode)`

### Validation & Regular Expressions
* **UPI VPA:** `^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`
* **Indian Mobile (E.164):** `^(?:\+91|0)?[6-9]\d{9}$`
* **IFSC Code:** `^[A-Z]{4}0[A-Z0-9]{6}$`
* **SHA-256 Digest:** `^[a-fA-F0-9]{64}$`
* **UTR / Transaction Reference:** `\b(?:\d{12}|[A-Z0-9]{12,22})\b`

---

## ⚖️ System Rules & Forensic Constraints

### 1. Forensic Integrity Rules
1. **Immutable Storage:** Original binary files are write-once and never mutated. All format transformations, OCR preprocessing, and waveform analysis operate strictly on in-memory buffers. Original SHA-256 checksums remain identical.
2. **Zero Unanchored Assertions:** The AI engine is prohibited from generating entities or conclusions without a bidirectional link to an uploaded `evidence_id` and bounding box / offset. Unanchored hallucinated claims are dropped.

### 2. Legal Boundaries & Guardrails
1. **Investigative Intelligence Tool:** The platform does not claim to convict or automate judicial sentencing.
2. **Qualified Language:** All outputs use qualified evidentiary terms such as *"Potential Syndicate Match Detected"* or *"High-Risk Common Identifier"* rather than unverified definitive assertions.
3. **Statutory Admissibility (BSA §63):** Produces automated electronic record certificates meeting Section 63 of Bharatiya Sakshya Adhiniyam (BSA) standards.

### 3. Engineering Directives
1. **Deterministic Cross-Case Matching:** Pre-seeded with realistic fraud patterns (`badguy@okicici`, `+919876543210`) so demo uploads immediately link to multi-jurisdiction clusters.
2. **High-Performance Resolution:** Graph resolution operates in-memory for instant $<5$ second multi-file analysis.

---

## 🚀 Quick Start & Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize Database & Seed
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
```

### 3. Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the Rakshak Forensic Dashboard.

---

## 📚 Core Documentation References

- 📄 [Product Requirement Document (PRD)](file:///e:/Rakshak/prd.md) — Functional requirements, persona journeys, and scope.
- 🗄️ [Data Requirement Document (DRD)](file:///e:/Rakshak/drd.md) — Database schema specifications and graph topologies.
- 🏛️ [System Architecture](file:///e:/Rakshak/architecture.md) — Technical pipeline and subsystem flow.
- ⚖️ [System Rules & Constraints](file:///e:/Rakshak/rules.md) — Forensic and legal guardrails.
- 🔬 [5 Technical Pillars & Innovations](file:///e:/Rakshak/technical_pillars.md) — Deep dive into the forensic engines.
- 🗺️ [Implementation Roadmap & Phases](file:///e:/Rakshak/phases.md) — Milestone tracking.
