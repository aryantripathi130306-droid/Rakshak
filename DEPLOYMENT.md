# RAKSHAK v3.0 — CONTROLLED STAGING DEPLOYMENT & OPERATIONAL RUNBOOK

Forensic Digital Evidence Intake & Cross-Case Syndicate Intelligence Platform  
Document Classification: **INTERNAL LAW-ENFORCEMENT STAGING DEPLOYMENT**  
Platform Release: **v3.0.0 (Production Build - Next.js 16.4.0 / Turbopack)**

---

## 1. System Architecture & Staging Topology

```
           [TLS / HTTPS 443] (Law Enforcement Internal WAN / VPN)
                                  │
                                  ▼
                 ┌─────────────────────────────────┐
                 │    Nginx / Caddy Reverse Proxy  │
                 │   - TLS 1.3 Strict Termination  │
                 │   - Security Headers Injection  │
                 │   - Static Asset Caching        │
                 └────────────────┬────────────────┘
                                  │ [HTTP 3000 Loopback]
                                  ▼
                 ┌─────────────────────────────────┐
                 │       Next.js 16.4.0 App        │
                 │  - App Router & API Endpoints   │
                 │  - In-Process Forensic OCR      │
                 │  - Deterministic Entity Engine  │
                 └──────┬───────────────────┬──────┘
                        │                   │
         [Prisma Client v5]        [Direct OS File I/O]
                        ▼                   ▼
           ┌───────────────────────┐   ┌───────────────────────────┐
           │ Staging: SQLite       │   │ Content-Addressed Cold    │
           │ Prod: PostgreSQL 16   │   │ Storage: uploads/raw/     │
           │ (schema.postgresql)   │   │ (<sha256>.bin Immutable)  │
           └───────────────────────┘   └───────────────────────────┘
```

---

## 2. Environment Configuration

### Setup Instructions:
1. Copy `.env.example` to `.env.production` or `.env.local`:
   ```bash
   cp .env.example .env.production
   ```
2. Configure mandatory variables:
   - `DATABASE_URL`: Connection string (`file:./dev.db` for pilot staging or `postgresql://...` for cluster).
   - `STRICT_AUTH=true`: Disables unauthenticated demo-mode fallback.
   - `SESSION_SECRET`: 64-character random hex string.
   - `EVIDENCE_STORAGE_PATH`: Absolute or relative path to persistent cold storage (`./uploads/raw`).
   - `MAX_UPLOAD_SIZE_MB`: Maximum permitted file intake size (Default: `100`).

---

## 3. Staging Deployment Execution

### Step 1: Install Dependencies
```bash
npm ci --production=false
```

### Step 2: Build Production Artifact
```bash
npm run build
```
*Output: 23 static pages prerendered, 35 dynamic API routes compiled with Turbopack.*

### Step 3: Run Post-Deployment Smoke Verification
```bash
node scripts/test_phase11_staging_smoke.mjs
```

### Step 4: Start Production Application Server
```bash
npm run start
# Or using PM2 process manager for auto-restart:
pm2 start npm --name "rakshak-staging" -- start
```

---

## 4. HTTPS Reverse Proxy Configuration (Nginx Example)

```nginx
server {
    listen 443 ssl http2;
    server_name rakshak.internal;

    ssl_certificate /etc/ssl/certs/rakshak.crt;
    ssl_certificate_key /etc/ssl/private/rakshak.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self';" always;

    # Client upload limits for digital evidence
    client_max_body_size 100M;

    # Reverse proxy to Next.js production server
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Block direct web access to cold storage binaries
    location /uploads/raw/ {
        deny all;
        return 403;
    }
}
```

---

## 5. PostgreSQL Migration & Cutover Playbook

When promoting from SQLite staging to dedicated PostgreSQL infrastructure:
1. **Pre-Cutover Backup & Verification**:
   - Execute a synchronized snapshot of both database and cold storage binaries:
     ```bash
     node scripts/backup_evidence_db.mjs
     ```
   - Verify isolated sandbox restoration:
     ```bash
     node scripts/restore_evidence_db.mjs
     ```
2. **Schema Definition**:
   - Production PostgreSQL schema is maintained in [`prisma/schema.postgresql.prisma`](file:///e:/Rakshak/prisma/schema.postgresql.prisma).
3. **Export & Cryptographic Hash Audit**:
   - Run the automated migration exporter:
     ```bash
     node scripts/migrate_sqlite_to_postgres.mjs
     ```
   - *Verifies 100% of SHA-256 hashes of all evidence items before outputting payload.*
   - Generates `backups/migration_staging/sqlite_migration_payload.json` containing cases, evidence metadata, extracted facts, timeline events, clusters, legal records, officers, audit logs, reports, and pilot feedback.
4. **Target Schema Application & Validation**:
   - In target environment:
     ```bash
     export DATABASE_URL="postgresql://user:password@pg-host:5432/rakshak_prod?schema=public&sslmode=prefer"
     npx prisma db push --schema=prisma/schema.postgresql.prisma
     ```
5. **Data Population & Foreign-Key Integrity Verification**:
   - Populate records and verify row counts match the manifest table generated by `migrate_sqlite_to_postgres.mjs`.
   - Run referential integrity check across case-to-evidence and case-to-cluster mappings.
6. **Regression Suite Execution on PostgreSQL**:
   - Run complete regression suite against target:
     ```bash
     node scripts/test_phase6_graph.mjs
     node scripts/test_phase7_legal.mjs
     node scripts/test_phase8_reports_rbac.mjs
     node scripts/test_phase9_e2e_ocr.mjs
     node scripts/test_phase10_release_validation.mjs
     node scripts/test_phase11_staging_smoke.mjs
     node scripts/test_phase12_pilot_acceptance.mjs
     node scripts/test_phase13_pilot_operations.mjs
     node scripts/test_phase14_security_assessment.mjs
     ```

---

## 6. Operational Backup & Recovery Procedure

### Automated Backup Snapshot:
```bash
node scripts/backup_evidence_db.mjs
```
- Creates timestamped directory in `backups/snapshots/backup_<timestamp>/`.
- Atomically copies database file (`dev.db`).
- Copies all immutable evidence binaries (`uploads/raw/*.bin`).
- Computes SHA-256 digests of all files and writes `backup_manifest.json` and `backup_manifest.sha256`.

### Isolated Disaster Recovery Test:
```bash
node scripts/restore_evidence_db.mjs
```
- Restores snapshot into sandbox (`temp_restore_verify/`).
- Validates cryptographic manifest signature.
- Verifies byte-level SHA-256 hashes of every restored evidence binary.
- Connects isolated Prisma client and verifies database table row counts.

---

## 7. Operational Health Monitoring

Health Check Endpoint: `GET /api/health`
- **Database**: Ping latency, record count, connectivity.
- **Evidence Cold Storage**: Write/read probe check, total immutable binary count.
- **Security**: `STRICT_AUTH` mode, runtime environment.
- **System**: Node version, platform, RSS memory, heap usage.

```bash
curl -s http://localhost:3000/api/health | jq .
```

---

## 8. Rollback Protocol & Data Reconciliation

In the event of an infrastructure failure, network segmentation fault, or target database cutover abort:

### Trigger Conditions:
- Database connectivity latency exceeds 500ms or connection pool exhaustion occurs.
- Failure of any regression test or evidence SHA-256 mismatch during post-migration verification.
- Upstream network proxy failure or unauthorized inbound routing.

### Step-by-Step Rollback Procedure:
1. **Freeze Ingestion & Stop Application Server**:
   ```bash
   pm2 stop rakshak-staging
   # Or terminate Next.js daemon
   ```
2. **Preserve Target State (Do Not Blindly Overwrite)**:
   - Before rolling back, capture any records created in PostgreSQL during the cutover window:
     ```bash
     pg_dump -U rakshak_app_user -d rakshak_prod -F c -b -v -f backups/aborted_cutover_delta.dump
     ```
3. **Re-point Connection to Verified Baseline**:
   - Revert `DATABASE_URL` in `.env` to the verified baseline SQLite (`file:./dev.db`).
   - If rolling back from a previous snapshot:
     ```bash
     cp backups/snapshots/backup_<target>/database/dev.db prisma/dev.db
     ```
4. **Reconcile Cold Storage Binaries**:
   - Verify that all binaries in `uploads/raw/<sha256>.bin` remain intact and match SHA-256 checksums in the baseline manifest.
   - Never delete primary evidence files during rollback.
5. **Re-execute Full Verification Suite**:
   ```bash
   node scripts/test_phase11_staging_smoke.mjs
   node scripts/test_phase12_pilot_acceptance.mjs
   node scripts/test_phase13_pilot_operations.mjs
   node scripts/test_phase14_security_assessment.mjs
   ```
6. **Log Rollback Action in Audit Ledger**:
   - Record an incident log with operator badge, reason for abort, delta dump reference, and target status.
7. **Restart Application Service**:
   ```bash
   npm run start
   ```

---

## 9. Phase 14 Pilot Readiness & Infrastructure Gates Portal

The system provides an internal operational pilot readiness dashboard:
- **UI Endpoint**: `http://localhost:3000/frontend/pages/pilot-readiness.html`
- **Audit API**: `GET /api/pilot-readiness`
- **Formal Sign-off API**: `POST /api/pilot-readiness`

### Gate C Release Classification Criteria:
The application is categorized as **Gate C (Ready for Controlled Synthetic-Data Staging)**. Ingestion of live, non-synthetic investigative evidence remains strictly prohibited until:
1. External PostgreSQL cluster is provisioned, migrated, and verified.
2. HTTPS reverse proxy (Nginx/Caddy) with TLS 1.3 and firewall perimeter rules are verified.
3. Upstream Next.js security maintenance advisory (14 Oct 2026) is evaluated and applied.
4. Formal departmental sign-offs from all 4 designated authorities are recorded.


