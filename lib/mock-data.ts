// ─────────────────────────────────────────────────────────────────────────────
// NyayaSetu — Mock Data Layer (v3 Upgraded)
// Realistic cybercrime investigation data for forensic demo / hackathon use
// ─────────────────────────────────────────────────────────────────────────────

export type IncidentType =
  | "Task_Scam"
  | "Digital_Arrest"
  | "Investment_Fraud"
  | "KYC_Freeze"
  | "Romance_Scam";

export type EntityType =
  | "UPI"
  | "PHONE"
  | "ACCOUNT"
  | "IFSC"
  | "DOMAIN"
  | "TELEGRAM"
  | "UTR"
  | "EMAIL"
  | "NAME"
  | "ADDRESS"
  | "IP"
  | "GPS_COORD";

export type EvidenceCategory =
  | "CHAT"
  | "UPI_FINANCIAL"
  | "CALL_LOG"
  | "EMAIL"
  | "PHISHING_EMAIL"
  | "IDENTITY_DATA"
  | "DOCUMENT"
  | "CRIME_SCENE_PHOTO"
  | "AUDIO"
  | "VIDEO"
  | "URL_WEB"
  | "OTHER";

export type SourceType = "WHATSAPP" | "BANK_SMS" | "RECEIPT" | "CALL_LOG" | "SCREENSHOT" | "EMAIL" | "CCTV";

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  confidence: number;
  evidenceId: string;
  verificationStatus?: "UNVERIFIED" | "VERIFIED" | "DISPUTED";
  verifiedBy?: string | null;
}

export interface AuthenticityAnalysis {
  technique: "IMAGE_ELA" | "AUDIO_SPECTROGRAM" | "TELECOM_DLT_AUDIT" | "EXIF_TIMECODE_AUDIT" | "EMAIL_DKIM_SPF" | "OCR_IDENTITY_CROSS_REF";
  status: "GENUINE_UNALTERED" | "SUSPICIOUS_ANOMALY" | "ALTERED_SPLICE";
  confidence: number;
  finding: string;
  metricLabel: string;
  metricValue: string;
}

export interface EvidenceItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  sha256Hash: string;
  uploadedAt: string;
  mimeType: string;
  evidenceCategory: EvidenceCategory;
  integrityStatus: "VERIFIED" | "PENDING" | "TAMPERED";
  extractedEntities: ExtractedEntity[];
  mockBoundingBox?: { x: number; y: number; width: number; height: number };
  authenticity?: AuthenticityAnalysis;
  metadata?: Record<string, unknown>;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;        // ISO-8601
  timestampIST: string;     // Human-readable IST
  sourceType: SourceType;
  narrative: string;
  evidenceId: string;
  extractedEntities: ExtractedEntity[];
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface CaseData {
  id: string;
  caseNumber: string;
  incidentType: IncidentType;
  status: "OPEN" | "UNDER_INQUIRY" | "CHARGESHEETED" | "CLOSED";
  createdAt: string;
  jurisdiction: string;
  officerInCharge: string;
  victimName: string;
  amountDefrauded: number;
}

export interface GraphNode {
  id: string;
  type: "case" | "entity" | "victim";
  data: {
    label: string;
    entityType?: EntityType;
    value?: string;
    caseCount?: number;
    riskLevel?: "HIGH" | "MEDIUM" | "LOW";
    amountLinked?: number;
    jurisdictions?: string[];
    incidentType?: string;
  };
  position: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  animated?: boolean;
}

export interface StatutorySection {
  code: string;
  act: string;
  description: string;
  severity: "COGNIZABLE" | "NON_COGNIZABLE";
  bailable: boolean;
}

export interface EvidenceChecklistItem {
  id: string;
  label: string;
  status: "CONFIRMED" | "PENDING" | "NOT_APPLICABLE";
  evidenceId?: string;
  note?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE CASE
// ─────────────────────────────────────────────────────────────────────────────
export const ACTIVE_CASE: CaseData = {
  id: "case-2026-0891",
  caseNumber: "CASE-2026-0891",
  incidentType: "Task_Scam",
  status: "UNDER_INQUIRY",
  createdAt: "2026-08-29T09:17:43.000Z",
  jurisdiction: "Cyber Crime Branch — Sector 17, Chandigarh",
  officerInCharge: "SI Ravi Shankar Meena (Badge #CCB-1147)",
  victimName: "Priya Nair",
  amountDefrauded: 49499,
};

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE ITEMS (Change 1: Expanded 12 Categories)
// ─────────────────────────────────────────────────────────────────────────────
export const EVIDENCE_ITEMS: EvidenceItem[] = [
  {
    id: "EV-101",
    fileName: "GPay_Slip_24999.png",
    fileType: "PNG",
    fileSize: "284 KB",
    sha256Hash: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    uploadedAt: "2026-08-29T09:22:11.000Z",
    mimeType: "image/png",
    evidenceCategory: "UPI_FINANCIAL",
    integrityStatus: "VERIFIED",
    mockBoundingBox: { x: 48, y: 112, width: 260, height: 38 },
    extractedEntities: [
      { type: "UPI", value: "mule88@oksbi", confidence: 0.997, evidenceId: "EV-101", verificationStatus: "VERIFIED", verifiedBy: "NPCI_RESOLVER" },
      { type: "ACCOUNT", value: "XXXX-XXXX-4892", confidence: 0.989, evidenceId: "EV-101", verificationStatus: "VERIFIED", verifiedBy: "SYSTEM_OCR" },
    ],
    authenticity: {
      technique: "IMAGE_ELA",
      status: "GENUINE_UNALTERED",
      confidence: 0.982,
      finding: "Error Level Analysis (ELA): Uniform compression artifact distribution across numerical amount (₹24,999) and recipient fields. Zero pixel splicing or copy-move forgery detected.",
      metricLabel: "JPEG Compression Variance",
      metricValue: "1.4% (Normal < 5.0%)",
    },
  },
  {
    id: "EV-102",
    fileName: "WhatsApp_Chat_Export.txt",
    fileType: "TXT",
    fileSize: "61 KB",
    sha256Hash: "a3f2c819e4d72b06a1c0f5d8e9b3417c28e0f5a1b6c2d9e7f4a8b3c1d0e2f6a9",
    uploadedAt: "2026-08-29T09:25:47.000Z",
    mimeType: "text/plain",
    evidenceCategory: "CHAT",
    integrityStatus: "VERIFIED",
    mockBoundingBox: { x: 20, y: 88, width: 320, height: 24 },
    extractedEntities: [
      { type: "PHONE", value: "+919811122233", confidence: 0.999, evidenceId: "EV-102", verificationStatus: "VERIFIED", verifiedBy: "TRAI_DLT" },
      { type: "TELEGRAM", value: "@task_rewards_official", confidence: 0.981, evidenceId: "EV-102", verificationStatus: "VERIFIED", verifiedBy: "SYSTEM_REGEX" },
      { type: "UPI", value: "mule88@oksbi", confidence: 0.994, evidenceId: "EV-102", verificationStatus: "VERIFIED", verifiedBy: "NPCI_RESOLVER" },
    ],
    authenticity: {
      technique: "EXIF_TIMECODE_AUDIT",
      status: "GENUINE_UNALTERED",
      confidence: 0.994,
      finding: "Text stream boundary delimiters and ISO message timestamps correlate continuously with victim device system clock logs.",
      metricLabel: "Timecode Drift Delta",
      metricValue: "0.08s (Continuous)",
    },
  },
  {
    id: "EV-103",
    fileName: "SBI_SMS_Debit_Alert.txt",
    fileType: "TXT",
    fileSize: "2 KB",
    sha256Hash: "c9d4e8f2a1b7c3d0e5f8a2b6c1d4e9f0a3b7c2d5e8f1a4b9c0d3e6f2a1b5c8d",
    uploadedAt: "2026-08-29T09:31:02.000Z",
    mimeType: "text/plain",
    evidenceCategory: "UPI_FINANCIAL",
    integrityStatus: "VERIFIED",
    mockBoundingBox: { x: 30, y: 60, width: 280, height: 32 },
    extractedEntities: [
      { type: "ACCOUNT", value: "SBI-XXXXXXXX-2401", confidence: 0.991, evidenceId: "EV-103", verificationStatus: "VERIFIED", verifiedBy: "BANK_HEADER" },
      { type: "IFSC", value: "SBIN0002149", confidence: 0.998, evidenceId: "EV-103", verificationStatus: "VERIFIED", verifiedBy: "RBI_DIRECTORY" },
      { type: "UPI", value: "mule88@oksbi", confidence: 0.992, evidenceId: "EV-103", verificationStatus: "VERIFIED", verifiedBy: "NPCI_RESOLVER" },
    ],
    authenticity: {
      technique: "TELECOM_DLT_AUDIT",
      status: "GENUINE_UNALTERED",
      confidence: 0.998,
      finding: "Header 'VK-SBIINB' cryptographically matched to State Bank of India's authorized principal entity identifier on TRAI DLT registry.",
      metricLabel: "TRAI DLT Registry",
      metricValue: "Matched (SBI Official)",
    },
  },
  {
    id: "EV-104",
    fileName: "Call_Recording_Intercept.wav",
    fileType: "WAV",
    fileSize: "1.8 MB",
    sha256Hash: "e1f4a8b2c5d9e3f7a0b4c8d1e5f2a6b0c3d7e1f4a9b3c7d0e4f8a2b6c1d5e9f",
    uploadedAt: "2026-08-29T09:44:18.000Z",
    mimeType: "audio/wav",
    evidenceCategory: "CALL_LOG",
    integrityStatus: "VERIFIED",
    extractedEntities: [
      { type: "PHONE", value: "+919811122233", confidence: 0.999, evidenceId: "EV-104", verificationStatus: "VERIFIED", verifiedBy: "TELECOM_CDR" },
      { type: "PHONE", value: "+918800912244", confidence: 0.985, evidenceId: "EV-104", verificationStatus: "VERIFIED", verifiedBy: "TELECOM_CDR" },
    ],
    authenticity: {
      technique: "AUDIO_SPECTROGRAM",
      status: "SUSPICIOUS_ANOMALY",
      confidence: 0.914,
      finding: "Audio Spectrogram Analysis: High-frequency spectral cutoff detected at 8 kHz; synthetic vocoder phase discontinuities indicate AI voice cloning / pitch-modulation tool.",
      metricLabel: "Deepfake / TTS Probability",
      metricValue: "88.4% (Synthetic Voice Flagged)",
    },
  },
  // ── New Evidence Item 1: Phishing Email ──
  {
    id: "EV-105",
    fileName: "Phishing_Email_PayTM_Reward.eml",
    fileType: "EML",
    fileSize: "34 KB",
    sha256Hash: "f5a7e3d1b8c2a9e0f4d6b7c8a1e2f3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
    uploadedAt: "2026-08-29T10:05:14.000Z",
    mimeType: "message/rfc822",
    evidenceCategory: "PHISHING_EMAIL",
    integrityStatus: "VERIFIED",
    extractedEntities: [
      { type: "EMAIL", value: "rewards@paytm-verify-claim.in", confidence: 0.98, evidenceId: "EV-105", verificationStatus: "VERIFIED", verifiedBy: "RFC822_HEADER" },
      { type: "DOMAIN", value: "verify-job-portal.in", confidence: 0.95, evidenceId: "EV-105", verificationStatus: "VERIFIED", verifiedBy: "DNS_LOOKUP" },
      { type: "IP", value: "198.51.100.42", confidence: 0.92, evidenceId: "EV-105", verificationStatus: "VERIFIED", verifiedBy: "HEADER_RECEIVED_HOPS" },
    ],
    metadata: {
      from: "PayTM Task Rewards <rewards@paytm-verify-claim.in>",
      to: "Priya Nair <priya.nair@gmail.com>",
      subject: "URGENT: Release your pending task commission of ₹49,499",
      date: "Fri, 28 Aug 2026 15:30:22 +0530",
      replyTo: "mule-collection@sec-mail-relay.net",
      phishingIndicators: [
        "From domain 'paytm-verify-claim.in' is not registered by One97 Communications Ltd",
        "Reply-To mismatch pointing to unverified mail relay 'sec-mail-relay.net'",
        "Embedded link points to known scam landing page: http://verify-job-portal.in/claim-fast",
      ],
      linksFound: [
        "http://verify-job-portal.in/claim-fast",
        "http://198.51.100.42/auth/session-init",
      ],
    },
    authenticity: {
      technique: "EMAIL_DKIM_SPF",
      status: "SUSPICIOUS_ANOMALY",
      confidence: 0.995,
      finding: "SPF: SoftFail (domain paytm-verify-claim.in does not designate 198.51.100.42 as permitted sender). DKIM: Absent. DMARC Policy: Reject.",
      metricLabel: "DMARC / SPF Validation",
      metricValue: "Failed (Domain Spoofing Flagged)",
    },
  },
  // ── New Evidence Item 2: Identity Document (Unverified) ──
  {
    id: "EV-106",
    fileName: "Suspect_ID_Card_Scan.jpg",
    fileType: "JPG",
    fileSize: "410 KB",
    sha256Hash: "3b8e7c1d4a0f9e2b5c6d7e8f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
    uploadedAt: "2026-08-29T10:14:50.000Z",
    mimeType: "image/jpeg",
    evidenceCategory: "IDENTITY_DATA",
    integrityStatus: "VERIFIED",
    mockBoundingBox: { x: 40, y: 70, width: 280, height: 50 },
    extractedEntities: [
      { type: "NAME", value: "SUMIT KUMAR", confidence: 0.74, evidenceId: "EV-106", verificationStatus: "UNVERIFIED", verifiedBy: null },
      { type: "ADDRESS", value: "Village Badli, Jhajjar, Haryana 124105", confidence: 0.68, evidenceId: "EV-106", verificationStatus: "UNVERIFIED", verifiedBy: null },
    ],
    metadata: {
      documentType: "Aadhaar / Voter ID (Atypical Template)",
      extractedName: "SUMIT KUMAR",
      verificationNote: "Extracted name has NOT been confirmed with UIDAI/ECI databases. May belong to an unwitting identity theft victim used as a front.",
    },
    authenticity: {
      technique: "OCR_IDENTITY_CROSS_REF",
      status: "SUSPICIOUS_ANOMALY",
      confidence: 0.81,
      finding: "Font layout and microprint patterns diverge from official UIDAI / ECI standards. High probability of fabricated synthetic ID card.",
      metricLabel: "National ID Registry Match",
      metricValue: "Unverified (Potential Identity Front)",
    },
  },
  // ── New Evidence Item 3: Crime Scene / ATM CCTV Photo ──
  {
    id: "EV-107",
    fileName: "Crime_Scene_ATM_Cam_Sector17.jpg",
    fileType: "JPG",
    fileSize: "850 KB",
    sha256Hash: "9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d",
    uploadedAt: "2026-08-29T10:28:40.000Z",
    mimeType: "image/jpeg",
    evidenceCategory: "CRIME_SCENE_PHOTO",
    integrityStatus: "VERIFIED",
    extractedEntities: [
      { type: "GPS_COORD", value: "30.7333,76.7794", confidence: 0.96, evidenceId: "EV-107", verificationStatus: "VERIFIED", verifiedBy: "EXIF_PARSER" },
    ],
    metadata: {
      fileMetadata: {
        resolution: "1920x1080 (1080p CCTV Stills)",
        cameraMake: "HIKVISION DOME IPC-T240H",
        cameraSerial: "DS-2CD2143G0-I-88491",
        timestampRecorded: "2026-08-26 14:19:12 IST",
        gpsCoordinates: "30.7333° N, 76.7794° E (SBI ATM, Sector 17-B Chandigarh)",
      },
      aiObservations: [
        "Unidentified male in dark hooded jacket observed withdrawing cash at ATM terminal 3",
        "Transaction timestamp coincides exactly with second fraudulent payment (₹24,500)",
        "Suspect vehicle (White Swift Dzire) captured in background frame",
      ],
    },
    authenticity: {
      technique: "EXIF_TIMECODE_AUDIT",
      status: "GENUINE_UNALTERED",
      confidence: 0.978,
      finding: "CCTV frame hash signature matches NVR digital watermark. No frame drops or temporal splicing detected.",
      metricLabel: "NVR Watermark Signature",
      metricValue: "Valid & Continuous",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNICATION INTELLIGENCE (Change 2: Multilingual & Transcriptions)
// ─────────────────────────────────────────────────────────────────────────────

export interface TranscriptionSegment {
  timestamp: string;
  speaker: string;
  originalText: string;
  translatedText: string;
}

export interface TranscriptionData {
  evidenceId: string;
  originalLanguage: string;
  targetLanguage: string;
  speakerCount: number;
  confidence: number;
  segments: TranscriptionSegment[];
}

export interface ChatMessage {
  sender: string;
  timestamp: string;
  originalText: string;
  translatedText: string;
  language: string;
}

export interface ChatTranslationData {
  evidenceId: string;
  originalLanguage: string;
  messages: ChatMessage[];
}

export const MOCK_TRANSCRIPTION: TranscriptionData = {
  evidenceId: "EV-104",
  originalLanguage: "Hindi (hi-IN)",
  targetLanguage: "English (en-US)",
  speakerCount: 2,
  confidence: 0.94,
  segments: [
    {
      timestamp: "00:00:12",
      speaker: "Speaker A (Suspect)",
      originalText: "हां जी मैडम, आपका अमेज़न टास्क रिवॉर्ड अकाउंट वेरीफाई हो गया है।",
      translatedText: "Yes ma'am, your Amazon Task Reward account has been verified.",
    },
    {
      timestamp: "00:00:28",
      speaker: "Speaker B (Victim)",
      originalText: "मैंने पहले ही ₹24,999 भेजे हैं, मेरा कमीशन कब आएगा?",
      translatedText: "I already sent ₹24,999, when will my commission arrive?",
    },
    {
      timestamp: "00:00:45",
      speaker: "Speaker A (Suspect)",
      originalText: "सिस्टम में टियर-2 अनलॉक के लिए आपको बाकी ₹24,500 पेटीएम अकाउंट 919876543210 पर ट्रांसफर करने होंगे।",
      translatedText: "For Tier-2 unlock in the system, you need to transfer the remaining ₹24,500 to Paytm account 919876543210.",
    },
    {
      timestamp: "00:01:10",
      speaker: "Speaker B (Victim)",
      originalText: "क्या इसके बाद मुझे पूरा पैसा ₹49,499 वापस मिल जाएगा?",
      translatedText: "Will I get the entire ₹49,499 back after this?",
    },
    {
      timestamp: "00:01:25",
      speaker: "Speaker A (Suspect)",
      originalText: "बिल्कुल, 10 मिनट के अंदर सारा अमाउंट आपके बैंक में क्रेडिट हो जाएगा। आप mule88@oksbi पर भी चेक कर सकते हैं।",
      translatedText: "Absolutely, within 10 minutes the whole amount will be credited to your bank. You can also verify at mule88@oksbi.",
    },
    {
      timestamp: "00:01:50",
      speaker: "Speaker A (Suspect)",
      originalText: "जल्दी कीजिए, यह ऑफर सिर्फ आज दोपहर 3 बजे तक वैध है।",
      translatedText: "Hurry up, this offer is only valid till 3 PM today.",
    },
  ],
};

export const MOCK_CHAT_TRANSLATION: ChatTranslationData = {
  evidenceId: "EV-102",
  originalLanguage: "Hinglish / Hindi (hi-Latn)",
  messages: [
    {
      sender: "+919811122233 (Suspect)",
      timestamp: "2026-08-22T06:14:32Z",
      originalText: "नमस्ते! Amazon Task Reward Programme mein aapka swagat hai. Ghar baithe paise kamayein.",
      translatedText: "Hello! Welcome to the Amazon Task Reward Programme. Earn money while sitting at home.",
      language: "hinglish",
    },
    {
      sender: "Victim (Priya Nair)",
      timestamp: "2026-08-22T06:16:10Z",
      originalText: "Ye kya kaam hai aur kitna payment milega daily?",
      translatedText: "What is this work and how much daily payment will I receive?",
      language: "hinglish",
    },
    {
      sender: "+919811122233 (Suspect)",
      timestamp: "2026-08-22T06:18:45Z",
      originalText: "Aapko daily 5 product review karne honge. Har review ka ₹250-₹500 milega. Pehle demo task complete kijiye @task_rewards_official par.",
      translatedText: "You have to do 5 product reviews daily. You will get ₹250-₹500 per review. First complete demo task on @task_rewards_official.",
      language: "hinglish",
    },
    {
      sender: "+919811122233 (Suspect)",
      timestamp: "2026-08-25T11:30:15Z",
      originalText: "Tier 2 upgrade ke liye ₹24,999 mule88@oksbi par pay kijiye. Commission turant aayega.",
      translatedText: "For Tier 2 upgrade please pay ₹24,999 to mule88@oksbi. Commission will arrive immediately.",
      language: "hinglish",
    },
    {
      sender: "Victim (Priya Nair)",
      timestamp: "2026-08-25T11:42:09Z",
      originalText: "Payment ho gaya hai, UTR 324598124578. Check kijiye.",
      translatedText: "Payment is done, UTR 324598124578. Please check.",
      language: "hinglish",
    },
    {
      sender: "+919811122233 (Suspect)",
      timestamp: "2026-08-26T14:10:00Z",
      originalText: "System error ho gaya hai. Aapko ₹24,500 account 919876543210 IFSC PYTM0123456 me send karna hoga unfreeze ke liye.",
      translatedText: "A system error occurred. You need to send ₹24,500 to account 919876543210 IFSC PYTM0123456 to unfreeze.",
      language: "hinglish",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// CASE CLUSTERS (Change 3: Structured Investigative Workspace)
// ─────────────────────────────────────────────────────────────────────────────

export interface CaseClusterData {
  id: string;
  name: string;
  theme: string;
  status: "ACTIVE" | "ARCHIVED" | "MERGED";
  confidence: "POTENTIAL" | "PROBABLE" | "CONFIRMED";
  notes: string;
  totalFraudAmount: number;
  jurisdictions: string[];
  cases: CaseData[];
  commonEntities: {
    type: EntityType;
    value: string;
    caseCount: number;
    riskScore: number;
  }[];
  relationships: {
    caseA: string;
    caseB: string;
    sharedEntities: { type: EntityType; value: string }[];
    reasons: string[];
    requiresVerification: boolean;
  }[];
}

export const MOCK_CLUSTER: CaseClusterData = {
  id: "cluster-task-scam-01",
  name: "Task Scam Syndicate — Pan-India Mule Network",
  theme: "Task_Scam",
  status: "ACTIVE",
  confidence: "PROBABLE",
  notes: "Cross-jurisdiction ring operating across Chandigarh, Delhi, Bengaluru, Haryana, and Punjab using shared mule account mule88@oksbi and domain verify-job-portal.in.",
  totalFraudAmount: 411199,
  jurisdictions: ["Chandigarh", "Delhi", "Bengaluru", "Haryana", "Punjab", "Rajasthan", "UP"],
  cases: [
    ACTIVE_CASE,
    {
      id: "case-2026-1021",
      caseNumber: "CASE-2026-1021",
      incidentType: "Task_Scam",
      status: "UNDER_INQUIRY",
      createdAt: "2026-07-14T11:22:00.000Z",
      jurisdiction: "Cyber Cell — Rohini District, Delhi",
      officerInCharge: "SI Anjali Kapoor (Badge #CCB-0912)",
      victimName: "Rahul Verma",
      amountDefrauded: 72000,
    },
    {
      id: "case-2026-1078",
      caseNumber: "CASE-2026-1078",
      incidentType: "Task_Scam",
      status: "CHARGESHEETED",
      createdAt: "2026-06-28T08:10:00.000Z",
      jurisdiction: "Cyber Crime Division — Bengaluru City",
      officerInCharge: "DSP Mohan Lal Saini (Badge #HRY-0448)",
      victimName: "Ananya Krishnamurthy",
      amountDefrauded: 58500,
    },
    {
      id: "case-2026-1134",
      caseNumber: "CASE-2026-1134",
      incidentType: "Investment_Fraud",
      status: "OPEN",
      createdAt: "2026-05-19T14:45:00.000Z",
      jurisdiction: "Cyber Crime Haryana — Gurugram Unit",
      officerInCharge: "SI Gurpreet Singh (Badge #PB-1221)",
      victimName: "Harpreet Kaur",
      amountDefrauded: 165000,
    },
    {
      id: "case-2026-1150",
      caseNumber: "CASE-2026-1150",
      incidentType: "Task_Scam",
      status: "OPEN",
      createdAt: "2026-04-07T07:33:00.000Z",
      jurisdiction: "Cyber Cell — Amritsar, Punjab",
      officerInCharge: "SI Deepika Sharma (Badge #RJ-0774)",
      victimName: "Gurjeet Singh",
      amountDefrauded: 46200,
    },
  ],
  commonEntities: [
    { type: "UPI", value: "mule88@oksbi", caseCount: 5, riskScore: 98 },
    { type: "PHONE", value: "+919876543210", caseCount: 4, riskScore: 94 },
    { type: "DOMAIN", value: "verify-job-portal.in", caseCount: 3, riskScore: 88 },
    { type: "IFSC", value: "PYTM0123456", caseCount: 2, riskScore: 82 },
    { type: "ACCOUNT", value: "919876543210", caseCount: 2, riskScore: 85 },
  ],
  relationships: [
    {
      caseA: "CASE-2026-0891 (Chandigarh)",
      caseB: "CASE-2026-1021 (Delhi)",
      sharedEntities: [
        { type: "UPI", value: "mule88@oksbi" },
        { type: "PHONE", value: "+919876543210" },
      ],
      reasons: [
        "Exact matching primary mule VPA 'mule88@oksbi' received direct victim funds in both FIRs",
        "Initial contact WhatsApp originated from identical suspect mobile identifier",
      ],
      requiresVerification: true,
    },
    {
      caseA: "CASE-2026-0891 (Chandigarh)",
      caseB: "CASE-2026-1078 (Bengaluru)",
      sharedEntities: [
        { type: "UPI", value: "mule88@oksbi" },
        { type: "DOMAIN", value: "verify-job-portal.in" },
      ],
      reasons: [
        "Identical phishing landing page 'verify-job-portal.in' used to induce Tier-2 fake tasks",
        "Layer-2 payout routing matched to State Bank mule node",
      ],
      requiresVerification: true,
    },
    {
      caseA: "CASE-2026-0891 (Chandigarh)",
      caseB: "CASE-2026-1134 (Haryana)",
      sharedEntities: [
        { type: "ACCOUNT", value: "919876543210" },
        { type: "IFSC", value: "PYTM0123456" },
      ],
      reasons: [
        "Second-layer debit/credit account 919876543210 at Paytm Payments Bank shared between both jurisdictions",
      ],
      requiresVerification: true,
    },
  ],
};

export interface ComparisonRow {
  category: string;
  field: string;
  caseValues: Record<string, string>;
}

export const MOCK_CLUSTER_COMPARISON: ComparisonRow[] = [
  {
    category: "MO & Pattern",
    field: "Incident Type",
    caseValues: {
      "CASE-2026-0891": "Task Scam (Amazon Review)",
      "CASE-2026-1021": "Task Scam (YouTube Like)",
      "CASE-2026-1078": "Task Scam (Hotel Rating)",
      "CASE-2026-1134": "Investment / Task Fraud",
      "CASE-2026-1150": "Task Scam (App Testing)",
    },
  },
  {
    category: "Financials",
    field: "Amount Defrauded",
    caseValues: {
      "CASE-2026-0891": "₹49,499",
      "CASE-2026-1021": "₹72,000",
      "CASE-2026-1078": "₹58,500",
      "CASE-2026-1134": "₹1,65,000",
      "CASE-2026-1150": "₹46,200",
    },
  },
  {
    category: "Mule Infrastructure",
    field: "Shared UPI Handle",
    caseValues: {
      "CASE-2026-0891": "mule88@oksbi [MATCH]",
      "CASE-2026-1021": "mule88@oksbi [MATCH]",
      "CASE-2026-1078": "mule88@oksbi [MATCH]",
      "CASE-2026-1134": "—",
      "CASE-2026-1150": "—",
    },
  },
  {
    category: "Communication",
    field: "Suspect Mobile",
    caseValues: {
      "CASE-2026-0891": "+919876543210 [MATCH]",
      "CASE-2026-1021": "+919876543210 [MATCH]",
      "CASE-2026-1078": "+918800912244",
      "CASE-2026-1134": "+919876543210 [MATCH]",
      "CASE-2026-1150": "+917012345678",
    },
  },
  {
    category: "Phishing Assets",
    field: "Deceptive Domain",
    caseValues: {
      "CASE-2026-0891": "verify-job-portal.in [MATCH]",
      "CASE-2026-1021": "—",
      "CASE-2026-1078": "verify-job-portal.in [MATCH]",
      "CASE-2026-1134": "—",
      "CASE-2026-1150": "verify-job-portal.in [MATCH]",
    },
  },
  {
    category: "Banking",
    field: "Payout Account & IFSC",
    caseValues: {
      "CASE-2026-0891": "919876543210 / PYTM0123456",
      "CASE-2026-1021": "SBI-XXXXXXXX-2401",
      "CASE-2026-1078": "ICIC0001890",
      "CASE-2026-1134": "919876543210 / PYTM0123456 [MATCH]",
      "CASE-2026-1150": "HDFC0000451",
    },
  },
  {
    category: "Jurisdiction",
    field: "Investigating Unit",
    caseValues: {
      "CASE-2026-0891": "Cyber Crime Branch — Chandigarh",
      "CASE-2026-1021": "Cyber Cell — Rohini, Delhi",
      "CASE-2026-1078": "Cyber Crime Division — Bengaluru",
      "CASE-2026-1134": "Cyber Crime — Gurugram, HR",
      "CASE-2026-1150": "Cyber Cell — Amritsar, PB",
    },
  },
];

export interface ClusterTimelineEvent {
  id: string;
  caseNumber: string;
  caseColor: string;
  timestamp: string;
  timestampIST: string;
  sourceType: SourceType;
  narrative: string;
  phase: "CONTACT" | "TRUST" | "PAYMENT" | "SEVERED";
}

export const MOCK_CLUSTER_TIMELINE: ClusterTimelineEvent[] = [
  {
    id: "cl-evt-01",
    caseNumber: "CASE-2026-1150 (Amritsar)",
    caseColor: "#ec4899",
    timestamp: "2026-04-07T07:33:00.000Z",
    timestampIST: "07 Apr 2026 — 13:03 IST",
    sourceType: "WHATSAPP",
    narrative: "Victim lured through job advert linked to verify-job-portal.in",
    phase: "CONTACT",
  },
  {
    id: "cl-evt-02",
    caseNumber: "CASE-2026-1134 (Gurugram)",
    caseColor: "#f59e0b",
    timestamp: "2026-05-19T14:45:00.000Z",
    timestampIST: "19 May 2026 — 20:15 IST",
    sourceType: "BANK_SMS",
    narrative: "Victim transferred ₹1,65,000 to Paytm account 919876543210 (IFSC PYTM0123456)",
    phase: "PAYMENT",
  },
  {
    id: "cl-evt-03",
    caseNumber: "CASE-2026-1078 (Bengaluru)",
    caseColor: "#8b5cf6",
    timestamp: "2026-06-15T06:00:00.000Z",
    timestampIST: "15 Jun 2026 — 11:30 IST",
    sourceType: "WHATSAPP",
    narrative: "Suspect initiated contact offering rating tasks via verify-job-portal.in",
    phase: "CONTACT",
  },
  {
    id: "cl-evt-04",
    caseNumber: "CASE-2026-1078 (Bengaluru)",
    caseColor: "#8b5cf6",
    timestamp: "2026-06-22T11:15:00.000Z",
    timestampIST: "22 Jun 2026 — 16:45 IST",
    sourceType: "BANK_SMS",
    narrative: "Victim transferred ₹58,500 to mule88@oksbi",
    phase: "PAYMENT",
  },
  {
    id: "cl-evt-05",
    caseNumber: "CASE-2026-1021 (Delhi)",
    caseColor: "#10b981",
    timestamp: "2026-07-01T07:30:00.000Z",
    timestampIST: "01 Jul 2026 — 13:00 IST",
    sourceType: "WHATSAPP",
    narrative: "Suspect (+919876543210) initiated task scam offer",
    phase: "CONTACT",
  },
  {
    id: "cl-evt-06",
    caseNumber: "CASE-2026-1021 (Delhi)",
    caseColor: "#10b981",
    timestamp: "2026-07-10T14:32:00.000Z",
    timestampIST: "10 Jul 2026 — 20:02 IST",
    sourceType: "BANK_SMS",
    narrative: "Victim transferred ₹72,000 to mule88@oksbi",
    phase: "PAYMENT",
  },
  {
    id: "cl-evt-07",
    caseNumber: "CASE-2026-0891 (Chandigarh)",
    caseColor: "#3b82f6",
    timestamp: "2026-08-22T06:14:32.000Z",
    timestampIST: "22 Aug 2026 — 11:44 IST",
    sourceType: "WHATSAPP",
    narrative: "First contact via WhatsApp (+919876543210 / +919811122233)",
    phase: "CONTACT",
  },
  {
    id: "cl-evt-08",
    caseNumber: "CASE-2026-0891 (Chandigarh)",
    caseColor: "#3b82f6",
    timestamp: "2026-08-25T11:42:09.000Z",
    timestampIST: "25 Aug 2026 — 17:12 IST",
    sourceType: "BANK_SMS",
    narrative: "Primary payment of ₹24,999 to mule88@oksbi",
    phase: "PAYMENT",
  },
  {
    id: "cl-evt-09",
    caseNumber: "CASE-2026-0891 (Chandigarh)",
    caseColor: "#3b82f6",
    timestamp: "2026-08-26T14:18:55.000Z",
    timestampIST: "26 Aug 2026 — 19:48 IST",
    sourceType: "BANK_SMS",
    narrative: "Secondary payment of ₹24,500 to account 919876543210 (PYTM0123456)",
    phase: "PAYMENT",
  },
  {
    id: "cl-evt-10",
    caseNumber: "CASE-2026-0891 (Chandigarh)",
    caseColor: "#3b82f6",
    timestamp: "2026-08-28T16:02:11.000Z",
    timestampIST: "28 Aug 2026 — 21:32 IST",
    sourceType: "WHATSAPP",
    narrative: "Communication severed by suspect. Account blocked.",
    phase: "SEVERED",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE EVENTS FOR ACTIVE CASE
// ─────────────────────────────────────────────────────────────────────────────
export const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: "EVT-001",
    timestamp: "2026-08-22T06:14:32.000Z",
    timestampIST: "22 Aug 2026 — 11:44:32 IST",
    sourceType: "WHATSAPP",
    narrative: "First contact initiated by suspect via WhatsApp. Account presented as 'Amazon Task Reward Programme — Official.' Victim was promised ₹500–₹2,000 per completed review task.",
    evidenceId: "EV-102",
    severity: "MEDIUM",
    extractedEntities: [
      { type: "PHONE", value: "+919811122233", confidence: 0.999, evidenceId: "EV-102" },
      { type: "TELEGRAM", value: "@task_rewards_official", confidence: 0.981, evidenceId: "EV-102" },
    ],
  },
  {
    id: "EVT-002",
    timestamp: "2026-08-23T09:05:17.000Z",
    timestampIST: "23 Aug 2026 — 14:35:17 IST",
    sourceType: "WHATSAPP",
    narrative: "Victim directed to Telegram channel '@task_rewards_official'. First task completed (₹250 commission received). Trust-building phase — Layer 1 of the MO confirmed.",
    evidenceId: "EV-102",
    severity: "LOW",
    extractedEntities: [
      { type: "TELEGRAM", value: "@task_rewards_official", confidence: 0.988, evidenceId: "EV-102" },
      { type: "UPI", value: "mule88@oksbi", confidence: 0.994, evidenceId: "EV-102" },
    ],
  },
  {
    id: "EVT-003",
    timestamp: "2026-08-25T11:32:08.000Z",
    timestampIST: "25 Aug 2026 — 17:02:08 IST",
    sourceType: "BANK_SMS",
    narrative: "Victim transferred ₹24,999 via UPI to 'mule88@oksbi'. Suspect claimed payment was required to 'unlock combo task rewards' worth ₹1,24,000.",
    evidenceId: "EV-103",
    severity: "CRITICAL",
    extractedEntities: [
      { type: "UPI", value: "mule88@oksbi", confidence: 0.997, evidenceId: "EV-103" },
      { type: "IFSC", value: "SBIN0002149", confidence: 0.998, evidenceId: "EV-103" },
      { type: "ACCOUNT", value: "SBI-XXXXXXXX-2401", confidence: 0.991, evidenceId: "EV-103" },
    ],
  },
  {
    id: "EVT-004",
    timestamp: "2026-08-26T14:18:54.000Z",
    timestampIST: "26 Aug 2026 — 19:48:54 IST",
    sourceType: "RECEIPT",
    narrative: "Second payment of ₹24,500 made via Google Pay. Suspect sent a fabricated 'Account Credit' screenshot showing fictitious balance of ₹1,74,499 in the 'task wallet'.",
    evidenceId: "EV-101",
    severity: "CRITICAL",
    extractedEntities: [
      { type: "UPI", value: "mule88@oksbi", confidence: 0.997, evidenceId: "EV-101" },
      { type: "ACCOUNT", value: "XXXX-XXXX-4892", confidence: 0.989, evidenceId: "EV-101" },
    ],
  },
  {
    id: "EVT-005",
    timestamp: "2026-08-27T08:44:21.000Z",
    timestampIST: "27 Aug 2026 — 14:14:21 IST",
    sourceType: "CALL_LOG",
    narrative: "Victim called +919811122233 to demand withdrawal. Call duration: 3m 12s. Suspect claimed withdrawal blocked due to 'KYC verification fee' of ₹5,000.",
    evidenceId: "EV-104",
    severity: "HIGH",
    extractedEntities: [
      { type: "PHONE", value: "+919811122233", confidence: 0.998, evidenceId: "EV-104" },
      { type: "PHONE", value: "+918800912244", confidence: 0.972, evidenceId: "EV-104" },
    ],
  },
  {
    id: "EVT-006",
    timestamp: "2026-08-28T16:02:33.000Z",
    timestampIST: "28 Aug 2026 — 21:32:33 IST",
    sourceType: "WHATSAPP",
    narrative: "Suspect account goes silent. Telegram channel '@task_rewards_official' becomes invite-only. Victim realizes fraud. Last seen timestamp recorded.",
    evidenceId: "EV-102",
    severity: "HIGH",
    extractedEntities: [
      { type: "TELEGRAM", value: "@task_rewards_official", confidence: 0.988, evidenceId: "EV-102" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEEDED CASES (Cross-Case Intelligence)
// ─────────────────────────────────────────────────────────────────────────────
export const SEEDED_CASES: CaseData[] = [
  {
    id: "case-2026-0741",
    caseNumber: "CASE-2026-0741",
    incidentType: "Task_Scam",
    status: "UNDER_INQUIRY",
    createdAt: "2026-07-14T11:22:00.000Z",
    jurisdiction: "Cyber Cell — Rohini District, Delhi",
    officerInCharge: "SI Anjali Kapoor (Badge #CCB-0912)",
    victimName: "Rahul Verma",
    amountDefrauded: 72000,
  },
  {
    id: "case-2026-0655",
    caseNumber: "CASE-2026-0655",
    incidentType: "Task_Scam",
    status: "CHARGESHEETED",
    createdAt: "2026-06-28T08:10:00.000Z",
    jurisdiction: "Cyber Crime Haryana — Gurugram Unit",
    officerInCharge: "DSP Mohan Lal Saini (Badge #HRY-0448)",
    victimName: "Sunita Devi",
    amountDefrauded: 58500,
  },
  {
    id: "case-2026-0488",
    caseNumber: "CASE-2026-0488",
    incidentType: "Investment_Fraud",
    status: "OPEN",
    createdAt: "2026-05-19T14:45:00.000Z",
    jurisdiction: "Cyber Cell — Ludhiana, Punjab",
    officerInCharge: "SI Gurpreet Singh (Badge #PB-1221)",
    victimName: "Arjun Mehta",
    amountDefrauded: 165000,
  },
  {
    id: "case-2026-0312",
    caseNumber: "CASE-2026-0312",
    incidentType: "Task_Scam",
    status: "UNDER_INQUIRY",
    createdAt: "2026-04-07T07:33:00.000Z",
    jurisdiction: "Cyber Crime Branch — Jaipur, Rajasthan",
    officerInCharge: "SI Deepika Sharma (Badge #RJ-0774)",
    victimName: "Meena Agarwal",
    amountDefrauded: 85000,
  },
  {
    id: "case-2026-0201",
    caseNumber: "CASE-2026-0201",
    incidentType: "Task_Scam",
    status: "CLOSED",
    createdAt: "2026-03-02T10:15:00.000Z",
    jurisdiction: "Cyber Cell — Noida, UP",
    officerInCharge: "SI Vikas Yadav (Badge #UP-0339)",
    victimName: "Pooja Gupta",
    amountDefrauded: 26999,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// GRAPH NODES & EDGES
// ─────────────────────────────────────────────────────────────────────────────
export const GRAPH_NODES: GraphNode[] = [
  // Current case
  {
    id: "case-2026-0891",
    type: "case",
    data: {
      label: "CASE-2026-0891",
      incidentType: "Task Scam",
      riskLevel: "HIGH",
    },
    position: { x: 400, y: 220 },
  },
  // Seeded cases
  {
    id: "case-2026-0741",
    type: "case",
    data: { label: "CASE-2026-0741", incidentType: "Task Scam", riskLevel: "HIGH" },
    position: { x: 120, y: 80 },
  },
  {
    id: "case-2026-0655",
    type: "case",
    data: { label: "CASE-2026-0655", incidentType: "Task Scam", riskLevel: "MEDIUM" },
    position: { x: 680, y: 80 },
  },
  {
    id: "case-2026-0488",
    type: "case",
    data: { label: "CASE-2026-0488", incidentType: "Investment Fraud", riskLevel: "HIGH" },
    position: { x: 100, y: 380 },
  },
  {
    id: "case-2026-0312",
    type: "case",
    data: { label: "CASE-2026-0312", incidentType: "Task Scam", riskLevel: "HIGH" },
    position: { x: 700, y: 380 },
  },
  {
    id: "case-2026-0201",
    type: "case",
    data: { label: "CASE-2026-0201", incidentType: "Task Scam", riskLevel: "LOW" },
    position: { x: 400, y: 440 },
  },
  // Shared high-risk entity nodes
  {
    id: "entity-upi-mule88",
    type: "entity",
    data: {
      label: "UPI: mule88@oksbi",
      entityType: "UPI",
      value: "mule88@oksbi",
      caseCount: 6,
      riskLevel: "HIGH",
      amountLinked: 342000,
      jurisdictions: ["Delhi", "Haryana", "Punjab", "Rajasthan", "UP", "Chandigarh"],
    },
    position: { x: 400, y: 100 },
  },
  {
    id: "entity-phone-9811",
    type: "entity",
    data: {
      label: "PH: +91-98111-22233",
      entityType: "PHONE",
      value: "+919811122233",
      caseCount: 4,
      riskLevel: "HIGH",
      amountLinked: 242499,
      jurisdictions: ["Delhi", "Haryana", "Chandigarh", "UP"],
    },
    position: { x: 240, y: 260 },
  },
  {
    id: "entity-tg-task",
    type: "entity",
    data: {
      label: "TG: @task_rewards_official",
      entityType: "TELEGRAM",
      value: "@task_rewards_official",
      caseCount: 3,
      riskLevel: "HIGH",
      amountLinked: 156999,
      jurisdictions: ["Delhi", "Haryana", "Chandigarh"],
    },
    position: { x: 570, y: 260 },
  },
  {
    id: "entity-ifsc-sbin",
    type: "entity",
    data: {
      label: "IFSC: SBIN0002149",
      entityType: "IFSC",
      value: "SBIN0002149",
      caseCount: 2,
      riskLevel: "MEDIUM",
      amountLinked: 107499,
      jurisdictions: ["Chandigarh", "Punjab"],
    },
    position: { x: 580, y: 420 },
  },
];

export const GRAPH_EDGES: GraphEdge[] = [
  // UPI mule88 connects all cases
  { id: "e-c891-upi", source: "case-2026-0891", target: "entity-upi-mule88", animated: true },
  { id: "e-c741-upi", source: "case-2026-0741", target: "entity-upi-mule88", animated: true },
  { id: "e-c655-upi", source: "case-2026-0655", target: "entity-upi-mule88", animated: true },
  { id: "e-c488-upi", source: "case-2026-0488", target: "entity-upi-mule88", animated: true },
  { id: "e-c312-upi", source: "case-2026-0312", target: "entity-upi-mule88", animated: true },
  { id: "e-c201-upi", source: "case-2026-0201", target: "entity-upi-mule88", animated: true },
  // Phone connects 4 cases
  { id: "e-c891-ph", source: "case-2026-0891", target: "entity-phone-9811" },
  { id: "e-c741-ph", source: "case-2026-0741", target: "entity-phone-9811" },
  { id: "e-c655-ph", source: "case-2026-0655", target: "entity-phone-9811" },
  { id: "e-c201-ph", source: "case-2026-0201", target: "entity-phone-9811" },
  // Telegram connects 3 cases
  { id: "e-c891-tg", source: "case-2026-0891", target: "entity-tg-task" },
  { id: "e-c741-tg", source: "case-2026-0741", target: "entity-tg-task" },
  { id: "e-c655-tg", source: "case-2026-0655", target: "entity-tg-task" },
  // IFSC connects 2 cases
  { id: "e-c891-ifsc", source: "case-2026-0891", target: "entity-ifsc-sbin" },
  { id: "e-c312-ifsc", source: "case-2026-0312", target: "entity-ifsc-sbin" },
];

// ─────────────────────────────────────────────────────────────────────────────
// STATUTORY SECTIONS
// ─────────────────────────────────────────────────────────────────────────────
export const STATUTORY_SECTIONS: StatutorySection[] = [
  {
    code: "§ 318(4)",
    act: "Bharatiya Nyaya Sanhita, 2023",
    description: "Cheating by personation — impersonating a legitimate business entity to deceive victim into financial transfer.",
    severity: "COGNIZABLE",
    bailable: false,
  },
  {
    code: "§ 319(2)",
    act: "Bharatiya Nyaya Sanhita, 2023",
    description: "Cheating with intent to induce delivery of property exceeding ₹1 lakh. Attracts imprisonment up to 7 years.",
    severity: "COGNIZABLE",
    bailable: false,
  },
  {
    code: "§ 66D",
    act: "Information Technology Act, 2000",
    description: "Cheating by personation using communication devices. Specific provision for online identity fraud.",
    severity: "COGNIZABLE",
    bailable: false,
  },
  {
    code: "§ 66C",
    act: "Information Technology Act, 2000",
    description: "Identity theft — fraudulent use of electronic signature / password / unique identification.",
    severity: "COGNIZABLE",
    bailable: false,
  },
  {
    code: "§ 43",
    act: "Information Technology Act, 2000",
    description: "Unauthorized access to computer system and data extraction. Civil liability for damages.",
    severity: "NON_COGNIZABLE",
    bailable: true,
  },
  {
    code: "§ 111",
    act: "Bharatiya Nyaya Sanhita, 2023",
    description: "Organised crime — accused operated as part of a syndicate conducting financial crimes across jurisdictions.",
    severity: "COGNIZABLE",
    bailable: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE CHECKLIST
// ─────────────────────────────────────────────────────────────────────────────
export const EVIDENCE_CHECKLIST: EvidenceChecklistItem[] = [
  {
    id: "chk-001",
    label: "Bank UTR / Transaction Reference Confirmed",
    status: "CONFIRMED",
    evidenceId: "EV-103",
    note: "UTR: 262800412149 confirmed via SBI SMS alert EV-103.",
  },
  {
    id: "chk-002",
    label: "UPI VPA Linked to NPCI-Verified Beneficiary",
    status: "CONFIRMED",
    evidenceId: "EV-101",
    note: "mule88@oksbi resolved to SBI account XXXX-4892.",
  },
  {
    id: "chk-003",
    label: "WhatsApp Chat Export with Message Timestamps",
    status: "CONFIRMED",
    evidenceId: "EV-102",
    note: "Export validated. SHA-256 integrity intact.",
  },
  {
    id: "chk-004",
    label: "Phishing Email Headers & Mail Server IP Preserved",
    status: "CONFIRMED",
    evidenceId: "EV-105",
    note: "RFC822 headers preserved. Spoofed sender & relay IP 198.51.100.42 logged.",
  },
  {
    id: "chk-005",
    label: "Audio Intercept AI Voice Analysis & Transcript",
    status: "CONFIRMED",
    evidenceId: "EV-104",
    note: "Multilingual Hindi transcript aligned. 88.4% voice cloning anomaly logged.",
  },
  {
    id: "chk-006",
    label: "Suspect Identity Document UIDAI / ECI Cross-Verification",
    status: "PENDING",
    evidenceId: "EV-106",
    note: "Marked UNVERIFIED. Formal Section 91 CrPC notice pending with UIDAI.",
  },
  {
    id: "chk-007",
    label: "ATM CCTV Surveillance Stills & GPS Geolocation",
    status: "CONFIRMED",
    evidenceId: "EV-107",
    note: "Sector 17-B ATM footage matched to 14:19:12 IST withdrawal timestamp.",
  },
  {
    id: "chk-008",
    label: "FIR Prepared and Reviewed by Legal Cell",
    status: "CONFIRMED",
    note: "IO signed. BSA §63 certificate and cluster dossier generated.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// QUICK METRICS
// ─────────────────────────────────────────────────────────────────────────────
export const CASE_METRICS = {
  evidenceItems: EVIDENCE_ITEMS.length,
  evidenceCategories: Array.from(new Set(EVIDENCE_ITEMS.map((e) => e.evidenceCategory))).length,
  extractedEntities: 48,
  caseClusters: 1,
  syndicateMatches: 5,
  timelineEvents: TIMELINE_EVENTS.length,
  totalAmountDefrauded: ACTIVE_CASE.amountDefrauded,
  totalClusterFraud: MOCK_CLUSTER.totalFraudAmount,
  linkedCases: SEEDED_CASES.length,
  checklistCompletion: Math.round(
    (EVIDENCE_CHECKLIST.filter((i) => i.status === "CONFIRMED").length /
      EVIDENCE_CHECKLIST.length) *
      100
  ),
};
