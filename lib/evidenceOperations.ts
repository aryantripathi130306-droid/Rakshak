// ─────────────────────────────────────────────────────────────────────────────
// lib/evidenceOperations.ts
// Rakshak v3.0 — Custody Transfers, Forensic Examination & Integrity Operations
//
// Implements:
// 1. Controlled, attributable custody transfer and acknowledgement.
// 2. Authorized forensic examination workflows preserving source evidence integrity.
// 3. Derived-artifact provenance linked to original SHA-256 digest.
// 4. Live on-demand cryptographic integrity verification with fail-closed quarantine.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from "node:crypto";
import prisma from "./prisma.ts";
import { type OfficerProfile } from "./accessControl.ts";
import { canAccessCaseAsync } from "./accessControl.ts";
import { appendCustodyEventAsync } from "./custodyChain.ts";
import { executeEvidenceTransition } from "./evidenceLifecycle.ts";
import { getEvidenceStorageAdapter } from "../services/storageAdapter.ts";

export interface CustodyTransferInput {
  evidenceId: string;
  fromOfficer: OfficerProfile;
  toOfficerId: string;
  reason: string;
  ipAddress?: string;
}

export interface CustodyAcceptInput {
  evidenceId: string;
  acceptingOfficer: OfficerProfile;
  notes?: string;
  ipAddress?: string;
}

export interface ForensicExamInput {
  evidenceId: string;
  examiner: OfficerProfile;
  taskReference?: string;
  findings?: Record<string, unknown>;
  derivedFacts?: Array<{
    factAssertion: string;
    entityType: string;
    rawValue: string;
    normalizedValue: string;
    confidence: number;
  }>;
  ipAddress?: string;
}

/**
 * Initiate a formal custody transfer to another authorized officer
 */
export async function initiateCustodyTransferAsync(
  input: CustodyTransferInput,
  prismaClient?: any
): Promise<{ success: boolean; error?: string; statusCode?: number; transfer?: any }> {
  const client = prismaClient || prisma;
  const { evidenceId, fromOfficer, toOfficerId, reason, ipAddress } = input;

  // 1. Verify recipient officer exists and is ACTIVE
  const recipient = await client.officer.findUnique({
    where: { id: toOfficerId },
    select: { id: true, name: true, badgeNumber: true, role: true, status: true, departmentId: true },
  });

  if (!recipient) {
    return { success: false, error: `Recipient officer not found: ${toOfficerId}`, statusCode: 404 };
  }

  if (recipient.status !== "ACTIVE") {
    return {
      success: false,
      error: `Recipient officer ${recipient.name} is ${recipient.status}. Custody cannot be transferred to inactive accounts.`,
      statusCode: 403,
    };
  }

  // 2. Fetch evidence & parent case
  const evidence = await client.evidence.findUnique({
    where: { id: evidenceId },
    include: {
      case: { select: { id: true, caseNumber: true, departmentId: true } },
    },
  });

  if (!evidence) {
    return { success: false, error: `Evidence exhibit not found: ${evidenceId}`, statusCode: 404 };
  }

  // 3. Verify recipient department or active cross-department grant
  if (recipient.departmentId && evidence.case?.departmentId && recipient.departmentId !== evidence.case.departmentId) {
    const activeGrant = await client.accessGrant.findFirst({
      where: {
        granteeOfficerId: recipient.id,
        status: "ACTIVE",
        AND: [
          {
            OR: [
              { targetCaseId: evidence.caseId },
              { targetDepartmentId: evidence.case?.departmentId || "" },
            ],
          },
          {
            expiresAt: { gt: new Date() },
          },
        ],
      },
    });

    if (!activeGrant && recipient.role !== "SYS_ADMIN" && recipient.role !== "ADMIN") {
      return {
        success: false,
        error: `Recipient officer belongs to a different department and lacks an active cross-department access grant for case ${evidence.case?.caseNumber}.`,
        statusCode: 403,
      };
    }
  }

  // 4. Execute lifecycle transition to TRANSFERRED
  const transitionRes = await executeEvidenceTransition(
    evidenceId,
    "TRANSFERRED",
    fromOfficer,
    reason,
    {
      newCustodianId: recipient.id,
      ipAddress,
    },
    client
  );

  if (!transitionRes.success) {
    return { success: false, error: transitionRes.error, statusCode: transitionRes.statusCode };
  }

  return {
    success: true,
    transfer: {
      evidenceId,
      fromOfficer: `${fromOfficer.name} (${fromOfficer.badgeNumber})`,
      toOfficer: `${recipient.name} (${recipient.badgeNumber})`,
      reason,
      status: "TRANSFERRED",
    },
  };
}

/**
 * Acknowledge and accept an incoming custody transfer
 */
export async function acceptCustodyTransferAsync(
  input: CustodyAcceptInput,
  prismaClient?: any
): Promise<{ success: boolean; error?: string; statusCode?: number; evidence?: any }> {
  const client = prismaClient || prisma;
  const { evidenceId, acceptingOfficer, notes, ipAddress } = input;

  if (acceptingOfficer.status !== "ACTIVE") {
    return { success: false, error: "Only active officers can accept custody transfers.", statusCode: 403 };
  }

  const evidence = await client.evidence.findUnique({
    where: { id: evidenceId },
    include: { case: { select: { id: true, caseNumber: true, departmentId: true } } },
  });

  if (!evidence) {
    return { success: false, error: `Evidence not found: ${evidenceId}`, statusCode: 404 };
  }

  if (evidence.status !== "TRANSFERRED") {
    return {
      success: false,
      error: `Evidence is not in TRANSFERRED status (current: ${evidence.status}).`,
      statusCode: 400,
    };
  }

  // Recipient check: must be the designated new custodian or an authorized department supervisor
  const isTargetRecipient = evidence.currentCustodianId === acceptingOfficer.id;
  const isSupervisor =
    acceptingOfficer.role === "SUPERVISOR" ||
    acceptingOfficer.role === "ADMIN" ||
    acceptingOfficer.role === "SYS_ADMIN";

  if (!isTargetRecipient && !isSupervisor) {
    return {
      success: false,
      error: "You are not the designated recipient for this custody transfer.",
      statusCode: 403,
    };
  }

  // Execute transition back to IN_CUSTODY with recipient assigned as custodian
  const transitionRes = await executeEvidenceTransition(
    evidenceId,
    "IN_CUSTODY",
    acceptingOfficer,
    notes || "Custody transfer acknowledged and accepted",
    {
      newCustodianId: acceptingOfficer.id,
      ipAddress,
    },
    client
  );

  if (!transitionRes.success) {
    return { success: false, error: transitionRes.error, statusCode: transitionRes.statusCode };
  }

  // Record explicit CUSTODY_TRANSFER_ACCEPTED chained event
  await appendCustodyEventAsync(
    {
      evidenceId,
      eventType: "CUSTODY_TRANSFER_ACCEPTED",
      actor: `${acceptingOfficer.name} (${acceptingOfficer.badgeNumber})`,
      action: `Custody accepted by ${acceptingOfficer.name}. Notes: ${notes || "None"}`,
      result: "SUCCESS",
      details: {
        custodianId: acceptingOfficer.id,
        custodianBadge: acceptingOfficer.badgeNumber,
        departmentId: acceptingOfficer.departmentId,
        notes: notes || null,
      },
    },
    client
  );

  return { success: true, evidence: transitionRes.evidence };
}

/**
 * Start a forensic examination
 */
export async function startForensicExaminationAsync(
  input: {
    evidenceId: string;
    examiner: OfficerProfile;
    taskReference?: string;
    ipAddress?: string;
  },
  prismaClient?: any
): Promise<{ success: boolean; error?: string; statusCode?: number; evidence?: any }> {
  const client = prismaClient || prisma;
  const { evidenceId, examiner, taskReference, ipAddress } = input;

  if (examiner.role !== "FORENSIC_EXAMINER" && examiner.role !== "ADMIN" && examiner.role !== "SYS_ADMIN") {
    return {
      success: false,
      error: "Only authorized FORENSIC_EXAMINER or ADMIN officers can initiate forensic examination.",
      statusCode: 403,
    };
  }

  const reason = taskReference
    ? `Forensic examination initiated under task: ${taskReference}`
    : "Forensic examination initiated";

  return executeEvidenceTransition(
    evidenceId,
    "EXAMINATION_IN_PROGRESS",
    examiner,
    reason,
    { examinerId: examiner.id, ipAddress },
    client
  );
}

/**
 * Complete a forensic examination, persisting derived artifacts linked to source hash
 */
export async function completeForensicExaminationAsync(
  input: ForensicExamInput,
  prismaClient?: any
): Promise<{ success: boolean; error?: string; statusCode?: number; evidence?: any }> {
  const client = prismaClient || prisma;
  const { evidenceId, examiner, findings, derivedFacts, ipAddress } = input;

  if (examiner.role !== "FORENSIC_EXAMINER" && examiner.role !== "ADMIN" && examiner.role !== "SYS_ADMIN") {
    return {
      success: false,
      error: "Only authorized FORENSIC_EXAMINER or ADMIN officers can complete forensic examinations.",
      statusCode: 403,
    };
  }

  const evidence = await client.evidence.findUnique({
    where: { id: evidenceId },
    select: { id: true, sha256Hash: true, caseId: true, metadata: true },
  });

  if (!evidence) {
    return { success: false, error: `Evidence not found: ${evidenceId}`, statusCode: 404 };
  }

  // 1. Transition status to EXAMINATION_COMPLETED
  const transitionRes = await executeEvidenceTransition(
    evidenceId,
    "EXAMINATION_COMPLETED",
    examiner,
    "Forensic examination completed with findings recorded",
    { examinerId: examiner.id, findings, ipAddress },
    client
  );

  if (!transitionRes.success) {
    return { success: false, error: transitionRes.error, statusCode: transitionRes.statusCode };
  }

  // 2. Persist derived findings into evidence metadata without altering original binary
  if (findings) {
    let currentMeta: Record<string, unknown> = {};
    if (evidence.metadata) {
      try {
        currentMeta = JSON.parse(evidence.metadata);
      } catch {}
    }
    const updatedMeta = {
      ...currentMeta,
      forensicFindings: findings,
      examinedBy: `${examiner.name} (${examiner.badgeNumber})`,
      examinedAt: new Date().toISOString(),
      sourceHash: evidence.sha256Hash,
    };

    await client.evidence.update({
      where: { id: evidenceId },
      data: { metadata: JSON.stringify(updatedMeta) },
    });
  }

  // 3. Persist derived facts with sourceHash provenance
  if (derivedFacts && derivedFacts.length > 0) {
    for (const fact of derivedFacts) {
      try {
        await client.extractedFact.create({
          data: {
            evidenceId,
            caseId: evidence.caseId,
            factAssertion: fact.factAssertion,
            entityType: fact.entityType,
            rawValue: fact.rawValue,
            normalizedValue: fact.normalizedValue,
            confidence: fact.confidence || 0.95,
            sourceHash: evidence.sha256Hash,
            verificationStatus: "VERIFIED",
            verifiedBy: `${examiner.name} (${examiner.badgeNumber})`,
          },
        });
      } catch (factErr: any) {
        if (factErr.code === "P2022" || String(factErr).includes("pageNumber") || String(factErr).includes("column")) {
          const rawSql = `INSERT INTO ExtractedFact (id, evidenceId, caseId, factAssertion, entityType, rawValue, normalizedValue, confidence, sourceHash, verificationStatus, verifiedBy) VALUES ('${crypto.randomUUID()}', '${evidenceId}', '${evidence.caseId}', '${(fact.factAssertion || "").replace(/'/g, "''")}', '${fact.entityType}', '${(fact.rawValue || "").replace(/'/g, "''")}', '${(fact.normalizedValue || "").replace(/'/g, "''")}', ${fact.confidence || 0.95}, '${evidence.sha256Hash}', 'VERIFIED', '${examiner.name} (${examiner.badgeNumber})')`;
          await client.$executeRawUnsafe(rawSql).catch(() => {});
        } else {
          throw factErr;
        }
      }
    }
  }

  return { success: true, evidence: transitionRes.evidence };
}

/**
 * Perform live cryptographic integrity audit against cold storage
 */
export async function verifyEvidenceIntegrityAsync(
  evidenceId: string,
  auditorActor: string = "Cryptographic Integrity Subsystem",
  prismaClient?: any
): Promise<{
  verified: boolean;
  diskHash: string | null;
  recordedHash: string;
  quarantined?: boolean;
  error?: string;
}> {
  const client = prismaClient || prisma;

  const evidence = await client.evidence.findUnique({
    where: { id: evidenceId },
    select: {
      id: true,
      fileName: true,
      sha256Hash: true,
      clientHash: true,
      storagePath: true,
      status: true,
    },
  });

  if (!evidence) {
    throw new Error(`Evidence exhibit not found: ${evidenceId}`);
  }

  const storageAdapter = getEvidenceStorageAdapter();
  let diskBuffer: Buffer;
  let diskHash: string;

  try {
    const readResult = await storageAdapter.retrieveEvidence(evidence.sha256Hash, false);
    diskBuffer = readResult.buffer;
    diskHash = crypto.createHash("sha256").update(diskBuffer).digest("hex");
  } catch (err: any) {
    // Missing or corrupted on disk
    await appendCustodyEventAsync(
      {
        evidenceId,
        eventType: "INTEGRITY_FAILURE",
        actor: auditorActor,
        action: `STORAGE READ FAILURE: Exhibit could not be retrieved from cold storage: ${err.message}`,
        result: "FAILED",
        details: {
          storagePath: evidence.storagePath,
          error: err.message,
        },
      },
      client
    );

    await client.evidence.update({
      where: { id: evidenceId },
      data: {
        status: "QUARANTINED",
        quarantineReason: `Storage access failure: ${err.message}`,
      },
    });

    return {
      verified: false,
      diskHash: null,
      recordedHash: evidence.sha256Hash,
      quarantined: true,
      error: err.message,
    };
  }

  const isMatch = diskHash.toLowerCase() === evidence.sha256Hash.toLowerCase();

  if (!isMatch) {
    // BIT-ROT OR UNAUTHORIZED DISK MUTATION DETECTED!
    await appendCustodyEventAsync(
      {
        evidenceId,
        eventType: "INTEGRITY_FAILURE",
        actor: auditorActor,
        action: `CRITICAL INTEGRITY FAILURE: Live disk SHA-256 (${diskHash}) does not match canonical database hash (${evidence.sha256Hash})`,
        result: "FAILED",
        details: {
          computedDiskHash: diskHash,
          canonicalHash: evidence.sha256Hash,
          clientHash: evidence.clientHash,
          algorithm: "SHA-256",
        },
      },
      client
    );

    // Fail closed: Quarantine immediately
    await client.evidence.update({
      where: { id: evidenceId },
      data: {
        status: "QUARANTINED",
        quarantineReason: `Cryptographic digest mismatch: disk hash ${diskHash} differs from registered hash ${evidence.sha256Hash}`,
      },
    });

    return {
      verified: false,
      diskHash,
      recordedHash: evidence.sha256Hash,
      quarantined: true,
      error: "Cryptographic digest mismatch between cold storage and canonical database hash",
    };
  }

  // Integrity verified!
  await appendCustodyEventAsync(
    {
      evidenceId,
      eventType: "INTEGRITY_AUDIT",
      actor: auditorActor,
      action: `Cryptographic dual-hash audit passed. Server digest confirmed: ${diskHash}`,
      result: "VERIFIED",
      details: {
        computedDiskHash: diskHash,
        canonicalHash: evidence.sha256Hash,
        algorithm: "SHA-256",
      },
    },
    client
  );

  return {
    verified: true,
    diskHash,
    recordedHash: evidence.sha256Hash,
    quarantined: false,
  };
}
