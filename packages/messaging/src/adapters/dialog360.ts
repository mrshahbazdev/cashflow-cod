import type { OtpChannel } from '@cashflow-cod/shared-types';
import type { MessagingAdapter, SendMessageRequest, SendMessageResult } from '../index.js';

/**
 * 360Dialog WhatsApp Business API adapter (Cloud + On-Premise compatible).
 * Required credentials:
 *   - apiKey (D360-API-KEY header)
 *   - phoneNumberId (Cloud API): omit for the legacy /v1/messages endpoint
 *   - templateNamespace, templateName, templateLang (optional, for template msgs)
 *   - fromDisplayName (optional)
 * API docs: https://docs.360dialog.com/api/whatsapp-api
 *
 * Falls back to a deterministic stub when the API key is missing or
 * `mode=mock` is set in credentials.
 */
export const dialog360Adapter: MessagingAdapter = {
  provider: '360dialog',
  channels: ['WHATSAPP'],

  async send(
    credentials: Record<string, string>,
    channel: OtpChannel,
    req: SendMessageRequest,
  ): Promise<SendMessageResult> {
    if (channel !== 'WHATSAPP') {
      throw new Error('360Dialog adapter only supports the WHATSAPP channel');
    }
    if (credentials.mode === 'mock' || !credentials.apiKey) {
      return {
        providerId: `360dialog_mock_${Date.now()}`,
        status: 'queued',
        raw: { mock: true, body: req.body },
      };
    }

    const useCloud = Boolean(credentials.phoneNumberId);
    const url = useCloud
      ? `https://waba-v2.360dialog.io/${credentials.phoneNumberId}/messages`
      : 'https://waba.360dialog.io/v1/messages';

    let payload: Record<string, unknown>;
    if (req.templateId && credentials.templateNamespace) {
      payload = {
        to: req.to,
        type: 'template',
        template: {
          namespace: credentials.templateNamespace,
          name: req.templateId,
          language: { policy: 'deterministic', code: credentials.templateLang ?? 'en' },
          components: req.variables
            ? [
                {
                  type: 'body',
                  parameters: Object.values(req.variables).map((v) => ({ type: 'text', text: v })),
                },
              ]
            : [],
        },
      };
    } else {
      payload = {
        to: req.to,
        type: 'text',
        text: { body: req.body },
      };
    }

    if (useCloud) {
      payload = { messaging_product: 'whatsapp', recipient_type: 'individual', ...payload };
    }
    if (req.mediaUrl) {
      payload = {
        to: req.to,
        type: 'image',
        image: { link: req.mediaUrl, caption: req.body },
      };
      if (useCloud) {
        payload = { messaging_product: 'whatsapp', recipient_type: 'individual', ...payload };
      }
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'D360-API-KEY': credentials.apiKey,
      },
      body: JSON.stringify(payload),
    });
    const body = (await resp.json()) as {
      messages?: Array<{ id?: string }>;
      message_id?: string;
      meta?: { developer_message?: string };
      error?: { message?: string };
    };
    if (!resp.ok) {
      throw new Error(
        `360Dialog error: ${body.error?.message ?? body.meta?.developer_message ?? resp.statusText}`,
      );
    }
    const id = body.messages?.[0]?.id ?? body.message_id ?? `360dialog_${Date.now()}`;
    return { providerId: id, status: 'queued', raw: body };
  },
};
