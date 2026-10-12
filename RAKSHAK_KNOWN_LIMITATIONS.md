# RAKSHAK v3.0 — KNOWN LIMITATIONS & UNRESOLVED GATES

**Document Purpose**: Honest, comprehensive register of all infrastructure dependencies, operational constraints, security reviews, and external approvals that remain incomplete or unverified.  
**Platform Version**: Rakshak v3.0  
**Current Date**: October 11, 2026  
**Auditor**: Senior DevOps Engineer, Application Security Reviewer & Release Manager  

---

> [!WARNING]
> **GOVERNANCE NOTICE**  
> Software feature completion must NEVER be conflated with production operational authorization. While the Rakshak web application is feature-complete for synthetic-data staging, it is **NOT AUTHORIZED FOR PRODUCTION DEPLOYMENT** until every external gate in this document is resolved.

---

## 1. OPERATIONAL & DATA GOVERNANCE LIMITATIONS

### 1.1 Synthetic Data Exclusivity (Non-Negotiable)
- **Current State**: The platform contains 526 synthetic cases, 609 synthetic evidence records, and 514 synthetic binary exhibits.
- **Limitation**: Ingestion of real citizen complaints, live First Information Reports (FIRs), actual bank account transactions, or genuine suspect PII is **STRICTLY PROHIBITED AND DISABLED**.
- **Requirement for Removal**: Complete departmental data protection clearance, ISO/IEC 27001 data classification compliance, and formal Data Protection Officer (DPO) signoff.

### 1.2 Development Mode Strict Auth Fallback
- **Current State**: In development mode (`NODE_ENV=development` with `STRICT_AUTH=false`), unauthenticated API requests default to the lab demo officer (`DL-002`, ACP Vikram Singh) to permit seamless local testing.
- **Limitation**: If deployed to production with `STRICT_AUTH=false`, unauthenticated requests could access endpoints.
- **Mitigation**: Production deployment manifests enforce `NODE_ENV=production` and `STRICT_AUTH=true`, which returns HTTP 401 for any unauthenticated request.

---

## 2. INFRASTRUCTURE & HOST DEPENDENCY GATES

| Infrastructure Component | Staging Baseline Status | Target Production Requirement | Blocker Detail |
|---|---|---|---|
| **PostgreSQL Database** | SQLite (`prisma/dev.db`) | Dedicated PostgreSQL 16+ Cluster with SSL & replication | No PostgreSQL server is running on port 5432 on the Windows development workstation. Offline migration rehearsal passed, but live query load is unverified. |
| **Container Engine** | Native Node.js execution | Multi-container Docker Compose / Kubernetes | Docker Engine and Docker Compose CLI are not installed on the Windows workstation. Manifests are verified for syntax, but container startup is blocked. |
| **Reverse Proxy (Nginx)** | Direct Node loopback | Hardened Nginx 1.26+ reverse proxy | Neither Nginx nor Caddy is installed locally. HTTP ports 80/443 are closed. |
| **Production HTTPS/TLS** | HTTP loopback (`http://127.0.0.1:3000`) | TLS 1.3 with authorized departmental CA certificate | No authorized departmental SSL certificate exists for the local workstation. |
| **Network Perimeter** | Loopback binding | Hardware/software firewall restricted to police CIDR subnets | Host firewall and external network perimeter cannot be verified from a local workstation. |

---

## 3. DEPENDENCY & SECURITY ADVISORY GATES

### 3.1 Upstream Next.js Advisory (October 14, 2026)
- **Current Status**: `REVIEW REQUIRED`
- **Execution Date**: October 11, 2026.
- **Details**: The Phase 18 and 19 reports identified a planned upstream Next.js security announcement scheduled for October 14, 2026. Because that date is 3 days in the future, no official patch exists on npm (`next@latest` is `16.4.0`, identical to the installed version).
- **Residual Risk**: Potential raw HTTP parsing vulnerabilities in the internal server. Mitigated in target architecture by fronting with Nginx.
- **Next Action**: Execute the intake and patch verification protocol defined in [PHASE19_SECURITY_ADVISORY_REPORT.md](file:///e:/Rakshak/PHASE19_SECURITY_ADVISORY_REPORT.md) on October 14, 2026.

---

## 4. EXTERNAL CLEARANCE & APPROVAL GATES

### 4.1 Departmental Authorization (PENDING)
- Formal operational authorization from the Head of Cyber Crime, State Police Headquarters, or central investigative agency remains pending.
- Operational deployment to field units is prohibited without written authorization.

### 4.2 Independent Application Security Assessment (PENDING)
- While internal security audits and automated tests (path traversal, RBAC, input validation, SQL injection prevention) passed with 0 defects, an **independent third-party CREST-certified penetration test** has not yet been conducted.
- A formal AppSec penetration testing report is required prior to production rollout.

### 4.3 Forensic & Statutory Legal Certification (PENDING)
- The technical generation of Bharatiya Sakshya Adhiniyam, 2023 (BSA) Section 63 electronic evidence certificates has been implemented and verified.
- However, formal review and admissibility certification by the Directorate of Prosecution or designated standing legal counsel remains pending.
