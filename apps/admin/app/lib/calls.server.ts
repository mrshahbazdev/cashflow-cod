/**
 * Phase 2.4 — AI voice confirmation calls.
 * Places an outbound call via the configured voice adapter, records a CallSession row.
 * Supports Twilio by default; extensible via the VoiceAdapter interface.
 */
import { twilioVoiceAdapter, type VoiceAdapter } from '@cashflow-cod/messaging';
import prisma from '../db.server';

const adapters: Record<string, VoiceAdapter> = {
  twilio: twilioVoiceAdapter,
};

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
  const order = await prisma.order.findUnique({ where: { id: args.orderId } });
  if (!order) return { ok: false, error: 'Order not found' };
  if (!order.phone) return { ok: false, error: 'Order has no phone number' };

  const providerKey = args.provider ?? 'twilio';
  const adapter = adapters[providerKey];
  if (!adapter) return { ok: false, error: `Unsupported voice provider: ${providerKey}` };

  const lang = args.language ?? 'en';
  const script = DEFAULT_SCRIPTS[lang] ?? DEFAULT_SCRIPTS.en!;
  const body = args.scriptOverride ?? script.body;

  const session = await prisma.callSession.create({
    data: {
      orderId: order.id,
      provider: `${providerKey}-voice`,
      direction: 'outbound',
      status: 'queued',
      scriptId: script.id,
      language: script.language,
    },
  });

  const creds = args.credentials ?? loadCredentialsFromEnv(providerKey);
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

export async function recordCallDisposition(args: {
  providerId: string;
  digit: string;
  recordingUrl?: string;
  transcript?: string;
  durationSec?: number;
}): Promise<void> {
  const session = await prisma.callSession.findFirst({ where: { providerId: args.providerId } });
  if (!session) return;
  const disposition = digitToDisposition(args.digit);
  await prisma.callSession.update({
    where: { id: session.id },
    data: {
      dispositionCapture: args.digit,
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

function digitToDisposition(d: string): 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED' | null {
  if (d === '1') return 'CONFIRMED';
  if (d === '2') return 'CANCELLED';
  if (d === '9') return 'RESCHEDULED';
  return null;
}

function loadCredentialsFromEnv(provider: string): Record<string, string> {
  if (provider === 'twilio') {
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
      fromVoice: process.env.TWILIO_VOICE_FROM ?? process.env.TWILIO_FROM ?? '',
    };
  }
  return {};
}
