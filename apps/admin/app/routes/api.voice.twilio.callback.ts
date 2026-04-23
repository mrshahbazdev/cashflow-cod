import type { ActionFunctionArgs } from '@remix-run/node';
import { recordCallDisposition } from '../lib/calls.server';

/**
 * Twilio status/Gather callback. Twilio POSTs application/x-www-form-urlencoded.
 * Expected params: CallSid, CallStatus, Digits (optional), RecordingUrl (optional),
 * CallDuration (optional). Returns empty TwiML to end the call gracefully.
 */
export async function action({ request }: ActionFunctionArgs) {
  const text = await request.text();
  const params = new URLSearchParams(text);
  const callSid = params.get('CallSid');
  const digits = params.get('Digits') ?? '';
  const recordingUrl = params.get('RecordingUrl') ?? undefined;
  const duration = params.get('CallDuration');
  if (callSid) {
    await recordCallDisposition({
      providerId: callSid,
      digit: digits,
      recordingUrl,
      durationSec: duration ? Number(duration) : undefined,
    });
  }
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>', {
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
  });
}
