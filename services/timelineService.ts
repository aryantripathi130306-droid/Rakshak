// ─────────────────────────────────────────────────────────────────────────────
// services/timelineService.ts
// ISO-8601 temporal normalisation engine.
// Accepts multi-format timestamps, normalises to UTC, sorts ascending, and
// auto-tags each event with a fraud trajectory phase.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from "crypto";
import {
  type RawEventInput,
  type NormalisedTimelineEvent,
  type ScamPhase,
} from "@/lib/validators";

// ─── Timestamp parsers ────────────────────────────────────────────────────────

/** Month abbreviation → zero-indexed number */
const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * WhatsApp format: "22/08/26, 11:44 am" or "22/08/2026, 11:44 am"
 * Returns UTC Date or null if it doesn't match.
 */
function parseWhatsAppTimestamp(raw: string): Date | null {
  const re =
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}):(\d{2})\s*(am|pm)/i;
  const m = raw.match(re);
  if (!m) return null;
  let [, dd, mm, yy, hh, min, ampm] = m;
  let year = parseInt(yy, 10);
  if (year < 100) year += 2000;
  let hour = parseInt(hh, 10);
  if (ampm.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (ampm.toLowerCase() === "am" && hour === 12) hour = 0;
  // WhatsApp timestamps are assumed IST (UTC+5:30)
  const d = new Date(
    Date.UTC(year, parseInt(mm, 10) - 1, parseInt(dd, 10), hour, parseInt(min, 10))
  );
  // Subtract IST offset to get true UTC
  d.setTime(d.getTime() - 5.5 * 60 * 60 * 1000);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Bank SMS format: "25-Aug-2026 17:02:08" or "25-08-2026 17:02:08"
 * Returns UTC Date or null.
 */
function parseBankSmsTimestamp(raw: string): Date | null {
  // With month name
  const re1 =
    /(\d{1,2})-([a-zA-Z]{3})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/;
  const m1 = raw.match(re1);
  if (m1) {
    const [, dd, mon, yyyy, hh, mm, ss = "0"] = m1;
    const monthIdx = MONTH_MAP[mon.toLowerCase()];
    if (monthIdx === undefined) return null;
    const d = new Date(
      Date.UTC(
        parseInt(yyyy, 10),
        monthIdx,
        parseInt(dd, 10),
        parseInt(hh, 10),
        parseInt(mm, 10),
        parseInt(ss, 10)
      )
    );
    // Bank SMSes are IST
    d.setTime(d.getTime() - 5.5 * 60 * 60 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }

  // Numeric: 25-08-2026 17:02:08
  const re2 =
    /(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/;
  const m2 = raw.match(re2);
  if (m2) {
    const [, dd, mm2, yyyy, hh, min, ss = "0"] = m2;
    const d = new Date(
      Date.UTC(
        parseInt(yyyy, 10),
        parseInt(mm2, 10) - 1,
        parseInt(dd, 10),
        parseInt(hh, 10),
        parseInt(min, 10),
        parseInt(ss, 10)
      )
    );
    d.setTime(d.getTime() - 5.5 * 60 * 60 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Try native Date parse for ISO-8601 and other machine formats.
 */
function parseIsoTimestamp(raw: string): Date | null {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Master timestamp parser — tries each format in order and returns the first
 * successfully parsed Date. Throws if no format matches.
 */
export function parseTimestamp(raw: string): Date {
  const parsed =
    parseIsoTimestamp(raw) ??
    parseWhatsAppTimestamp(raw) ??
    parseBankSmsTimestamp(raw);
  if (!parsed) {
    throw new Error(
      `TimelineService: Unable to parse timestamp "${raw}". ` +
        `Supported formats: ISO-8601, WhatsApp (DD/MM/YY, HH:MM am/pm), ` +
        `Bank SMS (DD-Mon-YYYY HH:MM:SS).`
    );
  }
  return parsed;
}

// ─── Scam phase classifier ────────────────────────────────────────────────────

const PHASE_RULES: Array<{ keywords: string[]; phase: ScamPhase }> = [
  {
    keywords: [
      "job offer",
      "telegram",
      "whatsapp",
      "review",
      "task reward",
      "part-time",
      "part time",
      "earn from home",
      "investment opportunity",
      "first contact",
    ],
    phase: "CONTACT",
  },
  {
    keywords: [
      "task completed",
      "commission",
      "credited",
      "₹150",
      "reward received",
      "trust",
      "first payment",
      "small amount",
      "demo",
      "trial",
    ],
    phase: "TRUST",
  },
  {
    keywords: [
      "transferred",
      "paid",
      "upi",
      "sent",
      "debit",
      "transaction",
      "payment",
      "₹",
      "rs.",
      "amount",
      "bank",
    ],
    phase: "PAYMENT",
  },
  {
    keywords: [
      "blocked",
      "no response",
      "account frozen",
      "deleted",
      "stopped",
      "silent",
      "unreachable",
      "number switched off",
      "invite-only",
      "disappeared",
    ],
    phase: "SEVERED",
  },
];

export function classifyPhase(description: string): ScamPhase {
  const lower = description.toLowerCase();
  for (const rule of PHASE_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.phase;
    }
  }
  return "UNKNOWN";
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Normalise a heterogeneous list of raw events into a sorted, phase-tagged,
 * ISO-8601 UTC timeline.
 *
 * @param events - Raw input events with unparsed timestamps
 * @returns Normalised events sorted ascending by UTC timestamp
 */
export function normalizeTimeline(
  events: RawEventInput[]
): NormalisedTimelineEvent[] {
  const normalised: NormalisedTimelineEvent[] = events.map((ev) => {
    const timestamp = parseTimestamp(ev.rawTimestamp);
    return {
      id: randomUUID(),
      caseId: ev.caseId,
      evidenceId: ev.evidenceId,
      timestamp,
      isoTimestamp: timestamp.toISOString(),
      description: ev.description.trim(),
      phase: classifyPhase(ev.description),
      sourceType: ev.sourceType,
    };
  });

  // Sort strictly ascending (earliest first)
  normalised.sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  return normalised;
}

/**
 * Format a UTC Date to IST string for display.
 * e.g. "22 Aug 2026 — 11:44:32 IST"
 */
export function formatIST(date: Date): string {
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }) + " IST";
}
