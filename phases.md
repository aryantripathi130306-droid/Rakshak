# Implementation Phases (24-48 Hour Roadmap)

## Phase 1: Setup & Data Foundation (Hours 0 - 6)
- [x] Initialize Next.js project with Tailwind CSS and forensic styling.
- [x] Set up Prisma schema with `Case`, `Evidence`, `ExtractedFact`, `TimelineEvent`, and `CaseEntity`.
- [x] Seed database with pre-existing mock cybercrime cases sharing common UPI handles (`mule88@oksbi`, `+919876543210`).
- [x] Implement client-side SHA-256 hash generation using Web Crypto API.

## Phase 2: Evidence Dropzone & Ingestion Pipeline (Hours 6 - 14)
- [x] Build drag-and-drop file vault with instantaneous hash & timestamp preview.
- [x] Implement text extraction routine (Regex pattern matching for UPI, IFSC, Phone).
- [x] Integrate structured output schema for narrative event sequencing.
- [x] Store raw artifacts in cold immutable storage without modifying original signatures.

## Phase 3: Timeline & Source-Traceability UI (Hours 14 - 22)
- [x] Build interactive vertical timeline component mapping events from earliest to latest.
- [x] Add "Click-to-Verify" feature: Clicking an event highlights the source document and bounding box in the inspector drawer.
- [x] Implement Modus Operandi (MO) badge tagging (e.g., "CONTACT", "TRUST", "PAYMENT", "SEVERED").

## Phase 4: Cross-Case Entity Graph (Hours 22 - 30)
- [x] Implement interactive network graph visualization.
- [x] Add real-time node resolution: Match extracted entities against the database.
- [x] Create visual alerts: Highlight shared entity nodes in crimson/amber with syndicate indicators.

## Phase 5: PDF Dossier Export & Polish (Hours 30 - 36)
- [x] Implement single-click PDF export containing the chain of custody manifest, timeline, and entity table.
- [x] Polish UI with Bloomberg/Palantir forensic intelligence dashboard aesthetics.
- [x] Rehearse live pitch using the deterministic seeded demo flow.
