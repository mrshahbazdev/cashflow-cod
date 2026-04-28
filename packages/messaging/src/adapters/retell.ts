/**
 * Retell AI voice adapter.
 * Creates an outbound phone call using Retell's API, which handles
 * the full 2-way AI conversation with the customer.
 *
 * Retell manages the voice model, turn-taking, and NLU internally.
 * We just trigger the call and receive a webhook when it ends.
 */
import type { VoiceAdapter, PlaceCallRequest, PlaceCallResult } from '../voice.js';

const RETELL_API = 'https://api.retellai.com/v2';

interface RetellCreateCallResponse {
  call_id: string;
  call_status: string;
  agent_id: string;
}

export const retellVoiceAdapter: VoiceAdapter = {
  provider: 'retell',

  async call(credentials, req): Promise<PlaceCallResult> {
    const { retellApiKey, retellAgentId, fromNumber } = credentials;
    if (!retellApiKey || !retellAgentId) {
      return {
        providerId: `mock_retell_${Date.now()}`,
        status: 'queued',
        raw: { mock: true, reason: 'missing Retell credentials' },
      };
    }

    const from = req.from ?? fromNumber ?? '';

    const body: Record<string, unknown> = {
      agent_id: retellAgentId,
      customer_number: req.to,
      retell_llm_dynamic_variables: {
        customer_name: 'Customer',
        order_script: req.script,
        language: req.language ?? 'en-US',
      },
    };

    if (from) body.from_number = from;
    if (req.callbackUrl) body.metadata = { callbackUrl: req.callbackUrl };

    try {
      const res = await fetch(`${RETELL_API}/create-phone-call`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${retellApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as RetellCreateCallResponse & { message?: string };
      if (!res.ok) {
        return { providerId: '', status: 'failed', raw: data };
      }

      return {
        providerId: data.call_id ?? `retell_${Date.now()}`,
        status: 'queued',
        raw: data,
      };
    } catch (err) {
      return { providerId: '', status: 'failed', raw: { error: (err as Error).message } };
    }
  },

  buildTwiml(_script, _opts): string {
    // Retell handles its own voice pipeline — no TwiML needed
    return '';
  },
};
