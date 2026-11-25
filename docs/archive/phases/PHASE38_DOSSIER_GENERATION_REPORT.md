# RAKSHAK v3.0 — PHASE 38
## EVIDENCE-BACKED INVESTIGATIVE DOSSIERS & REPRODUCIBLE REPORTING
### Workstream A & C: Dossier Architecture, Template-Driven Assembly & Source-of-Truth Mapping

**Report Date:** October 25, 2026  
**System State:** Synthetic Development & Testing Only (`rakshak_phase38_test`)  
**Production Ingestion:** Strictly Disabled  
**Status:** COMPLETE  

---

### 1. Executive Summary

Phase 38 delivers an auditable, deterministic, and evidence-backed investigative dossier generation engine for RAKSHAK v3.0. Previous releases provided atomic custody chains (Phase 36/36.1/36.2) and cross-case intelligence graph traversal (Phase 37). However, investigative case summaries, exhibits, custody logs, and cross-case leads remained fragmented across separate subsystem queries. 

The Phase 38 dossier engine provides:
1. **Deterministic, Template-Driven Assembly:** Assembles case metadata, chronological timelines, physical/digital evidence exhibit registers, verified chain-of-custody logs, reviewed cross-case intelligence links, and unverified candidate leads into a canonical JSON payload.
2. **Strict Epistemic Classification:** Strictly differentiates recorded facts (`RECORDED_FACT`), source-derived observations (`SOURCE_DERIVED`), unverified leads (`CANDIDATE_LEAD`), analyst interpretations (`ANALYST_INTERPRETATION`), and reviewed conclusions (`REVIEWED_CONCLUSION`). Candidate entity links are never promoted to verified facts or claims of guilt.
3. **Non-Destructive Source Mapping:** Dossiers do not function as a new or mutable source of truth for cases, evidence, or custody events; rather, they serve as point-in-time cryptographic snapshots referencing authoritative database rows.
4. **Contradiction & Discrepancy Surfacing:** Automatically surfaces discrepancies (e.g. hash integrity check failures, chain-of-custody transfer anomalies, or revoked cross-case links) rather than silently smoothing or omitting conflicting evidence.

---

### 2. Dossier Section Architecture & Authoritative Source Mapping

Every generated investigative dossier conforms to a formal, hierarchical section layout. Each populated section maps deterministically to underlying authoritative Prisma models:

| Dossier Section | Authoritative Source Model | Selection Criteria & Privacy Gates | Transformation & Rendering Rules |
| :--- | :--- | :--- | :--- |
| **Header & Metadata** | `InvestigativeDossier` | Assigned UUID, case context, department jurisdiction. | Generated number format `DOS-{YYYY}-{CASE_NUMBER}-{HASH8}`. Version counter starts at `v1`. |
| **Case Overview** | `Case` | Active case row matching `caseId` within officer's jurisdiction. | Extracts FIR number, title, classification, status, jurisdiction, and authorized case narrative. |
| **Timeline of Events** | `TimelineEvent` | Timeline events where `caseId` matches; ordered chronologically (`timestamp ASC`). | Formats ISO-8601 timestamps, event descriptions, source evidence references, and verification status. |
| **Evidence Exhibit Inventory** | `Evidence` | Evidence exhibits matching `caseId`, filtered by department RLS. | Lists exhibit numbers, item types, storage locations, SHA-256 hashes, and verified custody status. |
| **Chain-of-Custody Summary** | `CustodyEvent` | Custody events joined via `evidenceId` across case exhibits. | Summarizes sequential custody transfers, chronological actor identities, action verbs, and cryptographic digests (`eventHash`). |
| **Cross-Case Intelligence** | `EntityLink` | Reviewed / Confirmed links where `sourceCaseId` or `targetCaseId` matches case. | Highlights reviewed relationships, linked entity values, match types, confidence scores, and reviewer rationale. Masked if cross-dept unauthorized. |
| **Candidate Investigative Leads** | `EntityLink` (Pending) | Candidate links with status `PENDING_REVIEW` or `SUGGESTED`. | **Explicitly isolated**: Prefaced with statutory non-culpability disclaimers. Labeled unverified candidate hypothesis. |
| **Discrepancies & Contradictions** | `Evidence`, `CustodyEvent`, `EntityLink` | Records flagged with integrity failures, status mismatches, or revocations. | Exposes contradictory records explicitly (e.g. hash mismatch between upload and verification, or disputed links). |
| **Claim Provenance Registry** | `DossierClaim` | Auto-generated claim extraction matching dossier version. | Canonical list of all factual assertions with source record pointers, timestamps, and confidence scores. |
| **Supervisor Review & Approval** | `DossierReview` | Immutable log of supervisor review submissions. | Records reviewer identity, decision, timestamp, review rationale, and bound cryptographic digest. |

---

### 3. Epistemic Separation & Non-Culpability Safeguards

In compliance with criminal procedure guidelines and evidence admissibility standards:
- **No Autonomous Culpability Conclusions:** The generator does not emit findings of guilt, motive, or legal culpability.
- **Candidate Lead Isolation:** Cross-case entity links that have not undergone formal human review retain the status `PENDING_REVIEW` and category `CANDIDATE_LEAD`. They are rendered under a dedicated section titled `"Candidate Investigative Leads (Unverified)"` with the mandatory disclaimer:
  > *"NOTICE: Candidate leads represent unverified algorithmic matches and investigative hypotheses. They do not constitute established facts, proof of identity, or evidence of wrongdoing."*
- **Disputed & Revoked Link Representation:** When a previously suggested link is rejected or revoked by an investigator, it is preserved in the dossier under disputed records to prevent confirmation bias or selective suppression of exculpatory connections.

---

### 4. Deterministic Assembly Engine (`lib/dossierGeneration.ts`)

Dossier content is assembled using the deterministic engine implemented in `lib/dossierGeneration.ts`:
1. **Canonical JSON Serialization (`canonicalJsonStringify`):** All JSON keys across objects, nested arrays, and metadata dictionaries are sorted lexicographically before stringification, guaranteeing that identical data structures yield identical UTF-8 byte streams.
2. **Cryptographic Content Digest (`computeContentHash`):** The canonical JSON string of the dossier content is digested using SHA-256:
   $$\text{contentHash} = \text{SHA-256}(\text{canonicalJsonStringify}(\text{dossierContent}))$$
3. **Manifest Compilation:** Captures exact record IDs, counts, and hash digests of all underlying rows used during assembly (`sourceManifest`), enabling precise auditability and stale-detection.

---

### 5. Statutory Framework & Disclaimer of Admissibility

As mandated by safety constraints:
- Dossiers generated in Phase 38 are derived solely from synthetic test records.
- Neither the system nor this report claims formal statutory certification (e.g., Section 65B Indian Evidence Act / Section 63 Bharatiya Sakshya Adhiniyam 2023) without independent, live digital forensic examination and physical verification of device custody.
