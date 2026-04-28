/**
 * ElevenLabs TTS adapter.
 * Converts text to realistic speech audio (Urdu / Arabic / English)
 * via ElevenLabs API, then returns a URL for Twilio <Play>.
 */

export interface ElevenLabsTTSRequest {
  text: string;
  voiceId?: string;
  modelId?: string;
  language?: string;
}

export interface ElevenLabsTTSResult {
  audioUrl: string;
  audioBase64?: string;
  durationMs?: number;
}

const ELEVEN_LABS_API = 'https://api.elevenlabs.io/v1';

/** Default multilingual v2 model — best for non-English. */
const DEFAULT_MODEL = 'eleven_multilingual_v2';

/** Default voice IDs per language (users should override via settings). */
const DEFAULT_VOICES: Record<string, string> = {
  'en-US': 'EXAVITQu4vr4xnSDxMaL', // "Sarah" — clear English
  'ur-PK': 'EXAVITQu4vr4xnSDxMaL', // uses multilingual model
  'ar-SA': 'EXAVITQu4vr4xnSDxMaL', // uses multilingual model
};

/**
 * Synthesize speech and return the audio as a base64-encoded mp3 data URI
 * suitable for Twilio <Play>. For production, upload to R2/S3 and return
 * a public URL instead.
 */
export async function synthesizeSpeech(
  apiKey: string,
  req: ElevenLabsTTSRequest,
): Promise<ElevenLabsTTSResult> {
  const voiceId = req.voiceId ?? DEFAULT_VOICES[req.language ?? 'en-US'] ?? DEFAULT_VOICES['en-US'];
  const modelId = req.modelId ?? DEFAULT_MODEL;

  const url = `${ELEVEN_LABS_API}/text-to-speech/${voiceId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: req.text,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`ElevenLabs TTS error ${res.status}: ${errorBody}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return {
    audioUrl: `data:audio/mpeg;base64,${base64}`,
    audioBase64: base64,
  };
}

/**
 * Synthesize speech and return a publicly accessible URL.
 * In production you'd upload to cloud storage; this version
 * returns a base64 data URI as a fallback.
 */
export async function synthesizeToUrl(
  apiKey: string,
  req: ElevenLabsTTSRequest,
): Promise<string> {
  const result = await synthesizeSpeech(apiKey, req);
  return result.audioUrl;
}
