// ─────────────────────────────────────────────────────────────────────────────
// lib/custodyChain.ts
// Rakshak v3.0 — Cryptographic Chain-of-Custody Event Ledger & Independent Verifier
//
// Hardened in Phase 36.1:
// 1. Complete Event-Hash Coverage: V2 canonicalization protecting eventId, evidenceId,
//    sequenceNumber, prevEventHash, eventType, actor, action, result, timestamp,
//    and complete structured metadata (actorId, departmentId, reason, caseId, etc.).
// 2. Deterministic Canonical Serialization: Key-sorted, whitespace-normalized, versioned.
// 3. Concurrency & Sequence Safety: In-memory mutex serialization per evidenceId with
//    database transactional retries and unique sequence constraint compatibility.
// 4. Trust Anchors & Independent Checkpoints: HMAC-SHA256 checkpoint signatures to detect
//    privileged full-chain rewrites beyond the zero-filled GENESIS_HASH.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from "node:crypto";
import prisma from "./prisma.ts";

export const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";
export const CANONICAL_VERSION_V1 = "v1";
export const CANONICAL_VERSION_V2 = "v2";
export const SUPPORTED_CANONICAL_VERSIONS = [CANONICAL_VERSION_V1, CANONICAL_VERSION_V2];

export type CustodyEventType =
  | "INTAKE_UPLOAD"
  | "HASH_VERIFIED"
  | "EVIDENCE_ACCEPTED"
  | "QUARANTINED"
  | "REJECTED"
  | "CUSTODIAN_ASSIGNED"
  | "CUSTODY_TRANSFER_INITIATED"
  | "CUSTODY_TRANSFER_ACCEPTED"
  | "CUSTODY_TRANSFER_REJECTED"
  | "EXAMINATION_STARTED"
  | "EXAMINATION_COMPLETED"
  | "EVIDENCE_SEALED"
  | "EVIDENCE_UNSEALED"
  | "EVIDENCE_RELEASED"
  | "INTEGRITY_AUDIT"
  | "INTEGRITY_FAILURE"
  | "EVIDENCE_ACCESSED"
  | "EVIDENCE_DOWNLOADED"
  | "METADATA_UPDATED"
  | "OFFICER_NOTE";

export type CustodyResult = "SUCCESS" | "VERIFIED" | "FAILED" | "WARNING";

export interface CustodyEventInput {
  id?: string;
  evidenceId: string;
  eventType: CustodyEventType | string;
  actor: string;
  action: string;
  result?: CustodyResult;
  details?: Record<string, unknown> | string | null;
  timestamp?: Date;
  canonicalVersion?: "v1" | "v2";
}

export interface CustodyChainVerificationResult {
  valid: boolean;
  eventCount: number;
  error?: string;
  brokenAtIndex?: number;
  expectedHash?: string;
  actualHash?: string;
  canonicalVersion?: string;
}

export interface CustodyCheckpoint {
  checkpointId: string;
  evidenceId: string;
  latestSequenceNumber: number;
  latestEventHash: string;
  timestamp: string;
  keyId: string;
  algorithm: string;
  signature: string;
}

/**
 * Deterministically serialize any JavaScript value:
 * - Primitives (string, number, boolean, null)
 * - Objects: keys are sorted lexicographically, undefined/functions omitted
 * - Arrays: elements recursively canonicalized
 * - Dates: converted to standard ISO-8601 UTC string
 */
export function canonicalStringify(val: unknown): string {
  if (val === null || val === undefined) {
    return "null";
  }
  if (typeof val === "boolean" || typeof val === "number") {
    return JSON.stringify(val);
  }
  if (typeof val === "string") {
    return JSON.stringify(val.trim());
  }
  if (val instanceof Date) {
    return JSON.stringify(val.toISOString());
  }
  if (Array.isArray(val)) {
    return "[" + val.map((item) => canonicalStringify(item)).join(",") + "]";
  }
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const sortedKeys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    const parts = sortedKeys.map(
      (k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`
    );
    return "{" + parts.join(",") + "}";
  }
  return JSON.stringify(String(val));
}

/**
 * Deterministically serialize a details object or string with sorted keys (legacy helper)
 */
export function canonicalizeDetails(details: unknown): string {
  if (!details) return "";
  if (typeof details === "string") {
    try {
      const parsed = JSON.parse(details);
      return canonicalizeDetails(parsed);
    } catch {
      return details.trim();
    }
  }
  if (typeof details === "object" && details !== null) {
    if (Array.isArray(details)) {
      return "[" + details.map((item) => canonicalizeDetails(item)).join(",") + "]";
    }
    const keys = Object.keys(details as Record<string, unknown>).sort();
    const parts = keys.map(
      (k) => `${JSON.stringify(k)}:${canonicalizeDetails((details as Record<string, unknown>)[k])}`
    );
    return "{" + parts.join(",") + "}";
  }
  return JSON.stringify(details);
}

export interface ComputeEventHashParams {
  canonicalVersion?: "v1" | "v2";
  eventId?: string;
  evidenceId: string;
  sequenceNumber: number;
  eventType: string;
  actor: string;
  action: string;
  result: string;
  timestamp: Date | string;
  prevEventHash: string;
  details?: unknown;
}

/**
 * Compute the deterministic SHA-256 hash of a custody event.
 * Supports V2 (default: full coverage canonical JSON) and V1 (Phase 36 pipe-delimited format).
 */
export function computeEventHash(params: ComputeEventHashParams): string {
  const version = params.canonicalVersion || CANONICAL_VERSION_V2;
  const tsStr =
    params.timestamp instanceof Date
      ? params.timestamp.toISOString()
      : new Date(params.timestamp).toISOString();

  if (version === CANONICAL_VERSION_V1) {
    const canonDetails = canonicalizeDetails(params.details);
    const canonicalPayload = [
      params.evidenceId,
      params.sequenceNumber,
      params.eventType,
      params.actor,
      params.action,
      params.result,
      tsStr,
      params.prevEventHash,
      canonDetails,
    ].join("|");
    return crypto.createHash("sha256").update(canonicalPayload, "utf8").digest("hex");
  }

  // Version 2: Complete Canonical JSON Envelope
  let detailsObj: any = null;
  if (params.details) {
    if (typeof params.details === "string") {
      try {
        detailsObj = JSON.parse(params.details);
      } catch {
        detailsObj = { raw: params.details.trim() };
      }
    } else if (typeof params.details === "object") {
      detailsObj = params.details;
    }
  }

  const v2Envelope = {
    action: (params.action || "").trim(),
    actor: (params.actor || "").trim(),
    canonicalVersion: CANONICAL_VERSION_V2,
    details: detailsObj,
    eventId: params.eventId || null,
    evidenceId: (params.evidenceId || "").trim(),
    eventType: (params.eventType || "").trim(),
    prevEventHash: (params.prevEventHash || "").trim(),
    result: (params.result || "SUCCESS").trim(),
    sequenceNumber: Number(params.sequenceNumber),
    timestamp: tsStr,
  };

  const serializedV2 = canonicalStringify(v2Envelope);
  return crypto.createHash("sha256").update(serializedV2, "utf8").digest("hex");
}

// In-process per-evidence FIFO serialization lock to avoid concurrency races
const evidenceLockQueues = new Map<string, Promise<void>>();

async function withEvidenceLock<T>(evidenceId: string, fn: () => Promise<T>): Promise<T> {
  const previous = evidenceLockQueues.get(evidenceId) || Promise.resolve();
  let release: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  evidenceLockQueues.set(evidenceId, previous.then(() => current));
  await previous;
  try {
    return await fn();
  } finally {
    release!();
    if (evidenceLockQueues.get(evidenceId) === current) {
      evidenceLockQueues.delete(evidenceId);
    }
  }
}

/**
 * Append a cryptographically chained custody event to the relational ledger.
 * Serialized per evidence exhibit to prevent sequence collisions or chain forks.
 */
/**
 * Append a cryptographically chained custody event to the relational ledger.
 * Coordinates serialization across multiple processes via PostgreSQL advisory locks,
 * and maintains in-process serialization for single-process safety.
 */
export async function appendCustodyEventAsync(
  input: CustodyEventInput,
  prismaClient?: any
): Promise<any> {
  const client = prismaClient || prisma;
  const now = input.timestamp || new Date();
  const resultStatus: CustodyResult = input.result || "SUCCESS";
  const canonicalVersion = input.canonicalVersion || CANONICAL_VERSION_V2;
  const eventId = input.id || crypto.randomUUID();

  // 1. Strict Fail-Closed Input Validation
  if (!input.evidenceId || typeof input.evidenceId !== "string" || !input.evidenceId.trim()) {
    throw new Error("Missing or invalid evidenceId for custody event");
  }
  if (!input.eventType || typeof input.eventType !== "string" || !input.eventType.trim()) {
    throw new Error("Missing or invalid eventType for custody event");
  }
  if (!input.actor || typeof input.actor !== "string" || !input.actor.trim()) {
    throw new Error("Missing or invalid actor for custody event");
  }
  if (!input.action || typeof input.action !== "string" || !input.action.trim()) {
    throw new Error("Missing or invalid action for custody event");
  }
  if (!SUPPORTED_CANONICAL_VERSIONS.includes(canonicalVersion as any)) {
    throw new Error(`Unsupported canonicalization version: '${canonicalVersion}'`);
  }

  return withEvidenceLock(input.evidenceId, async () => {
    // Retry loop for cross-process concurrency and transaction serialization conflicts
    const MAX_RETRIES = 5;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const runTx = typeof client.$transaction === "function"
          ? (fn: (tx: any) => Promise<any>) => client.$transaction(fn, { timeout: 10000, maxWait: 5000 })
          : (fn: (tx: any) => Promise<any>) => fn(client);

        return await runTx(async (tx: any) => {
          // Attempt PostgreSQL transaction-level advisory lock per evidenceId
          // This ensures that independent Node processes serialize append operations for this exhibit
          try {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(('x' || substr(md5('custody_chain_' || ${input.evidenceId}), 1, 16))::bit(64)::bigint);`;
          } catch {
            // Not supported on SQLite or mock environments
          }

          // Authoritative read of the latest recorded event for this evidence under lock
          const lastEvent = await tx.custodyEvent.findFirst({
            where: { evidenceId: input.evidenceId },
            orderBy: [{ sequenceNumber: "desc" }, { timestamp: "desc" }],
            select: { id: true, sequenceNumber: true, eventHash: true },
          });

          const nextSeq = (lastEvent?.sequenceNumber || 0) + 1;
          const prevHash = lastEvent?.eventHash || GENESIS_HASH;

          // Validate prevHash format
          if (!prevHash || !/^[0-9a-f]{64}$/.test(prevHash)) {
            throw new Error(`Previous event hash is invalid or malformed: '${prevHash}'`);
          }

          // Ensure canonicalVersion is recorded inside details for transparent verification
          let structuredDetails: any = null;
          if (input.details) {
            if (typeof input.details === "string") {
              try {
                structuredDetails = JSON.parse(input.details);
              } catch {
                structuredDetails = { note: input.details.trim() };
              }
            } else if (typeof input.details === "object") {
              structuredDetails = { ...input.details };
            }
          }
          if (canonicalVersion === CANONICAL_VERSION_V2) {
            structuredDetails = structuredDetails || {};
            structuredDetails.canonicalVersion = CANONICAL_VERSION_V2;
          }

          const eventHash = computeEventHash({
            canonicalVersion,
            eventId,
            evidenceId: input.evidenceId,
            sequenceNumber: nextSeq,
            eventType: input.eventType,
            actor: input.actor,
            action: input.action,
            result: resultStatus,
            timestamp: now,
            prevEventHash: prevHash,
            details: structuredDetails,
          });

          // Validate computed eventHash format before persistence
          if (!eventHash || !/^[0-9a-f]{64}$/.test(eventHash)) {
            throw new Error("Computed eventHash is missing, empty, or malformed");
          }

          const detailsString = structuredDetails
            ? JSON.stringify(structuredDetails)
            : null;

          return await tx.custodyEvent.create({
            data: {
              id: eventId,
              evidenceId: input.evidenceId,
              eventType: input.eventType,
              actor: input.actor,
              action: input.action,
              result: resultStatus,
              details: detailsString,
              timestamp: now,
              prevEventHash: prevHash,
              eventHash,
              sequenceNumber: nextSeq,
            },
          });
        });
      } catch (err: any) {
        lastErr = err;
        // If error is an explicit validation error, fail immediately without retrying
        if (
          err.message?.includes("Unsupported canonicalization version") ||
          err.message?.includes("invalid or malformed") ||
          err.message?.includes("Missing or invalid")
        ) {
          throw err;
        }

        if (attempt < MAX_RETRIES) {
          const jitter = Math.floor(Math.random() * 25);
          await new Promise((res) => setTimeout(res, 25 * attempt + jitter));
          continue;
        }
        throw lastErr;
      }
    }
  });
}

/**
 * Verify cryptographic integrity of an array of custody events.
 * Detects:
 * - Altered actor, action, result, or details (including metadata fields)
 * - Altered timestamp or sequence number
 * - Missing/deleted events in sequence
 * - Reordered events
 * - Missing or malformed event hashes
 * - Invalid genesis or predecessor hash
 * - Unsupported canonicalization versions
 */
export function verifyCustodyChainEvents(events: any[]): CustodyChainVerificationResult {
  if (!events || events.length === 0) {
    return { valid: true, eventCount: 0 };
  }

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const expectedSeq = i + 1;

    // 1. Check sequence continuity and ordering
    if (ev.sequenceNumber !== undefined && ev.sequenceNumber !== null && ev.sequenceNumber !== expectedSeq) {
      return {
        valid: false,
        eventCount: events.length,
        brokenAtIndex: i,
        error: `Sequence discontinuity or reordering detected at index ${i}: expected #${expectedSeq}, got #${ev.sequenceNumber}`,
      };
    }

    // 2. Validate hash presence and format
    if (!ev.eventHash || !/^[0-9a-f]{64}$/.test(ev.eventHash)) {
      return {
        valid: false,
        eventCount: events.length,
        brokenAtIndex: i,
        error: `Missing or malformed event hash at event #${ev.sequenceNumber || expectedSeq}`,
      };
    }

    // 3. Check prevEventHash linkage
    const expectedPrevHash = i === 0 ? GENESIS_HASH : events[i - 1].eventHash;
    if (ev.prevEventHash && ev.prevEventHash !== expectedPrevHash) {
      return {
        valid: false,
        eventCount: events.length,
        brokenAtIndex: i,
        expectedHash: expectedPrevHash,
        actualHash: ev.prevEventHash,
        error: `Broken hash chain at event #${ev.sequenceNumber || i + 1}: prevEventHash mismatch`,
      };
    }

    // 4. Inspect details for canonical version and unsupported version check
    let parsedDetails: any = null;
    if (ev.details) {
      if (typeof ev.details === "string") {
        try {
          parsedDetails = JSON.parse(ev.details);
        } catch {
          parsedDetails = { raw: ev.details };
        }
      } else if (typeof ev.details === "object") {
        parsedDetails = ev.details;
      }
    }

    const version = parsedDetails?.canonicalVersion;
    if (version && !SUPPORTED_CANONICAL_VERSIONS.includes(version)) {
      return {
        valid: false,
        eventCount: events.length,
        brokenAtIndex: i,
        error: `Unsupported or malformed canonicalization version at event #${ev.sequenceNumber || i + 1}: ${version}`,
      };
    }

    // 5. Recompute eventHash and verify
    let hashMatches = false;

    // If tagged as v2, verify V2 first
    if (version === CANONICAL_VERSION_V2) {
      const computedV2 = computeEventHash({
        canonicalVersion: CANONICAL_VERSION_V2,
        eventId: ev.id,
        evidenceId: ev.evidenceId,
        sequenceNumber: ev.sequenceNumber || expectedSeq,
        eventType: ev.eventType,
        actor: ev.actor,
        action: ev.action,
        result: ev.result,
        timestamp: ev.timestamp,
        prevEventHash: ev.prevEventHash || expectedPrevHash,
        details: ev.details,
      });
      if (computedV2 === ev.eventHash) {
        hashMatches = true;
      } else {
        return {
          valid: false,
          eventCount: events.length,
          brokenAtIndex: i,
          expectedHash: ev.eventHash,
          actualHash: computedV2,
          error: `Tampering detected at event #${ev.sequenceNumber || i + 1}: digest recalculation failed (V2)`,
        };
      }
    } else {
      // Try V1 (Phase 36 baseline)
      const computedV1 = computeEventHash({
        canonicalVersion: CANONICAL_VERSION_V1,
        eventId: ev.id,
        evidenceId: ev.evidenceId,
        sequenceNumber: ev.sequenceNumber || expectedSeq,
        eventType: ev.eventType,
        actor: ev.actor,
        action: ev.action,
        result: ev.result,
        timestamp: ev.timestamp,
        prevEventHash: ev.prevEventHash || expectedPrevHash,
        details: ev.details,
      });

      if (computedV1 === ev.eventHash) {
        hashMatches = true;
      } else {
        // If V1 fails, check V2 in case it wasn't explicitly tagged
        const computedV2 = computeEventHash({
          canonicalVersion: CANONICAL_VERSION_V2,
          eventId: ev.id,
          evidenceId: ev.evidenceId,
          sequenceNumber: ev.sequenceNumber || expectedSeq,
          eventType: ev.eventType,
          actor: ev.actor,
          action: ev.action,
          result: ev.result,
          timestamp: ev.timestamp,
          prevEventHash: ev.prevEventHash || expectedPrevHash,
          details: ev.details,
        });

        if (computedV2 === ev.eventHash) {
          hashMatches = true;
        } else {
          return {
            valid: false,
            eventCount: events.length,
            brokenAtIndex: i,
            expectedHash: ev.eventHash,
            actualHash: computedV1,
            error: `Tampering detected at event #${ev.sequenceNumber || i + 1}: digest recalculation failed`,
          };
        }
      }
    }
  }

  return { valid: true, eventCount: events.length };
}

/**
 * Verify complete custody chain directly from database for a specific evidence exhibit
 */
export async function verifyCustodyChainAsync(
  evidenceId: string,
  prismaClient?: any
): Promise<CustodyChainVerificationResult> {
  const client = prismaClient || prisma;
  const events = await client.custodyEvent.findMany({
    where: { evidenceId },
    orderBy: { sequenceNumber: "asc" },
  });

  return verifyCustodyChainEvents(events);
}

/**
 * Generate a digitally signed custody checkpoint anchored outside the database.
 */
export function createCustodyCheckpoint(params: {
  evidenceId: string;
  latestSequenceNumber: number;
  latestEventHash: string;
  keyId: string;
  secretOrKey: string;
  timestamp?: Date | string;
}): CustodyCheckpoint {
  const now = params.timestamp
    ? params.timestamp instanceof Date
      ? params.timestamp.toISOString()
      : new Date(params.timestamp).toISOString()
    : new Date().toISOString();

  const checkpointId = crypto.randomUUID();
  const payload = canonicalStringify({
    checkpointId,
    evidenceId: params.evidenceId.trim(),
    keyId: params.keyId.trim(),
    latestEventHash: params.latestEventHash.trim(),
    latestSequenceNumber: Number(params.latestSequenceNumber),
    timestamp: now,
  });

  const signature = crypto
    .createHmac("sha256", params.secretOrKey)
    .update(payload, "utf8")
    .digest("hex");

  return {
    checkpointId,
    evidenceId: params.evidenceId.trim(),
    latestSequenceNumber: Number(params.latestSequenceNumber),
    latestEventHash: params.latestEventHash.trim(),
    timestamp: now,
    keyId: params.keyId.trim(),
    algorithm: "HMAC-SHA256",
    signature,
  };
}

/**
 * Cryptographically verify an independent custody checkpoint signature.
 */
export function verifyCustodyCheckpoint(
  checkpoint: CustodyCheckpoint,
  secretOrKey: string
): { valid: boolean; error?: string } {
  if (!checkpoint || !checkpoint.signature) {
    return { valid: false, error: "Missing checkpoint or signature" };
  }

  const payload = canonicalStringify({
    checkpointId: checkpoint.checkpointId,
    evidenceId: checkpoint.evidenceId.trim(),
    keyId: checkpoint.keyId.trim(),
    latestEventHash: checkpoint.latestEventHash.trim(),
    latestSequenceNumber: Number(checkpoint.latestSequenceNumber),
    timestamp: checkpoint.timestamp,
  });

  const expectedSig = crypto
    .createHmac("sha256", secretOrKey)
    .update(payload, "utf8")
    .digest("hex");

  if (expectedSig !== checkpoint.signature) {
    return { valid: false, error: "Checkpoint cryptographic signature invalid (signature mismatch)" };
  }

  return { valid: true };
}

export interface VerifyChainWithCheckpointOptions {
  requireHead?: boolean;
}

/**
 * Verify custody chain against an authoritative external checkpoint trust anchor.
 * Catches complete chain rewrites where an adversary recomputed all hashes from genesis,
 * as well as cross-evidence substitution and older sequence checkpoints on altered chains.
 */
export function verifyChainWithCheckpoint(
  events: any[],
  checkpoint: CustodyCheckpoint,
  secretOrKey: string,
  options?: VerifyChainWithCheckpointOptions
): CustodyChainVerificationResult {
  // 1. Validate checkpoint signature itself
  const sigResult = verifyCustodyCheckpoint(checkpoint, secretOrKey);
  if (!sigResult.valid) {
    return {
      valid: false,
      eventCount: events.length,
      error: `Trust anchor verification failed: ${sigResult.error}`,
    };
  }

  // 2. Match checkpoint target evidence
  if (events.length === 0) {
    return {
      valid: false,
      eventCount: 0,
      error: "Trust anchor validation failed: chain is empty but checkpoint specifies events",
    };
  }

  if (checkpoint.evidenceId && events[0].evidenceId !== checkpoint.evidenceId) {
    return {
      valid: false,
      eventCount: events.length,
      error: `Trust anchor evidenceId mismatch: checkpoint=${checkpoint.evidenceId}, chain=${events[0].evidenceId}`,
    };
  }

  // 3. Validate internal chain consistency
  const chainResult = verifyCustodyChainEvents(events);
  if (!chainResult.valid) {
    return chainResult;
  }

  const latestChainSeq = events[events.length - 1].sequenceNumber || events.length;
  if (options?.requireHead && checkpoint.latestSequenceNumber !== latestChainSeq) {
    return {
      valid: false,
      eventCount: events.length,
      error: `Trust anchor sequence mismatch: checkpoint certifies #${checkpoint.latestSequenceNumber} but chain head is #${latestChainSeq}. Stale checkpoint cannot certify altered newer chain.`,
    };
  }

  const checkpointEvent = events.find((e) => e.sequenceNumber === checkpoint.latestSequenceNumber);
  if (!checkpointEvent) {
    return {
      valid: false,
      eventCount: events.length,
      error: `Trust anchor event #${checkpoint.latestSequenceNumber} not found in chain`,
    };
  }

  if (checkpointEvent.eventHash !== checkpoint.latestEventHash) {
    return {
      valid: false,
      eventCount: events.length,
      expectedHash: checkpoint.latestEventHash,
      actualHash: checkpointEvent.eventHash,
      error: `Trust anchor mismatch at event #${checkpoint.latestSequenceNumber}: database chain digest (${checkpointEvent.eventHash.slice(0, 16)}...) does not match certified checkpoint digest (${checkpoint.latestEventHash.slice(0, 16)}...). Detected complete-chain rewrite.`,
    };
  }

  return { valid: true, eventCount: events.length };
}

/**
 * Authoritatively generate a custody checkpoint directly from verified database events.
 * Fetches events under lock, verifies the entire chain, and issues a cryptographically
 * signed checkpoint for the chain head.
 */
export async function createCustodyCheckpointFromDbAsync(
  evidenceId: string,
  options: {
    keyId: string;
    secretOrKey: string;
    prismaClient?: any;
    timestamp?: Date | string;
  }
): Promise<{ success: boolean; checkpoint?: CustodyCheckpoint; error?: string }> {
  const client = options.prismaClient || prisma;
  return withEvidenceLock(evidenceId, async () => {
    const events = await client.custodyEvent.findMany({
      where: { evidenceId },
      orderBy: { sequenceNumber: "asc" },
    });

    if (!events || events.length === 0) {
      return {
        success: false,
        error: `Cannot checkpoint empty custody chain for evidence: ${evidenceId}`,
      };
    }

    const verification = verifyCustodyChainEvents(events);
    if (!verification.valid) {
      return {
        success: false,
        error: `Cannot checkpoint invalid or tampered chain: ${verification.error}`,
      };
    }

    const headEvent = events[events.length - 1];
    const checkpoint = createCustodyCheckpoint({
      evidenceId,
      latestSequenceNumber: headEvent.sequenceNumber || events.length,
      latestEventHash: headEvent.eventHash,
      keyId: options.keyId,
      secretOrKey: options.secretOrKey,
      timestamp: options.timestamp,
    });

    return { success: true, checkpoint };
  });
}

