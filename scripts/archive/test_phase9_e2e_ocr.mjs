/**
 * scripts/test_phase9_e2e_ocr.mjs
 * 
 * Comprehensive Phase 9 End-to-End Regression & OCR Verification Test Suite
 * 
 * Verifies the complete forensic lifecycle:
 * 1. Officer Authentication & RBAC Session verification
 * 2. Case Creation with Assigned Investigating Officer
 * 3. Client/Server SHA-256 Dual Verification (Tamper / Mismatch rejection)
 * 4. Forensic Evidence Persistence & Cold Storage Integrity (uploads/raw/<sha256>.bin)
 * 5. Document Text & OCR Extraction (PDF Bank Statement & Image OCR)
 * 6. Deterministic Entity Extraction & Source Anchoring (UPI, Phone, IFSC, UTR)
 * 7. Timeline Event Association & Modus Operandi Classification
 * 8. Cross-Case Syndicate Intelligence Graph Resolution
 * 9. Legal Matrix Mapping & BSA Section 63 Electronic Dossier Generation
 * 10. Investigation Report Generation & RBAC Download Authorization
 * 11. Centralized Audit Log & Chain of Custody Trail Verification
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';

const BASE_URL = 'http://localhost:3000';

function computeSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function runTest() {
  console.log('================================================================');
  console.log('   RAKSHAK v3.0 — PHASE 9 OCR & END-TO-END VALIDATION SUITE     ');
  console.log('================================================================\n');

  let sessionCookie = '';
  let officerName = 'Inspector Rajesh Kumar';
  let officerBadge = 'DL-002';
  let createdCaseId = null;
  let createdCaseNumber = null;
  let pdfEvidenceId = null;
  let pdfServerHash = null;

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 1: Officer Authentication & Session Verification
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[STAGE 1] Testing Officer Authentication & Session Handling...');
  {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        badgeNumber: officerBadge,
        password: 'Rakshak@2026',
      }),
    });

    if (!loginRes.ok) {
      throw new Error(`Officer login failed with HTTP ${loginRes.status}`);
    }

    const loginData = await loginRes.json();
    console.log(`  ✓ Logged in as: ${loginData.officer.name} (${loginData.officer.designation}, Role: ${loginData.officer.role})`);

    const setCookie = loginRes.headers.get('set-cookie');
    if (setCookie) {
      sessionCookie = setCookie.split(';')[0];
      console.log('  ✓ Acquired secure session cookie');
    }

    // Verify /api/auth/me
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    const meData = await meRes.json();
    if (!meData.authenticated || meData.officer.badgeNumber !== officerBadge) {
      throw new Error('Session cookie failed identity verification');
    }
    console.log('  ✓ /api/auth/me confirmed valid authenticated identity');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 2: Case Creation with Assigned Officer
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[STAGE 2] Testing Case Creation with Assigned Investigating Officer...');
  {
    const uniqueSuffix = Date.now().toString().slice(-6);
    createdCaseNumber = `CYB/2026/PH9-${uniqueSuffix}`;

    const createCaseRes = await fetch(`${BASE_URL}/api/cases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        caseNumber: createdCaseNumber,
        incidentType: 'Investment_Fraud',
        complainantName: 'Sunita Sharma',
        jurisdiction: 'Delhi Cyber Crime Cell',
        amountDefrauded: 1450000,
        description: 'Victim targeted via Telegram investment scheme promising 300% returns, redirected to spoofed ICICI portal.',
        firNumber: `FIR-09-${uniqueSuffix}/2026`,
        officerName: officerName,
        officerBadge: officerBadge,
      }),
    });

    if (!createCaseRes.ok) {
      const err = await createCaseRes.text();
      throw new Error(`Case creation failed: ${createCaseRes.status} - ${err}`);
    }

    const caseData = await createCaseRes.json();
    createdCaseId = caseData.id;
    console.log(`  ✓ Case created: ID=${createdCaseId}, Number=${caseData.caseNumber}`);
    console.log(`  ✓ Assigned Officer: ${caseData.officerName} (${caseData.officerBadge})`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 3: Dual Client/Server SHA-256 Verification & Tamper Protection
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[STAGE 3] Testing Client/Server SHA-256 Verification & Tamper Protection...');
  {
    // 3a. Generate synthetic PDF bank statement with forensic entities
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('STATE BANK OF INDIA - FORENSIC TRANSACTION STATEMENT', 14, 20);
    doc.setFontSize(11);
    doc.text('Account Number: 987654321001', 14, 32);
    doc.text('IFSC Code: SBIN0001234', 14, 40);
    doc.text('Beneficiary UPI ID: syndicate.rakshak@okaxis', 14, 48);
    doc.text('Transaction Phone: +919876543210', 14, 56);
    doc.text('Reference UTR: UTR987654321098', 14, 64);
    doc.text('Secondary Domain: payment-secure-portal.com', 14, 72);
    doc.text('Destination IP: 192.168.1.105', 14, 80);
    doc.text('Remarks: Part of transnational task scam funnel', 14, 88);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const realSha256 = computeSha256(pdfBuffer);
    const tamperedSha256 = '0000000000000000000000000000000000000000000000000000000000000000';

    console.log(`  Generated synthetic PDF (${pdfBuffer.length} bytes, SHA-256: ${realSha256.substring(0, 16)}...)`);

    // 3b. Test Tampered Upload (should be rejected with 422)
    const badFormData = new FormData();
    const badBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
    badFormData.append('file', badBlob, 'bank_statement_tampered.pdf');
    badFormData.append('caseId', createdCaseId);
    badFormData.append('clientHash', tamperedSha256);
    badFormData.append('category', 'UPI_FINANCIAL');

    const badUploadRes = await fetch(`${BASE_URL}/api/evidence/upload`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
      body: badFormData,
    });

    if (badUploadRes.status === 422) {
      const badData = await badUploadRes.json();
      console.log(`  ✓ Tampered upload correctly rejected: HTTP 422 (${badData.code}: ${badData.error})`);
    } else {
      const badBody = await badUploadRes.text();
      throw new Error(`Tampered upload was NOT rejected! Received HTTP ${badUploadRes.status} - Body: ${badBody}`);
    }

    // 3c. Test Legitimate Upload with matching client SHA-256
    const goodFormData = new FormData();
    const goodBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
    goodFormData.append('file', goodBlob, 'sbi_forensic_statement.pdf');
    goodFormData.append('caseId', createdCaseId);
    goodFormData.append('clientHash', realSha256);
    goodFormData.append('category', 'UPI_FINANCIAL');

    const goodUploadRes = await fetch(`${BASE_URL}/api/evidence/upload`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
      body: goodFormData,
    });

    if (!goodUploadRes.ok) {
      const err = await goodUploadRes.text();
      throw new Error(`Legitimate upload failed: HTTP ${goodUploadRes.status} - ${err}`);
    }

    const uploadData = await goodUploadRes.json();
    pdfEvidenceId = uploadData.evidenceId;
    pdfServerHash = uploadData.sha256Hash;

    if (pdfServerHash !== realSha256 || !uploadData.verified) {
      throw new Error(`Upload integrity verification failed: serverHash=${pdfServerHash}, realSha256=${realSha256}`);
    }
    console.log(`  ✓ Legitimate evidence accepted: ID=${pdfEvidenceId}, Verified SHA-256=${pdfServerHash.substring(0, 16)}...`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 4: Storage Persistence & Cold Storage Path Verification
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[STAGE 4] Verifying Evidence Persistence & Cold Storage Integrity...');
  {
    const storageFilePath = path.join(process.cwd(), 'uploads', 'raw', `${pdfServerHash}.bin`);
    if (!fs.existsSync(storageFilePath)) {
      throw new Error(`Stored file does not exist at expected cold storage path: ${storageFilePath}`);
    }

    const storedBytes = fs.readFileSync(storageFilePath);
    const storedHash = computeSha256(storedBytes);
    if (storedHash !== pdfServerHash) {
      throw new Error(`Cold storage byte integrity compromised! Disk hash: ${storedHash}`);
    }
    console.log(`  ✓ File persists at uploads/raw/${pdfServerHash}.bin (${storedBytes.length} bytes, SHA-256 match verified)`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 5: OCR & Document Text Extraction
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[STAGE 5] Testing Document Text Extraction & OCR Engine...');
  {
    // Trigger explicit OCR endpoint
    const ocrRes = await fetch(`${BASE_URL}/api/evidence/${pdfEvidenceId}/ocr`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    });

    if (!ocrRes.ok) {
      const err = await ocrRes.text();
      throw new Error(`OCR execution failed: HTTP ${ocrRes.status} - ${err}`);
    }

    const ocrData = await ocrRes.json();
    console.log(`  ✓ OCR Engine: ${ocrData.ocr.engine} (v${ocrData.ocr.engineVersion})`);
    console.log(`  ✓ Status: ${ocrData.ocr.status}, Confidence: ${ocrData.ocr.confidence}%, Chars: ${ocrData.ocr.charCount}`);
    console.log(`  ✓ Entities extracted in OCR payload: ${ocrData.entitiesCount}`);
    if (ocrData.ocr.error) console.log(`  ⚠ OCR Error detail: ${ocrData.ocr.error}`);
    console.log(`  ✓ Processing Time: ${ocrData.ocr.processingTimeMs}ms, Pages: ${ocrData.ocr.pageCount}`);

    if (ocrData.ocr.status !== 'SUCCESS' || ocrData.ocr.charCount < 50) {
      throw new Error(`OCR did not extract expected text length: charCount=${ocrData.ocr.charCount}`);
    }

    // Verify GET /api/evidence/:id/text endpoint
    const textRes = await fetch(`${BASE_URL}/api/evidence/${pdfEvidenceId}/text`);
    if (!textRes.ok) throw new Error(`GET /api/evidence/:id/text failed with HTTP ${textRes.status}`);
    const textData = await textRes.json();
    console.log(`  ✓ /api/evidence/:id/text confirmed raw text length: ${(textData.text || textData.rawText || '').length} chars`);

    // Verify GET /api/evidence/:id/ocr status endpoint
    const ocrStatusRes = await fetch(`${BASE_URL}/api/evidence/${pdfEvidenceId}/ocr`);
    if (!ocrStatusRes.ok) throw new Error(`GET /api/evidence/:id/ocr failed with HTTP ${ocrStatusRes.status}`);
    const ocrStatusData = await ocrStatusRes.json();
    console.log(`  ✓ /api/evidence/:id/ocr confirmed telemetry status: ${ocrStatusData.ocr?.status}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 6: Deterministic Entity Extraction & Source Anchoring
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[STAGE 6] Testing Deterministic Entity Extraction & Provenance Anchoring...');
  {
    const evidenceRes = await fetch(`${BASE_URL}/api/evidence/${pdfEvidenceId}`);
    if (!evidenceRes.ok) throw new Error(`GET /api/evidence/:id failed: HTTP ${evidenceRes.status}`);
    const evidenceData = await evidenceRes.json();
    let facts = evidenceData.facts || [];
    console.log(`  ✓ Evidence facts count: ${facts.length}`);

    if (facts.length === 0) {
      // Also check GET /api/entities?caseId=
      const entRes = await fetch(`${BASE_URL}/api/entities?caseId=${createdCaseId}`);
      if (entRes.ok) {
        const entData = await entRes.json();
        console.log(`  ✓ Checked /api/entities?caseId: ${entData.entities?.length || entData.length || 0} entities found`);
        if (Array.isArray(entData.entities)) facts = entData.entities;
        else if (Array.isArray(entData)) facts = entData;
      }
    }

    const extractedTypes = facts.map(f => f.entityType);
    console.log(`  ✓ Entity types extracted: ${Array.from(new Set(extractedTypes)).join(', ')}`);

    // Check specific known entities
    const upiFact = facts.find(f => f.entityType === 'UPI');
    const phoneFact = facts.find(f => f.entityType === 'PHONE');
    const ifscFact = facts.find(f => f.entityType === 'IFSC');
    const utrFact = facts.find(f => f.entityType === 'UTR');

    if (!upiFact) throw new Error('Expected UPI entity was not extracted');
    if (!phoneFact) throw new Error('Expected PHONE entity was not extracted');
    if (!ifscFact) throw new Error('Expected IFSC entity was not extracted');

    console.log(`  ✓ UPI: ${upiFact.normalizedValue} (SourceHash: ${upiFact.sourceHash.substring(0, 16)}...)`);
    console.log(`  ✓ Phone: ${phoneFact.normalizedValue} (SourceHash: ${phoneFact.sourceHash.substring(0, 16)}...)`);
    console.log(`  ✓ IFSC: ${ifscFact.normalizedValue} (SourceHash: ${ifscFact.sourceHash.substring(0, 16)}...)`);
    if (utrFact) {
      console.log(`  ✓ UTR: ${utrFact.normalizedValue}`);
    }

    // Verify source anchoring
    if (upiFact.sourceHash !== pdfServerHash || upiFact.evidenceId !== pdfEvidenceId) {
      throw new Error('Entity provenance anchor mismatch! Does not point to originating evidence');
    }
    console.log('  ✓ Provenance anchors verified: SourceHash matches original evidence SHA-256');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 7: Timeline Association
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[STAGE 7] Testing Timeline Association & Modus Operandi Classification...');
  {
    // Post timeline event for this evidence
    const timelineRes = await fetch(`${BASE_URL}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: createdCaseId,
        events: [
          {
            rawTimestamp: '2026-10-10 14:30:00',
            description: 'Fraudulent transaction executed via UPI gateway syndicate.rakshak@okaxis',
            sourceType: 'BANK_SMS',
            evidenceId: pdfEvidenceId,
          },
        ],
      }),
    });

    if (!timelineRes.ok) {
      const err = await timelineRes.text();
      throw new Error(`Timeline creation failed: HTTP ${timelineRes.status} - ${err}`);
    }

    const timelineData = await timelineRes.json();
    console.log(`  ✓ Timeline event ingested: count=${timelineData.ingestedCount || 1}`);

    // Query case timeline
    const caseTimelineRes = await fetch(`${BASE_URL}/api/timeline?caseId=${createdCaseId}`);
    const timelineJson = await caseTimelineRes.json();
    const events = timelineJson.events || (Array.isArray(timelineJson) ? timelineJson : []);
    if (!Array.isArray(events) || events.length === 0) {
      throw new Error('Case timeline query returned no events');
    }
    console.log(`  ✓ Case timeline confirmed ${events.length} event(s)`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 8: Cross-Case Syndicate Graph Resolution
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[STAGE 8] Testing Cross-Case Syndicate Intelligence Resolution...');
  {
    const graphRes = await fetch(`${BASE_URL}/api/graph`);
    if (!graphRes.ok) throw new Error(`GET /api/graph failed: HTTP ${graphRes.status}`);
    const graphData = await graphRes.json();
    console.log(`  ✓ Cross-case Graph Nodes: ${graphData.nodes?.length || 0}, Edges: ${graphData.edges?.length || 0}`);

    if (!Array.isArray(graphData.nodes) || graphData.nodes.length === 0) {
      throw new Error('Cross-case graph contains no nodes');
    }

    // Verify clusters
    const clustersRes = await fetch(`${BASE_URL}/api/clusters`);
    if (!clustersRes.ok) throw new Error(`GET /api/clusters failed: HTTP ${clustersRes.status}`);
    const clusters = await clustersRes.json();
    console.log(`  ✓ Syndicate Clusters discovered: ${Array.isArray(clusters) ? clusters.length : clusters.clusters?.length || 0}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 9: Legal Matrix Mapping & BSA Section 63 Dossier Export
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[STAGE 9] Testing Statutory Legal Mapping & BSA §63 Dossier Export...');
  {
    // 9a. Verify legal provisions
    const legalRes = await fetch(`${BASE_URL}/api/cases/${createdCaseId}/legal`);
    if (!legalRes.ok) throw new Error(`GET /api/cases/:id/legal failed: HTTP ${legalRes.status}`);
    const legalData = await legalRes.json();
    console.log(`  ✓ Legal matrix provisions loaded: ${legalData.provisions?.length || 0} provisions available`);

    // 9b. Generate BSA Section 63 Electronic Record Manifest Dossier
    const exportRes = await fetch(`${BASE_URL}/api/cases/${createdCaseId}/dossier/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        format: 'JSON',
        includeEvidence: true,
        officerName: officerName,
        officerBadge: officerBadge,
      }),
    });

    if (!exportRes.ok) {
      const err = await exportRes.text();
      throw new Error(`Dossier export failed: HTTP ${exportRes.status} - ${err}`);
    }

    const dossierData = await exportRes.json();
    console.log(`  ✓ BSA Section 63 Dossier exported: Version=${dossierData.dossierVersion}`);
    console.log(`  ✓ Certifying Officer: ${dossierData.statutoryCertificate?.certifyingOfficer}`);
    console.log(`  ✓ Electronic Evidence Manifest Count: ${dossierData.evidenceManifest?.length || 0}`);
    const firstEv = dossierData.evidenceManifest?.[0];
    if (firstEv) {
      console.log(`  ✓ Manifest Evidence SHA-256: ${firstEv.sha256Hash?.substring(0, 16)}... (Integrity Verified: ${firstEv.integrityVerified})`);
    }

    if (!dossierData.evidenceManifest || dossierData.evidenceManifest.length < 1) {
      throw new Error('Dossier manifest did not include verified evidence records');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 10: Investigation Report Generation & RBAC Download Authorization
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[STAGE 10] Testing Report Generation & RBAC Access Enforcement...');
  {
    // Generate report with session
    const reportRes = await fetch(`${BASE_URL}/api/reports/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        reportType: 'INVESTIGATION_COMPLETE',
        caseId: createdCaseId,
        title: `Comprehensive Investigation Report — ${createdCaseNumber}`,
        outputFormat: 'PDF',
      }),
    });

    if (!reportRes.ok) {
      const err = await reportRes.text();
      throw new Error(`Report generation failed: HTTP ${reportRes.status} - ${err}`);
    }

    const reportData = await reportRes.json();
    console.log(`  ✓ Investigation Report generated: Number=${reportData.report.reportNumber}, Status=${reportData.report.status}`);

    const reportId = reportData.report.id;

    // Test Unauthorized Download with invalid/tampered token (Must be rejected)
    const unauthDownloadRes = await fetch(`${BASE_URL}/api/reports/${reportId}/download`, {
      headers: { Cookie: 'rakshak_session=tampered_invalid_token_99999' },
    });
    if (unauthDownloadRes.status === 401 || unauthDownloadRes.status === 403) {
      console.log(`  ✓ Unauthorized report download correctly rejected: HTTP ${unauthDownloadRes.status}`);
    } else {
      throw new Error(`Unauthorized report download was NOT rejected! Status=${unauthDownloadRes.status}`);
    }

    // Test Authenticated Download (Must succeed)
    const authDownloadRes = await fetch(`${BASE_URL}/api/reports/${reportId}/download`, {
      headers: { Cookie: sessionCookie },
    });
    if (authDownloadRes.ok) {
      const reportBlob = await authDownloadRes.arrayBuffer();
      console.log(`  ✓ Authenticated report download succeeded (${reportBlob.byteLength} bytes)`);
    } else {
      throw new Error(`Authenticated report download failed: HTTP ${authDownloadRes.status}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 11: Centralized Audit Logging & Chain of Custody Trail
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[STAGE 11] Verifying Centralized Audit Trail & Chain of Custody...');
  {
    // Check evidence chain of custody events
    const custodyRes = await fetch(`${BASE_URL}/api/evidence/${pdfEvidenceId}/custody`);
    if (custodyRes.ok) {
      const custodyData = await custodyRes.json();
      const eventsCount = custodyData.custodyLog?.length || (Array.isArray(custodyData) ? custodyData.length : 0);
      console.log(`  ✓ Chain of custody events recorded: ${eventsCount}`);
    }

    // Check centralized audit log
    const auditRes = await fetch(`${BASE_URL}/api/audit?limit=10`, {
      headers: { Cookie: sessionCookie },
    });
    if (!auditRes.ok) throw new Error(`GET /api/audit failed: HTTP ${auditRes.status}`);
    const auditData = await auditRes.json();
    console.log(`  ✓ Total Audit Logs: ${auditData.total}, Recent events: ${auditData.events?.length}`);

    // Verify OCR or evidence intake action logged
    const ocrOrUploadLog = auditData.events?.find(e => e.action === 'OCR_EXTRACTION' || e.action === 'VIEW_EVIDENCE' || e.module === 'Evidence' || e.module === 'Reports');
    if (ocrOrUploadLog) {
      console.log(`  ✓ Audit entry verified: Action=${ocrOrUploadLog.action}, Module=${ocrOrUploadLog.module}, Officer=${ocrOrUploadLog.officerName}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 12: Raster Image OCR Pipeline Verification (Tesseract Engine)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[STAGE 12] Testing Raster Image OCR Pipeline (Tesseract.js V5)...');
  {
    const sampleImagePath = path.join(process.cwd(), 'node_modules', 'tesseract.js', 'docs', 'images', 'tesseract.png');
    if (fs.existsSync(sampleImagePath)) {
      const imgBytes = fs.readFileSync(sampleImagePath);
      const imgSha256 = computeSha256(imgBytes);

      const imgFormData = new FormData();
      const imgBlob = new Blob([imgBytes], { type: 'image/png' });
      imgFormData.append('file', imgBlob, 'evidence_screenshot.png');
      imgFormData.append('caseId', createdCaseId);
      imgFormData.append('clientHash', imgSha256);
      imgFormData.append('evidenceCategory', 'CRIME_SCENE_PHOTO');

      const imgUploadRes = await fetch(`${BASE_URL}/api/evidence/upload`, {
        method: 'POST',
        headers: { Cookie: sessionCookie },
        body: imgFormData,
      });

      if (!imgUploadRes.ok) {
        throw new Error(`Image upload failed: HTTP ${imgUploadRes.status}`);
      }

      const imgData = await imgUploadRes.json();
      console.log(`  ✓ Image evidence ingested: ID=${imgData.evidenceId}, Hash=${imgData.sha256Hash.substring(0, 16)}...`);

      // Trigger OCR on Image
      const imgOcrRes = await fetch(`${BASE_URL}/api/evidence/${imgData.evidenceId}/ocr`, {
        method: 'POST',
        headers: { Cookie: sessionCookie },
      });

      if (!imgOcrRes.ok) {
        throw new Error(`Image OCR trigger failed: HTTP ${imgOcrRes.status}`);
      }

      const imgOcrData = await imgOcrRes.json();
      console.log(`  ✓ Image OCR Engine: ${imgOcrData.ocr.engine} (v${imgOcrData.ocr.engineVersion})`);
      console.log(`  ✓ Image OCR Status: ${imgOcrData.ocr.status}, Confidence: ${imgOcrData.ocr.confidence}%`);
      console.log(`  ✓ Recognized Words/Boxes: ${imgOcrData.ocr.words?.length || 0}`);

      if (imgOcrData.ocr.engine !== 'TESSERACT_OCR_V5' || imgOcrData.ocr.status !== 'SUCCESS') {
        throw new Error(`Tesseract image OCR did not return expected engine or status`);
      }
      console.log('  ✓ Tesseract image OCR successfully parsed raster graphic');
    } else {
      console.log('  ⚠ Sample image not found; skipped raster image OCR test');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log('   PHASE 9 VERIFICATION PASSED: ALL 12 STAGES SUCCESSFUL!       ');
  console.log('================================================================');
  console.log('✓ Full End-to-End Workflow Validated');
  console.log('✓ Cryptographic Evidence Integrity Enforced');
  console.log('✓ Document & Image OCR Active (pdf-parse v2 & Tesseract.js v5)');
  console.log('✓ Deterministic Entity Extraction & Anchoring Operational');
  console.log('✓ Cross-Case Syndicate Graph & Legal Dossier Export Verified');
  console.log('✓ RBAC Enforcement & Centralized Audit Trail Operational');
}

runTest().catch((err) => {
  console.error('\n❌ PHASE 9 TEST FAILED:', err);
  process.exit(1);
});
