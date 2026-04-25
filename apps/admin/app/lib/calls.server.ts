/**
 * Phase 2.4 — AI voice confirmation calls (A + B + C pipeline).
 *
 * Option A: Basic Twilio TTS + DTMF
 * Option B: ElevenLabs + Twilio (realistic Urdu/Arabic voice)
 * Option C: Retell AI / OpenAI Realtime (full 2-way AI conversation)
 *
 * Places an outbound call via the configured voice adapter, records a
 * CallSession row. Supports auto-trigger from the worker queue.
 */
import {
  twilioVoiceAdapter,
  elevenLabsTwilioVoiceAdapter,
  retellVoiceAdapter,
  openaiRealtimeVoiceAdapter,
  type VoiceAdapter,
} from '@cashflow-cod/messaging';
import prisma from '../db.server';

/* ------------------------------------------------------------------ */
/* Adapter registry                                                    */
/* ------------------------------------------------------------------ */
const adapters: Record<string, VoiceAdapter> = {
  twilio: twilioVoiceAdapter,
  'elevenlabs-twilio': elevenLabsTwilioVoiceAdapter,
  retell: retellVoiceAdapter,
  'openai-realtime': openaiRealtimeVoiceAdapter,
};

/* ------------------------------------------------------------------ */
/* Call scripts (default per language)                                  */
/* ------------------------------------------------------------------ */
export type CallScript = {
  id: string;
  language: string;
  body: string;
};

const DEFAULT_SCRIPTS: Record<string, CallScript> = {
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
/* Place a confirmation call                                           */
/* ------------------------------------------------------------------ */
export async function placeConfirmationCall(args: {
  orderId: string;
  provider?: string;
  language?: string;
  scriptOverride?: string;
  credentials?: Record<string, string>;
  callbackUrl?: string;
}): Promise<
  | { ok: true; sessionId: string; status: string }
  | { ok: false; error: string }
> {
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    include: { shop: { select: { settings: true } } },
  });
  if (!order) return { ok: false, error: 'Order not found' };
  if (!order.phone) return { ok: false, error: 'Order has no phone number' };

  // Determine provider from args → shop settings → env fallback
  const shopSettings = (order.shop?.settings ?? {}) as Record<string, unknown>;
  const voiceSettings = (shopSettings.voice ?? {}) as Record<string, string>;
  const providerKey = args.provider ?? voiceSettings.provider ?? 'twilio';
  const adapter = adapters[providerKey];
  if (!adapter) return { ok: false, error: `Unsupported voice provider: ${providerKey}` };

  const lang = args.language ?? (shopSettings.defaultLanguage as string) ?? 'en';
  const script = DEFAULT_SCRIPTS[lang] ?? DEFAULT_SCRIPTS.en!;
  const body = args.scriptOverride ?? script.body;

  const session = await prisma.callSession.create({
    data: {
      orderId: order.id,
      provider: adapter.provider,
      direction: 'outbound',
      status: 'queued',
      scriptId: script.id,
      language: script.language,
    },
  });

  const creds = args.credentials ?? loadCredentials(providerKey, voiceSettings);
  const result = await adapter.call(creds, {
    to: order.phone,
    language: script.language,
    script: body,
    callbackUrl: args.callbackUrl,
  });

  await prisma.callSession.update({
    where: { id: session.id },
    data: {
      status: result.status,
      providerId: result.providerId || null,
      startedAt: result.status === 'queued' || result.status === 'dialing' ? new Date() : undefined,
    },
  });

  return { ok: true, sessionId: session.id, status: result.status };
}

/* ------------------------------------------------------------------ */
/* Record call disposition (Twilio / Retell / OpenAI callback)         */
/* ------------------------------------------------------------------ */
export async function recordCallDisposition(args: {
  providerId: string;
  digit: string;
  recordingUrl?: string;
  transcript?: string;
  durationSec?: number;
  /** AI agent disposition text (for Retell/OpenAI) */
  aiDisposition?: string;
}): Promise<void> {
  const session = await prisma.callSession.findFirst({ where: { providerId: args.providerId } });
  if (!session) return;

  const disposition = args.aiDisposition
    ? aiTextToDisposition(args.aiDisposition)
    : digitToDisposition(args.digit);

  await prisma.callSession.update({
    where: { id: session.id },
    data: {
      dispositionCapture: args.aiDisposition ?? args.digit,
      recordingUrl: args.recordingUrl ?? null,
      transcript: args.transcript ?? null,
      durationSec: args.durationSec ?? null,
      status: 'completed',
      endedAt: new Date(),
    },
  });
  if (disposition) {
    await prisma.order.update({
      where: { id: session.orderId },
      data: { disposition },
    });
  }
}

/* ------------------------------------------------------------------ */
/* Retell webhook handler                                              */
/* ------------------------------------------------------------------ */
export async function handleRetellWebhook(payload: {
  call_id: string;
  call_status: string;
  transcript?: string;
  recording_url?: string;
  call_analysis?: {
    call_summary?: string;
    user_sentiment?: string;
    custom_analysis_data?: Record<string, unknown>;
  };
  duration_ms?: number;
  disconnection_reason?: string;
}): Promise<void> {
  const session = await prisma.callSession.findFirst({
    where: { providerId: payload.call_id },
  });
  if (!session) return;

  const aiResult = payload.call_analysis?.custom_analysis_data?.disposition as string | undefined;
  const disposition = aiResult
    ? aiTextToDisposition(aiResult)
    : statusToDisposition(payload.call_status);

  await prisma.callSession.update({
    where: { id: session.id },
    data: {
      status: payload.call_status === 'ended' ? 'completed' : payload.call_status,
      transcript: payload.transcript ?? null,
      recordingUrl: payload.recording_url ?? null,
      durationSec: payload.duration_ms ? Math.round(payload.duration_ms / 1000) : null,
      dispositionCapture: aiResult ?? payload.disconnection_reason ?? null,
      endedAt: new Date(),
    },
  });

  if (disposition) {
    await prisma.order.update({
      where: { id: session.orderId },
      data: { disposition },
    });
  }
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
function digitToDisposition(d: string): 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED' | null {
  if (d === '1') return 'CONFIRMED';
  if (d === '2') return 'CANCELLED';
  if (d === '9') return 'RESCHEDULED';
  return null;
}

function aiTextToDisposition(text: string): 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED' | 'NO_ANSWER' | null {
  const lower = text.toLowerCase();
  if (lower.includes('confirm')) return 'CONFIRMED';
  if (lower.includes('cancel') || lower.includes('reject')) return 'CANCELLED';
  if (lower.includes('reschedule') || lower.includes('callback') || lower.includes('call back')) return 'RESCHEDULED';
  if (lower.includes('no_answer') || lower.includes('no answer') || lower.includes('voicemail')) return 'NO_ANSWER';
  return null;
}

function statusToDisposition(status: string): 'NO_ANSWER' | null {
  if (status === 'no_answer' || status === 'busy') return 'NO_ANSWER';
  return null;
}

function loadCredentials(provider: string, shopVoice: Record<string, string>): Record<string, string> {
  // Shop-level settings override env vars
  const merge = (envKey: string, settingsKey: string): string =>
    shopVoice[settingsKey] || process.env[envKey] || '';

  if (provider === 'twilio') {
    return {
      accountSid: merge('TWILIO_ACCOUNT_SID', 'twilioAccountSid'),
      authToken: merge('TWILIO_AUTH_TOKEN', 'twilioAuthToken'),
      fromVoice: merge('TWILIO_VOICE_FROM', 'twilioFromNumber') || process.env.TWILIO_PHONE_NUMBER || '',
    };
  }
  if (provider === 'elevenlabs-twilio') {
    return {
      accountSid: merge('TWILIO_ACCOUNT_SID', 'twilioAccountSid'),
      authToken: merge('TWILIO_AUTH_TOKEN', 'twilioAuthToken'),
      fromVoice: merge('TWILIO_VOICE_FROM', 'twilioFromNumber') || process.env.TWILIO_PHONE_NUMBER || '',
      elevenLabsApiKey: merge('ELEVENLABS_API_KEY', 'elevenLabsApiKey'),
      elevenLabsVoiceId: merge('ELEVENLABS_VOICE_ID', 'elevenLabsVoiceId'),
    };
  }
  if (provider === 'retell') {
    return {
      retellApiKey: merge('RETELL_API_KEY', 'retellApiKey'),
      retellAgentId: merge('RETELL_AGENT_ID', 'retellAgentId'),
      fromNumber: merge('RETELL_FROM_NUMBER', 'retellFromNumber') || process.env.TWILIO_PHONE_NUMBER || '',
    };
  }
  if (provider === 'openai-realtime') {
    return {
      openaiApiKey: merge('OPENAI_API_KEY', 'openaiApiKey'),
      accountSid: merge('TWILIO_ACCOUNT_SID', 'twilioAccountSid'),
      authToken: merge('TWILIO_AUTH_TOKEN', 'twilioAuthToken'),
      fromVoice: merge('TWILIO_VOICE_FROM', 'twilioFromNumber') || process.env.TWILIO_PHONE_NUMBER || '',
      relayUrl: merge('OPENAI_RELAY_URL', 'openaiRelayUrl'),
    };
  }
  return {};
}
