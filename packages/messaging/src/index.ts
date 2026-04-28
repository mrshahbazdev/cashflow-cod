import type { MessagingProvider, OtpChannel } from '@cashflow-cod/shared-types';

export interface SendMessageRequest {
  to: string;
  body: string;
  templateId?: string;
  variables?: Record<string, string>;
  mediaUrl?: string;
}

export interface SendMessageResult {
  providerId: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  raw?: unknown;
}

export interface MessagingAdapter {
  readonly provider: MessagingProvider;
  readonly channels: OtpChannel[];

  send(
    credentials: Record<string, string>,
    channel: OtpChannel,
    req: SendMessageRequest,
  ): Promise<SendMessageResult>;
}

export class MessagingRegistry {
  private adapters = new Map<MessagingProvider, MessagingAdapter>();

  register(adapter: MessagingAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: MessagingProvider): MessagingAdapter | undefined {
    return this.adapters.get(provider);
  }
}

export const messagingRegistry = new MessagingRegistry();

export function generateOtp(length = 6): string {
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  return String(Math.floor(min + Math.random() * (max - min)));
}

// SMS / WhatsApp adapters
export { consoleAdapter } from './adapters/console.js';
export { twilioAdapter } from './adapters/twilio.js';
export { dialog360Adapter } from './adapters/dialog360.js';

// Voice adapters (A + B + C pipeline)
export {
  twilioVoiceAdapter,
  elevenLabsTwilioVoiceAdapter,
} from './voice.js';
export type { VoiceAdapter, PlaceCallRequest, PlaceCallResult } from './voice.js';

// Option B — ElevenLabs standalone TTS
export { synthesizeSpeech, synthesizeToUrl } from './adapters/elevenlabs.js';
export type { ElevenLabsTTSRequest, ElevenLabsTTSResult } from './adapters/elevenlabs.js';

// Option C — AI conversational agents
export { retellVoiceAdapter } from './adapters/retell.js';
export { openaiRealtimeVoiceAdapter } from './adapters/openai-realtime.js';

import { consoleAdapter } from './adapters/console.js';
import { twilioAdapter } from './adapters/twilio.js';
import { dialog360Adapter } from './adapters/dialog360.js';

messagingRegistry.register(consoleAdapter);
messagingRegistry.register(twilioAdapter);
messagingRegistry.register(dialog360Adapter);
