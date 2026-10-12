// ─────────────────────────────────────────────────────────────────────────────
// app/api/auth/onboard-request/route.ts
// POST /api/auth/onboard-request — Public department onboarding intake
//
// STRICT GATE: Submitting this form ONLY creates a pending request.
// It DOES NOT create active accounts, issue tokens, or grant case access.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { logAuditEvent } from "@/services/authService";

export const runtime = "nodejs";

const ONBOARD_STORE_PATH = path.join(process.cwd(), "data", "dept_onboarding_requests.json");

interface OnboardRequestRecord {
  id: string;
  requestId: string;
  departmentName: string;
  jurisdiction: string;
  nodalOfficerName: string;
  nodalOfficerBadge: string;
  nodalEmail: string;
  contactPhone: string;
  authorizationRef: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: string;
  ipAddress: string;
}

async function loadRequests(): Promise<OnboardRequestRecord[]> {
  try {
    const raw = await fs.readFile(ONBOARD_STORE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveRequests(list: OnboardRequestRecord[]): Promise<void> {
  const dir = path.dirname(ONBOARD_STORE_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(ONBOARD_STORE_PATH, JSON.stringify(list, null, 2), "utf-8");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      departmentName,
      jurisdiction,
      nodalOfficerName,
      nodalOfficerBadge,
      nodalEmail,
      contactPhone,
      authorizationRef,
    } = body;

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";

    // Validate mandatory fields
    if (
      !departmentName?.trim() ||
      !jurisdiction?.trim() ||
      !nodalOfficerName?.trim() ||
      !nodalOfficerBadge?.trim() ||
      !nodalEmail?.trim() ||
      !authorizationRef?.trim()
    ) {
      return Response.json(
        { error: "All institutional onboarding fields are mandatory." },
        { status: 400 }
      );
    }

    if (!nodalEmail.includes("@") || !nodalEmail.includes(".")) {
      return Response.json(
        { error: "Invalid institutional email address." },
        { status: 400 }
      );
    }

    const requestId = `REQ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const id = crypto.randomUUID();

    const record: OnboardRequestRecord = {
      id,
      requestId,
      departmentName: departmentName.trim(),
      jurisdiction: jurisdiction.trim(),
      nodalOfficerName: nodalOfficerName.trim(),
      nodalOfficerBadge: nodalOfficerBadge.trim(),
      nodalEmail: nodalEmail.trim().toLowerCase(),
      contactPhone: (contactPhone || "").trim(),
      authorizationRef: authorizationRef.trim(),
      status: "PENDING",
      submittedAt: new Date().toISOString(),
      ipAddress,
    };

    const existing = await loadRequests();
    existing.push(record);
    await saveRequests(existing);

    // Audit the request submission
    await logAuditEvent({
      officerName: `${nodalOfficerName} (Applicant)`,
      officerBadge: nodalOfficerBadge,
      action: "ONBOARDING_REQUEST_SUBMITTED",
      module: "Auth",
      targetType: "DepartmentOnboardingRequest",
      targetId: requestId,
      details: `Department onboarding application logged for ${departmentName} (${jurisdiction})`,
      result: "SUCCESS",
      ipAddress,
      metadata: { departmentName, jurisdiction, nodalEmail, authorizationRef },
    });

    return Response.json(
      {
        success: true,
        requestId,
        status: "PENDING",
        message: "Department onboarding request logged. Pending verification by Platform Administrators.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/auth/onboard-request] Error:", err);
    return Response.json(
      { error: "Failed to process department onboarding request" },
      { status: 500 }
    );
  }
}
