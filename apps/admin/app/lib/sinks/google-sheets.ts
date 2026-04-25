import type { SinkAdapter, SinkResult } from './types';

/**
 * Google Sheets append adapter.
 *
 * Authenticates using a service-account JSON (private_key + client_email) and
 * appends one row per `order.placed` event to the configured sheet. The
 * service account must be shared on the target sheet with edit access.
 *
 * Reference: https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/append
 */

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export const googleSheetsSink: SinkAdapter = {
  provider: 'google_sheets',
  displayName: 'Google Sheets',
  credentialsHelp:
    'Service account JSON (paste full contents). Share the sheet with the service account email as Editor.',
  credentialFields: [
    {
      key: 'serviceAccount',
      label: 'Service account JSON',
      type: 'textarea',
      required: true,
      placeholder: '{"type":"service_account",...}',
    },
    {
      key: 'spreadsheetId',
      label: 'Spreadsheet ID',
      type: 'text',
      required: true,
      placeholder: '1AbCdEf...XYZ',
    },
    {
      key: 'sheetName',
      label: 'Sheet/tab name',
      type: 'text',
      required: false,
      placeholder: 'Orders',
    },
  ],
  async fire(credentials, _settings, event): Promise<SinkResult> {
    if (event.kind !== 'order.placed') {
      // Only mirror finalised orders — skip submission/disposition events.
      return { ok: true };
    }
    let sa: ServiceAccount;
    try {
      const raw = (credentials.serviceAccount as string) ?? '';
      sa = JSON.parse(raw) as ServiceAccount;
    } catch {
      return { ok: false, error: 'serviceAccount is not valid JSON' };
    }
    if (!sa.client_email || !sa.private_key) {
      return { ok: false, error: 'serviceAccount missing client_email or private_key' };
    }
    const spreadsheetId = (credentials.spreadsheetId as string) ?? '';
    const sheetName = (credentials.sheetName as string) || 'Sheet1';
    if (!spreadsheetId) return { ok: false, error: 'spreadsheetId missing' };

    let token: string;
    try {
      token = await getAccessToken(sa);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    const o = event.order;
    const row = [
      new Date(o.createdAt).toISOString(),
      o.shopifyOrderId ?? o.id,
      o.customerName ?? '',
      o.email ?? '',
      o.phone ?? '',
      o.addressLine1 ?? '',
      o.city ?? '',
      o.postalCode ?? '',
      o.country ?? '',
      o.total ?? 0,
      o.currency ?? '',
      o.disposition,
    ];

    const range = `${encodeURIComponent(sheetName)}!A:L`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId,
    )}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ values: [row] }),
      });
      if (res.ok) return { ok: true, responseStatus: res.status };
      const text = await res.text();
      return { ok: false, error: text || `HTTP ${res.status}`, responseStatus: res.status };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

/**
 * Mint a service-account access token via the JWT bearer flow.
 * No google-auth-library dependency — keeps the bundle small and edge-friendly.
 */
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: iat + 3600,
    iat,
  };
  const enc = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const signature = await rsaSign(unsigned, sa.private_key);
  const jwt = `${unsigned}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });
  const body = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenRes.ok || !body.access_token) {
    throw new Error(`token exchange failed: ${body.error ?? tokenRes.status}`);
  }
  return body.access_token;
}

async function rsaSign(input: string, privateKeyPem: string): Promise<string> {
  const { createSign } = await import('node:crypto');
  const signer = createSign('RSA-SHA256');
  signer.update(input);
  signer.end();
  return signer.sign(privateKeyPem).toString('base64url');
}
