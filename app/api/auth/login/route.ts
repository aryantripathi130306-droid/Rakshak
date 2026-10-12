// ─────────────────────────────────────────────────────────────────────────────
// app/api/auth/login/route.ts
// POST /api/auth/login — Secure officer authentication with audit tracking
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { verifyPassword, createSession, logAuditEvent, ROLE_PERMISSIONS, type Role } from "@/services/authService";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const identifier = body.identifier || body.badgeNumber || body.email;
    const password = body.password;

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    const userAgent = request.headers.get("user-agent") || "Rakshak-Workstation";

    if (!identifier || !password) {
      return Response.json(
        { error: "Identifier (badge or email) and password are required." },
        { status: 400 }
      );
    }

    const p = prisma as any;
    let officer = await p.officer.findFirst({
      where: {
        OR: [
          { badgeNumber: identifier },
          { email: identifier.toLowerCase() },
        ],
      },
    }).catch((dbErr: any) => {
      console.error("[POST /api/auth/login] Database query error:", dbErr);
      throw new Error(`Database connection or table error: ${dbErr?.message || String(dbErr)}`);
    });

    if (!officer) {
      // Auto-provision initial administrator if officer table is empty (e.g. freshly deployed database)
      try {
        const count = await p.officer.count().catch(() => 0);
        if (count === 0) {
          const salt = await bcrypt.genSalt(10);
          const passwordHash = await bcrypt.hash("Rakshak@2026!", salt);
          await p.officer.create({
            data: {
              badgeNumber: "DL-CYBER-001",
              name: "Aryan Tripathi",
              email: "aryan.tripathi@cybercrime.gov.in",
              passwordHash,
              designation: "Chief Cyber Crime Administrator & Lead Investigator",
              role: "ADMIN",
              jurisdiction: "Delhi NCR",
              unit: "Cyber Crime Special Cell Headquarters",
              status: "ACTIVE",
            },
          }).catch(() => {});

          if (identifier === "DL-CYBER-001" || identifier.toLowerCase() === "aryan.tripathi@cybercrime.gov.in") {
            officer = await p.officer.findFirst({ where: { badgeNumber: "DL-CYBER-001" } });
          }
        }
      } catch (_) {}
    }

    if (!officer) {
      await logAuditEvent({
        officerName: "Unauthenticated Actor",
        action: "LOGIN_FAILED",
        module: "Auth",
        targetType: "Officer",
        targetId: identifier,
        details: `Failed authentication attempt for non-existent identifier: ${identifier}`,
        result: "FAILED",
        ipAddress,
      });

      return Response.json({ error: "Invalid badge number, email, or password." }, { status: 401 });
    }

    if (officer.status !== "ACTIVE") {
      await logAuditEvent({
        officerId: officer.id,
        officerName: officer.name,
        officerBadge: officer.badgeNumber,
        action: "ACCESS_DENIED",
        module: "Auth",
        targetType: "Officer",
        targetId: officer.id,
        details: `Login attempt rejected: Account status is ${officer.status}`,
        result: "BLOCKED",
        ipAddress,
      });

      return Response.json(
        { error: `Account is ${officer.status.toLowerCase()}. Contact Head of Cyber Crime.` },
        { status: 403 }
      );
    }

    const passwordMatches = await verifyPassword(password, officer.passwordHash);
    if (!passwordMatches) {
      await logAuditEvent({
        officerId: officer.id,
        officerName: officer.name,
        officerBadge: officer.badgeNumber,
        action: "LOGIN_FAILED",
        module: "Auth",
        targetType: "Officer",
        targetId: officer.id,
        details: "Password mismatch during authentication attempt",
        result: "FAILED",
        ipAddress,
      });

      return Response.json({ error: "Invalid badge number, email, or password." }, { status: 401 });
    }

    // Create session
    const { token, expiresAt } = await createSession(officer.id, ipAddress, userAgent);

    // Record login audit event
    await logAuditEvent({
      officerId: officer.id,
      officerName: officer.name,
      officerBadge: officer.badgeNumber,
      action: "LOGIN_SUCCESS",
      module: "Auth",
      targetType: "Officer",
      targetId: officer.id,
      details: `Officer logged in successfully from ${ipAddress}`,
      result: "SUCCESS",
      ipAddress,
    });

    const role = officer.role as Role;
    const permissions = ROLE_PERMISSIONS[role] || [];

    const response = Response.json(
      {
        success: true,
        token,
        expiresAt: expiresAt.toISOString(),
        officer: {
          id: officer.id,
          badgeNumber: officer.badgeNumber,
          name: officer.name,
          email: officer.email,
          designation: officer.designation,
          role: officer.role,
          jurisdiction: officer.jurisdiction,
          unit: officer.unit,
          status: officer.status,
        },
        permissions,
      },
      { status: 200 }
    );

    // Set secure HTTP-only cookie (only apply Secure flag on HTTPS connections so HTTP local/staging keeps session)
    const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    const secureFlag = isHttps ? "; Secure" : "";
    response.headers.set(
      "Set-Cookie",
      `rakshak_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secureFlag}`
    );

    return response;
  } catch (err) {
    console.error("[POST /api/auth/login] Error:", err);
    return Response.json(
      { error: "Authentication service error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
