// ─────────────────────────────────────────────────────────────────────────────
// lib/dossierGeneration.ts
// Rakshak v3.0 — Phase 38 Evidence-Backed Investigative Dossiers & Claim Provenance
//
// Assembles authorized case information, evidence records, custody history,
// timelines, and reviewed cross-case intelligence into structured dossiers.
// Enforces claim-level provenance, deterministic content hashing, and stale detection.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from "node:crypto";
import prisma from "./prisma.ts";
import { canAccessDepartmentAsync, hasPermission, type OfficerProfile } from "./accessControl.ts";

export type ClaimCategory =
  | "RECORDED_FACT"
  | "SOURCE_DERIVED"
  | "CANDIDATE_LEAD"
  | "ANALYST_INTERPRETATION"
  | "REVIEWED_CONCLUSION";

export type ClaimStatus =
  | "PENDING_REVIEW"
  | "ACCEPTED"
  | "REVIEWED"
  | "DISPUTED"
  | "WITHDRAWN";

export interface ClaimRecord {
  claimNumber: string;
  statement: string;
  category: ClaimCategory;
  sourceModel: string;
  sourceRecordId: string;
  sourceCaseId?: string | null;
  sourceEvidenceId?: string | null;
  sourceTimestamp?: Date | null;
  evidenceHash?: string | null;
  custodyRef?: string | null;
  method: string;
  status: ClaimStatus;
  reviewedById?: string | null;
  reviewedAt?: Date | null;
  limitations?: string | null;
  isVerified: boolean;
}

export interface SourceManifestItem {
  model: string;
  recordId: string;
  hashOrRef?: string | null;
  timestamp: string;
}

export interface DossierSectionPayload {
  dossierNumber: string;
  caseId: string;
  caseNumber: string;
  version: number;
  templateVersion: string;
  generatorVersion: string;
  generatedAtUTC: string;
  classification: string;
  statutoryFramework: {
    evidenceAct: string;
    penalCode: string;
    cyberAct: string;
  };
  caseInformation: {
    caseId: string;
    caseNumber: string;
    incidentType: string;
    complainantName: string;
    jurisdiction: string | null;
    status: string;
    amountDefraudedINR: number | null;
    firNumber: string | null;
    officerName: string | null;
    officerBadge: string | null;
    registeredAtUTC: string;
  };
  investigationScope: {
    reportingPeriodStart: string;
    reportingPeriodEnd: string;
    primaryJurisdiction: string;
    participatingDepartments: string[];
  };
  caseSummary: string;
  chronologicalTimeline: Array<{
    eventId: string;
    timestampUTC: string;
    phase: string;
    sourceType: string;
    description: string;
    evidenceId: string | null;
  }>;
  evidenceInventory: Array<{
    evidenceId: string;
    fileName: string;
    fileType: string;
    mimeType: string;
    fileSizeBytes: number;
    sha256Hash: string;
    clientHash: string | null;
    integrityVerified: boolean;
    storageState: string;
    uploadedAtUTC: string;
  }>;
  custodySummary: Array<{
    eventId: string;
    sequenceNumber: number;
    eventType: string;
    evidenceId: string;
    custodianName: string;
    custodianBadge?: string | null;
    sourceDepartment?: string;
    targetDepartment?: string | null;
    integrityHash: string;
    timestampUTC: string;
  }>;
  forensicExaminations: Array<{
    findingId: string;
    evidenceId: string;
    assertion: string;
    entityType: string | null;
    confidence: number;
    verificationStatus: string;
  }>;
  reviewedIntelligenceLinks: Array<{
    linkId: string;
    entityType: string;
    maskedValue: string;
    linkType: string;
    matchRule: string;
    status: string;
    confidenceCategory: string;
    explanation: string;
    targetCaseNumber: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
    reviewRationale: string | null;
  }>;
  outstandingInvestigativeLeads: Array<{
    leadId: string;
    entityType: string;
    maskedValue: string;
    linkType: string;
    matchRule: string;
    status: string;
    confidenceCategory: string;
    explanation: string;
    limitations: string | null;
    disclaimer: string;
  }>;
  contradictoryAndUnresolved: Array<{
    topic: string;
    nature: string;
    details: string;
    affectedRecords: string[];
  }>;
  reviewAndApprovalHistory: Array<{
    reviewId: string;
    decision: string;
    fromStatus: string;
    toStatus: string;
    reviewerName: string;
    reviewerBadge: string | null;
    reviewerRole: string;
    rationale: string;
    reviewedAtUTC: string;
  }>;
  limitationsAndDisclaimers: string[];
  sourceManifest: SourceManifestItem[];
}

/**
 * Deterministic JSON stringify with sorted object keys.
 * Ensures identical objects produce byte-for-byte identical JSON strings across calls.
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJsonStringify).join(",") + "]";
  }
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJsonStringify(obj[key])}`
  );
  return "{" + entries.join(",") + "}";
}

/**
 * Computes deterministic SHA-256 hash of canonical JSON content.
 */
export function computeContentHash(content: any): string {
  const canonicalStr = canonicalJsonStringify(content);
  return crypto.createHash("sha256").update(canonicalStr, "utf8").digest("hex");
}

/**
 * Helper to mask sensitive identifiers for display.
 */
function maskDisplayValue(type: string, val: string): string {
  if (!val) return "";
  if (type === "PHONE") {
    return val.length > 5 ? val.slice(0, 3) + "****" + val.slice(-3) : "****";
  }
  if (type === "EMAIL") {
    const parts = val.split("@");
    return parts[0].length > 2
      ? parts[0].slice(0, 1) + "***" + parts[0].slice(-1) + "@" + (parts[1] || "")
      : "***@" + (parts[1] || "");
  }
  if (type === "ACCOUNT") {
    return val.length > 4 ? "****" + val.slice(-4) : "****";
  }
  return val.length > 8 ? val.slice(0, 4) + "..." + val.slice(-4) : val;
}

/**
 * Core Dossier Assembly & Claim Provenance Engine
 */
export async function assembleInvestigativeDossier(
  caseIdOrNumber: string,
  requester: OfficerProfile,
  options: {
    templateVersion?: string;
    generatorVersion?: string;
    title?: string;
    summary?: string;
    forceNewVersion?: boolean;
    previousVersionId?: string;
  } = {},
  prismaOverride?: any
): Promise<{
  success: boolean;
  statusCode: number;
  dossier?: any;
  error?: string;
  claims?: ClaimRecord[];
}> {
  const p = (prismaOverride ?? prisma) as any;

  // 1. Authenticate & Verify Officer Account Status
  const dbOfficer = await p.officer.findUnique({
    where: { id: requester.id },
    select: { id: true, name: true, badgeNumber: true, role: true, status: true, departmentId: true, jurisdiction: true },
  });

  if (!dbOfficer || dbOfficer.status !== "ACTIVE") {
    return {
      success: false,
      statusCode: 403,
      error: `Access denied: Officer account is ${dbOfficer ? dbOfficer.status : "NON_EXISTENT"}. Active account required.`,
    };
  }

  // 2. Permission check: reports:generate or reports:view
  if (!hasPermission(dbOfficer.role, "reports:generate") && !hasPermission(dbOfficer.role, "case:read")) {
    return {
      success: false,
      statusCode: 403,
      error: `Access denied: Role ${dbOfficer.role} lacks permission to generate dossiers.`,
    };
  }

  // 3. Resolve Target Case
  const targetCase = await p.case.findFirst({
    where: { OR: [{ id: caseIdOrNumber }, { caseNumber: caseIdOrNumber }] },
    include: {
      evidence: {
        include: {
          facts: true,
          transcriptions: true,
          chatTranslations: true,
        },
        orderBy: { uploadedAt: "asc" },
      },
      timeline: { orderBy: { timestamp: "asc" } },
      entities: { orderBy: { firstSeenAt: "asc" } },
      legalMappings: true,
      department: true,
    },
  });

  if (!targetCase) {
    return {
      success: false,
      statusCode: 404,
      error: `Case not found: ${caseIdOrNumber}`,
    };
  }

  // 4. Case-Level Authorization & Department Boundary Check
  const isAuthorized = await canAccessDepartmentAsync(
    dbOfficer,
    targetCase.jurisdiction,
    targetCase.departmentId,
    p
  );

  if (!isAuthorized) {
    return {
      success: false,
      statusCode: 403,
      error: "Access denied: Target case belongs to another departmental jurisdiction without an active access grant.",
    };
  }

  // 5. Fetch Custody Events for Evidence
  const evidenceIds = targetCase.evidence.map((e: any) => e.id);
  const custodyEvents = evidenceIds.length > 0
    ? await p.custodyEvent.findMany({
        where: { evidenceId: { in: evidenceIds } },
        orderBy: [{ evidenceId: "asc" }, { sequenceNumber: "asc" }],
      })
    : [];

  // 6. Fetch Entity Links associated with Case
  const entityLinks = await p.entityLink.findMany({
    where: {
      OR: [{ sourceCaseId: targetCase.id }, { targetCaseId: targetCase.id }],
    },
    include: {
      reviews: { orderBy: { reviewedAt: "desc" }, take: 1 },
      sourceCase: { select: { id: true, caseNumber: true, departmentId: true, jurisdiction: true } },
      targetCase: { select: { id: true, caseNumber: true, departmentId: true, jurisdiction: true } },
    },
  });

  // Filter accessible entity links: targetCase must also be accessible to the officer,
  // or foreign case details must be scrubbed / excluded to prevent unauthorized intelligence leakage!
  const authorizedConfirmedLinks: any[] = [];
  const authorizedCandidateLeads: any[] = [];
  const rejectedOrRevokedLinks: any[] = [];

  for (const el of entityLinks) {
    const otherCase = el.sourceCaseId === targetCase.id ? el.targetCase : el.sourceCase;
    const canAccessOther = otherCase
      ? await canAccessDepartmentAsync(dbOfficer, otherCase.jurisdiction, otherCase.departmentId, p)
      : false;

    // Build representation
    const rep = {
      linkId: el.id,
      entityType: el.entityType,
      maskedValue: maskDisplayValue(el.entityType, el.normalizedValue),
      linkType: el.linkType,
      matchRule: el.matchRule,
      status: el.status,
      confidenceCategory: el.confidenceCategory,
      explanation: el.explanation,
      targetCaseNumber: canAccessOther ? otherCase?.caseNumber : "[RESTRICTED_DEPARTMENT_CASE]",
      targetCaseAccessible: canAccessOther,
      reviewedBy: el.reviewedBy,
      reviewedAt: el.reviewedAt ? el.reviewedAt.toISOString() : null,
      reviewRationale: el.reviewRationale,
      limitations: el.limitations,
      isGeneric: el.isGeneric,
    };

    if (el.status === "CONFIRMED") {
      authorizedConfirmedLinks.push(rep);
    } else if (el.status === "CANDIDATE" || el.status === "UNDER_REVIEW") {
      authorizedCandidateLeads.push({
        leadId: el.id,
        entityType: el.entityType,
        maskedValue: maskDisplayValue(el.entityType, el.normalizedValue),
        linkType: el.linkType,
        matchRule: el.matchRule,
        status: el.status,
        confidenceCategory: el.confidenceCategory,
        explanation: el.explanation,
        limitations: el.limitations || "Candidate match requires independent analytical verification.",
        disclaimer: "INVESTIGATIVE LEAD ONLY — NOT PROOF OF IDENTITY OR GUILT",
      });
    } else if (el.status === "REJECTED" || el.status === "REVOKED") {
      rejectedOrRevokedLinks.push(rep);
    }
  }

  // 7. Check for Contradictory Information & Unresolved Discrepancies
  const contradictoryItems: Array<{ topic: string; nature: string; details: string; affectedRecords: string[] }> = [];

  // A. Check evidence integrity failures
  for (const ev of targetCase.evidence) {
    if (ev.clientHash && ev.sha256Hash && ev.clientHash !== ev.sha256Hash) {
      contradictoryItems.push({
        topic: `Evidence Exhibit Integrity Mismatch: ${ev.fileName}`,
        nature: "INTEGRITY_MISMATCH",
        details: `Client-reported SHA-256 (${ev.clientHash.slice(0, 12)}...) differs from server-calculated SHA-256 (${ev.sha256Hash.slice(0, 12)}...).`,
        affectedRecords: [ev.id],
      });
    }
  }

  // B. Check revoked links or rejected candidate links
  for (const r of rejectedOrRevokedLinks) {
    contradictoryItems.push({
      topic: `Previously Disputed Cross-Case Link: ${r.entityType} (${r.maskedValue})`,
      nature: r.status === "REVOKED" ? "LINK_REVOCATION" : "LINK_REJECTION",
      details: `Earlier candidate relationship was evaluated and marked ${r.status}. Rationale: ${r.reviewRationale || "No rationale recorded"}.`,
      affectedRecords: [r.linkId],
    });
  }

  // 8. Compile Source Manifest & Factual Claims Mapping
  const sourceManifest: SourceManifestItem[] = [];
  const claims: ClaimRecord[] = [];
  let claimSeq = 1;

  // Claim: Case Registration
  claims.push({
    claimNumber: `CLM-${String(claimSeq++).padStart(3, "0")}`,
    statement: `Case ${targetCase.caseNumber} registered for incident type ${targetCase.incidentType} on behalf of complainant ${targetCase.complainantName}.`,
    category: "RECORDED_FACT",
    sourceModel: "Case",
    sourceRecordId: targetCase.id,
    sourceCaseId: targetCase.id,
    sourceTimestamp: targetCase.createdAt,
    method: "DIRECT_FIELD_EXTRACTION",
    status: "ACCEPTED",
    isVerified: true,
  });
  sourceManifest.push({
    model: "Case",
    recordId: targetCase.id,
    timestamp: targetCase.updatedAt.toISOString(),
  });

  // Claim: Financial Defraudment Amount if present
  if (targetCase.amountDefrauded != null) {
    claims.push({
      claimNumber: `CLM-${String(claimSeq++).padStart(3, "0")}`,
      statement: `Reported defrauded amount is INR ${targetCase.amountDefrauded.toLocaleString("en-IN")}.`,
      category: "RECORDED_FACT",
      sourceModel: "Case",
      sourceRecordId: targetCase.id,
      sourceCaseId: targetCase.id,
      sourceTimestamp: targetCase.createdAt,
      method: "DIRECT_FIELD_EXTRACTION",
      status: "ACCEPTED",
      isVerified: true,
    });
  }

  // Claims for Evidence Exhibits
  for (const ev of targetCase.evidence) {
    const isIntegrityOk = !ev.clientHash || ev.clientHash === ev.sha256Hash;
    claims.push({
      claimNumber: `CLM-${String(claimSeq++).padStart(3, "0")}`,
      statement: `Evidence exhibit ${ev.fileName} (${ev.fileType}, ${ev.fileSize} bytes) ingested into cold vault with SHA-256 ${ev.sha256Hash}.`,
      category: "RECORDED_FACT",
      sourceModel: "Evidence",
      sourceRecordId: ev.id,
      sourceCaseId: targetCase.id,
      sourceEvidenceId: ev.id,
      sourceTimestamp: ev.uploadedAt,
      evidenceHash: ev.sha256Hash,
      method: "DIRECT_FIELD_EXTRACTION",
      status: isIntegrityOk ? "ACCEPTED" : "DISPUTED",
      limitations: isIntegrityOk ? undefined : "Evidence failed client-server hash verification.",
      isVerified: isIntegrityOk,
    });
    sourceManifest.push({
      model: "Evidence",
      recordId: ev.id,
      hashOrRef: ev.sha256Hash,
      timestamp: ev.uploadedAt.toISOString(),
    });

    // Claims for Extracted Facts
    for (const f of ev.facts || []) {
      const isExtVerified = f.verificationStatus === "VERIFIED";
      claims.push({
        claimNumber: `CLM-${String(claimSeq++).padStart(3, "0")}`,
        statement: `Extracted observation from ${ev.fileName}: "${f.factAssertion}" (confidence: ${f.confidence}).`,
        category: isExtVerified ? "RECORDED_FACT" : "SOURCE_DERIVED",
        sourceModel: "ExtractedFact",
        sourceRecordId: f.id,
        sourceCaseId: targetCase.id,
        sourceEvidenceId: ev.id,
        sourceTimestamp: f.extractedAt,
        evidenceHash: ev.sha256Hash,
        method: "DETERMINISTIC_EXTRACTION",
        status: isExtVerified ? "ACCEPTED" : "PENDING_REVIEW",
        limitations: isExtVerified ? undefined : "Automated extraction pending officer verification.",
        isVerified: isExtVerified,
      });
      sourceManifest.push({
        model: "ExtractedFact",
        recordId: f.id,
        timestamp: f.extractedAt.toISOString(),
      });
    }
  }

  // Claims for Custody Events
  for (const ce of custodyEvents) {
    const hash = ce.eventHash || "N/A";
    claims.push({
      claimNumber: `CLM-${String(claimSeq++).padStart(3, "0")}`,
      statement: `Custody event #${ce.sequenceNumber} (${ce.eventType}) executed by ${ce.actor}. Integrity hash: ${hash.slice(0, 16)}...`,
      category: "RECORDED_FACT",
      sourceModel: "CustodyEvent",
      sourceRecordId: ce.id,
      sourceCaseId: targetCase.id,
      sourceEvidenceId: ce.evidenceId,
      sourceTimestamp: ce.timestamp,
      custodyRef: hash,
      method: "DIRECT_FIELD_EXTRACTION",
      status: "ACCEPTED",
      isVerified: true,
    });
    sourceManifest.push({
      model: "CustodyEvent",
      recordId: ce.id,
      hashOrRef: hash,
      timestamp: ce.timestamp.toISOString(),
    });
  }

  // Claims for Confirmed Intelligence Links
  for (const l of authorizedConfirmedLinks) {
    claims.push({
      claimNumber: `CLM-${String(claimSeq++).padStart(3, "0")}`,
      statement: `Analyst-confirmed intelligence relationship: Shared ${l.entityType} (${l.maskedValue}) linked to ${l.targetCaseNumber}. Explanation: ${l.explanation}.`,
      category: "REVIEWED_CONCLUSION",
      sourceModel: "EntityLink",
      sourceRecordId: l.linkId,
      sourceCaseId: targetCase.id,
      method: "ENTITY_RESOLUTION",
      status: "REVIEWED",
      reviewedById: l.reviewedBy,
      reviewedAt: l.reviewedAt ? new Date(l.reviewedAt) : null,
      isVerified: true,
    });
    sourceManifest.push({
      model: "EntityLink",
      recordId: l.linkId,
      hashOrRef: l.matchRule,
      timestamp: l.reviewedAt || new Date().toISOString(),
    });
  }

  // Claims for Candidate Leads (Must NOT be marked verified or confirmed!)
  for (const cand of authorizedCandidateLeads) {
    claims.push({
      claimNumber: `CLM-${String(claimSeq++).padStart(3, "0")}`,
      statement: `Candidate investigative lead: Potential match on ${cand.entityType} (${cand.maskedValue}). Rule: ${cand.matchRule}.`,
      category: "CANDIDATE_LEAD",
      sourceModel: "EntityLink",
      sourceRecordId: cand.leadId,
      sourceCaseId: targetCase.id,
      method: "ENTITY_RESOLUTION",
      status: "PENDING_REVIEW",
      limitations: cand.limitations,
      isVerified: false,
    });
    sourceManifest.push({
      model: "EntityLink",
      recordId: cand.leadId,
      hashOrRef: cand.matchRule,
      timestamp: new Date().toISOString(),
    });
  }

  // 9. Versioning & Dossier Identification
  const templateVersion = options.templateVersion || "DOSSIER_TEMPLATE_V1";
  const generatorVersion = options.generatorVersion || "RAKSHAK_DOSSIER_GEN_V1";

  // Check existing versions for this case
  const existingDossiers = await p.investigativeDossier.findMany({
    where: { caseId: targetCase.id },
    orderBy: { version: "desc" },
    take: 1,
  });

  const nextVersion = existingDossiers.length > 0 ? existingDossiers[0].version + 1 : 1;
  const previousVersionId = options.previousVersionId || (existingDossiers.length > 0 ? existingDossiers[0].id : null);

  const dossierSeq = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
  const dossierNumber = `DOS-${new Date().getFullYear()}-${targetCase.caseNumber}-${dossierSeq}`;
  const title = options.title || `Forensic Dossier: ${targetCase.caseNumber} (v${nextVersion})`;
  const summary = options.summary || `Comprehensive investigative dossier for Case #${targetCase.caseNumber} (${targetCase.incidentType}).`;

  // 10. Assemble Structured Dossier Payload
  const dossierPayload: DossierSectionPayload = {
    dossierNumber,
    caseId: targetCase.id,
    caseNumber: targetCase.caseNumber,
    version: nextVersion,
    templateVersion,
    generatorVersion,
    generatedAtUTC: new Date().toISOString(),
    classification: "CONFIDENTIAL // LAW ENFORCEMENT PROCEEDING EXHIBIT",
    statutoryFramework: {
      evidenceAct: "Bharatiya Sakshya Adhiniyam, 2023 — Section 63",
      penalCode: "Bharatiya Nyaya Sanhita, 2023",
      cyberAct: "Information Technology Act, 2000",
    },
    caseInformation: {
      caseId: targetCase.id,
      caseNumber: targetCase.caseNumber,
      incidentType: targetCase.incidentType,
      complainantName: targetCase.complainantName,
      jurisdiction: targetCase.jurisdiction,
      status: targetCase.status,
      amountDefraudedINR: targetCase.amountDefrauded,
      firNumber: targetCase.firNumber,
      officerName: targetCase.officerName,
      officerBadge: targetCase.officerBadge,
      registeredAtUTC: targetCase.createdAt.toISOString(),
    },
    investigationScope: {
      reportingPeriodStart: targetCase.createdAt.toISOString(),
      reportingPeriodEnd: new Date().toISOString(),
      primaryJurisdiction: targetCase.jurisdiction || "State Cyber Crime",
      participatingDepartments: [targetCase.department?.name || targetCase.jurisdiction || "Primary Unit"],
    },
    caseSummary: summary,
    chronologicalTimeline: targetCase.timeline.map((tl: any) => ({
      eventId: tl.id,
      timestampUTC: tl.timestamp.toISOString(),
      phase: tl.phase,
      sourceType: tl.sourceType,
      description: tl.description,
      evidenceId: tl.evidenceId,
    })),
    evidenceInventory: targetCase.evidence.map((ev: any) => ({
      evidenceId: ev.id,
      fileName: ev.fileName,
      fileType: ev.fileType,
      mimeType: ev.mimeType,
      fileSizeBytes: ev.fileSize,
      sha256Hash: ev.sha256Hash,
      clientHash: ev.clientHash,
      integrityVerified: !ev.clientHash || ev.clientHash === ev.sha256Hash,
      storageState: "IMMUTABLE_COLD_STORAGE",
      uploadedAtUTC: ev.uploadedAt.toISOString(),
    })),
    custodySummary: custodyEvents.map((ce: any) => ({
      eventId: ce.id,
      sequenceNumber: ce.sequenceNumber,
      eventType: ce.eventType,
      evidenceId: ce.evidenceId,
      custodianName: ce.actor,
      integrityHash: ce.eventHash || "N/A",
      timestampUTC: ce.timestamp.toISOString(),
    })),
    forensicExaminations: targetCase.evidence.flatMap((ev: any) =>
      (ev.facts || []).map((f: any) => ({
        findingId: f.id,
        evidenceId: ev.id,
        assertion: f.factAssertion,
        entityType: f.entityType,
        confidence: f.confidence,
        verificationStatus: f.verificationStatus || "UNVERIFIED",
      }))
    ),
    reviewedIntelligenceLinks: authorizedConfirmedLinks,
    outstandingInvestigativeLeads: authorizedCandidateLeads,
    contradictoryAndUnresolved: contradictoryItems,
    reviewAndApprovalHistory: [],
    limitationsAndDisclaimers: [
      "This dossier compiles evidence exhibits, custody logs, and analytical findings recorded in Rakshak v3.0.",
      "Automated extractions and candidate leads constitute investigative intelligence only and do not establish guilt.",
      "Finalized conclusions are subject to independent judicial evaluation under Section 63 of Bharatiya Sakshya Adhiniyam, 2023.",
    ],
    sourceManifest,
  };

  // 11. Compute Canonical Content Hash
  const canonicalContentJson = canonicalJsonStringify(dossierPayload);
  const contentHash = computeContentHash(dossierPayload);

  // 12. Save Dossier & Claims in Database Transaction
  const createdDossier = await p.$transaction(async (tx: any) => {
    // If regenerating, mark previous version as SUPERSEDED if it was already approved/finalized
    if (previousVersionId) {
      await tx.investigativeDossier.updateMany({
        where: { id: previousVersionId, status: { in: ["APPROVED", "FINALIZED"] } },
        data: { status: "SUPERSEDED" },
      });
    }

    const dossier = await tx.investigativeDossier.create({
      data: {
        dossierNumber,
        caseId: targetCase.id,
        version: nextVersion,
        title,
        status: "GENERATED",
        templateVersion,
        generatorVersion,
        summary,
        contentJson: canonicalContentJson,
        contentHash,
        sourceManifest: JSON.stringify(sourceManifest),
        isStale: false,
        generatedById: dbOfficer.id,
        generatedByName: dbOfficer.name,
        generatedByBadge: dbOfficer.badgeNumber,
        previousVersionId,
      },
    });

    // Create claims
    if (claims.length > 0) {
      await tx.dossierClaim.createMany({
        data: claims.map((c) => ({
          dossierId: dossier.id,
          claimNumber: c.claimNumber,
          statement: c.statement,
          category: c.category,
          sourceModel: c.sourceModel,
          sourceRecordId: c.sourceRecordId,
          sourceCaseId: c.sourceCaseId,
          sourceEvidenceId: c.sourceEvidenceId,
          sourceTimestamp: c.sourceTimestamp,
          evidenceHash: c.evidenceHash,
          custodyRef: c.custodyRef,
          method: c.method,
          status: c.status,
          limitations: c.limitations,
          isVerified: c.isVerified,
        })),
      });
    }

    return dossier;
  });

  return {
    success: true,
    statusCode: 200,
    dossier: createdDossier,
    claims,
  };
}

/**
 * Checks if a generated dossier is stale compared to active DB records.
 */
export async function checkDossierStaleness(
  dossierId: string,
  prismaOverride?: any
): Promise<{ isStale: boolean; reason?: string }> {
  const p = (prismaOverride ?? prisma) as any;

  const dossier = await p.investigativeDossier.findUnique({
    where: { id: dossierId },
  });

  if (!dossier) return { isStale: false };
  if (dossier.isStale) return { isStale: true, reason: dossier.staleReason || "Marked stale" };

  let manifest: SourceManifestItem[] = [];
  try {
    manifest = JSON.parse(dossier.sourceManifest);
  } catch (_) {
    return { isStale: false };
  }

  // Check Case updates
  const caseItem = manifest.find((m) => m.model === "Case");
  if (caseItem) {
    const c = await p.case.findUnique({ where: { id: caseItem.recordId }, select: { updatedAt: true } });
    if (c && (new Date(c.updatedAt).getTime() > new Date(caseItem.timestamp).getTime() || c.updatedAt.toISOString() > caseItem.timestamp)) {
      return { isStale: true, reason: "Target case details were updated after dossier generation." };
    }
  }

  // Check Evidence count or updates
  const evidenceItems = manifest.filter((m) => m.model === "Evidence");
  const currentEvidenceCount = await p.evidence.count({ where: { caseId: dossier.caseId } });
  if (currentEvidenceCount !== evidenceItems.length) {
    return { isStale: true, reason: "New evidence items were uploaded or removed after dossier generation." };
  }

  // Check CustodyEvent count
  const custodyItems = manifest.filter((m) => m.model === "CustodyEvent");
  const currentCustodyCount = await p.custodyEvent.count({
    where: { evidence: { caseId: dossier.caseId } },
  });
  if (currentCustodyCount !== custodyItems.length) {
    return { isStale: true, reason: "New custody events recorded on case evidence after dossier generation." };
  }

  return { isStale: false };
}

/**
 * Marks a dossier stale in database.
 */
export async function markDossierStale(
  dossierId: string,
  reason: string,
  prismaOverride?: any
): Promise<void> {
  const p = (prismaOverride ?? prisma) as any;
  await p.investigativeDossier.update({
    where: { id: dossierId },
    data: { isStale: true, staleReason: reason },
  });
}
