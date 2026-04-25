import type { ActionFunctionArgs } from '@remix-run/node';
import { handleRetellWebhook } from '../lib/calls.server';

/**
 * Retell AI webhook callback.
 * Retell POSTs JSON when a call ends with transcript + analysis.
 */
export async function action({ request }: ActionFunctionArgs) {
  const payload = (await request.json()) as {
    event?: string;
    call?: {
      call_id: string;
      call_status: string;
      transcript?: string;
      recording_url?: string;
      call_analysis?: {
        call_summary?: string;
        user_sentiment?: string;
        custom_analysis_data?: Record<string, unknown>;
      };
      duration_ms?: number;
      disconnection_reason?: string;
    };
  };

  if (payload.event === 'call_ended' && payload.call) {
    await handleRetellWebhook(payload.call);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
