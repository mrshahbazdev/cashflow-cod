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

/* ------------------------------------------------------------------ */
/* Option A — Basic Twilio TTS + DTMF                                 */
/* ------------------------------------------------------------------ */
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
    const twiml = this.buildTwiml(req.script, {
      language: req.language,
      audioUrl: req.audioUrl,
    });
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
    const gatherAction = '/api/voice/twilio/callback';
    return `<?xml version="1.0" encoding="UTF-8"?><Response>${audio}<Gather input="dtmf" numDigits="1" timeout="8" action="${gatherAction}"><Say language="${lang}">Press 1 to confirm, 2 to cancel, 9 to reschedule.</Say></Gather><Say language="${lang}">We did not receive a response. Goodbye.</Say></Response>`;
  },
};

/* ------------------------------------------------------------------ */
/* Option B — ElevenLabs + Twilio combined voice adapter               */
/* Generates realistic Urdu/Arabic TTS via ElevenLabs, then places     */
/* the call through Twilio with <Play>.                                */
/* ------------------------------------------------------------------ */
export const elevenLabsTwilioVoiceAdapter: VoiceAdapter = {
  provider: 'elevenlabs-twilio',

  async call(credentials, req): Promise<PlaceCallResult> {
    const { accountSid, authToken, fromVoice, elevenLabsApiKey, elevenLabsVoiceId } = credentials;
    if (!accountSid || !authToken || !elevenLabsApiKey) {
      return {
        providerId: `mock_el_${Date.now()}`,
        status: 'queued',
        raw: { mock: true, reason: 'missing ElevenLabs or Twilio credentials' },
      };
    }

    // Step 1: Generate speech audio via ElevenLabs
    const voiceId = elevenLabsVoiceId || 'EXAVITQu4vr4xnSDxMaL';
    const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    let audioUrl = '';

    try {
      const ttsRes = await fetch(ttsUrl, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsApiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: req.script,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      });

      if (!ttsRes.ok) {
        const errText = await ttsRes.text();
        // eslint-disable-next-line no-console
        console.warn(`[elevenlabs] TTS failed (${ttsRes.status}): ${errText}, falling back to Twilio <Say>`);
      } else {
        const arrayBuffer = await ttsRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        audioUrl = `data:audio/mpeg;base64,${base64}`;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[elevenlabs] TTS error, falling back to Twilio <Say>:', (err as Error).message);
    }

    // Step 2: Place call via Twilio with the generated audio (or fallback to <Say>)
    const from = req.from ?? fromVoice ?? '';
    const callUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const twiml = this.buildTwiml(req.script, {
      language: req.language,
      audioUrl: audioUrl || undefined,
    });
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
      const res = await fetch(callUrl, {
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
        providerId: body.sid ?? `twilio_el_${Date.now()}`,
        status: (body.status as PlaceCallResult['status']) ?? 'queued',
        raw: { ...body, elevenLabsAudio: !!audioUrl },
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
    const gatherAction = '/api/voice/twilio/callback';
    return `<?xml version="1.0" encoding="UTF-8"?><Response>${audio}<Gather input="dtmf" numDigits="1" timeout="8" action="${gatherAction}"><Say language="${lang}">Press 1 to confirm, 2 to cancel, 9 to reschedule.</Say></Gather><Say language="${lang}">We did not receive a response. Goodbye.</Say></Response>`;
  },
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
function escapeXml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
