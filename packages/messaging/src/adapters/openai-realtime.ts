/**
 * OpenAI Realtime API voice adapter.
 * Uses Twilio to place the outbound call, then bridges the audio stream
 * to OpenAI's Realtime API for a 2-way AI conversation.
 *
 * Architecture:
 *   Twilio outbound call → <Stream> WebSocket → our relay server
 *     → OpenAI Realtime API (bidirectional audio)
 *
 * This adapter sets up the Twilio call with TwiML that connects to
 * a WebSocket relay endpoint. The relay is expected to run alongside
 * the main app (see api.voice.openai-relay route).
 */
import type { VoiceAdapter, PlaceCallRequest, PlaceCallResult } from '../voice.js';

function escapeXml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const openaiRealtimeVoiceAdapter: VoiceAdapter = {
  provider: 'openai-realtime',

  async call(credentials, req): Promise<PlaceCallResult> {
    const { accountSid, authToken, fromVoice, relayUrl } = credentials;
    if (!accountSid || !authToken) {
      return {
        providerId: `mock_openai_${Date.now()}`,
        status: 'queued',
        raw: { mock: true, reason: 'missing Twilio credentials for OpenAI Realtime' },
      };
    }

    const from = req.from ?? fromVoice ?? '';
    const wsUrl = relayUrl ?? 'wss://your-app.fly.dev/api/voice/openai-relay';

    const twiml = buildOpenAITwiml(req.script, req.language ?? 'en-US', wsUrl);

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams({
      From: from,
      To: req.to,
      Twiml: twiml,
    });
    if (req.callbackUrl) {
      params.set('StatusCallback', req.callbackUrl);
      params.set('StatusCallbackEvent', 'completed');
    }

    try {
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
        return { providerId: '', status: 'failed', raw: body };
      }
      return {
        providerId: body.sid ?? `twilio_openai_${Date.now()}`,
        status: (body.status as PlaceCallResult['status']) ?? 'queued',
        raw: body,
      };
    } catch (err) {
      return { providerId: '', status: 'failed', raw: { error: (err as Error).message } };
    }
  },

  buildTwiml(script, opts = {}): string {
    return buildOpenAITwiml(script, opts.language ?? 'en-US', '');
  },
};

function buildOpenAITwiml(script: string, lang: string, relayUrl: string): string {
  const safe = escapeXml(script);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `  <Say voice="Polly.Joanna" language="${lang}">${safe}</Say>`,
    `  <Connect>`,
    `    <Stream url="${escapeXml(relayUrl)}" />`,
    `  </Connect>`,
    '</Response>',
  ].join('');
}
