# Product Requirement Document (PRD) — Rakshak

## 1. Executive Overview
Rakshak is an AI-assisted digital evidence intake and cross-case intelligence platform. It ingests unstructured consumer cybercrime complaints (WhatsApp chats, UPI receipts, call logs), establishes cryptographic chain of custody, extracts forensic entities with source-traceability, and discovers cross-jurisdiction fraud syndicates using an automated entity graph.

## 2. Target Personas
1. **The Victim (Citizen):** Non-technical person under acute distress; requires natural language reporting without technical/legal jargon.
2. **The Investigating Officer (Cyber Cell):** Overburdened law enforcement agent who needs organized, verifiable timelines and cross-case links without AI hallucinations.

## 3. Core Functional Requirements

### 3.1 Citizen Portal (Intake & Vault)
* **FR-101 Dynamic Conversational Ingestion:** Plain-text natural language intake (voice/text) that parses the incident category (e.g., Task Scam, Digital Arrest) and prompts for missing parameters.
* **FR-102 Client-Side Cryptographic Hashing:** Every uploaded file computes a SHA-256 hash using the Web Crypto API before multi-part upload.
* **FR-103 Evidence Vault:** Read-only storage storing binary files, metadata, MIME types, and cryptographic signatures.

### 3.2 Forensic Extraction & Timeline Engine
* **FR-201 Deterministic Entity Extraction:** Regex + NER parsing of Phone Numbers (E.164), UPI VPAs, Bank Accounts, IFSC codes, URLs, and Telegram handles.
* **FR-202 ISO-8601 Temporal Reconstruction:** Extraction of timestamps across disparate formats (EXIF, WhatsApp headers, SMS headers) normalized into an interactive visual timeline.
* **FR-203 Bidirectional Source Traceability:** Each extracted fact links to its specific `Evidence_ID` and bounding coordinates or file offsets.

### 3.3 Cross-Case Intelligence & Graph
* **FR-301 Node Ingestion:** Entities are mapped into an in-memory graph as `EntityNode` connected to `CaseNode`.
* **FR-302 Real-time Syndicate Alert:** Instant alert when an ingested entity has an in-degree > 1 across independent case nodes.
* **FR-303 Interactive Force-Directed Graph:** Visual network showing cases linked by shared identifiers (UPI, Phone, Account).

### 3.4 Investigation Dossier Export
* **FR-401 Report Compilation:** One-click PDF generation containing Case Metadata, Evidence Integrity Manifest, Chronological Timeline, Entity Linkages, and Statutory Classification checklist.

## 4. Non-Functional Requirements
* **Latency:** End-to-end evidence ingestion and graph resolution under 5 seconds for up to 10 files.
* **Security:** Original binaries remain immutable; all processing operates on sandboxed buffer copies.
* **Data Integrity:** Strict schema validation on all entity outputs via Zod.
