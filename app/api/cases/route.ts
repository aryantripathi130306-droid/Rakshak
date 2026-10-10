// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/route.ts
// GET /api/cases — list all cases (with search, filter, sort, pagination)
// POST /api/cases — create a new case
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

// ─── Auto-generate next case number ──────────────────────────────────────────
async function generateCaseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const latest = await prisma.case.findFirst({
    where: { caseNumber: { startsWith: `CASE-${year}-` } },
    orderBy: { caseNumber: "desc" },
  });

  let seq = 1;
  if (latest) {
    const parts = latest.caseNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `CASE-${year}-${String(seq).padStart(4, "0")}`;
}

// Map frontend/flexible values to DB Enum / schema values
function normalizeStatus(s?: string): "OPEN" | "UNDER_INQUIRY" | "CHARGESHEETED" | "CLOSED" {
  if (!s) return "OPEN";
  const upper = s.toUpperCase().trim();
  if (upper === "UNDER_INVESTIGATION" || upper === "UNDER_INQUIRY") return "UNDER_INQUIRY";
  if (upper === "CHARGESHEET_FILED" || upper === "CHARGESHEETED") return "CHARGESHEETED";
  if (upper === "CLOSED") return "CLOSED";
  return "OPEN";
}

function normalizeType(t?: string): "Task_Scam" | "Digital_Arrest" | "Investment_Fraud" | "KYC_Freeze" | "Romance_Scam" {
  if (!t) return "Task_Scam";
  const s = t.replace(/\s+/g, "_");
  if (s.toLowerCase().includes("digital")) return "Digital_Arrest";
  if (s.toLowerCase().includes("investment")) return "Investment_Fraud";
  if (s.toLowerCase().includes("kyc")) return "KYC_Freeze";
  if (s.toLowerCase().includes("romance")) return "Romance_Scam";
  return "Task_Scam";
}

// ─── GET /api/cases ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q         = searchParams.get("q")?.trim()          || "";
    const status    = searchParams.get("status")?.trim()     || "";
    const type      = searchParams.get("type")?.trim()       || "";
    const jur       = searchParams.get("jurisdiction")?.trim() || "";
    const sortBy    = searchParams.get("sortBy")             || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const page      = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit     = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip      = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (q) {
      where.OR = [
        { caseNumber:      { contains: q } },
        { complainantName: { contains: q } },
        { firNumber:       { contains: q } },
        { jurisdiction:    { contains: q } },
        { officerName:     { contains: q } },
        { description:     { contains: q } },
      ];
    }
    if (status)  where.status       = normalizeStatus(status);
    if (type)    where.incidentType = normalizeType(type);
    if (jur)     where.jurisdiction = { contains: jur };

    // Build sort
    const validSortFields = ["caseNumber", "createdAt", "updatedAt", "status", "complainantName"];
    const orderField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const orderBy = { [orderField]: sortOrder };

    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: { evidence: true, timeline: true, entities: true },
          },
        },
      }),
      prisma.case.count({ where }),
    ]);

    return Response.json(
      { cases, total, page, limit, totalPages: Math.ceil(total / limit) },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/cases] Error:", err);
    return Response.json({ error: "Failed to fetch cases." }, { status: 500 });
  }
}

// ─── POST /api/cases ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const caseNumberSupplied = body.caseNumber;
    const incidentType = normalizeType(body.incidentType);
    const complainantName = body.complainantName || "Anonymous";
    const jurisdiction = body.jurisdiction || null;
    const amountDefrauded = typeof body.amountDefrauded === 'number'
      ? body.amountDefrauded
      : (typeof body.totalLossINR === 'number' ? body.totalLossINR : (typeof body.fraudAmountINR === 'number' ? body.fraudAmountINR : 0));
    const description = body.description || null;
    const firNumber = body.firNumber || null;
    const officerName = body.officerName || body.investigatingOfficer || null;
    const officerBadge = body.officerBadge || null;
    const status = normalizeStatus(body.status);

    if (!complainantName || complainantName.trim() === '') {
      return Response.json({ error: "Complainant name is required" }, { status: 400 });
    }

    const caseNumber = caseNumberSupplied || (await generateCaseNumber());

    const existing = await prisma.case.findUnique({ where: { caseNumber } });
    if (existing) {
      return Response.json(
        { error: `Case number already exists: ${caseNumber}` },
        { status: 409 }
      );
    }

    const newCase = await prisma.case.create({
      data: {
        caseNumber,
        incidentType,
        complainantName,
        jurisdiction,
        amountDefrauded: Math.round(amountDefrauded),
        description,
        firNumber,
        officerName,
        officerBadge,
        status,
      },
    });

    return Response.json(newCase, { status: 201 });
  } catch (err) {
    console.error("[POST /api/cases] Error:", err);
    return Response.json(
      { error: "Case creation failed.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
