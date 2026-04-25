import type { ActionFunctionArgs } from '@remix-run/node';
import { recordCallDisposition } from '../lib/calls.server';

/**
 * Twilio status/Gather callback. Twilio POSTs application/x-www-form-urlencoded.
 * Expected params: CallSid, CallStatus, Digits (optional), RecordingUrl (optional),
 * CallDuration (optional). Returns TwiML: confirms the selection or ends the call.
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

  // Build response TwiML based on the digit pressed
  let responseTwiml: string;
  if (digits === '1') {
    responseTwiml =
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Your order has been confirmed. Thank you!</Say><Hangup/></Response>';
  } else if (digits === '2') {
    responseTwiml =
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Your order has been cancelled. Goodbye.</Say><Hangup/></Response>';
  } else if (digits === '9') {
    responseTwiml =
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>We will call you back soon. Thank you.</Say><Hangup/></Response>';
  } else {
    responseTwiml =
      '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';
  }

  return new Response(responseTwiml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
  });
}
