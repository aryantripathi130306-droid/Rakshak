# RAKSHAK v3.0 — ADMINISTRATOR RUNBOOK & OPERATIONAL MANUAL

**Target Audience**: Systems Administrators, DevOps Engineers, Security Officers, Release Managers  
**Classification**: OFFICIAL — CONFIDENTIAL OPERATIONAL MANUAL  
**Current Revision**: v3.0 (Controlled Synthetic Staging Baseline)  

---

## 1. PLATFORM ARCHITECTURE & RUNTIME TOPOLOGY

```
                         ┌──────────────────────────────────────────────┐
                         │              Target Production Ingress        │
                         │          Nginx Reverse Proxy (Port 443/80)    │
                         │   [TLS 1.3 Termination • HSTS • Rate Limit]  │
                         └──────────────────────┬───────────────────────┘
                                                │ Loopback proxy
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                           RAKSHAK APPLICATION RUNTIME                                 │
│                                                                                       │
│   Next.js 16.4.0 Engine (Port 3000) • Node.js v24.15.0                                │
│   ├─ 12 Vanilla HTML/CSS/JS Frontend Pages (/frontend/pages/*)                        │
│   ├─ 46 API Route Handlers (/api/*) • 61 HTTP Operations                              │
│   ├─ Cryptographic Verification Layer (Dual SHA-256 Invariants)                       │
│   ├─ On-Premises OCR & Deterministic Entity Extraction Engine                         │
│   └─ In-Memory Cross-Case Syndicate Graph Resolver                                    │
│                                                                                       │
│             ┌─────────────────────────┴─────────────────────────┐                     │
│             ▼                                                   ▼                     │
│   Active Staging Database                             Cold Storage Repository         │
│   SQLite: prisma/dev.db (6.5 MB)                      Filesystem: uploads/raw/        │
│   [Target: PostgreSQL 16 Cluster]                     [514 Content-Addressed .bin]    │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. SAFE STARTUP & SHUTDOWN PROCEDURES

### 2.1 Staging Development Startup (Current Workstation Baseline)
```bash
# 1. Verify Node.js and npm versions
node -v   # Expected: v20+ (Verified on v24.15.0)
npm -v    # Expected: 10+  (Verified on 11.12.1)

# 2. Verify Database Existence & Schema Parity
npx prisma generate

# 3. Start Application Server
npm run dev

# 4. Confirm Service Health
curl http://127.0.0.1:3000/api/health
# Expected Response: {"status":"HEALTHY","storage":"UP","database":{"status":"UP"}}
```

### 2.2 Target Linux Production Deployment (When Infrastructure Available)
```bash
# 1. Verify Docker Engine & Compose
docker --version
docker compose version

# 2. Build and Start Multi-Container Stack
docker compose --env-file .env.production up -d --build

# 3. Verify Container Status
docker compose ps
```

### 2.3 Safe Shutdown Procedure
```bash
# Local development mode:
# Terminate the Node.js process gracefully (Ctrl+C or kill SIGTERM).
# Avoid SIGKILL to prevent SQLite WAL locks.

# Containerized deployment:
docker compose down
```

---

## 3. CONFIGURATION & ENVIRONMENT VARIABLES

Configuration is managed via `.env` in local development and `.env.production` in production:

| Variable | Staging Setting | Production Requirement | Purpose |
|---|---|---|---|
| `NODE_ENV` | `development` | `production` | Optimizes Next.js runtime; enforces strict cookie `Secure` flag. |
| `DATABASE_URL` | `file:./dev.db` | `postgresql://user:pass@postgres:5432/rakshak_db` | Connection string for active Prisma database. |
| `STRICT_AUTH` | `false` (lab fallback) | `true` | Enforces mandatory cryptographic token or session cookie validation on all endpoints. |
| `SESSION_SECRET` | Pre-shared lab key | 64-char cryptographically random hex | Key used to sign session cookies and JWT bearer tokens. |
| `MAX_UPLOAD_SIZE_MB` | `100` | `100` | Hard threshold for single exhibit upload payload. |
| `LOG_LEVEL` | `info` | `warn` | Logging granularity. Suppresses sensitive telemetry in production. |

---

## 4. HEALTH MONITORING & DIAGNOSTIC TELEMETRY

The primary health endpoint is located at `GET /api/health`.

### 4.1 Health Check Parameters
A standard HTTP probe returns:
```json
{
  "status": "HEALTHY",
  "version": "3.0.0",
  "environment": "staging",
  "database": {
    "status": "UP",
    "latencyMs": 4,
    "caseCount": 526
  },
  "storage": {
    "status": "UP",
    "totalBinaries": 514,
    "directory": "uploads/raw"
  },
  "timestamp": "2026-10-11T10:14:00.000Z"
}
```

### 4.2 Automated Health Probing (Cron/Systemd)
Incorporate the following curl check into external uptime monitors:
```bash
curl -f -s http://127.0.0.1:3000/api/health | grep -q '"status":"HEALTHY"' || exit 1
```

---

## 5. OFFICER ACCOUNT ADMINISTRATION & RBAC

All administrative officer actions are handled via `/api/officers` (restricted to `ADMIN` role).

### 5.1 Account Provisioning
```bash
# Provisioning an officer via authenticated POST /api/officers
curl -X POST http://127.0.0.1:3000/api/officers \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "badgeNumber": "MH-104",
    "name": "Inspector Rajesh Shinde",
    "email": "rajesh.shinde@cybercrime.gov.in",
    "designation": "Inspector",
    "role": "INVESTIGATOR",
    "jurisdiction": "Pune Cyber Cell",
    "password": "<TEMPORARY_INITIAL_PASSWORD>"
  }'
```
- Passwords are automatically hashed with salted `bcryptjs` (work factor 10).
- Plaintext passwords are never stored in the database or logged.

### 5.2 Officer Account Deactivation
To immediately revoke all active sessions and access permissions for an officer:
```bash
curl -X PATCH http://127.0.0.1:3000/api/officers/<officerId> \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "SUSPENDED" }'
```
Any subsequent request bearing a session belonging to this badge is blocked with HTTP 403 `ACCESS_DENIED`.

---

## 6. COLD STORAGE INTEGRITY VERIFICATION

The cold evidence storage directory (`uploads/raw/`) stores original, unaltered `.bin` evidence exhibits named by their SHA-256 digest.

### 6.1 Executing the Read-Only Evidence Verifier
To audit 100% of physical files against the active database records:
```bash
node scripts/reconcile_evidence_store_phase17.mjs --check-only
```
**Acceptance Criteria**:
- Corrupted Disk Binaries: `0`
- Missing Expected Binaries: `0`
- Digest Mismatches: `0`

---

## 7. BACKUP & DISASTER RECOVERY PROCEDURES

### 7.1 Creating an Operational Snapshot
Automated backups capture:
1. Active database binary.
2. Complete directory tree of `uploads/raw/`.
3. Cryptographic manifest signing every file with its SHA-256 digest.

```bash
# Run backup generator
node scripts/test_phase11_staging_smoke.mjs
# Snapshots are deposited in: backups/snapshots/backup_<TIMESTAMP>/
```

### 7.2 Testing Recovery into an Isolated Sandbox
To verify that a backup can be restored without touching the active database:
```bash
node scripts/validate_disaster_recovery_phase18.mjs
```
The test script extracts the snapshot into `temp_recovery_sandbox/`, checks 100% of binary hashes against the manifest, boots an isolated Prisma client against the restored database, and confirms queryability before cleanly removing the sandbox.

---

## 8. RELEASE PIPELINE AUTOMATION

Before cutting any software release or updating the codebase, execute the full 10-stage automated pipeline:
```bash
node scripts/validate_release_pipeline_phase18.mjs
```
**Pipeline Stages**:
1. Dependency Lockfile Invariant Check
2. TypeScript Static Compilation (`tsc --noEmit`)
3. Production Next.js Build Verification
4. Production Dependency Security Audit (`npm audit`)
5. Historical Regression Suites (Phases 6–15)
6. Phase 16.5 Comprehensive Website Audit (93 assertions)
7. Phase 17 Evidence Store Verifier Tests (15 failure modes)
8. Phase 18 PostgreSQL Migration Rehearsal
9. Phase 18 Isolated Disaster Recovery Rehearsal
10. Deployment Manifests & Hardening Validation

---

## 9. INCIDENT ESCALATION & TROUBLESHOOTING

| Incident Symptom | Root Cause Analysis | Remediation Protocol |
|---|---|---|
| **HTTP 422 `INTEGRITY_VIOLATION` during file upload** | Client-computed SHA-256 does not match server-computed digest. Likely network corruption or tampering in transit. | Advise officer to re-attempt upload from original file source. Inspect network logs. Do not bypass hash verification. |
| **HTTP 409 Conflict during case creation** | Case number collision. | Fixed in Phase 20 (`generateCaseNumber()` now mathematically scans maximum sequence). Verify that `prisma/dev.db` has write permissions. |
| **Database `SQLITE_BUSY` or write lock timeout** | Concurrent write transactions in SQLite. | Ensure transactions are scoped. Staging is limited to moderate concurrency; target production PostgreSQL cluster resolves concurrent write locks. |
| **Console `SyntaxError: Identifier has already been declared`** | Duplicate export in frontend script. | Run `node scripts/check_frontend_imports.mjs`. Ensure every imported symbol is declared exactly once. |
