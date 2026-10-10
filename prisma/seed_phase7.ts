import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Phase 7 Legal Provisions and Mappings...");

  // 1. Statutory Provisions
  const provisions = [
    {
      act: "Bharatiya Nyaya Sanhita, 2023",
      actCode: "BNS",
      section: "§ 318(4)",
      title: "Cheating by personation",
      description: "Whoever cheats by personation shall be punished with imprisonment of either description for a term which may extend to five years, or with fine, or with both.",
      offenceCategory: "Cyber Impersonation",
      cognizable: true,
      bailable: false,
      sourceUrl: "https://www.indiacode.nic.in/bitstream/123456789/20062/1/a2023-45.pdf",
      statutoryVersion: "2023_OFFICIAL",
      verifiedDate: "2024-07-01",
    },
    {
      act: "Bharatiya Nyaya Sanhita, 2023",
      actCode: "BNS",
      section: "§ 319(2)",
      title: "Cheating and dishonestly inducing delivery of property",
      description: "Whoever cheats and thereby dishonestly induces the person deceived to deliver any property to any person... punishable with imprisonment up to seven years and fine.",
      offenceCategory: "Financial Fraud",
      cognizable: true,
      bailable: false,
      sourceUrl: "https://www.indiacode.nic.in/bitstream/123456789/20062/1/a2023-45.pdf",
      statutoryVersion: "2023_OFFICIAL",
      verifiedDate: "2024-07-01",
    },
    {
      act: "Bharatiya Nyaya Sanhita, 2023",
      actCode: "BNS",
      section: "§ 111",
      title: "Organised crime",
      description: "Continuing unlawful activity including cyber-crimes having severe consequences, economic offences committed by or on behalf of a syndicate.",
      offenceCategory: "Syndicate Operations",
      cognizable: true,
      bailable: false,
      sourceUrl: "https://www.indiacode.nic.in/bitstream/123456789/20062/1/a2023-45.pdf",
      statutoryVersion: "2023_OFFICIAL",
      verifiedDate: "2024-07-01",
    },
    {
      act: "Information Technology Act, 2000",
      actCode: "IT_ACT",
      section: "§ 66C",
      title: "Identity theft",
      description: "Whoever, fraudulently or dishonestly make use of the electronic signature, password or any other unique identification feature of any other person.",
      offenceCategory: "Identity Theft",
      cognizable: true,
      bailable: true,
      sourceUrl: "https://www.indiacode.nic.in/bitstream/123456789/13116/1/it_act_2000_updated.pdf",
      statutoryVersion: "2000_AMENDED",
      verifiedDate: "2024-07-01",
    },
    {
      act: "Information Technology Act, 2000",
      actCode: "IT_ACT",
      section: "§ 66D",
      title: "Cheating by personation using communication device",
      description: "Whoever, by means of any communication device or computer resource cheats by personation, punishable with imprisonment up to three years and fine up to one lakh rupees.",
      offenceCategory: "Cyber Communication Fraud",
      cognizable: true,
      bailable: true,
      sourceUrl: "https://www.indiacode.nic.in/bitstream/123456789/13116/1/it_act_2000_updated.pdf",
      statutoryVersion: "2000_AMENDED",
      verifiedDate: "2024-07-01",
    },
    {
      act: "Information Technology Act, 2000",
      actCode: "IT_ACT",
      section: "§ 66E",
      title: "Violation of privacy",
      description: "Whoever, intentionally or knowingly captures, publishes or transmits the image of a private area of any person without consent.",
      offenceCategory: "Privacy Infringement",
      cognizable: true,
      bailable: true,
      sourceUrl: "https://www.indiacode.nic.in/bitstream/123456789/13116/1/it_act_2000_updated.pdf",
      statutoryVersion: "2000_AMENDED",
      verifiedDate: "2024-07-01",
    },
    {
      act: "Bharatiya Nyaya Sanhita, 2023",
      actCode: "BNS",
      section: "§ 351(2)",
      title: "Criminal intimidation",
      description: "Whoever commits the offence of criminal intimidation shall be punished with imprisonment of either description for a term which may extend to two years, or with fine.",
      offenceCategory: "Digital Arrest / Coercion",
      cognizable: true,
      bailable: true,
      sourceUrl: "https://www.indiacode.nic.in/bitstream/123456789/20062/1/a2023-45.pdf",
      statutoryVersion: "2023_OFFICIAL",
      verifiedDate: "2024-07-01",
    },
    {
      act: "Bharatiya Sakshya Adhiniyam, 2023",
      actCode: "BSA",
      section: "§ 63",
      title: "Admissibility of electronic records",
      description: "Conditions, electronic record integrity verification, device particulars, and statutory certificate requirements under BSA §63(4).",
      offenceCategory: "Evidence Admissibility Standard",
      cognizable: false,
      bailable: false,
      sourceUrl: "https://www.indiacode.nic.in/bitstream/123456789/20063/1/a2023-47.pdf",
      statutoryVersion: "2023_OFFICIAL",
      verifiedDate: "2024-07-01",
    },
  ];

  for (const p of provisions) {
    const existing = await prisma.legalProvision.findFirst({
      where: { actCode: p.actCode, section: p.section },
    });
    if (existing) {
      await prisma.legalProvision.update({
        where: { id: existing.id },
        data: p,
      });
    } else {
      await prisma.legalProvision.create({ data: p });
    }
  }
  console.log(`✅ Seeded ${provisions.length} statutory provisions.`);

  // 2. Case Legal Mappings for CASE-2026-0891
  const case0891 = await prisma.case.findFirst({
    where: { caseNumber: "CASE-2026-0891" },
  });

  if (case0891) {
    const mappings = [
      {
        sectionCode: "BNS_318_4",
        act: "BNS",
        section: "§ 318(4)",
        description: "Cheating by personation",
        relevance: "PRIMARY",
        status: "REVIEWED",
        rationale: "Accused contacted victim impersonating an official e-commerce recruiter offering part-time commission tasks.",
        reviewerName: "ACP Vikram Singh (Badge #DL-002)",
        reviewedAt: new Date("2026-08-30T10:30:00Z"),
        reviewerNotes: "Corroborated by WhatsApp chat transcripts in EV-102 and EV-2026-0043.",
      },
      {
        sectionCode: "BNS_319_2",
        act: "BNS",
        section: "§ 319(2)",
        description: "Cheating and dishonestly inducing delivery of property",
        relevance: "PRIMARY",
        status: "REVIEWED",
        rationale: "Victim was deceived into transferring ₹49,499 across multiple transactions under false unfreeze promises.",
        reviewerName: "ACP Vikram Singh (Badge #DL-002)",
        reviewedAt: new Date("2026-08-30T10:35:00Z"),
        reviewerNotes: "Supported by GPay transaction slip EV-101 and bank statement EV-103.",
      },
      {
        sectionCode: "BNS_111",
        act: "BNS",
        section: "§ 111",
        description: "Organised crime",
        relevance: "SECONDARY",
        status: "SUGGESTED",
        rationale: "Cross-case graph resolution identified identical mule VPA mule88@oksbi operating across 12 police FIRs.",
        reviewerName: null,
        reviewedAt: null,
        reviewerNotes: null,
      },
      {
        sectionCode: "IT_66C",
        act: "IT Act",
        section: "§ 66C",
        description: "Identity theft",
        relevance: "PRIMARY",
        status: "SUGGESTED",
        rationale: "Mule accounts were registered using fraudulently obtained Aadhaar and SIM card identities.",
        reviewerName: null,
        reviewedAt: null,
        reviewerNotes: null,
      },
      {
        sectionCode: "IT_66D",
        act: "IT Act",
        section: "§ 66D",
        description: "Cheating using communication device",
        relevance: "PRIMARY",
        status: "APPROVED",
        rationale: "Mobile numbers and Telegram bot platforms were systematically deployed to orchestrate fraud.",
        reviewerName: "ACP Vikram Singh (Badge #DL-002)",
        reviewedAt: new Date("2026-08-30T11:00:00Z"),
        reviewerNotes: "Verified call logs in EV-104 and intercept audio recording.",
      },
      {
        sectionCode: "IT_66E",
        act: "IT Act",
        section: "§ 66E",
        description: "Violation of privacy (if applicable)",
        relevance: "SECONDARY",
        status: "SUGGESTED",
        rationale: "Suspect collected personal photos and ID documents from victim during mock KYC verification.",
        reviewerName: null,
        reviewedAt: null,
        reviewerNotes: null,
      },
    ];

    for (const m of mappings) {
      await prisma.caseLegalMapping.upsert({
        where: {
          caseId_sectionCode: {
            caseId: case0891.id,
            sectionCode: m.sectionCode,
          },
        },
        update: m,
        create: {
          caseId: case0891.id,
          ...m,
        },
      });
    }
    console.log(`✅ Seeded ${mappings.length} case legal mappings for CASE-2026-0891.`);

    // 3. Evidence-to-Section Mappings
    const evMappings = [
      {
        evidenceId: "EV-2026-0043",
        section: "§ 318(4), § 66D",
        relevance: "HIGH",
        rationale: "WhatsApp chat logs establishing impersonation of task employer and deception.",
      },
      {
        evidenceId: "EV-2026-0076",
        section: "§ 319(2), § 66D",
        relevance: "HIGH",
        rationale: "Screenshot of UPI payment to mule handle establishing inducement of fund delivery.",
      },
      {
        evidenceId: "EV-2026-0091",
        section: "§ 66D",
        relevance: "MEDIUM",
        rationale: "Audio recording of fraudster instructing victim on unfreeze payment steps.",
      },
      {
        evidenceId: "EV-2026-0112",
        section: "§ 111, § 66C",
        relevance: "MEDIUM",
        rationale: "Bank statement showing rapid pass-through mule fund dispersion.",
      },
      {
        evidenceId: "EV-2026-0134",
        section: "§ 318(4), § 66D",
        relevance: "MEDIUM",
        rationale: "Telegram chat export revealing group task admin deception channels.",
      },
      {
        evidenceId: "EV-101",
        section: "§ 319(2)",
        relevance: "HIGH",
        rationale: "Primary victim Google Pay receipt showing direct transfer to mule VPA.",
      },
      {
        evidenceId: "EV-102",
        section: "§ 318(4), § 66D",
        relevance: "HIGH",
        rationale: "Initial contact chat export containing fraudulent task offer and fake company credentials.",
      },
    ];

    for (const em of evMappings) {
      const evRecord = await prisma.evidence.findUnique({ where: { id: em.evidenceId } });
      if (evRecord) {
        await prisma.evidenceLegalMapping.upsert({
          where: {
            evidenceId_section: {
              evidenceId: em.evidenceId,
              section: em.section,
            },
          },
          update: {
            relevance: em.relevance,
            rationale: em.rationale,
            caseId: evRecord.caseId,
          },
          create: {
            evidenceId: em.evidenceId,
            caseId: evRecord.caseId,
            section: em.section,
            relevance: em.relevance,
            rationale: em.rationale,
            mappedBy: "ACP Vikram Singh (Badge #DL-002)",
          },
        });
      }
    }
    console.log(`✅ Seeded evidence legal mappings.`);
  }

  console.log("Phase 7 Legal data seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
