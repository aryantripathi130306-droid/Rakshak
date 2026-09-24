# Rakshak (रक्षक)

> **Forensic Digital Evidence Intake & Cross-Case Syndicate Intelligence Platform**  
> Built for cybercrime cells, forensic investigators, and law enforcement agencies to eliminate AI hallucinations, automate cross-jurisdiction fraud syndicate discovery, and establish statutory cryptographic chain of custody.

---

## 📚 Core System Documents

All foundational architecture, product specifications, data models, and constraints:

1. 📄 **[Product Requirement Document (PRD)](file:///e:/nayay-setu/prd.md)** — Executive overview, personas, and core functional specifications.
2. 🗄️ **[Data Requirement Document (DRD)](file:///e:/nayay-setu/drd.md)** — Relational Prisma schema, in-memory graph topologies, and validation regex rules.
3. 🏛️ **[System Architecture](file:///e:/nayay-setu/architecture.md)** — High-level ingestion and processing pipeline, component stack, and storage design.
4. ⚖️ **[System Rules & Constraints](file:///e:/nayay-setu/rules.md)** — Forensic integrity protocols, legal guardrails (BSA §63), and hackathon engineering directives.
5. 🗺️ **[Implementation Roadmap & Phases](file:///e:/nayay-setu/phases.md)** — 24–48 hour roadmap tracking Phase 1 through Phase 5 deliverables.
6. 🔬 **[5 Technical Pillars & Innovations](file:///e:/nayay-setu/technical_pillars.md)** — Detailed specification of the 5 technical engines (Client-side Hashing, Deterministic Extraction, Source-Traceability, Cross-Case Entity Graph, and Timeline Normalization).

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize Database & Seed
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
```

### 3. Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the Rakshak Forensic Dashboard.
