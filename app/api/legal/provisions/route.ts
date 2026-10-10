// ─────────────────────────────────────────────────────────────────────────────
// app/api/legal/provisions/route.ts
// Official statutory provisions registry (BNS 2023, IT Act 2000, BSA 2023)
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const act = searchParams.get("act");

    const where: any = { active: true };
    if (act) {
      where.actCode = act;
    }

    const p = prisma as any;
    const provisions = await p.legalProvision.findMany({
      where,
      orderBy: [{ actCode: "asc" }, { section: "asc" }],
    });

    return Response.json(
      {
        total: provisions.length,
        provisions,
        authoritativeSources: {
          BNS: "https://www.indiacode.nic.in/bitstream/123456789/20062/1/a2023-45.pdf",
          IT_ACT: "https://www.indiacode.nic.in/bitstream/123456789/13116/1/it_act_2000_updated.pdf",
          BSA: "https://www.indiacode.nic.in/bitstream/123456789/20063/1/a2023-47.pdf",
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "public, max-age=3600" },
      }
    );
  } catch (err) {
    console.error("[GET /api/legal/provisions] Error:", err);
    return Response.json(
      { error: "Failed to fetch statutory provisions", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
