# RAKSHAK v3.0 — PHASE 36 REPORT
## Workstreams E & G: Forensic Examination, Custody Transfers & Direct PostgreSQL RLS Verification

**Phase Status:** COMPLETE  
**Execution Date:** 2026-10-24  
**Target PostgreSQL Database:** `rakshak_phase36_test` (Dedicated synthetic database, verified non-existent prior to execution)  
**PostgreSQL Runtime Role:** `rakshak_app_user` (`rolsuper = false`, `rolbypassrls = false`)  
**Cold Storage Invariant:** 560 files preserved in `uploads/raw/` (Manifest: `bdc91bb78c603d212d992ac552d8ff85e6e4096bb0533c836ed8936b20ad61b8`)  

---

### 1. Executive Summary

Phase 36 completes the forensic examination and custody transfer operational workflows, while independently proving tenant isolation and Row-Level Security (RLS) enforcement at the PostgreSQL database kernel layer.

Key capabilities implemented and empirically verified:
1. **Two-Step Controlled Custody Transfer:** Custody transfer requires initiation by the active custodian, validation of recipient eligibility (active account status, assigned department or cross-department access grant), and explicit recipient acknowledgement/acceptance.
2. **Forensic Examination Lifecycle & Derived Artifact Provenance:** Forensic examination can only be initiated and completed by authenticated officers with `FORENSIC_EXAMINER` or `ADMIN` roles. The raw evidence binary remains strictly immutable, while derived findings (such as OCR extractions or entity facts) are stored with independent identifiers and cryptographically anchored to the source exhibit hash (`sourceHash`).
3. **Direct PostgreSQL Kernel RLS Verification:** Executed directly via unprivileged `rakshak_app_user` on `rakshak_phase36_test`, proving that departmental boundaries and unexpired `AccessGrant` scopes are strictly enforced even if an adversary gains direct SQL execution access.

---

### 2. Workstream E: Custody Transfers & Forensic Examination

#### 2.1 Two-Step Custody Transfer Protocol
Custody transfers enforce a zero-ambiguity model where an exhibit never has multiple concurrent active custodians or unassigned limbo states:
1. **Initiation (`POST /api/evidence/:id/transfer`):**
   - Must be invoked by the current custodian (`Evidence.currentCustodianId`).
   - Recipient officer must exist, have status `ACTIVE` (not `SUSPENDED`), and belong to the case's department or hold an active, unexpired `AccessGrant`.
   - Transitions status to `TRANSFERRED`.
   - Records recipient in metadata and appends a `CUSTODY_TRANSFER_INITIATED` custody event.
2. **Acknowledgement & Acceptance:**
   - Must be called by the designated recipient officer.
   - Transitions status to `IN_CUSTODY` and updates `currentCustodianId = recipientOfficerId`.
   - Appends a `CUSTODY_TRANSFER_ACCEPTED` custody event to the hash chain.

#### 2.2 Forensic Examination Protocol
1. **Initiation (`POST /api/evidence/:id/examine` with `action: "START"`):**
   - Requires `FORENSIC_EXAMINER` or `ADMIN` role.
   - Verifies case accessibility via department or access grant.
   - Transitions status to `EXAMINATION_IN_PROGRESS` and sets `examinerId = officer.id`.
   - Appends `FORENSIC_EXAM_START` custody event.
2. **Completion (`action: "COMPLETE"`):**
   - Transitions status to `EXAMINATION_COMPLETED`.
   - Links extracted findings (`ExtractedFact`) with immutable metadata:
     - `sourceHash`: exact SHA-256 of the source evidence binary.
     - `examinerId`: authoritative examiner ID.
     - `taskRef`: examination case reference.
   - Appends `FORENSIC_EXAM_COMPLETE` custody event.
   - Raw binary bytes in storage remain 100% unaltered.

---

### 3. Workstream G: Direct PostgreSQL RLS Verification

#### 3.1 Security Catalog & Isolation Boundaries
Tests were conducted directly against PostgreSQL 16 on `rakshak_phase36_test` under unprivileged role `rakshak_app_user`:
- `rolsuper = false`, `rolbypassrls = false`.
- RLS enabled and forced on `Evidence`, `Case`, `CustodyEvent`, and `AccessGrant`.
- Private session state secured in `private_auth.session_context` (inaccessible to `rakshak_app_user`).

#### 3.2 Implemented RLS Policy Definitions
```sql
-- Evidence Tenant Isolation Policy
CREATE POLICY "p_evidence_tenant_isolation" ON "Evidence"
  FOR ALL
  TO PUBLIC
  USING (
    (is_verified_platform_admin() = TRUE)
    OR
    EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "Evidence"."caseId"
        AND (
          (get_verified_department_id() IS NOT NULL AND c."departmentId" = get_verified_department_id())
          OR
          EXISTS (
            SELECT 1 FROM "AccessGrant" ag
            WHERE (ag."targetCaseId" = c.id OR ag."targetDepartmentId" = c."departmentId")
              AND ag."granteeOfficerId" = get_verified_officer_id()
              AND ag."status" = 'ACTIVE'
              AND (ag."expiresAt" IS NULL OR ag."expiresAt" > CURRENT_TIMESTAMP)
          )
        )
    )
  );

-- CustodyEvent Tenant Isolation Policy
CREATE POLICY "p_custody_tenant_isolation" ON "CustodyEvent"
  FOR ALL
  TO PUBLIC
  USING (
    (is_verified_platform_admin() = TRUE)
    OR
    EXISTS (
      SELECT 1 FROM "Evidence" e
      JOIN "Case" c ON c.id = e."caseId"
      WHERE e.id = "CustodyEvent"."evidenceId"
        AND (
          (get_verified_department_id() IS NOT NULL AND c."departmentId" = get_verified_department_id())
          OR
          EXISTS (
            SELECT 1 FROM "AccessGrant" ag
            WHERE (ag."targetCaseId" = c.id OR ag."targetDepartmentId" = c."departmentId")
              AND ag."granteeOfficerId" = get_verified_officer_id()
              AND ag."status" = 'ACTIVE'
              AND (ag."expiresAt" IS NULL OR ag."expiresAt" > CURRENT_TIMESTAMP)
          )
        )
    )
  );
```

---

### 4. Direct Empirical Test Results (Workstreams E & G)

| Test ID | Scenario | Execution Role | Outcome | Empirical Diagnostic |
|---|---|---|---|---|
| **TC-21** | Custody transfer initiated by authorized custodian transitions to TRANSFERRED | Application / Prisma | **PASSED** | Status transitioned to `TRANSFERRED` |
| **TC-22** | Transfer initiated by non-custodian officer is denied | Application / Prisma | **PASSED** | Denied (not current custodian) |
| **TC-23** | Transfer to suspended officer fails closed | Application / Prisma | **PASSED** | Blocked due to account status `SUSPENDED` |
| **TC-24** | Transfer to different department without access grant is denied | Application / Prisma | **PASSED** | Denied without approved cross-dept grant |
| **TC-25** | Designated recipient acknowledges and accepts transfer | Application / Prisma | **PASSED** | Custodian updated; status `IN_CUSTODY` |
| **TC-26** | Non-recipient officer attempting to accept transfer is rejected | Application / Prisma | **PASSED** | Denied (recipient mismatch) |
| **TC-27** | Forensic examination started by FORENSIC_EXAMINER | Application / Prisma | **PASSED** | Status `EXAMINATION_IN_PROGRESS` |
| **TC-28** | Ordinary investigator denied forensic examination initiation | Application / Prisma | **PASSED** | Denied (requires `FORENSIC_EXAMINER` role) |
| **TC-29** | Examination completion stores derived artifacts with `sourceHash` | Application / Prisma | **PASSED** | Derived fact linked to source hash |
| **TC-32** | PostgreSQL RLS: Authorized investigator queries only own department evidence | `rakshak_app_user` (psql) | **PASSED** | Visible: `evi_cyber_36`; `evi_eow_36` invisible |
| **TC-33** | PostgreSQL RLS: Unauthorized department returns 0 rows for other department | `rakshak_app_user` (psql) | **PASSED** | Count = 0 |
| **TC-34** | PostgreSQL RLS: Cross-dept investigator with active AccessGrant can read evidence | `rakshak_app_user` (psql) | **PASSED** | Count = 1 (Grant authorized read) |
| **TC-35** | PostgreSQL RLS: Revoked/expired AccessGrant immediately revokes evidence access | `rakshak_app_user` (psql) | **PASSED** | Count = 0 (Immediate revocation) |
| **TC-36** | PostgreSQL RLS: Forged unverified client-settable tenant context fails closed | `rakshak_app_user` (psql) | **PASSED** | Count = 0 (Client SET ignored) |
| **TC-37** | PostgreSQL RLS: Connection pooling teardown (`clear` + `DISCARD ALL`) leaks 0 rows | `rakshak_app_user` (psql) | **PASSED** | Pre: 1, Post: 0 (No state leak across pool) |
| **TC-38** | Cold evidence binary preservation: all 560 files in `uploads/raw/` unaltered | Filesystem Hash Manifest | **PASSED** | Count: 560, Hash: `bdc91bb78c603d21...` |

---

### 5. Verified Security Invariants
- **No Direct Table Mutation:** `CustodyEvent` cannot be modified or deleted by `rakshak_app_user` under any circumstances.
- **No Departmental Hopping:** RLS policies reject client-asserted `SET app.current_department_id` and require cryptographic server-side session tokens validated against `OfficerSession`.
- **Pooled Connection Sanitization:** `clear_tenant_context()` followed by `DISCARD ALL` ensures that connections recycled by Prisma or PgBouncer never leak residual authorization context to subsequent requests.
- **Cold Storage Invariant:** Live cold evidence directory `uploads/raw/` was subjected to byte-for-byte SHA-256 manifest verification across all 560 binary files before and after suite execution, confirming zero modifications.
