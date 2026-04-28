/**
 * Public-facing return status page.
 *
 * URL: /returns/:code  → shows current status of a ReturnRequest by tracking code.
 */
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { brandingForShop, DEFAULT_BRANDING } from '../lib/agency.server';
import { getReturnByCode } from '../lib/returns.server';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const code = String(params.code ?? '');
  const rma = await getReturnByCode(code);
  if (!rma) return json({ branding: DEFAULT_BRANDING, found: false as const });
  const branding = await brandingForShop(rma.shopId);
  return json({
    branding,
    found: true as const,
    rma: {
      trackingCode: rma.trackingCode,
      reason: rma.reason,
      resolution: rma.resolution,
      status: rma.status,
      createdAt: rma.createdAt.toISOString(),
      customer: rma.order?.customerName ?? null,
    },
  });
};

export default function ReturnStatusRoute() {
  const data = useLoaderData<typeof loader>();
  const wrap: React.CSSProperties = {
    minHeight: '100vh',
    background: '#f8fafc',
    padding: 24,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    color: data.branding.accentColor,
  };
  const card: React.CSSProperties = {
    maxWidth: 640,
    margin: '0 auto',
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    padding: 24,
  };
  if (!data.found) {
    return (
      <div style={wrap}>
        <div style={card}>
          <h1>Return request</h1>
          <p>No return request found with that code.</p>
        </div>
      </div>
    );
  }
  const { rma, branding } = data;
  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={{ marginTop: 0 }}>Return {rma.trackingCode}</h1>
        <p>Hi {rma.customer ?? 'there'}, here is the latest status of your return.</p>
        <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8 }}>
          <dt>Status</dt>
          <dd>
            <span
              style={{
                background: branding.primaryColor,
                color: '#fff',
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 12,
              }}
            >
              {rma.status}
            </span>
          </dd>
          <dt>Resolution</dt>
          <dd>{rma.resolution}</dd>
          <dt>Reason</dt>
          <dd>{rma.reason}</dd>
          <dt>Opened</dt>
          <dd>{new Date(rma.createdAt).toLocaleString()}</dd>
        </dl>
        {!branding.hidePoweredBy ? (
          <footer style={{ marginTop: 24, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
            Powered by Cashflow COD
          </footer>
        ) : null}
      </div>
    </div>
  );
}
