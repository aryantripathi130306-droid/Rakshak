# Rakshak (रक्षक)

> **Forensic Digital Evidence Intake & Cross-Case Syndicate Intelligence Platform**  
> Built for cybercrime cells, forensic investigators, and law enforcement agencies to eliminate AI hallucinations, automate cross-jurisdiction fraud syndicate discovery, and establish statutory cryptographic chain of custody.

---

## 📑 Table of Contents
- [🏛️ System Architecture](#️-system-architecture)
- [🗄️ Entity-Relationship (ER) Diagram & Data Models](#️-entity-relationship-er-diagram--data-models)
  - [1. Chen-Notation ER Diagram](#1-chen-notation-er-diagram)
  - [2. Entity & Relationship Dictionary](#2-entity--relationship-dictionary)
  - [3. Forensic Validation & Regex Standards](#3-forensic-validation--regex-standards)
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

### 1. Chen-Notation ER Diagram

<div align="center">

![Rakshak ER Diagram](./rakshak_er_diagram.svg)

</div>

> **📝 Edit the ER Diagram:** Open [`Rakshak.drawio`](./Rakshak.drawio) in [draw.io](https://app.diagrams.net/) or click the file in GitHub to view/edit it interactively.
> 
> **Viewing options:**
> - **GitHub:** Click on [`Rakshak.drawio`](./Rakshak.drawio) in the repo — GitHub renders it natively!
> - **Local:** Open `Rakshak.drawio` in [draw.io Desktop](https://github.com/jgraph/drawio-desktop/releases) or at [app.diagrams.net](https://app.diagrams.net/)
> - **VS Code:** Install the [Draw.io Integration](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio) extension to edit directly in your editor

---

### 2. Entity & Relationship Dictionary

| Entity | Description | Primary Key | Key Foreign Keys & Cardinality |
| :--- | :--- | :--- | :--- |
| **`User`** | Investigating officers, cyber analysts, and administrators. | `id` (PK) | `1 : N` $\rightarrow$ `Case` (`files`), `1 : N` $\rightarrow$ `AuditLog` (`performs`) |
| **`Case`** | Core cybercrime incident registered in the system. | `id` (PK) | `1 : N` $\rightarrow$ `Evidence` (`has`), `1 : N` $\rightarrow$ `TimelineEvent` (`has`), `1 : N` $\rightarrow$ `AIProcessingJob` (`triggers`) |
| **`Evidence`** | Binary evidence vault items with dual SHA-256 verification. | `id` (PK) | `1 : N` $\rightarrow$ `ExtractedFact` (`extracts`), `1 : N` $\rightarrow$ `TimelineEvent` (`source of`) |
| **`ExtractedFact`** | Discrete forensic extractions with bounding coordinates and provenance hashes. | `id` (PK) | `N : 1` $\rightarrow$ `CaseEntity` (`identifies`), Belongs to `Evidence` (N:1) |
| **`TimelineEvent`** | Reconstructed chronological event milestone across communications and transactions. | `id` (PK) | Sourced from `Evidence` (N:1) & attached to `Case` (N:1) |
| **`AuditLog`** | Immutable forensic access log tracking officer actions and export events. | `id` (PK) | Performed by `User` (N:1) |
| **`AIProcessingJob`** | Async queue tracking background AI OCR, translation, and graph inference workers. | `id` (PK) | Triggered by `Case` (N:1), `1 : N` $\rightarrow$ `Alert` (`generates`) |
| **`Alert`** | Real-time cross-case syndicate match or high-risk mule account notifications. | `id` (PK) | Generated by `AIProcessingJob` (N:1) |
| **`Entity`** | Global canonical repository of unique extracted identifiers across all cases. | `id` (PK) | `1 : N` $\rightarrow$ `CaseEntity` (`linked in`) |
| **`CaseEntity`** | Association connecting an individual Case to specific global Entities. | `id` (PK) | `1 : N` $\rightarrow$ `SyndicateEntity` (`grouped into`), Belongs to `Case` (N:1) & `Entity` (N:1) |
| **`SyndicateEntity`** | Junction linking global entities to syndicate fraud rings. | `id` (PK) | Belongs to `SyndicateCluster` (N:1) and `CaseEntity` (N:1) |
| **`SyndicateCluster`** | Aggregated fraud syndicates / crime rings sharing common financial/telecom infrastructure. | `id` (PK) | `1 : N` $\rightarrow$ `SyndicateEntity` (`contains`) |

---

### 3. Forensic Validation & Regex Standards
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

Open [https://rakshak-six-mu.vercel.app/](https://rakshak-six-mu.vercel.app/) to view the Rakshak Forensic Dashboard.

---

## 📚 Core Documentation References

- 📄 [Product Requirement Document (PRD)](file:///e:/Rakshak/prd.md) — Functional requirements, persona journeys, and scope.
- 🗄️ [Data Requirement Document (DRD)](file:///e:/Rakshak/drd.md) — Database schema specifications and graph topologies.
- 🏛️ [System Architecture](file:///e:/Rakshak/architecture.md) — Technical pipeline and subsystem flow.
- ⚖️ [System Rules & Constraints](file:///e:/Rakshak/rules.md) — Forensic and legal guardrails.
- 🔬 [5 Technical Pillars & Innovations](file:///e:/Rakshak/technical_pillars.md) — Deep dive into the forensic engines.
- 🗺️ [Implementation Roadmap & Phases](file:///e:/Rakshak/phases.md) — Milestone tracking.
