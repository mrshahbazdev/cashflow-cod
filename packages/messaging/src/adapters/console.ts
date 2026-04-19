import type { OtpChannel } from '@cashflow-cod/shared-types';
import type { MessagingAdapter, SendMessageRequest, SendMessageResult } from '../index.js';

export const consoleAdapter: MessagingAdapter = {
  provider: 'custom',
  channels: ['SMS', 'WHATSAPP', 'EMAIL', 'VOICE'],
  async send(
    _credentials: Record<string, string>,
    channel: OtpChannel,
    req: SendMessageRequest,
  ): Promise<SendMessageResult> {
    // eslint-disable-next-line no-console
    console.info(`[console-messaging] ${channel} → ${req.to}: ${req.body}`);
    return { providerId: `console_${Date.now()}`, status: 'sent' };
  },
};
