# RAKSHAK v3.0 — PHASE 37 AUTHORIZATION & POSTGRESQL RLS REPORT
## Cross-Case Security Architecture, Verified Session Context, Row-Level Security & Tamper Resistance

### 1. Executive Summary

Phase 37 builds cross-case intelligence and entity resolution directly upon the verified PostgreSQL session context and Row-Level Security (RLS) foundations established in Phases 34, 34.1, 35.1, and 36.

Graph intelligence queries operate under a strict **Zero-Information-Leakage** policy:
- No officer can discover, enumerate, or traverse nodes or relationships linked to cases outside their authorized jurisdiction without an active, unexpired, and non-revoked `AccessGrant`.
- Connection to an entity does not grant access to adjacent foreign cases.
- Inaccessible foreign cases are completely omitted from graph query results, response metadata, and node/edge count metrics.
- All database policies were independently verified using the non-superuser application role `rakshak_app_user` (without `BYPASSRLS`).

---

### 2. Multi-Layered Authorization Architecture

Security enforcement for the intelligence graph and entity resolution operates across three independent tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TIER 1: API & ROUTE GATEWAY                     │
│  - Session token verification & active officer status check            │
│  - Suspended account denial (immediate cutoff)                         │
│  - Role capability checks (syndicate:view, case:read, evidence:read)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  TIER 2: DOMAIN KERNEL (APPLICATION LEVEL)             │
│  - Verified case-level access checks (canAccessCase)                   │
│  - Department isolation & AccessGrant validation                       │
│  - Grant expiration & revocation verification                          │
│  - Zero-leakage node & edge pruning                                    │
│  - Shortest path boundary enforcement                                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                TIER 3: POSTGRESQL ROW-LEVEL SECURITY (DATABASE KERNEL) │
│  - rakshak_app_user runtime role (NO BYPASSRLS)                        │
│  - Verified session parameters:                                        │
│      rakshak.verified_user_id, rakshak.verified_dept_id               │
│  - Fail-closed RLS policies on "EntityLink" and "EntityLinkReview"     │
│  - SQL-level privilege revoking (NO UPDATE/DELETE on reviews)          │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 3. Verified PostgreSQL Session Context & RLS Policies

#### 3.1 Trusted Session Parameters
In compliance with the Phase 34.1 security architecture, the database connection establishes verified tenant context via:
```sql
SELECT set_config('rakshak.verified_user_id', $officerId, true);
SELECT set_config('rakshak.verified_dept_id', $deptId, true);
```
Unverified client-supplied headers or configuration settings are discarded. If a query is attempted without verified session context, the RLS policies fail closed (returning 0 rows).

#### 3.2 Row-Level Security Policies on `EntityLink`
Table `"EntityLink"` has RLS enabled and forced:
```sql
ALTER TABLE "EntityLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EntityLink" FORCE ROW LEVEL SECURITY;
```

**Select Policy (`entity_link_select_policy`):**
An officer can only query an entity link if their verified department matches the source case, the target case, or an active cross-department access grant exists:
```sql
CREATE POLICY entity_link_select_policy ON "EntityLink"
FOR SELECT TO rakshak_app_user
USING (
  -- 1. Direct Department Ownership of Source Case
  EXISTS (
    SELECT 1 FROM "Case" c
    WHERE c."id" = "EntityLink"."sourceCaseId"
      AND c."departmentId" = current_setting('rakshak.verified_dept_id', true)
  )
  OR
  -- 2. Direct Department Ownership of Target Case
  EXISTS (
    SELECT 1 FROM "Case" c
    WHERE c."id" = "EntityLink"."targetCaseId"
      AND c."departmentId" = current_setting('rakshak.verified_dept_id', true)
  )
  OR
  -- 3. Valid, Unexpired, Non-Revoked Cross-Department Access Grant
  EXISTS (
    SELECT 1 FROM "AccessGrant" ag
    JOIN "Case" c ON c."id" = ag."caseId"
    WHERE (c."id" = "EntityLink"."sourceCaseId" OR c."id" = "EntityLink"."targetCaseId")
      AND ag."granteeId" = current_setting('rakshak.verified_user_id', true)
      AND ag."revokedAt" IS NULL
      AND ag."expiresAt" > CURRENT_TIMESTAMP
  )
);
```

#### 3.3 Row-Level Security Policies on `EntityLinkReview`
Table `"EntityLinkReview"` has RLS enabled and forced:
```sql
ALTER TABLE "EntityLinkReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EntityLinkReview" FORCE ROW LEVEL SECURITY;
```

**Select Policy (`entity_link_review_select_policy`):**
Review decisions are visible only if the officer has access to the parent `EntityLink`:
```sql
CREATE POLICY entity_link_review_select_policy ON "EntityLinkReview"
FOR SELECT TO rakshak_app_user
USING (
  EXISTS (
    SELECT 1 FROM "EntityLink" el
    WHERE el."id" = "EntityLinkReview"."linkId"
  )
);
```

---

### 4. Database Privilege Hardening & Tamper Resistance

To prevent history alteration, backdating, or unauthorized deletion of intelligence records:

1. **`EntityLink` Table:**
   ```sql
   REVOKE DELETE, TRUNCATE ON "EntityLink" FROM rakshak_app_user;
   ```
   - Only `SELECT`, `INSERT`, and `UPDATE` (for status transitions and optimistic versioning) are permitted.
   - Deletion and truncation are completely denied to the application user.

2. **`EntityLinkReview` Table (Immutable Audit Ledger):**
   ```sql
   REVOKE UPDATE, DELETE, TRUNCATE ON "EntityLinkReview" FROM rakshak_app_user;
   ```
   - Review records are strictly **append-only**.
   - Neither investigators, supervisors, nor application users can edit, overwrite, or delete historical review decisions.

3. **Check Constraints:**
   - Review rationale length is enforced at the schema level:
     ```sql
     CHECK (char_length("rationale") >= 5)
     ```
   - Status transitions and link types are constrained by categorical CHECK constraints.

---

### 5. Access Grant Expiry, Revocation & Officer Status

1. **Grant Expiration:** When an `AccessGrant` expires (`expiresAt <= NOW()`), cross-department visibility is revoked immediately at both application and SQL RLS levels without requiring a background batch cleanup job.
2. **Grant Revocation:** Immediate setting of `revokedAt = NOW()` cuts off intelligence access in real-time.
3. **Suspended Officers:** If an officer's account status is set to `SUSPENDED`, all intelligence API endpoints immediately reject requests with `403 Forbidden`, regardless of role or active grants.
4. **Independent Evidence Permissions:** Having access to an `EntityLink` or its source case does not confer blanket permission to download raw evidence exhibits (`sourceEvidenceId`). Viewing exhibits requires independent evidence-level authorization via `canAccessEvidence()`.

---

### 6. Empirical Security & Isolation Test Results

Authorization and RLS enforcement were exhaustively validated across scenarios in `scripts/test_phase37_cross_case_intelligence.mjs` against PostgreSQL instance `rakshak_phase37_test`:

| Scenario ID | Test Description | Role / Tenant Evaluated | Expected Outcome | Verified Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-12** | Direct evidence ID manipulation | Unauthorized Officer | Access Denied | **PASSED** |
| **TC-13** | Case enumeration by varying ID | Foreign Dept Officer | Access Denied / 403 | **PASSED** |
| **TC-14** | Inaccessible node/edge graph pruning | Delhi Officer on Mumbai Case | Omitted from Nodes & Edges | **PASSED** |
| **TC-15** | Bounded multi-hop traversal | Investigator | Max Depth Clamped to 3 | **PASSED** |
| **TC-16** | Query result limits enforcement | Investigator | Hard Limit Clamped to 100 | **PASSED** |
| **TC-17** | Expired AccessGrant traversal | Delhi Officer (Expired Grant) | Foreign Case Blocked | **PASSED** |
| **TC-18** | Revoked AccessGrant traversal | Delhi Officer (Revoked Grant) | Foreign Case Blocked | **PASSED** |
| **TC-19** | Suspended officer account cutoff | Suspended Officer | HTTP 403 / Access Denied | **PASSED** |
| **TC-20** | Forged tenant context bypass attempt | `rakshak_app_user` (Forged Setting) | Returned 0 Rows | **PASSED** |
| **TC-21** | Missing session context fail-closed | `rakshak_app_user` (No Context) | Returned 0 Rows | **PASSED** |
| **TC-22** | Zero-leakage side-channel defense | Unauthorized Officer | Case Count & Metadata Hidden | **PASSED** |
| **TC-23** | Evidence provenance access gating | Unauthorized Officer | Metadata Gated | **PASSED** |
| **TC-30** | Server-side reviewer identity resolution | Attacker header injection | Server Token Identity Used | **PASSED** |
| **TC-31** | Security audit logging of denials | Unauthorized Caller | Audit Log Generated | **PASSED** |
| **TC-32** | SQL privilege mutation resistance | `rakshak_app_user` | DELETE/UPDATE Denied by PG | **PASSED** |

---

### 7. Scalability & Query Performance

1. **Selective Indexed Traversal:** Multi-hop traversal utilizes indexed foreign keys on `("sourceCaseId", "targetCaseId")` and `("entityType", "normalizedValue")`.
2. **In-Memory Budget Limits:** Traversal is bounded in the database before passing to application memory. The server never loads all cases or links indiscriminately.
3. **Optimistic Versioning:** Version checks on `EntityLink` prevent row-locking bottlenecks while guaranteeing transactional consistency.
