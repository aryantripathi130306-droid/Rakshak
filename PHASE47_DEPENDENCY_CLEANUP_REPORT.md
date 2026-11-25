# PHASE 47 — Dependency Cleanup Report

**Date:** 2026-11-25  
**Mode:** Controlled Two-Group Removal + Lockfile Synchronization  
**TypeScript Status:** `tsc --noEmit` → Exit Code `0`  
**Audit Status:** `npm audit --audit-level=high` → Exit Code `0` (0 high/critical vulnerabilities; 1 moderate advisory on `next@16.4.3`)

---

## 1. Removed Packages (Confirmed Zero Usage)

### Group 1 — Unused Radix UI Primitives (41 packages pruned including transitives)
- `@radix-ui/react-dialog`
- `@radix-ui/react-tabs`
- `@radix-ui/react-tooltip`

**Verification:** Zero static/dynamic imports across `app/`, `components/`, `lib/`, `services/`, `scripts/`, and `public/frontend/`.  
**Post-Removal Checks:** `tsc --noEmit` (after regenerating `@prisma/client-pg`), `check_frontend_imports.mjs` (0), `check_frontend_integrity.mjs` (0).

### Group 2 — Unused Styling Utilities (3 packages pruned)
- `class-variance-authority`
- `clsx`
- `tailwind-merge`

**Verification:** Zero static/dynamic imports across the repository.  
**Post-Removal Checks:** `prisma validate` (SQLite + PostgreSQL), `tsc --noEmit` (0), `check_frontend_imports.mjs` (0), `check_frontend_integrity.mjs` (0), `next build --webpack` (0).

---

## 2. Retained Packages (Explicitly Investigated & Kept)

| Package | Why Retained |
|---|---|
| `@xyflow/react` | Actively imported by `components/tabs/GraphView.tsx` → `components/InvestigationDashboard.tsx` → `app/page.tsx`. Removing it would break `tsc --noEmit` and `next build`. |
| `lucide-react` | Actively imported by 11 React components under `components/`. |
| `html2canvas` | Referenced by vendored `public/frontend/vendor/jspdf.umd.min.js`. |
| `@types/bcryptjs`, `@types/jszip`, `@types/pdf-parse` | Implicitly consumed by TypeScript for typed imports. |
| `next@16.4.3` | Core framework. `npm audit` reports 1 moderate advisory; not upgraded during Phase 47 to avoid unrequested breaking changes. |

---

## 3. Lockfile & Prisma Client Note
- `package.json` and `package-lock.json` were updated together via `npm.cmd uninstall`.
- Because `npm uninstall` prunes generated `node_modules/@prisma/client-pg`, `prisma generate --schema=prisma/schema.postgresql.prisma` was executed immediately after Group 2 removal to restore `@prisma/client-pg`.
