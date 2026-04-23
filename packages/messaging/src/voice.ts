/**
 * Voice adapter (Phase 2.4).
 * Places an outbound call and plays TTS (via Twilio <Say> or an ElevenLabs-generated audio URL).
 * Follows the pluggable-adapter pattern: pass credentials to the concrete adapter.
 */
export interface PlaceCallRequest {
  to: string;
  from?: string;
  language?: string;
  script: string;
  callbackUrl?: string;
  audioUrl?: string;
}

export interface PlaceCallResult {
  providerId: string;
  status: 'queued' | 'dialing' | 'answered' | 'failed' | 'no_answer' | 'completed';
  raw?: unknown;
}

export interface VoiceAdapter {
  readonly provider: string;
  call(credentials: Record<string, string>, req: PlaceCallRequest): Promise<PlaceCallResult>;
  buildTwiml(script: string, opts?: { language?: string; audioUrl?: string }): string;
}

export const twilioVoiceAdapter: VoiceAdapter = {
  provider: 'twilio-voice',

  async call(credentials, req): Promise<PlaceCallResult> {
    const { accountSid, authToken, fromVoice } = credentials;
    const from = req.from ?? fromVoice;
    if (!accountSid || !authToken || !from) {
      return {
        providerId: `mock_${Date.now()}`,
        status: 'queued',
        raw: { mock: true, reason: 'missing credentials' },
      };
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams({
      From: from,
      To: req.to,
      Twiml: this.buildTwiml(req.script, { language: req.language, audioUrl: req.audioUrl }),
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
        providerId: body.sid ?? `twilio_${Date.now()}`,
        status: (body.status as PlaceCallResult['status']) ?? 'queued',
        raw: body,
      };
    } catch (err) {
      return { providerId: '', status: 'failed', raw: { error: (err as Error).message } };
    }
  },

  buildTwiml(script, opts = {}): string {
    const lang = opts.language ?? 'en-US';
    const safe = escapeXml(script);
    const audio = opts.audioUrl
      ? `<Play>${escapeXml(opts.audioUrl)}</Play>`
      : `<Say voice="Polly.Joanna" language="${lang}">${safe}</Say>`;
    return `<?xml version="1.0" encoding="UTF-8"?><Response>${audio}<Gather input="dtmf" numDigits="1" timeout="8" action="${opts.audioUrl ? '' : ''}"><Say language="${lang}">Press 1 to confirm, 2 to cancel, 9 to reschedule.</Say></Gather></Response>`;
  },
};

function escapeXml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
