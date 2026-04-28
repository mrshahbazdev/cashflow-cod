/**
 * Public customer-facing return request form.
 *
 * URL: /returns/new?orderId=<id>
 * Submits POST → creates a ReturnRequest, redirects to /returns/:trackingCode
 */
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import prisma from '../db.server';
import { brandingForShop, DEFAULT_BRANDING } from '../lib/agency.server';
import { createReturn } from '../lib/returns.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId') ?? '';
  const phone = url.searchParams.get('phone') ?? '';
  if (!orderId) {
    return json({ branding: DEFAULT_BRANDING, orderId: '', orderFound: false, phone });
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return json({ branding: DEFAULT_BRANDING, orderId, orderFound: false, phone });
  const branding = await brandingForShop(order.shopId);
  return json({ branding, orderId, orderFound: true, phone });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.formData();
  const orderId = String(body.get('orderId') ?? '');
  const reason = String(body.get('reason') ?? '').trim();
  const resolution = String(body.get('resolution') ?? 'REFUND') as 'REFUND' | 'REPLACE' | 'STORE_CREDIT';
  const notes = String(body.get('notes') ?? '').trim() || undefined;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Response('Order not found', { status: 404 });
  if (!reason) throw new Response('Reason required', { status: 400 });
  const rma = await createReturn({ shopId: order.shopId, orderId, reason, resolution, notes });
  return redirect(`/returns/${rma.trackingCode}`);
};

export default function NewReturnRoute() {
  const { branding, orderId, orderFound } = useLoaderData<typeof loader>();
  const wrap: React.CSSProperties = {
    minHeight: '100vh',
    background: '#f8fafc',
    padding: 24,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    color: branding.accentColor,
  };
  const card: React.CSSProperties = {
    maxWidth: 640,
    margin: '0 auto',
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    padding: 24,
  };

  if (!orderFound) {
    return (
      <div style={wrap}>
        <div style={card}>
          <h1>Open a return</h1>
          <p>Order not found. Please open the link from your order tracking page.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={{ marginTop: 0 }}>Open a return request</h1>
        <RemixForm method="post">
          <input type="hidden" name="orderId" value={orderId} />
          <label style={{ display: 'block', marginBottom: 8 }}>Reason</label>
          <textarea
            name="reason"
            required
            rows={4}
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #c4cdd5', marginBottom: 12 }}
          />
          <label style={{ display: 'block', marginBottom: 8 }}>Resolution</label>
          <select
            name="resolution"
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #c4cdd5', marginBottom: 12 }}
          >
            <option value="REFUND">Refund</option>
            <option value="REPLACE">Replacement</option>
            <option value="STORE_CREDIT">Store credit</option>
          </select>
          <label style={{ display: 'block', marginBottom: 8 }}>Additional notes (optional)</label>
          <textarea
            name="notes"
            rows={2}
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #c4cdd5', marginBottom: 12 }}
          />
          <button
            type="submit"
            style={{
              background: branding.primaryColor,
              color: '#fff',
              border: 'none',
              padding: '10px 16px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Submit request
          </button>
        </RemixForm>
      </div>
    </div>
  );
}
