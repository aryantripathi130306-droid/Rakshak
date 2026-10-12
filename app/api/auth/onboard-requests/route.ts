// ─────────────────────────────────────────────────────────────────────────────
// app/api/auth/onboard-requests/route.ts
// GET /api/auth/onboard-requests — List pending department onboarding requests
// Requires Platform Administrator (ADMIN) role.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { authenticateOfficer } from "@/services/authService";

export const runtime = "nodejs";

const ONBOARD_STORE_PATH = path.join(process.cwd(), "data", "dept_onboarding_requests.json");

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to review onboarding requests." },
        { status: 401 }
      );
    }

    if (auth.officer.role !== "ADMIN") {
      return Response.json(
        { error: "Access denied: Platform Administrator privileges required." },
        { status: 403 }
      );
    }

    let requests = [];
    try {
      const raw = await fs.readFile(ONBOARD_STORE_PATH, "utf-8");
      requests = JSON.parse(raw);
    } catch {
      requests = [];
    }

    return Response.json(
      {
        total: requests.length,
        requests,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      }
    );
  } catch (err) {
    console.error("[GET /api/auth/onboard-requests] Error:", err);
    return Response.json(
      { error: "Failed to fetch onboarding requests" },
      { status: 500 }
    );
  }
}
