/**
 * Frontend API client for Sarvam AI edge function.
 * All calls go through the sarvam-ai edge function — never directly to Sarvam.
 */
import { supabase } from '@/integrations/supabase/client';

// ── Types ──

export interface SarvamChatRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: 'sarvam-30b' | 'sarvam-30b-16k' | 'sarvam-105b' | 'sarvam-105b-32k';
  temperature?: number;
  max_tokens?: number;
}

export interface SarvamTranslateRequest {
  input: string;
  source_language_code?: string;
  target_language_code: string;
  model?: 'mayura:v1' | 'sarvam-translate:v1';
  speaker_gender?: 'Male' | 'Female';
  mode?: 'formal' | 'modern-colloquial' | 'classic-colloquial' | 'code-mixed';
}

export interface SarvamTtsRequest {
  text: string;
  target_language_code?: string;
  model?: 'bulbul:v2' | 'bulbul:v3';
  speaker?: string;
  pace?: number;
  temperature?: number;
}

export interface SarvamSttRequest {
  file: File;
  model?: 'saaras:v3' | 'saarika:v2.5';
  language?: string;
  mode?: 'transcribe' | 'translate' | 'verbatim' | 'translit' | 'codemix';
}

export interface SarvamResponse<T = unknown> {
  success: boolean;
  capability?: string;
  data?: T;
  error?: string;
  details?: unknown;
}

// ── Helpers ──

async function invokeSarvam<T>(body: Record<string, unknown>): Promise<SarvamResponse<T>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated — please log in');

  const { data, error } = await supabase.functions.invoke('sarvam-ai', { body });
  if (error) {
    return { success: false, error: error.message };
  }
  return data as SarvamResponse<T>;
}

async function invokeSarvamMultipart<T>(formData: FormData): Promise<SarvamResponse<T>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated — please log in');

  // For multipart, we use fetch directly since supabase.functions.invoke doesn't support FormData well
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/functions/v1/sarvam-ai`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: data.error || 'Request failed' };
  }
  return data as SarvamResponse<T>;
}

// ── Chat ──

export async function sarvamChat(request: SarvamChatRequest) {
  return invokeSarvam<{
    choices: Array<{ message: { role: string; content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }>({
    action: 'chat',
    ...request,
  });
}

// ── Translation ──

export async function sarvamTranslate(request: SarvamTranslateRequest) {
  return invokeSarvam<{
    translated_text: string;
    source_language_code: string;
    request_id?: string;
  }>({
    action: 'translate',
    ...request,
  });
}

// ── Text to Speech ──

export async function sarvamTts(request: SarvamTtsRequest) {
  return invokeSarvam<{
    audios: string[]; // base64-encoded WAV
    request_id?: string;
  }>({
    action: 'tts',
    ...request,
  });
}

// ── Speech to Text ──

export async function sarvamStt(request: SarvamSttRequest) {
  const formData = new FormData();
  formData.append('action', 'stt');
  formData.append('file', request.file);
  if (request.model) formData.append('model', request.model);
  if (request.language) formData.append('language', request.language);
  if (request.mode) formData.append('mode', request.mode || 'transcribe');

  return invokeSarvamMultipart<{
    transcript?: string;
    language_code?: string;
    request_id?: string;
  }>(formData);
}

// ── Detect Language ──

export async function sarvamDetectLanguage(input: string) {
  return invokeSarvam<{
    language_code: string;
    script_code?: string;
    confidence?: number;
  }>({
    action: 'detect-language',
    input,
  });
}

// ── Transliterate ──

export async function sarvamTransliterate(
  input: string,
  source_language_code: string,
  target_language_code: string,
) {
  return invokeSarvam<{
    transliterated_text: string;
    request_id?: string;
  }>({
    action: 'transliterate',
    input,
    source_language_code,
    target_language_code,
  });
}

// ── Sarvam language codes reference ──

export const SARVAM_LANGUAGES = [
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'bn-IN', label: 'Bengali' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'pa-IN', label: 'Punjabi' },
  { code: 'od-IN', label: 'Odia' },
  { code: 'en-IN', label: 'English' },
  { code: 'ur-IN', label: 'Urdu' },
  { code: 'as-IN', label: 'Assamese' },
  { code: 'ne-IN', label: 'Nepali' },
  { code: 'kok-IN', label: 'Konkani' },
  { code: 'ks-IN', label: 'Kashmiri' },
  { code: 'sd-IN', label: 'Sindhi' },
  { code: 'sa-IN', label: 'Sanskrit' },
  { code: 'sat-IN', label: 'Santali' },
  { code: 'mni-IN', label: 'Manipuri' },
  { code: 'brx-IN', label: 'Bodo' },
  { code: 'mai-IN', label: 'Maithili' },
  { code: 'doi-IN', label: 'Dogri' },
] as const;

export const SARVAM_TTS_SPEAKERS = [
  'Shubh', 'Aditya', 'Ritu', 'Priya', 'Neha', 'Rahul', 'Pooja', 'Rohan',
  'Simran', 'Kavya', 'Amit', 'Dev', 'Ishita', 'Shreya', 'Ratan', 'Varun',
  'Manan', 'Sumit', 'Roopa', 'Kabir', 'Aayan', 'Ashutosh', 'Advait',
  'Amelia', 'Sophia', 'Anand', 'Tanya', 'Tarun', 'Sunny', 'Mani',
  'Gokul', 'Vijay', 'Shruti', 'Suhani', 'Mohit', 'Kavitha', 'Rehan',
  'Soham', 'Rupali',
] as const;
