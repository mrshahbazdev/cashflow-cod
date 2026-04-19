import type { OtpChannel } from '@cashflow-cod/shared-types';
import type { MessagingAdapter, SendMessageRequest, SendMessageResult } from '../index.js';

export const twilioAdapter: MessagingAdapter = {
  provider: 'twilio',
  channels: ['SMS', 'WHATSAPP', 'VOICE'],
  async send(
    credentials: Record<string, string>,
    channel: OtpChannel,
    req: SendMessageRequest,
  ): Promise<SendMessageResult> {
    const { accountSid, authToken, fromSms, fromWhatsapp } = credentials;
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials (accountSid, authToken) missing');
    }
    const from =
      channel === 'WHATSAPP' ? `whatsapp:${fromWhatsapp ?? fromSms ?? ''}` : (fromSms ?? '');
    const to = channel === 'WHATSAPP' ? `whatsapp:${req.to}` : req.to;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams({ From: from, To: to, Body: req.body });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const body = (await res.json()) as { sid?: string; status?: string; message?: string };
    if (!res.ok) {
      throw new Error(`Twilio error: ${body.message ?? res.statusText}`);
    }
    return {
      providerId: body.sid ?? `twilio_${Date.now()}`,
      status: (body.status as SendMessageResult['status']) ?? 'sent',
      raw: body,
    };
  },
};
