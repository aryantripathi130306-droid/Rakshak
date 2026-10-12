// ─────────────────────────────────────────────────────────────────────────────
// services/translationService.ts
// Multilingual Communication Intelligence & Transcription Service
// Preserves immutable original transcript and original message text at all times.
// ─────────────────────────────────────────────────────────────────────────────
import type { TranscriptionData, ChatTranslationData } from "@/lib/mock-data";

export interface LanguageOption {
  code: string;
  label: string;
  script: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "hi", label: "Hindi (हिंदी)", script: "Devanagari" },
  { code: "hinglish", label: "Hinglish (Hindi-Latin)", script: "Latin" },
  { code: "pa", label: "Punjabi (ਪੰਜਾਬੀ)", script: "Gurmukhi" },
  { code: "bn", label: "Bengali (বাংলা)", script: "Bengali" },
  { code: "ta", label: "Tamil (தமிழ்)", script: "Tamil" },
  { code: "te", label: "Telugu (తెలుగు)", script: "Telugu" },
  { code: "mr", label: "Marathi (मराठी)", script: "Devanagari" },
  { code: "ur", label: "Urdu (اردو)", script: "Arabic-Persian" },
  { code: "en", label: "English (Canonical)", script: "Latin" },
];

/**
 * Detect script / language family based on Unicode ranges.
 */
export function detectLanguage(text: string): string {
  if (!text) return "en";
  // Devanagari range \u0900-\u097F
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  // Gurmukhi range \u0A00-\u0A7F
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa";
  // Bengali range \u0980-\u09FF
  if (/[\u0980-\u09FF]/.test(text)) return "bn";
  // Tamil range \u0B80-\u0BFF
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  // Telugu range \u0C00-\u0C7F
  if (/[\u0C00-\u0C7F]/.test(text)) return "te";
  // Arabic / Urdu range \u0600-\u06FF
  if (/[\u0600-\u06FF]/.test(text)) return "ur";
  // Common Hinglish romanized keywords
  if (/\b(aapko|mein|hain|karna|hoga|kijiye|paise|bheje|namaste|hai)\b/i.test(text)) {
    return "hinglish";
  }
  return "en";
}

/**
 * Return available languages list
 */
export function getAvailableLanguages(): LanguageOption[] {
  return SUPPORTED_LANGUAGES;
}

/**
 * Retrieve transcription data for audio evidence item.
 */
export async function getEvidenceTranscription(evidenceId: string): Promise<TranscriptionData | null> {
  return null;
}

/**
 * Retrieve chat translation data for message exports.
 */
export async function getEvidenceChatTranslation(evidenceId: string): Promise<ChatTranslationData | null> {
  return null;
}
