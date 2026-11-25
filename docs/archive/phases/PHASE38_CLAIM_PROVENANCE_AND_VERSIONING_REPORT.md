# RAKSHAK v3.0 — PHASE 38
## CLAIM-LEVEL PROVENANCE, DETERMINISTIC VERSIONING & STALENESS DETECTION
### Workstream B & D: Claim Registry, Citation Validation, Immutability & Reproducibility

**Report Date:** October 25, 2026  
**System State:** Synthetic Development & Testing Only (`rakshak_phase38_test`)  
**Status:** COMPLETE  

---

### 1. Overview of Claim-Level Provenance

In investigative and prosecutorial workflows, every factual assertion in a dossier must be traceable to underlying evidence, witness records, custody logs, or forensic extractions. Phase 38 implements an automated claim decomposition and provenance registry backed by the `DossierClaim` model.

The claim engine enforces four inviolable principles:
1. **Zero Fabricated Citations:** A claim must resolve to an authentic database row (`sourceModel` and `sourceRecordId`). Attempts to supply or generate fabricated identifiers fail validation.
2. **Epistemic Category Rigor:** Every claim is explicitly tagged with an epistemic category:
   - `RECORDED_FACT`: Primary factual records (e.g. Case FIR number, creation timestamp, evidence item seized).
   - `SOURCE_DERIVED`: Derived attributes (e.g. OCR text extraction, forensic file metadata, custody transfer logs).
   - `CANDIDATE_LEAD`: Algorithmic cross-case matches, unreviewed entity links, or unverified leads.
   - `ANALYST_INTERPRETATION`: Hypotheses or contextual notes entered by investigative personnel.
   - `REVIEWED_CONCLUSION`: Findings confirmed by an authorized investigator or supervisor.
3. **No Unwarranted Elevation:** Unreviewed cross-case entity links remain strictly flagged as `CANDIDATE_LEAD` with `isVerified = false`.
4. **Contradiction Transparency:** Discrepancies between sources (such as an evidence exhibit whose on-disk SHA-256 digest fails verification, or a disputed link) are recorded as distinct discrepancy claims rather than resolved silently.

---

### 2. Schema Specification: `DossierClaim`

```prisma
model DossierClaim {
  id             String    @id @default(uuid())
  dossierId      String
  claimNumber    String
  claimText      String
  claimCategory  String    // RECORDED_FACT, SOURCE_DERIVED, CANDIDATE_LEAD, ANALYST_INTERPRETATION, REVIEWED_CONCLUSION
  sourceModel    String    // Case, Evidence, CustodyEvent, TimelineEvent, EntityLink, ExtractedFact
  sourceRecordId String
  caseId         String
  evidenceId     String?
  sourceHash     String?
  sourceTimestamp DateTime?
  status         String    @default("RECORDED") // RECORDED, ACCEPTED, DISPUTED, WITHDRAWN
  isVerified     Boolean   @default(false)
  confidenceScore Float?
  limitations    String?
  reviewedById   String?
  reviewedAt     DateTime?
  createdAt      DateTime  @default(now())

  dossier        InvestigativeDossier @relation(fields: [dossierId], references: [id], onDelete: Cascade)

  @@index([dossierId])
  @@index([sourceModel, sourceRecordId])
  @@index([caseId])
  @@index([claimCategory])
}
```

Database CHECK constraints in PostgreSQL migration `20261025_phase38_dossier_reporting.sql` enforce:
- `claimCategory IN ('RECORDED_FACT', 'SOURCE_DERIVED', 'CANDIDATE_LEAD', 'ANALYST_INTERPRETATION', 'REVIEWED_CONCLUSION')`
- `status IN ('RECORDED', 'ACCEPTED', 'DISPUTED', 'WITHDRAWN')`

---

### 3. Deterministic Dossier Versioning & Snapshot Immutability

When a dossier is generated, it forms an immutable historical snapshot:
1. **Sequential Versioning:** Version numbers start at `1` and increment sequentially (`v1`, `v2`, ...). A database-level partial unique index prevents race collisions:
   ```sql
   CREATE UNIQUE INDEX "InvestigativeDossier_case_version_idx" 
   ON "InvestigativeDossier" ("caseId", "version");
   ```
2. **Cryptographic Content Hash:** The canonical representation of the report content is hashed with SHA-256 (`contentHash`).
3. **Manifest Storage:** The exact manifest of records present at generation time is saved in `sourceManifest`, recording:
   - Case modification timestamp.
   - Evidence count, IDs, and exhibit hashes.
   - Timeline event count.
   - Custody event count and latest event hash.
   - Entity link count and latest review states.

---

### 4. Dynamic Staleness Detection (`checkDossierStaleness`)

To avoid "silent mutations" where a report generated months earlier misleads investigators because underlying case data has changed, the dossier engine provides an automated staleness detection check:
```typescript
const staleness = await checkDossierStaleness(dossierId, prismaClient);
```
Staleness reasons detected automatically include:
- `CASE_UPDATED`: Case record was updated (`updatedAt > generatedAt`).
- `EVIDENCE_MODIFIED`: New evidence exhibits were added, removed, or exhibit integrity status changed.
- `CUSTODY_EXTENDED`: New custody events were appended to exhibits in the case since generation.
- `LINKS_REVISED`: Entity links were confirmed, rejected, or revoked after dossier assembly.

When staleness is detected:
- The existing version remains **unaltered** with its original `contentHash` and signed snapshot intact.
- Its runtime metadata reflects `isStale: true` along with specific stale reasons.
- To incorporate new findings, an authorized investigator must invoke `/api/cases/[caseId]/dossier/generate`, which generates version `v2` (linking `previousVersionId = v1.id`), leaving `v1` historically auditable.

---

### 5. Reproducibility Guarantee & Limitations

| Aspect | Guarantee | Enforcement Mechanism |
| :--- | :--- | :--- |
| **JSON Byte Parity** | 100% deterministic canonical JSON for identical input records. | `canonicalJsonStringify` sorts all object keys recursively; numeric and string formatting normalized. |
| **Content Digest** | Exact 64-character SHA-256 digest match. | `computeContentHash` computed over canonical JSON. |
| **Historical Invariance** | Zero silent mutation of historical dossiers. | PostgreSQL `REVOKE DELETE, TRUNCATE` on `InvestigativeDossier` and `DossierClaim`; `validateDossierTransition` blocks updates on finalized versions. |
| **Reproducibility Limit** | If an underlying source record is purged or altered outside RAKSHAK, historical regeneration will detect manifest divergence. | `sourceManifest` records snapshot hashes of all included evidence. |

---

### 6. Verification Summary

In test scenario suite `scripts/test_phase38_dossier_reporting.mjs`:
- **TC-07**: Verified every material claim points to an authentic database row.
- **TC-08**: Verified client-supplied fabricated source IDs are rejected.
- **TC-10**: Verified candidate links retain `CANDIDATE_LEAD` and unverified status.
- **TC-11**: Verified rejected/revoked links are represented with current status.
- **TC-12**: Verified exhibit hash mismatches are flagged as contradictory records.
- **TC-15**: Verified case modifications mark historical dossiers as stale.
- **TC-16**: Verified source record changes do not silently alter existing dossier content hash.
- **TC-17**: Verified regeneration safely produces `v2` referencing `v1`.
- **TC-18**: Verified database constraints block duplicate version collisions.
