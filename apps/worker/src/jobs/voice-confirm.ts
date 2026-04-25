/**
 * Voice confirmation job handler.
 * Triggered when a new order is created; auto-places a confirmation call.
 * Supports retry with exponential back-off (BullMQ built-in).
 *
 * Job data shape:
 *   { orderId: string; language?: string; provider?: string; attempt?: number }
 */
import type { Job } from 'bullmq';
import {
  twilioVoiceAdapter,
  type VoiceAdapter,
  type PlaceCallResult,
} from '@cashflow-cod/messaging';

/* ------------------------------------------------------------------ */
/* Lazy-loaded adapters — the real objects live in @cashflow-cod/messaging.
 * We import the lightweight Twilio adapter directly; ElevenLabs,
 * Retell and OpenAI adapters are loaded dynamically so the worker
 * doesn't explode if their optional deps are missing.                */
/* ------------------------------------------------------------------ */
const adapterCache = new Map<string, VoiceAdapter>();

function getAdapter(provider: string): VoiceAdapter | undefined {
  if (adapterCache.has(provider)) return adapterCache.get(provider);

  if (provider === 'twilio') {
    adapterCache.set(provider, twilioVoiceAdapter);
    return twilioVoiceAdapter;
  }

  // ElevenLabs + Twilio combined adapter
  if (provider === 'elevenlabs-twilio') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { elevenLabsTwilioVoiceAdapter } = require('@cashflow-cod/messaging/voice');
      adapterCache.set(provider, elevenLabsTwilioVoiceAdapter);
      return elevenLabsTwilioVoiceAdapter;
    } catch {
      return undefined;
    }
  }

  // Retell AI adapter
  if (provider === 'retell') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { retellVoiceAdapter } = require('@cashflow-cod/messaging/voice');
      adapterCache.set(provider, retellVoiceAdapter);
      return retellVoiceAdapter;
    } catch {
      return undefined;
    }
  }

  // OpenAI Realtime adapter
  if (provider === 'openai-realtime') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { openaiRealtimeVoiceAdapter } = require('@cashflow-cod/messaging/voice');
      adapterCache.set(provider, openaiRealtimeVoiceAdapter);
      return openaiRealtimeVoiceAdapter;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

/* ------------------------------------------------------------------ */
/* Default call scripts per language                                   */
/* ------------------------------------------------------------------ */
const SCRIPTS: Record<string, { id: string; language: string; body: string }> = {
  en: {
    id: 'confirm_en_v1',
    language: 'en-US',
    body: 'Hello, this is an automated call to confirm your cash-on-delivery order. Please press 1 to confirm, 2 to cancel, or 9 to request a call back.',
  },
  ur: {
    id: 'confirm_ur_v1',
    language: 'ur-PK',
    body: 'السلام علیکم، آپ کا کیش آن ڈیلیوری آرڈر کنفرم کرنے کے لیے کال کی گئی ہے۔ آرڈر کنفرم کرنے کے لیے 1 دبائیں، منسوخ کرنے کے لیے 2، اور نئی کال کے لیے 9 دبائیں۔',
  },
  ar: {
    id: 'confirm_ar_v1',
    language: 'ar-SA',
    body: 'مرحبا، هذه مكالمة آلية لتأكيد طلب الدفع عند الاستلام. يرجى الضغط على 1 للتأكيد أو 2 للإلغاء أو 9 لطلب معاودة الاتصال.',
  },
};

/* ------------------------------------------------------------------ */
/* Env-based credentials fallback                                      */
/* ------------------------------------------------------------------ */
function loadCredentials(provider: string): Record<string, string> {
  if (provider === 'twilio' || provider === 'elevenlabs-twilio') {
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
      fromVoice: process.env.TWILIO_VOICE_FROM ?? process.env.TWILIO_PHONE_NUMBER ?? '',
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? '',
      elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID ?? '',
    };
  }
  if (provider === 'retell') {
    return {
      retellApiKey: process.env.RETELL_API_KEY ?? '',
      retellAgentId: process.env.RETELL_AGENT_ID ?? '',
      fromNumber: process.env.RETELL_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER ?? '',
    };
  }
  if (provider === 'openai-realtime') {
    return {
      openaiApiKey: process.env.OPENAI_API_KEY ?? '',
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
      fromVoice: process.env.TWILIO_VOICE_FROM ?? process.env.TWILIO_PHONE_NUMBER ?? '',
    };
  }
  return {};
}

/* ------------------------------------------------------------------ */
/* Job data interface                                                  */
/* ------------------------------------------------------------------ */
export interface VoiceConfirmJobData {
  orderId: string;
  phone: string;
  customerName?: string;
  language?: string;
  provider?: string;
  credentials?: Record<string, string>;
  callbackUrl?: string;
  shopDomain?: string;
  /** Internal: which attempt this is (1-based). BullMQ also tracks this. */
  attempt?: number;
}

/* ------------------------------------------------------------------ */
/* Processor                                                           */
/* ------------------------------------------------------------------ */
export async function processVoiceConfirm(job: Job<VoiceConfirmJobData>): Promise<PlaceCallResult> {
  const { phone, language, provider: providerKey, credentials, callbackUrl } = job.data;
  const prov = providerKey ?? 'twilio';

  const adapter = getAdapter(prov);
  if (!adapter) {
    throw new Error(`Voice adapter "${prov}" not available`);
  }

  const lang = language ?? 'en';
  const script = SCRIPTS[lang] ?? SCRIPTS.en!;

  const creds = credentials ?? loadCredentials(prov);
  const result = await adapter.call(creds, {
    to: phone,
    language: script.language,
    script: script.body,
    callbackUrl,
  });

  if (result.status === 'failed') {
    throw new Error(`Call failed: ${JSON.stringify(result.raw)}`);
  }

  // eslint-disable-next-line no-console
  console.log(
    `[voice-confirm] orderId=${job.data.orderId} provider=${prov} status=${result.status} sid=${result.providerId}`,
  );

  return result;
}

/* ------------------------------------------------------------------ */
/* BullMQ retry config for the queue                                   */
/* ------------------------------------------------------------------ */
export const VOICE_CONFIRM_RETRY = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 60_000 }, // 1m → 2m → 4m
};
