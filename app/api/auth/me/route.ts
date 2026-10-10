// ─────────────────────────────────────────────────────────────────────────────
// app/api/auth/me/route.ts
// GET /api/auth/me — Return current authenticated officer session & permissions
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import { authenticateOfficer, ROLE_PERMISSIONS } from "@/services/authService";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateOfficer(request);

    if (!authResult) {
      return Response.json(
        { error: "Unauthenticated. Please sign in." },
        { status: 401 }
      );
    }

    const { officer } = authResult;
    const permissions = ROLE_PERMISSIONS[officer.role] || [];

    return Response.json(
      {
        authenticated: true,
        officer,
        permissions,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      }
    );
  } catch (err) {
    console.error("[GET /api/auth/me] Error:", err);
    return Response.json({ error: "Session check failed" }, { status: 500 });
  }
}
