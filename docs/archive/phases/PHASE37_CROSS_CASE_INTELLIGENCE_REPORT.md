# RAKSHAK v3.0 — PHASE 37 CROSS-CASE INTELLIGENCE REPORT
## Cross-Case Intelligence Graph Traversal, Bounded Expansion & Zero-Leakage Architecture

### 1. Executive Summary

Phase 37 introduces a secure, explainable cross-case intelligence workflow designed to discover connections, common accounts, shared infrastructure, and criminal patterns across authorized cases without violating department boundaries or leaking unauthorized case intelligence.

A detected connection is strictly categorized as an **investigative lead** and not proof of wrongdoing, identity, or guilt. Automated systems produce candidate associations; consequential findings require attributable human analyst confirmation with recorded investigative rationale.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                PHASE 37 GRAPH ARCHITECTURE                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   [ Case A (Delhi) ] ───( Observed )───► [ Entity Node: UPI / Phone / Domain / Hash ]  │
│          │                                                │                            │
│    (EntityLink)                                      (EntityLink)                      │
│   CANDIDATE / CONFIRMED                             CANDIDATE / CONFIRMED              │
│          ▼                                                ▼                            │
│   [ Case B (Delhi) ] ───( Observed )───► [ Entity Node: Bank Account / Device ]       │
│                                                                                        │
│   ✖ Cross-Department Traversal (e.g. Case C Mumbai):                                   │
│     Blocked & Pruned at Database Kernel unless Active Unrevoked AccessGrant exists     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2. Data Model & Source Ownership

Source-of-truth ownership is strictly preserved:
1. **Case Authority:** The `Case` system remains authoritative for case numbers, statuses, complainant details, and assignments.
2. **Evidence Authority:** The `Evidence` system remains authoritative for exhibit metadata, cold-storage binaries (`/uploads/raw/`), and cryptographic integrity digests.
3. **Custody Authority:** The `CustodyEvent` ledger remains authoritative for the append-only cryptographic event chain.
4. **Link Provenance:** `EntityLink` models capture candidate and confirmed relationships, referencing source and target entities, cases, and evidence without altering underlying records.

#### EntityLink Model
- **`id`**: Unique UUID.
- **`sourceCaseId` / `targetCaseId`**: Authoritative foreign keys referencing `Case` (cascading delete on case disposal).
- **`sourceEntityId` / `targetEntityId`**: Optional references to underlying `CaseEntity` or `ExtractedFact` records.
- **`sourceEvidenceId` / `targetEvidenceId`**: Traceable references to supporting evidence exhibits.
- **`entityType`**: Categorical discriminator (`EMAIL`, `PHONE`, `UPI`, `ACCOUNT`, `IFSC`, `DOMAIN`, `URL`, `IP`, `DEVICE_HASH`, `NAME`, `UTR`, `TELEGRAM`, `OTHER`).
- **`normalizedValue`**: Canonical, deterministically normalized identifier or digest.
- **`linkType`**: Explicit category (`EXACT_IDENTIFIER_MATCH`, `SHARED_HASH`, `SHARED_ACCOUNT`, `EXPLICIT_RELATIONSHIP`, `ANALYST_CONFIRMED`, `POTENTIAL_MATCH`).
- **`matchRule`**: Documented rule identifier (e.g. `RULE_EXACT_NORM_PHONE_V1`).
- **`normalizationVersion`**: Strict canonicalization version (`v1`).
- **`explanation`**: Factual, explainable description of the connection.
- **`status`**: Controlled review state (`CANDIDATE`, `UNDER_REVIEW`, `CONFIRMED`, `REJECTED`, `REVOKED`).
- **`confidenceCategory`**: Documented category (`EXACT_IDENTIFIER_MATCH`, `POTENTIAL_MATCH`, `ANALYST_CONFIRMED`).
- **`limitations`**: Human-readable caveat (e.g. shared generic IP, private subnet, or multi-user gateway).
- **`isGeneric`**: Boolean flag indicating non-conclusive shared identifier.
- **`version`**: Monotonically increasing integer for optimistic concurrency control.

#### EntityLinkReview Model (Immutable Decision Ledger)
- **`id`**: Unique UUID.
- **`linkId`**: Reference to `EntityLink`.
- **`fromStatus` / `toStatus`**: Transition states.
- **`reviewerId` / `reviewerName` / `reviewerBadge` / `reviewerRole`**: Authoritative reviewer attribution resolved from server-side session.
- **`rationale`**: Mandatory factual explanation (>= 5 characters).
- **`reviewedAt`**: UTC timestamp.

---

### 3. Graph Traversal & Depth Boundary Controls

To prevent denial-of-service, runaway recursions, and memory exhaustion:
1. **Configurable Traversal Depth:**
   - Default: `depth = 2` hops.
   - Maximum Hard Limit: `MAX_TRAVERSAL_DEPTH = 3`. Requests specifying higher values are clamped automatically.
2. **Configurable Result Limits:**
   - Default: `limit = 50` nodes.
   - Maximum Hard Limit: `MAX_RESULT_LIMIT = 100` nodes. Excess nodes are pruned, and edges connected to pruned nodes are safely filtered.
3. **Cycle Prevention:**
   - The breadth-first search (BFS) queue maintains a `visitedCaseIds` set. Circular links (e.g. Case 1 -> Case 2 -> Case 1) terminate immediately without infinite loop.

---

### 4. Zero Information Leakage Enforcement

When an investigator queries the intelligence graph around an authorized case:
1. **Case-Level Access Scoping:** For every candidate case discovered across the entity adjacency network, `canAccessCase(officer, case, "read:metadata")` is evaluated.
2. **Total Pruning of Inaccessible Nodes:** If an officer lacks permission to access a discovered case (e.g. Case belongs to Mumbai Cyber Cell and caller is from Delhi Cyber Unit without an active `AccessGrant`):
   - The inaccessible case node is **not included in `nodes`**.
   - Connecting edges to the inaccessible case are **not included in `edges`**.
   - Summary statistics (such as `authorizedLinkedCaseCount` and `totalFraudAmountLinked`) **exclude** the unauthorized case entirely.
   - Error messages and response metadata do not reveal the title, case number, existence, or count of inaccessible cases.
3. **Evidence-Level Scoping:** Viewing an entity link does not confer automatic authorization to download or view raw evidence binaries; `canAccessEvidence(officer, evidence, "read:binary")` remains strictly enforced.

---

### 5. Explainable Shortest Path Discovery

The `/api/graph/path` endpoint resolves the shortest explanatory path between two authorized entities or cases:
- Evaluates BFS traversal restricted strictly to the caller's authorized node set.
- Generates a step-by-step path summary linking each hop with the supporting entity, relationship type, and source evidence.
- If the only connection between two authorized nodes passes through an unauthorized foreign case, the path resolution safely fails closed, reporting that no authorized connection exists within permissible scope.
