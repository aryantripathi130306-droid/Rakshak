# Data Requirement Document (DRD) — Rakshak

## 1. Database Schema & Data Models

### 1.1 Relational Schema (PostgreSQL / SQLite via Prisma)

```prisma
model Case {
  id          String         @id @default(uuid())
  caseNumber  String         @unique // e.g., "CASE-2026-0891"
  incidentType String        // e.g., "Task_Scam", "Digital_Arrest"
  status      String         @default("OPEN")
  createdAt   DateTime       @default(now())
  evidence    Evidence[]
  timeline    TimelineEvent[]
  entities    CaseEntity[]
}

model Evidence {
  id          String   @id @default(uuid())
  caseId      String
  case        Case     @relation(fields: [caseId], references: [id])
  fileName    String
  fileType    String
  fileSize    Int
  sha256Hash  String   // Client-computed hash
  storageUrl  String   // Immutable path
  uploadedAt  DateTime @default(now())
  facts       ExtractedFact[]
}

model ExtractedFact {
  id          String   @id @default(uuid())
  evidenceId  String
  evidence    Evidence @relation(fields: [evidenceId], references: [id])
  assertion   String   // e.g., "Transferred ₹25,000"
  entityType  String   // "UPI", "PHONE", "ACCOUNT"
  rawEntity   String   // "scammer@okaxis"
  confidence  Float
  coordinates Json?    // [x1, y1, x2, y2] bounding box
}

model TimelineEvent {
  id          String   @id @default(uuid())
  caseId      String
  case        Case     @relation(fields: [caseId], references: [id])
  timestamp   DateTime
  description String
  sourceType  String   // "WHATSAPP", "BANK_SMS", "RECEIPT"
  evidenceId  String
}

model CaseEntity {
  id          String   @id @default(uuid())
  caseId      String
  case        Case     @relation(fields: [caseId], references: [id])
  entityType  String   // "UPI", "PHONE", "BANK_ACC", "DOMAIN"
  identifier  String   // Normalized value
  linkedCasesCount Int @default(1)

  @@index([identifier])
}
```

### 1.2 Graph Model (Neo4j / Vis.js / React Flow In-Memory Schema)

#### Nodes:
* **CaseNode:** `{ id, caseNumber, incidentType, createdAt }`
* **EntityNode:** `{ id, type: "UPI" | "PHONE" | "ACCOUNT" | "DOMAIN", value: string }`
* **VictimNode:** `{ id, name, location }`

#### Edges:
* `(CaseNode)-[:HAS_ENTITY]->(EntityNode)`
* `(VictimNode)-[:FILED]->(CaseNode)`
* `(EntityNode)-[:LINKED_TO]->(CaseNode)`

## 2. Validation & Regular Expressions
* **UPI VPA:** `^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`
* **Indian Mobile (E.164):** `^(?:\+91|0)?[6-9]\d{9}$`
* **IFSC Code:** `^[A-Z]{4}0[A-Z0-9]{6}$`
* **SHA-256 Digest:** `^[a-fA-F0-9]{64}$`
