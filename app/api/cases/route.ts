// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/route.ts
// GET /api/cases — list all cases
// POST /api/cases — create a new case
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const CreateCaseSchema = z.object({
  caseNumber: z.string().min(3).max(50),
  incidentType: z.enum([
    "Task_Scam",
    "Digital_Arrest",
    "Investment_Fraud",
    "KYC_Freeze",
    "Romance_Scam",
  ]),
  complainantName: z.string().min(2).max(100),
  jurisdiction: z.string().optional(),
  amountDefrauded: z.number().int().min(0).optional(),
});

export async function GET(_request: NextRequest) {
  try {
    const cases = await prisma.case.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { evidence: true, timeline: true, entities: true },
        },
      },
    });

    return Response.json({ cases }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/cases] Error:", err);
    return Response.json({ error: "Failed to fetch cases." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateCaseSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { caseNumber, incidentType, complainantName, jurisdiction, amountDefrauded } =
      parsed.data;

    // Verify case number is unique
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
        jurisdiction: jurisdiction ?? null,
        amountDefrauded: amountDefrauded ?? null,
        status: "OPEN",
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
