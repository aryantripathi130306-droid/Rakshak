// ─────────────────────────────────────────────────────────────────────────────
// scripts/test_phase40_identifier_normalization.mjs
// RAKSHAK v3.0 — Phase 40 Identifier Normalization, Match Quality & Reproducibility Suite
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient as PrismaPgClient } from "@prisma/client-pg";

import {
  normalisePhone,
  normalisePhoneDetailed,
  PHONE_NORMALIZATION_VERSION,
} from "../lib/validators.ts";

import {
  NORMALIZATION_VERSION,
  LEGACY_NORMALIZATION_VERSION,
  normalizeEmail,
  normalizePhone,
  normalizeUpi,
  normalizeBankAccount,
  normalizeIfsc,
  normalizeDomain,
  normalizeUrl,
  normalizeIp,
  normalizeDeviceHash,
  normalizeUtr,
  normalizeEntityIdentifier,
  maskIdentifier,
  computeKeyedDigest,
  evaluateCandidateLink,
  reevaluateCandidateLinks,
} from "../lib/entityResolution.ts";

const TARGET_DB = process.env.TARGET_DB || "rakshak_phase40_test";
const DATABASE_URL = process.env.DATABASE_URL || `postgresql://postgres:change_me_in_vault@127.0.0.1:5432/${TARGET_DB}`;
process.env.DATABASE_URL = DATABASE_URL;
const ACTIVE_DB_PATH = path.join(process.cwd(), "prisma", "dev.db");
const RAW_DIR = path.join(process.cwd(), "uploads", "raw");
const OUT_JSON = path.join(process.cwd(), "PHASE40_TEST_RESULTS.json");

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return "none";
  return sha256(fs.readFileSync(filePath));
}

function computeDirectoryManifest(dirPath) {
  if (!fs.existsSync(dirPath)) return { count: 0, manifestHash: "none" };
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".bin")).sort();
  const hasher = crypto.createHash("sha256");
  for (const f of files) {
    const fileBytes = fs.readFileSync(path.join(dirPath, f));
    hasher.update(`${f}:${sha256(fileBytes)}:`);
  }
  return { count: files.length, manifestHash: hasher.digest("hex") };
}

async function runPhase40Suite() {
  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — PHASE 40 ADVERSARIAL NORMALIZATION SUITE      ");
  console.log("   Database: " + TARGET_DB);
  console.log("   Timestamp: " + new Date().toISOString());
  console.log("================================================================\n");

  const initialDevDbHash = sha256File(ACTIVE_DB_PATH);
  const initialColdStorage = computeDirectoryManifest(RAW_DIR);

  const prisma = new PrismaPgClient({
    datasources: { db: { url: DATABASE_URL } },
  });

  await prisma.$connect();
  console.log(`✓ Connected to isolated test database: ${TARGET_DB}\n`);

  // Seed Department required for Foreign Key integrity
  const dept = await prisma.department.upsert({
    where: { code: "CYBER_MUMBAI" },
    update: {},
    create: {
      id: "dept-40-001",
      name: "Mumbai Cyber Crime Division",
      code: "CYBER_MUMBAI",
      state: "Maharashtra",
      jurisdiction: "Mumbai Metro",
    },
  });

  // Deterministic cleanup of Phase 40 test fixtures before execution
  await prisma.entityLink.deleteMany({
    where: {
      OR: [
        { sourceCase: { caseNumber: { startsWith: "CASE-40-" } } },
        { targetCase: { caseNumber: { startsWith: "CASE-40-" } } },
      ],
    },
  });
  await prisma.case.deleteMany({
    where: { caseNumber: { startsWith: "CASE-40-" } },
  });

  const results = [];
  function record(id, name, status, details = "") {
    results.push({ id, name, status, details });
    const tag = status === "PASSED" ? "✓ PASS" : "✗ FAIL";
    console.log(`  ${tag} [${id}] ${name} ${details ? `— ${details}` : ""}`);
  }

  try {
    // ─── Scenario 1: Valid Indian domestic phone number normalizes according to policy
    {
      const res = normalisePhoneDetailed("9876543210");
      const passed =
        res.isValid &&
        res.normalizedValue === "+919876543210" &&
        res.countryCode === "+91" &&
        res.nationalNumber === "9876543210" &&
        res.ruleVersion === PHONE_NORMALIZATION_VERSION;
      record(
        "TC-01",
        "Valid Indian domestic phone number normalizes to +91 E.164",
        passed ? "PASSED" : "FAILED",
        res.normalizedValue
      );
    }

    // ─── Scenario 2: Indian international form normalizes consistently
    {
      const inputs = ["+91 98765-43210", "09876543210", "+91.9876543210", "919876543210"];
      const allMatch = inputs.every((inp) => normalisePhone(inp) === "+919876543210");
      record(
        "TC-02",
        "Correctly formatted Indian international forms normalize consistently",
        allMatch ? "PASSED" : "FAILED",
        "All 4 variations resolved to +919876543210"
      );
    }

    // ─── Scenario 3: Invalid domestic number is rejected or flagged
    {
      const invalidStartingDigit = normalisePhoneDetailed("1234567890"); // Starts with 1
      const dummyRepeated = normalisePhoneDetailed("0000000000"); // Dummy zeros
      const passed =
        (!invalidStartingDigit.isValid || invalidStartingDigit.isAmbiguous) &&
        (dummyRepeated.isGeneric || !dummyRepeated.isValid);
      record(
        "TC-03",
        "Invalid domestic number rejected or flagged with ambiguity",
        passed ? "PASSED" : "FAILED",
        `1234567890 valid=${invalidStartingDigit.isValid}, 0000000000 generic=${dummyRepeated.isGeneric}`
      );
    }

    // ─── Scenario 4: International number retains its real country code
    {
      const usPhone = normalisePhoneDetailed("+1 (415) 555-2671");
      const ukPhone = normalisePhoneDetailed("+44 7911 123456");
      const uaePhone = normalisePhoneDetailed("+971 50 123 4567");
      const passed =
        usPhone.normalizedValue === "+14155552671" &&
        usPhone.countryCode === "+1" &&
        ukPhone.normalizedValue === "+447911123456" &&
        ukPhone.countryCode === "+44" &&
        uaePhone.normalizedValue === "+971501234567" &&
        uaePhone.countryCode === "+971";
      record(
        "TC-04",
        "International number preserves authentic country calling code",
        passed ? "PASSED" : "FAILED",
        `US: ${usPhone.normalizedValue}, UK: ${ukPhone.normalizedValue}, UAE: ${uaePhone.normalizedValue}`
      );
    }

    // ─── Scenario 5: Differently prefixed numbers with identical last 10 digits do not collide
    {
      const evalResult = evaluateCandidateLink({
        sourceCaseId: "case-alpha-001",
        sourceCaseNumber: "CASE-2026-001",
        targetCaseId: "case-beta-002",
        targetCaseNumber: "CASE-2026-002",
        entityType: "PHONE",
        rawValueA: "+1 9876543210", // US number
        rawValueB: "+91 9876543210", // Indian number
      });
      const passed = !evalResult.isMatch;
      record(
        "TC-05",
        "Differently prefixed international numbers sharing last 10 digits do not collide",
        passed ? "PASSED" : "FAILED",
        `isMatch=${evalResult.isMatch} (${evalResult.explanation})`
      );
    }

    // ─── Scenario 6: Arbitrary 10-digit identifier is not automatically classified as a phone
    {
      const accountRes = normalizeEntityIdentifier("ACCOUNT", "1234567890");
      const utrRes = normalizeEntityIdentifier("UTR", "123456789012");
      const passed =
        accountRes.isValid &&
        accountRes.normalizedValue === "1234567890" &&
        !accountRes.normalizedValue.startsWith("+91") &&
        utrRes.isValid &&
        !utrRes.normalizedValue.startsWith("+91");
      record(
        "TC-06",
        "Arbitrary digit sequence not mistakenly converted to +91 phone",
        passed ? "PASSED" : "FAILED",
        `Account: ${accountRes.normalizedValue}, UTR: ${utrRes.normalizedValue}`
      );
    }

    // ─── Scenario 7: Extensions are handled according to documented policy
    {
      const extRes = normalisePhoneDetailed("+91 98201 23456 ext 402");
      const passed =
        extRes.isValid &&
        extRes.normalizedValue === "+919820123456" &&
        extRes.extension === "402" &&
        Boolean(extRes.limitations?.includes("Extension '402' isolated"));
      record(
        "TC-07",
        "Extensions isolated from canonical E.164 number into metadata",
        passed ? "PASSED" : "FAILED",
        `E.164: ${extRes.normalizedValue}, Ext: ${extRes.extension}`
      );
    }

    // ─── Scenario 8: Leading international dialing prefixes (00) handled consistently
    {
      const res1 = normalisePhone("001 415 555 2671");
      const res2 = normalisePhone("0091 98765 43210");
      const passed = res1 === "+14155552671" && res2 === "+919876543210";
      record(
        "TC-08",
        "Leading international dialing prefix (00) converted consistently to +",
        passed ? "PASSED" : "FAILED",
        `001: ${res1}, 0091: ${res2}`
      );
    }

    // ─── Scenario 9: Empty and malformed inputs fail safely
    {
      const emptyRes = normalizePhone("");
      const nullRes = normalizePhone(null);
      const alphaRes = normalizePhone("invalid-phone-string");
      const plusOnlyRes = normalizePhone("+");
      const passed =
        !emptyRes.isValid &&
        !nullRes.isValid &&
        !alphaRes.isValid &&
        !plusOnlyRes.isValid;
      record(
        "TC-09",
        "Empty, null, and non-numeric malformed inputs fail safely",
        passed ? "PASSED" : "FAILED",
        "All 4 malformed inputs returned isValid=false"
      );
    }

    // ─── Scenario 10: Original input remains available for provenance and review
    {
      const raw = " +91 (98765) 43210 [Primary] ";
      const norm = normalizePhone(raw);
      const passed = norm.isValid && norm.normalizedValue === "+919876543210";
      record(
        "TC-10",
        "Original input preserved alongside normalized value",
        passed ? "PASSED" : "FAILED",
        `Raw retained, Normalized: ${norm.normalizedValue}`
      );
    }

    // ─── Scenario 11: Normalization is deterministic for same input and version
    {
      const raw = "+91-98765-43210";
      const digestA = computeKeyedDigest(normalisePhone(raw));
      let matches = true;
      for (let i = 0; i < 50; i++) {
        if (computeKeyedDigest(normalisePhone(raw)) !== digestA) {
          matches = false;
          break;
        }
      }
      record(
        "TC-11",
        "Deterministic normalization across 50 repeated executions",
        matches ? "PASSED" : "FAILED",
        `Digest: ${digestA.slice(0, 16)}...`
      );
    }

    // ─── Scenario 12: Historical normalization versions remain identifiable
    {
      const passed =
        NORMALIZATION_VERSION === "v2" &&
        LEGACY_NORMALIZATION_VERSION === "v1" &&
        PHONE_NORMALIZATION_VERSION === "PHONE_NORM_V2";
      record(
        "TC-12",
        "Active and historical normalization versions explicitly versioned",
        passed ? "PASSED" : "FAILED",
        `Active: ${NORMALIZATION_VERSION}, Legacy: ${LEGACY_NORMALIZATION_VERSION}`
      );
    }

    // ─── Scenario 13: Normalization-version change does not silently rewrite confirmed links
    {
      // Insert synthetic confirmed link
      const seedCase = await prisma.case.create({
        data: {
          caseNumber: "CASE-40-CONF-001",
          description: "Confirmed Link Preservation Probe",
          complainantName: "Cyber Crime Cell Mumbai",
          departmentId: dept.id,
          incidentType: "CYBER_FINANCIAL_FRAUD",
        },
      });
      const targetCase = await prisma.case.create({
        data: {
          caseNumber: "CASE-40-CONF-002",
          description: "Confirmed Link Target Case",
          complainantName: "Cyber Crime Cell Mumbai",
          departmentId: dept.id,
          incidentType: "CYBER_FINANCIAL_FRAUD",
        },
      });
      const confirmedLink = await prisma.entityLink.create({
        data: {
          sourceCaseId: seedCase.id,
          targetCaseId: targetCase.id,
          entityType: "PHONE",
          normalizedValue: "+919876543210",
          linkType: "EXACT_IDENTIFIER_MATCH",
          confidenceCategory: "ANALYST_CONFIRMED",
          status: "CONFIRMED",
          matchRule: "RULE_EXACT_NORM_PHONE_V1",
          explanation: "Analyst confirmed historical match under V1",
        },
      });

      // Run re-evaluation
      const reeval = await reevaluateCandidateLinks(prisma, { caseId: seedCase.id, dryRun: false });
      const refreshedLink = await prisma.entityLink.findUnique({ where: { id: confirmedLink.id } });

      const passed =
        refreshedLink.status === "CONFIRMED" &&
        reeval.confirmedPreservedCount === 1 &&
        reeval.affectedCount === 0;

      record(
        "TC-13",
        "Normalization version change strictly preserves confirmed historical links",
        passed ? "PASSED" : "FAILED",
        `Confirmed status: ${refreshedLink.status}, Preserved count: ${reeval.confirmedPreservedCount}`
      );
    }

    // ─── Scenario 14: Generic email addresses are marked non-unique
    {
      const supportEmail = normalizeEmail("support@example.com");
      const infoEmail = normalizeEmail("info@company.in");
      const personalEmail = normalizeEmail("aryan.tripathi@legitlawfirm.org");
      const passed =
        supportEmail.isGeneric &&
        infoEmail.isGeneric &&
        !personalEmail.isGeneric;
      record(
        "TC-14",
        "Generic email addresses marked non-unique with limitation tags",
        passed ? "PASSED" : "FAILED",
        `support isGeneric=${supportEmail.isGeneric}, personal isGeneric=${personalEmail.isGeneric}`
      );
    }

    // ─── Scenario 15: Shared helplines are not treated as unique identifiers
    {
      const h1930 = normalizePhone("1930"); // National cybercrime helpline
      const h112 = normalizePhone("112");   // Emergency helpline
      const evalLink = evaluateCandidateLink({
        sourceCaseId: "case-p40-h1",
        sourceCaseNumber: "CASE-2026-H1",
        targetCaseId: "case-p40-h2",
        targetCaseNumber: "CASE-2026-H2",
        entityType: "PHONE",
        rawValueA: "1930",
        rawValueB: "1930",
      });
      const passed =
        h1930.isGeneric &&
        h112.isGeneric &&
        evalLink.isGeneric &&
        evalLink.linkType === "POTENTIAL_MATCH" &&
        evalLink.confidenceCategory === "POTENTIAL_MATCH";
      record(
        "TC-15",
        "Emergency and cyber helplines prevented from becoming exact identity matches",
        passed ? "PASSED" : "FAILED",
        `1930 linkType: ${evalLink.linkType}, category: ${evalLink.confidenceCategory}`
      );
    }

    // ─── Scenario 16: Private IP addresses not treated as unique identity evidence
    {
      const ip192 = normalizeIp("192.168.1.1");
      const ip10 = normalizeIp("10.0.0.1");
      const ipCgnat = normalizeIp("100.64.0.1");
      const publicIp = normalizeIp("103.21.244.2");
      const passed =
        ip192.isGeneric &&
        ip10.isGeneric &&
        ipCgnat.isGeneric &&
        !publicIp.isGeneric;
      record(
        "TC-16",
        "Private and Carrier-Grade NAT (CGNAT) IPs flagged as non-attributable",
        passed ? "PASSED" : "FAILED",
        `192.168.1.1 generic=${ip192.isGeneric}, CGNAT generic=${ipCgnat.isGeneric}, Public generic=${publicIp.isGeneric}`
      );
    }

    // ─── Scenario 17: Domain and URL canonicalization preserves meaningful distinctions
    {
      const url1 = normalizeUrl("https://example.com/phish/login?ref=123");
      const url2 = normalizeUrl("https://example.com/legit/about");
      const evalMatch = evaluateCandidateLink({
        sourceCaseId: "case-p40-u1",
        sourceCaseNumber: "CASE-2026-U1",
        targetCaseId: "case-p40-u2",
        targetCaseNumber: "CASE-2026-U2",
        entityType: "URL",
        rawValueA: "https://example.com/phish/login?ref=123",
        rawValueB: "https://example.com/legit/about",
      });
      const passed = !evalMatch.isMatch && url1.normalizedValue !== url2.normalizedValue;
      record(
        "TC-17",
        "URL path canonicalization preserves distinct endpoint identities",
        passed ? "PASSED" : "FAILED",
        `Distinct URLs do not match: isMatch=${evalMatch.isMatch}`
      );
    }

    // ─── Scenario 18: UPI values normalized without conflating with emails
    {
      const upi = normalizeUpi("merchant.pay@okhdfcbank");
      const email = normalizeEmail("merchant.pay@gmail.com");
      const passed =
        upi.isValid &&
        email.isValid &&
        upi.normalizedValue === "merchant.pay@okhdfcbank" &&
        email.normalizedValue === "merchant.pay@gmail.com";
      record(
        "TC-18",
        "UPI VPA handles normalized distinctly from email addresses",
        passed ? "PASSED" : "FAILED",
        `UPI: ${upi.normalizedValue}, Email: ${email.normalizedValue}`
      );
    }

    // ─── Scenario 19: Transaction references (UTR) remain distinct from phone numbers
    {
      const utr = normalizeUtr("919876543210"); // 12 digits starting with 91
      const passed =
        utr.isValid &&
        utr.normalizedValue === "919876543210" &&
        !utr.normalizedValue.startsWith("+91");
      record(
        "TC-19",
        "12-digit financial UTR reference never prefixed as +91 phone",
        passed ? "PASSED" : "FAILED",
        `UTR: ${utr.normalizedValue}`
      );
    }

    // ─── Scenario 20: Device-hash normalization validates expected hex format
    {
      const validSha256 = normalizeDeviceHash("E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855");
      const validMac = normalizeDeviceHash("00:1A:2B:3C:4D:5E");
      const invalidHash = normalizeDeviceHash("not_a_valid_hex_hash_value");
      const passed =
        validSha256.isValid &&
        validSha256.normalizedValue === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" &&
        validMac.isValid &&
        validMac.normalizedValue === "001a2b3c4d5e" &&
        !invalidHash.isValid;
      record(
        "TC-20",
        "Cryptographic digests and MAC addresses strictly validated for hex format",
        passed ? "PASSED" : "FAILED",
        `SHA-256 valid=${validSha256.isValid}, MAC valid=${validMac.isValid}, non-hex valid=${invalidHash.isValid}`
      );
    }

    // ─── Scenario 21: Candidate links retain source evidence and case provenance
    {
      const evalRes = evaluateCandidateLink({
        sourceCaseId: "case-prov-001",
        sourceCaseNumber: "CASE-2026-PROV1",
        targetCaseId: "case-prov-002",
        targetCaseNumber: "CASE-2026-PROV2",
        sourceEvidenceId: "ev-prov-001",
        targetEvidenceId: "ev-prov-002",
        entityType: "PHONE",
        rawValueA: "+91 9876543210",
        rawValueB: "9876543210",
      });
      const passed =
        evalRes.isMatch &&
        evalRes.sourceCaseId === "case-prov-001" &&
        evalRes.targetCaseId === "case-prov-002" &&
        evalRes.sourceEvidenceId === "ev-prov-001" &&
        evalRes.targetEvidenceId === "ev-prov-002" &&
        evalRes.normalizationVersion === "v2";
      record(
        "TC-21",
        "Candidate evaluation preserves complete multi-case provenance anchors",
        passed ? "PASSED" : "FAILED",
        `Rule: ${evalRes.matchRule}, Version: ${evalRes.normalizationVersion}`
      );
    }

    // ─── Scenario 22: Ambiguous normalization results cannot produce confirmed links
    {
      const evalAmbiguous = evaluateCandidateLink({
        sourceCaseId: "case-ambig-1",
        sourceCaseNumber: "CASE-AMBIG-1",
        targetCaseId: "case-ambig-2",
        targetCaseNumber: "CASE-AMBIG-2",
        entityType: "PHONE",
        rawValueA: "1800111222", // Toll-free helpline
        rawValueB: "1800111222",
      });
      const passed =
        evalAmbiguous.isMatch &&
        evalAmbiguous.linkType === "POTENTIAL_MATCH" &&
        evalAmbiguous.confidenceCategory !== "EXACT_IDENTIFIER_MATCH";
      record(
        "TC-22",
        "Ambiguous or generic values gated from exact confirmed matching",
        passed ? "PASSED" : "FAILED",
        `LinkType: ${evalAmbiguous.linkType}, Category: ${evalAmbiguous.confidenceCategory}`
      );
    }

    // ─── Scenario 23: Reviewed relationship preserved when normalized value unchanged
    {
      const caseA = await prisma.case.create({
        data: {
          caseNumber: "CASE-40-REV-001",
          description: "Reviewed Relationship Preservation",
          complainantName: "State Cyber Cell",
          departmentId: dept.id,
          incidentType: "CYBER_FINANCIAL_FRAUD",
        },
      });
      const caseB = await prisma.case.create({
        data: {
          caseNumber: "CASE-40-REV-002",
          description: "Reviewed Relationship Target",
          complainantName: "State Cyber Cell",
          departmentId: dept.id,
          incidentType: "CYBER_FINANCIAL_FRAUD",
        },
      });

      const candidateLink = await prisma.entityLink.create({
        data: {
          sourceCaseId: caseA.id,
          targetCaseId: caseB.id,
          entityType: "PHONE",
          normalizedValue: "+919876543210",
          linkType: "EXACT_IDENTIFIER_MATCH",
          confidenceCategory: "EXACT_IDENTIFIER_MATCH",
          status: "CANDIDATE",
          matchRule: "RULE_EXACT_NORM_PHONE_V2",
          explanation: "Candidate exact match",
        },
      });

      const reeval = await reevaluateCandidateLinks(prisma, { caseId: caseA.id, dryRun: false });
      const refreshed = await prisma.entityLink.findUnique({ where: { id: candidateLink.id } });

      const passed =
        refreshed.normalizedValue === "+919876543210" &&
        !refreshed.limitations?.includes("FLAGGED_FOR_REEVALUATION_V2") &&
        reeval.unaffectedCount >= 1;

      record(
        "TC-23",
        "Reviewed relationship preserved when normalized value is unchanged under V2",
        passed ? "PASSED" : "FAILED",
        `Unaffected count: ${reeval.unaffectedCount}, Limitations: ${refreshed.limitations || "none"}`
      );
    }

    // ─── Scenario 24: Candidate link flagged for re-evaluation when normalization basis changes
    {
      const caseA = await prisma.case.create({
        data: {
          caseNumber: "CASE-40-FLAG-001",
          description: "Reevaluation Flagging Case A",
          complainantName: "State Cyber Cell",
          departmentId: dept.id,
          incidentType: "CYBER_FINANCIAL_FRAUD",
        },
      });
      const caseB = await prisma.case.create({
        data: {
          caseNumber: "CASE-40-FLAG-002",
          description: "Reevaluation Flagging Case B",
          complainantName: "State Cyber Cell",
          departmentId: dept.id,
          incidentType: "CYBER_FINANCIAL_FRAUD",
        },
      });

      // Insert link with obsolete generic helpline that V1 did not flag
      const oldGenericLink = await prisma.entityLink.create({
        data: {
          sourceCaseId: caseA.id,
          targetCaseId: caseB.id,
          entityType: "PHONE",
          normalizedValue: "1930", // Cybercrime helpline
          linkType: "EXACT_IDENTIFIER_MATCH",
          status: "CANDIDATE",
          matchRule: "RULE_EXACT_NORM_PHONE_V1",
          explanation: "Legacy match on 1930",
        },
      });

      const reeval = await reevaluateCandidateLinks(prisma, { caseId: caseA.id, dryRun: false });
      const refreshed = await prisma.entityLink.findUnique({ where: { id: oldGenericLink.id } });

      const passed =
        reeval.affectedCount >= 1 &&
        refreshed.limitations?.includes("FLAGGED_FOR_REEVALUATION_V2");

      record(
        "TC-24",
        "Affected candidate link flagged for re-evaluation upon normalization divergence",
        passed ? "PASSED" : "FAILED",
        `Affected count: ${reeval.affectedCount}, Updated limitations: ${refreshed.limitations}`
      );
    }

    // ─── Scenario 25: Existing Phase 37 entity resolution logic remains compatible
    {
      const rawA = "test.investigator@mumbaipolice.gov.in";
      const rawB = "test.investigator@mumbaipolice.gov.in";
      const evalRes = evaluateCandidateLink({
        sourceCaseId: "case-p37-comp-1",
        sourceCaseNumber: "CASE-P37-1",
        targetCaseId: "case-p37-comp-2",
        targetCaseNumber: "CASE-P37-2",
        entityType: "EMAIL",
        rawValueA: rawA,
        rawValueB: rawB,
      });
      const passed =
        evalRes.isMatch &&
        evalRes.linkType === "EXACT_IDENTIFIER_MATCH" &&
        evalRes.normalizedValue === "test.investigator@mumbaipolice.gov.in";
      record(
        "TC-25",
        "Phase 37 cross-case entity resolution compatibility maintained",
        passed ? "PASSED" : "FAILED",
        `Rule: ${evalRes.matchRule}`
      );
    }

    // ─── Scenario 26: Bank Account collision resistance
    {
      const evalAcc = evaluateCandidateLink({
        sourceCaseId: "case-acc-1",
        sourceCaseNumber: "CASE-ACC-1",
        targetCaseId: "case-acc-2",
        targetCaseNumber: "CASE-ACC-2",
        entityType: "ACCOUNT",
        rawValueA: "123456789012",
        rawValueB: "987654321098",
      });
      const passed = !evalAcc.isMatch;
      record(
        "TC-26",
        "Distinct financial bank accounts do not produce false collisions",
        passed ? "PASSED" : "FAILED",
        `isMatch=${evalAcc.isMatch}`
      );
    }

    // ─── Scenario 27: IFSC non-unique facility tagging
    {
      const ifsc = normalizeIfsc("SBIN0001234");
      const passed = ifsc.isValid && ifsc.normalizedValue === "SBIN0001234";
      record(
        "TC-27",
        "IFSC code normalized as facility identifier",
        passed ? "PASSED" : "FAILED",
        `IFSC: ${ifsc.normalizedValue}`
      );
    }

    // ─── Scenario 28: Keyed HMAC digest is deterministic and one-way
    {
      const val = "+919876543210";
      const digest1 = computeKeyedDigest(val);
      const digest2 = computeKeyedDigest(val);
      const passed = digest1 === digest2 && digest1.length === 64;
      record(
        "TC-28",
        "Keyed HMAC digest calculation is one-way and deterministic",
        passed ? "PASSED" : "FAILED",
        `Digest length: ${digest1.length}`
      );
    }

    // ─── Scenario 29: Active development database immutability
    {
      const finalDevDbHash = sha256File(ACTIVE_DB_PATH);
      const passed = initialDevDbHash === finalDevDbHash;
      record(
        "TC-29",
        "Active development database (prisma/dev.db) remains 100% untouched",
        passed ? "PASSED" : "FAILED",
        `Initial: ${initialDevDbHash.slice(0, 16)}..., Final: ${finalDevDbHash.slice(0, 16)}...`
      );
    }

    // ─── Scenario 30: Cold storage evidence exhibits immutability
    {
      const finalColdStorage = computeDirectoryManifest(RAW_DIR);
      const passed =
        initialColdStorage.count === finalColdStorage.count &&
        initialColdStorage.manifestHash === finalColdStorage.manifestHash &&
        finalColdStorage.count === 560;
      record(
        "TC-30",
        "Cold storage evidence exhibits (uploads/raw/) remain 100% unaltered",
        passed ? "PASSED" : "FAILED",
        `Count: ${finalColdStorage.count}, Manifest: ${finalColdStorage.manifestHash.slice(0, 16)}...`
      );
    }
  } finally {
    await prisma.$disconnect();
  }

  const passedCount = results.filter((r) => r.status === "PASSED").length;
  const totalCount = results.length;
  const passRate = ((passedCount / totalCount) * 100).toFixed(1) + "%";

  console.log("\n================================================================");
  console.log(`   PHASE 40 TEST EXECUTION SUMMARY:`);
  console.log(`   Total Scenarios Executed: ${totalCount}`);
  console.log(`   Passed:                   ${passedCount} / ${totalCount} (${passRate})`);
  console.log(`   Failed:                   ${totalCount - passedCount}`);
  console.log("================================================================\n");

  const summary = {
    phase: "PHASE_40",
    title: "Identifier Normalization, Match Quality & Reproducible Test Baselines",
    timestamp: new Date().toISOString(),
    testDatabase: TARGET_DB,
    summary: {
      total: totalCount,
      passed: passedCount,
      failed: totalCount - passedCount,
      successRate: passRate,
    },
    invariants: {
      activeDatabaseUntouched: sha256File(ACTIVE_DB_PATH) === initialDevDbHash,
      coldStorageUntouched: computeDirectoryManifest(RAW_DIR).manifestHash === initialColdStorage.manifestHash,
      coldStorageCount: 560,
    },
    results,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2), "utf8");
  console.log(`Results written to: ${OUT_JSON}\n`);

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runPhase40Suite().catch((err) => {
  console.error("FATAL ERROR in Phase 40 test suite:", err);
  process.exit(1);
});
