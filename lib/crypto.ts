// ─────────────────────────────────────────────────────────────────────────────
// lib/crypto.ts — Cryptographic hashing and verification routines
// All forensic hash operations are centralised here.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from "crypto";
import { Readable } from "stream";

/** SHA-256 of a raw Buffer — used server-side for integrity verification */
export function sha256OfBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** SHA-256 of a plain string — used for test fixtures and text evidence */
export function sha256OfString(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Verify that a client-supplied hash matches the server-computed hash.
 * Throws a structured error on mismatch so the route can return 422.
 */
export function assertHashIntegrity(
  serverHash: string,
  clientHash: string
): void {
  // Normalise to lowercase for comparison
  const s = serverHash.toLowerCase().trim();
  const c = clientHash.toLowerCase().trim();
  if (s !== c) {
    throw new HashMismatchError(
      `Integrity Violation: Hash mismatch during transit. ` +
        `Client supplied: ${c.slice(0, 16)}… · Server computed: ${s.slice(0, 16)}…`
    );
  }
}

/** Strongly-typed error thrown when a hash does not match */
export class HashMismatchError extends Error {
  readonly statusCode = 422;
  constructor(message: string) {
    super(message);
    this.name = "HashMismatchError";
  }
}

/** Validate that a string looks like a 64-char hex SHA-256 digest */
export function isValidSha256(hash: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(hash.trim());
}

/**
 * Stream a Web API ReadableStream into a Node.js Buffer without touching the
 * original so the original file stays immutable.
 */
export async function webReadableToBuffer(
  readable: ReadableStream<Uint8Array>
): Promise<Buffer> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}
