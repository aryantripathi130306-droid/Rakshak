# RAKSHAK v3.0 — PHASE 32 ROLE & PERMISSION MATRIX
## Comprehensive Identity, Role Catalog, and Resource Authorization Specification

**Project:** RAKSHAK v3.0 (Advanced Multi-Jurisdictional Cybercrime Investigation & Evidence Management Platform)  
**Phase:** 32 — Multi-User Identity, Role & Department Access Model  
**Timestamp:** 2026-10-21T16:30:00Z  
**Classification:** Law Enforcement Sensitive (LE-S) / Internal Operational Architecture  

---

## 1. Executive Baseline & Gap Analysis

Prior to Phase 32, Rakshak v3.0 enforced coarse role-based access checks (`ADMIN`, `INVESTIGATOR`, `ANALYST`, `VIEWER`) coupled with tenant context resolution against the `OfficerSession` and `Department` models. While PostgreSQL Row-Level Security (RLS) policies were introduced in Phase 26 for tenant isolation, several architectural gaps remained regarding granular operational roles, separation of duties, and resource-level access discrimination.

### Baseline Comparison Matrix

| Area | Pre-Phase 32 Baseline State | Phase 32 Target Architecture | Gap Addressed |
| :--- | :--- | :--- | :--- |
| **Role Catalog** | 4 generic roles (`ADMIN`, `INVESTIGATOR`, `ANALYST`, `VIEWER`) | 6 specialized operational roles + 3 legacy roles mapped with strict compatibility | Lack of distinction between Supervisor, Forensic Examiner, Auditor, and Department Admin |
| **Evidence Access** | Binary download tied to broad read permissions | Resource-aware separation: `evidence:read:metadata` vs. `evidence:read:binary` | Forensic examiners and analysts could download raw evidence files indiscriminately |
| **Admin Privilege Scope** | Global `ADMIN` role could bypass case departmental filtering | Platform admin (`SYS_ADMIN` / `ADMIN`) denied case content access by default without explicit assignment or grant | Privilege escalation where platform engineers/admins could read classified case content |
| **Cross-Department Access** | Static department containment or broad bypass | Formal scoped `AccessGrant` mechanism with cryptographic tracking and expiration | Lack of auditable temporary cross-agency investigative access |
| **Session Revocation** | Sessions valid until `expiresAt` timestamp | Immediate server-side invalidation via `revokeAllOfficerSessions()` upon role/status changes | Stale session reuse after privilege demotion or officer suspension |
| **Audit Log Integrity** | Append-only via Prisma code convention | Explicit HTTP 405 method rejection (`POST`, `PUT`, `DELETE`) on `/api/audit` | Potential API misuse attempting audit log tampering |
| **Officer Management** | Any `ADMIN` could create/edit officers anywhere | `DEPT_ADMIN` strictly scoped to own department; prohibited from creating `SYS_ADMIN` or assigning unapproved roles | Department admins elevating accounts to root platform administrators |

---

## 2. Target Operational Roles Catalog

Phase 32 establishes 6 dedicated operational roles tailored to police, forensic, and supervisory workflows, alongside 3 legacy roles preserved for 100% backward compatibility.

```
                    ┌────────────────────────┐
                    │      TARGET ROLES      │
                    └───────────┬────────────┘
         ┌───────────────┬──────┴────────┬───────────────┐
         │               │               │               │
┌────────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│  INVESTIGATOR │ │  SUPERVISOR │ │  EXAMINER   │ │ DEPT_ADMIN  │
└───────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
         │                                               │
┌────────▼──────┐                               ┌────────▼──────┐
│    AUDITOR    │                               │   SYS_ADMIN   │
└───────────────┘                               └─────────────┘
```

### A. Investigator (`INVESTIGATOR`)
- **Primary Duty:** Case handling, witness interviews, entity extraction, and lead pursuit.
- **Resource Scope:** Access cases explicitly assigned to the officer or belonging to their department and unit.
- **Evidence Scope:** Register new exhibits; view metadata of departmental evidence; download binaries of assigned cases.
- **Guardrails:** Cannot approve case workflow milestones (`CHARGESHEETED`, `CLOSED`); cannot manage officers; cannot access other departments without an approved `AccessGrant`.

### B. Supervisor / Unit In-Charge (`SUPERVISOR`)
- **Primary Duty:** Departmental workload oversight, case assignment, milestone approvals, and integrity exception reviews.
- **Resource Scope:** All cases and exhibits registered within their department and assigned unit.
- **Approval Scope:** Exclusively authorized to approve case status transitions (`CHARGESHEETED`, `CLOSED`) and reassign investigating officers.
- **Guardrails:** Cannot view unapproved cross-department cases; cannot alter historical audit trails; cannot access raw evidence outside department scope.

### C. Forensic Examiner / Evidence Custodian (`FORENSIC_EXAMINER`)
- **Primary Duty:** Cold-storage exhibit intake, cryptographic SHA-256 integrity verification, chain-of-custody transfer logging, OCR, and multimodal extraction.
- **Resource Scope:** Evidence registered within department or transferred via formal custody handoff.
- **Evidence Distinction:** Has explicit rights to read evidence metadata, execute integrity verifications, log custody transfers, and download raw binaries for forensic analysis.
- **Guardrails:** Cannot modify core case dossiers, legal strategies, or officer accounts.

### D. Department Administrator (`DEPT_ADMIN`)
- **Primary Duty:** Departmental officer roster onboarding, status maintenance (active/suspended), and role assignments within permitted catalog.
- **Permitted Role Catalog:** Can only assign `INVESTIGATOR`, `SUPERVISOR`, `FORENSIC_EXAMINER`, and `VIEWER`.
- **Guardrails:** Strictly prohibited from assigning `SYS_ADMIN`, `ADMIN`, or `AUDITOR`; cannot alter officers in external departments; **cannot view investigative case content or evidence files**.

### E. System Administrator (`SYS_ADMIN`)
- **Primary Duty:** Infrastructure health, PostgreSQL RLS configuration, service status, backup schedule monitoring, and disaster recovery execution.
- **Scope & Defenses:** Full access to platform settings, officer provisioning across departments, and security diagnostics.
- **Zero-Trust Restriction:** **Denied access to case content and evidence files by default**. Must have an active case assignment or formal temporary `AccessGrant` to access investigative exhibits.

### F. Auditor / Compliance Reviewer (`AUDITOR`)
- **Primary Duty:** Oversight of evidentiary chain of custody, system access logs, role changes, and compliance validation.
- **Scope:** Read-only access to `/api/audit`, custody logs, and reporting analytics.
- **Guardrails:** Strictly prohibited from creating, updating, or deleting cases, evidence, or audit events (`canModifyAudit() === false`).

---

## 3. Legacy Role Compatibility & Mapping

To guarantee zero regression for existing staging data and legacy test suites, the legacy roles are mapped deterministically:

| Legacy Role | Operational Role Mapping | Effective Permission Profile | Invariant Preserved |
| :--- | :--- | :--- | :--- |
| `ADMIN` | Backward-compatible System Administrator | System settings, cross-department officer management, audit inspection. **Case content bypass closed**. | Preserves administrative oversight while enforcing Zero-Trust case access. |
| `INVESTIGATOR` | 1:1 Identity with Target `INVESTIGATOR` | Case authoring, entity linking, evidence registration within department. | Existing investigative workflows remain identical. |
| `ANALYST` | Read-only Evidence & Dossier Analyst | Can read case content and evidence metadata; can view syndicates and graph analytics; **cannot download raw evidence binaries**. | Prevents bulk exfiltration of raw evidence binaries by read-only analysts. |
| `VIEWER` | Read-only Case & Report Viewer | Read-only access to authorized case metadata; cannot create or mutate any records. | Minimum privilege baseline for trainees and read-only observers. |

---

## 4. Resource-Aware Permission Matrix

The system registers 28 distinct, fine-grained permissions. Access is calculated through `getEffectivePermissions(officer)`.

```
LEGEND:
[●] Granted unconditionally
[◐] Granted conditionally (resource scope / ownership / assignment check)
[○] Denied unconditionally
```

| Permission Identifier | Description | INV | SUP | EXM | DADM | SADM | AUD | LEG-ADM | LEG-ANA | LEG-VIW |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `case:read:metadata` | View case overview, numbers, status | ◐ | ● | ● | ● | ● | ● | ● | ● | ● |
| `case:read:content` | Read full case narratives, dossier | ◐ | ● | ◐ | ○ | ◐ | ○ | ◐ | ● | ◐ |
| `case:create` | Create a new FIR / investigation case | ● | ● | ○ | ○ | ○ | ○ | ● | ○ | ○ |
| `case:edit` | Update case notes, incident details | ◐ | ● | ○ | ○ | ○ | ○ | ● | ○ | ○ |
| `case:assign` | Assign/reassign investigating officer | ○ | ● | ○ | ○ | ● | ○ | ● | ○ | ○ |
| `case:workflow:approve` | Approve chargesheet, closure | ○ | ● | ○ | ○ | ○ | ○ | ● | ○ | ○ |
| `evidence:create` | Register initial evidence record | ● | ● | ● | ○ | ○ | ○ | ● | ○ | ○ |
| `evidence:read:metadata` | View file names, hashes, MIME types | ◐ | ● | ● | ○ | ◐ | ● | ◐ | ● | ● |
| `evidence:read:binary` | Download physical exhibit binary | ◐ | ◐ | ● | ○ | ◐ | ○ | ◐ | ○ | ○ |
| `evidence:verify` | Run SHA-256 verification against disk | ● | ● | ● | ○ | ● | ○ | ● | ○ | ○ |
| `evidence:custody:transfer` | Log chain-of-custody handoff | ◐ | ● | ● | ○ | ○ | ○ | ● | ○ | ○ |
| `evidence:extract` | Trigger OCR, transcriptions, NER | ● | ● | ● | ○ | ○ | ○ | ● | ○ | ○ |
| `entity:read` | View extracted entities, bank/mule IDs | ◐ | ● | ● | ○ | ◐ | ○ | ◐ | ● | ● |
| `entity:manage` | Add, merge, or link entities | ● | ● | ● | ○ | ○ | ○ | ● | ○ | ○ |
| `syndicate:read` | View cross-case criminal clusters | ◐ | ● | ◐ | ○ | ◐ | ○ | ◐ | ● | ● |
| `syndicate:manage` | Form, split, or label clusters | ● | ● | ○ | ○ | ○ | ○ | ● | ○ | ○ |
| `report:read` | View generated dossiers and reports | ◐ | ● | ◐ | ● | ● | ● | ● | ● | ● |
| `report:generate` | Compile case dossier / court reports | ● | ● | ● | ○ | ○ | ○ | ● | ○ | ○ |
| `officer:read` | View officer roster | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `officer:create` | Provision new officer accounts | ○ | ○ | ○ | ◐ | ● | ○ | ● | ○ | ○ |
| `officer:update` | Update officer profile / contact | ○ | ○ | ○ | ◐ | ● | ○ | ● | ○ | ○ |
| `officer:role:assign` | Assign or modify officer roles | ○ | ○ | ○ | ◐ | ● | ○ | ● | ○ | ○ |
| `officer:suspend` | Suspend or reactivate officer | ○ | ○ | ○ | ◐ | ● | ○ | ● | ○ | ○ |
| `grant:request` | Request cross-department access | ● | ● | ● | ○ | ○ | ○ | ● | ○ | ○ |
| `grant:approve` | Approve inter-department delegation | ○ | ● | ○ | ● | ● | ○ | ● | ○ | ○ |
| `audit:read` | View append-only audit trail | ○ | ◐ | ○ | ◐ | ● | ● | ● | ○ | ○ |
| `audit:modify` | Modify/delete audit records (FORBIDDEN)| ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| `system:settings:update` | Modify system-wide security settings | ○ | ○ | ○ | ○ | ● | ○ | ● | ○ | ○ |

---

## 5. Cross-Department Access Delegation Engine

To prevent arbitrary cross-department access while enabling joint inter-agency cybercrime investigations, Rakshak v3.0 utilizes a server-side **Access Grant** architecture.

### Schema & Data Structure (`data/access_grants.json`)
```typescript
interface AccessGrant {
  id: string;                    // UUID
  granteeOfficerId: string;      // Officer receiving temporary access
  granteeDepartmentId: string;   // Officer's home department
  targetDepartmentId: string;    // Department holding the case/exhibit
  targetCaseId?: string;         // Specific case ID (null for whole department scope)
  scope: "CASE_READ" | "CASE_WRITE" | "EVIDENCE_READ" | "FULL_INVESTIGATIVE";
  grantedByOfficerId: string;    // Supervisor or Department Admin authorizer
  createdAt: string;             // ISO-8601
  expiresAt: string;             // ISO-8601
  revokedAt?: string;            // ISO-8601 (if explicitly revoked)
  reason: string;                // Mandatory operational justification
}
```

### Delegation Rules & Invariants
1. **Grant Precedence:** If an officer does not belong to the target case's department, the authorization check calls `hasActiveGrantSync(officer, targetDeptId, targetCaseId)`.
2. **Deterministic Expiry:** Grants past `expiresAt` fail automatically without requiring background cron deletion.
3. **Revocation Immutability:** Revoked grants retain a `revokedAt` timestamp for forensic auditability and evaluate to inactive immediately.
4. **Scope Constraint:** A grant with `CASE_READ` scope does **not** grant rights to delete evidence, approve workflow transitions, or modify officer rosters.

---

## 6. Server-Side Session Invalidation Protocol

Privilege escalation through stale sessions is mitigated through atomic session revocation:
1. When an officer's role, department, or active status is updated via `PATCH /api/officers/[id]`, the server invokes `revokeAllOfficerSessions(officerId)`.
2. All active sessions in the `OfficerSession` table are deleted or marked revoked.
3. Subsequent requests with that session token are immediately rejected with HTTP 401 (`Unauthorized: Session expired or invalid`).
4. If an officer's status is changed to `SUSPENDED`, `canAccessCase()` and `canAccessEvidence()` immediately reject all operations, even if an unrevoked token were presented.
