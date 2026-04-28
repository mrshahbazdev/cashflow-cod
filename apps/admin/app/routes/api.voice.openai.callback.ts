import type { ActionFunctionArgs } from '@remix-run/node';
import { recordCallDisposition } from '../lib/calls.server';

/**
 * OpenAI Realtime relay callback.
 * Our WebSocket relay server POSTs the final conversation result here
 * when the call concludes.
 *
 * Expected JSON body:
 *   { callSid, transcript, disposition, durationSec, recordingUrl? }
 */
export async function action({ request }: ActionFunctionArgs) {
  const body = (await request.json()) as {
    callSid?: string;
    transcript?: string;
    disposition?: string;
    durationSec?: number;
    recordingUrl?: string;
  };

  if (body.callSid) {
    await recordCallDisposition({
      providerId: body.callSid,
      digit: '',
      transcript: body.transcript,
      aiDisposition: body.disposition,
      durationSec: body.durationSec,
      recordingUrl: body.recordingUrl,
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
