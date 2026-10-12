// ─────────────────────────────────────────────────────────────────────────────
// services/storageAdapter.ts
// Rakshak v3.0 — Secure Digital Evidence Storage Adapter Interface
//
// Defines a unified cryptographic storage interface supporting:
// 1. Content-addressed evidence identification using SHA-256.
// 2. Immutable original evidence handling.
// 3. Separate metadata and custody-event operations.
// 4. Verification of evidence hashes during retrieval.
// 5. Explicit storage-adapter capability reporting.
// ─────────────────────────────────────────────────────────────────────────────
import fs from "fs/promises";
import path from "path";
import { sha256OfBuffer, isValidSha256, HashMismatchError } from "@/lib/crypto";

export type WormMode = "NONE" | "COMPLIANCE" | "GOVERNANCE";

export interface StorageCapabilities {
  adapterType: string;
  contentAddressed: boolean;
  immutableOriginals: boolean;
  hashVerificationOnRetrieval: boolean;
  separateCustodyOperations: boolean;
  isHardwareWormCompliant: boolean;
  wormComplianceMode: WormMode;
  retentionLockEnforced: boolean;
  description: string;
}

export interface StorageWriteResult {
  sha256Hash: string;
  storagePath: string;
  bytesWritten: number;
  isNewWrite: boolean;
  capabilities: StorageCapabilities;
}

export interface StorageReadResult {
  buffer: Buffer;
  sha256Hash: string;
  bytesRead: number;
  verifiedOnRead: boolean;
  adapterType: string;
}

export interface EvidenceStorageAdapter {
  storeEvidence(buffer: Buffer, clientHash?: string): Promise<StorageWriteResult>;
  retrieveEvidence(sha256Hash: string, verifyIntegrity?: boolean): Promise<StorageReadResult>;
  evidenceExists(sha256Hash: string): Promise<boolean>;
  getCapabilities(): StorageCapabilities;
}

/**
 * Local Filesystem Storage Adapter
 *
 * Implements content-addressed storage on the local host filesystem.
 * Note: While this adapter ensures content-addressed immutability in software,
 * it CANNOT and DOES NOT claim hardware-enforced or cloud compliance-mode WORM.
 */
export class LocalFilesystemStorageAdapter implements EvidenceStorageAdapter {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.env.EVIDENCE_STORAGE_PATH || path.join(process.cwd(), "uploads", "raw");
  }

  getCapabilities(): StorageCapabilities {
    return {
      adapterType: "LOCAL_FILESYSTEM",
      contentAddressed: true,
      immutableOriginals: true,
      hashVerificationOnRetrieval: true,
      separateCustodyOperations: true,
      // CRITICAL: Local filesystems do not satisfy hardware/cloud compliance WORM standards
      isHardwareWormCompliant: false,
      wormComplianceMode: "NONE",
      retentionLockEnforced: false,
      description:
        "Local filesystem cold storage. Provides SHA-256 content addressing and read-time hash verification. Does NOT provide hardware-enforced WORM.",
    };
  }

  private resolvePath(sha256Hash: string): string {
    const cleanHash = sha256Hash.trim().toLowerCase();
    if (!isValidSha256(cleanHash)) {
      throw new Error(`[StorageSecurity] Malformed or invalid SHA-256 hash: ${sha256Hash}`);
    }
    const targetFile = `${cleanHash}.bin`;
    const resolved = path.resolve(this.baseDir, targetFile);
    const expectedPrefix = path.resolve(this.baseDir);
    if (!resolved.startsWith(expectedPrefix)) {
      throw new Error(`[StorageSecurity] Path traversal attempt blocked: ${sha256Hash}`);
    }
    return resolved;
  }

  async evidenceExists(sha256Hash: string): Promise<boolean> {
    try {
      const filePath = this.resolvePath(sha256Hash);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async storeEvidence(buffer: Buffer, clientHash?: string): Promise<StorageWriteResult> {
    const computedHash = sha256OfBuffer(buffer);

    if (clientHash) {
      const cleanClient = clientHash.trim().toLowerCase();
      if (cleanClient !== computedHash) {
        throw new HashMismatchError(
          `Integrity Violation: Hash mismatch during transit. Client supplied: ${cleanClient.slice(0, 16)}... Server computed: ${computedHash.slice(0, 16)}...`
        );
      }
    }

    const filePath = this.resolvePath(computedHash);
    await fs.mkdir(this.baseDir, { recursive: true });

    let isNewWrite = false;
    try {
      await fs.access(filePath);
      // File already exists — do NOT overwrite original binary
      isNewWrite = false;
    } catch {
      // New file write
      await fs.writeFile(filePath, buffer, { flag: "wx" }); // wx fails if file already exists
      isNewWrite = true;
    }

    return {
      sha256Hash: computedHash,
      storagePath: `/uploads/raw/${computedHash}.bin`,
      bytesWritten: buffer.length,
      isNewWrite,
      capabilities: this.getCapabilities(),
    };
  }

  async retrieveEvidence(sha256Hash: string, verifyIntegrity: boolean = true): Promise<StorageReadResult> {
    const cleanHash = sha256Hash.trim().toLowerCase();
    const filePath = this.resolvePath(cleanHash);

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(filePath);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        throw new Error(`Evidence exhibit not found in storage: ${cleanHash}`);
      }
      throw err;
    }

    let verifiedOnRead = false;
    if (verifyIntegrity) {
      const readHash = sha256OfBuffer(buffer);
      if (readHash !== cleanHash) {
        throw new HashMismatchError(
          `Cold Storage Bit-Rot / Tampering Detected! Stored exhibit ${cleanHash} computed ${readHash} upon retrieval.`
        );
      }
      verifiedOnRead = true;
    }

    return {
      buffer,
      sha256Hash: cleanHash,
      bytesRead: buffer.length,
      verifiedOnRead,
      adapterType: "LOCAL_FILESYSTEM",
    };
  }
}

// Global singleton instance
let defaultAdapter: EvidenceStorageAdapter | null = null;

export function getEvidenceStorageAdapter(): EvidenceStorageAdapter {
  if (!defaultAdapter) {
    defaultAdapter = new LocalFilesystemStorageAdapter();
  }
  return defaultAdapter;
}

export function setEvidenceStorageAdapter(adapter: EvidenceStorageAdapter): void {
  defaultAdapter = adapter;
}
