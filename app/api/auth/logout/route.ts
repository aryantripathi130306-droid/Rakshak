// ─────────────────────────────────────────────────────────────────────────────
// app/api/auth/logout/route.ts
// POST /api/auth/logout — Revoke session token and log event
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import { authenticateOfficer, revokeSession, logAuditEvent } from "@/services/authService";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateOfficer(request);
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";

    if (authResult && authResult.token) {
      await revokeSession(authResult.token);
      await logAuditEvent({
        officerId: authResult.officer.id,
        officerName: authResult.officer.name,
        officerBadge: authResult.officer.badgeNumber,
        action: "LOGOUT",
        module: "Auth",
        targetType: "Officer",
        targetId: authResult.officer.id,
        details: "Officer logged out and session revoked",
        result: "SUCCESS",
        ipAddress,
      });
    }

    const response = Response.json({ success: true, message: "Logged out successfully" }, { status: 200 });
    const isSecure = process.env.NODE_ENV === "production" || request.headers.get("x-forwarded-proto") === "https";
    const secureFlag = isSecure ? "; Secure" : "";
    response.headers.set(
      "Set-Cookie",
      `rakshak_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`
    );
    return response;
  } catch (err) {
    console.error("[POST /api/auth/logout] Error:", err);
    return Response.json({ error: "Logout failed" }, { status: 500 });
  }
}
