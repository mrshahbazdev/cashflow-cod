/**
 * Public customer-facing order tracking page.
 *
 * URL pattern: /track/:code?phone=03001234567
 *
 * `code` is the Order.id (cuid). The phone query parameter (or POST form field)
 * verifies that the requester knows the order's phone number; otherwise we
 * return a generic "not found" rather than leaking order existence.
 */
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import prisma from '../db.server';
import { brandingForShop, DEFAULT_BRANDING } from '../lib/agency.server';
import { formatMoney } from '../lib/currency';

interface TrackedOrder {
  id: string;
  customerName: string | null;
  city: string | null;
  country: string | null;
  total: number;
  currency: string;
  disposition: string;
  createdAt: string;
  tracking: { courier: string; consignmentNumber: string | null; status: string; url: string | null }[];
}

interface LoaderData {
  branding: typeof DEFAULT_BRANDING;
  code: string;
  needsPhone: boolean;
  notFound: boolean;
  order: TrackedOrder | null;
}

function normalizePhone(input: string): string {
  return input.replace(/[^0-9]/g, '');
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const code = String(params.code ?? '').trim();
  const url = new URL(request.url);
  const phone = url.searchParams.get('phone')?.trim() ?? '';

  if (!code) {
    return json<LoaderData>({ branding: DEFAULT_BRANDING, code, needsPhone: true, notFound: false, order: null });
  }
  if (!phone) {
    return json<LoaderData>({ branding: DEFAULT_BRANDING, code, needsPhone: true, notFound: false, order: null });
  }

  const normalized = normalizePhone(phone);
  const order = await prisma.order.findFirst({
    where: { id: code },
    include: { courierBookings: { include: { courierAccount: true } } },
  });

  if (!order) {
    return json<LoaderData>({ branding: DEFAULT_BRANDING, code, needsPhone: false, notFound: true, order: null });
  }
  const orderPhone = normalizePhone(order.phoneNormalized ?? order.phone ?? '');
  if (!orderPhone || !orderPhone.endsWith(normalized.slice(-7))) {
    return json<LoaderData>({ branding: DEFAULT_BRANDING, code, needsPhone: false, notFound: true, order: null });
  }

  const branding = await brandingForShop(order.shopId);
  return json<LoaderData>({
    branding,
    code,
    needsPhone: false,
    notFound: false,
    order: {
      id: order.id,
      customerName: order.customerName,
      city: order.city,
      country: order.country,
      total: order.total ? Number(order.total) : 0,
      currency: order.currency ?? 'USD',
      disposition: order.disposition,
      createdAt: order.createdAt.toISOString(),
      tracking: order.courierBookings.map((b) => ({
        courier: b.courierAccount.courier,
        consignmentNumber: b.consignmentNumber,
        status: b.status,
        url: b.trackingUrl,
      })),
    },
  });
};

export default function TrackOrderRoute() {
  const data = useLoaderData<typeof loader>();
  const { branding, code, needsPhone, notFound, order } = data;
  const wrapStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#f8fafc',
    padding: 24,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    color: branding.accentColor,
  };
  const cardStyle: React.CSSProperties = {
    maxWidth: 640,
    margin: '0 auto',
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    padding: 24,
  };

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {branding.logoUrl ? <img src={branding.logoUrl} alt="" style={{ height: 32 }} /> : null}
          <h1 style={{ margin: 0, fontSize: 20 }}>{branding.name} — Order tracking</h1>
        </header>

        {needsPhone ? (
          <RemixForm method="get">
            <p>Enter your phone number to view order <code>{code}</code>.</p>
            <input
              name="phone"
              placeholder="03001234567"
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
              View order
            </button>
          </RemixForm>
        ) : null}

        {notFound ? (
          <p>
            We could not find an order matching <code>{code}</code> for the phone number you provided. Please double-check
            and try again.
          </p>
        ) : null}

        {order ? (
          <div>
            <p style={{ marginTop: 0 }}>
              Hi <strong>{order.customerName ?? 'there'}</strong>, here is the status of your order.
            </p>
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
                  {order.disposition}
                </span>
              </dd>
              <dt>Total</dt>
              <dd>{formatMoney(order.total, order.currency)}</dd>
              <dt>Placed at</dt>
              <dd>{new Date(order.createdAt).toLocaleString()}</dd>
              <dt>City</dt>
              <dd>
                {order.city ?? '—'}
                {order.country ? `, ${order.country}` : ''}
              </dd>
            </dl>

            <h2 style={{ fontSize: 16, marginTop: 24 }}>Shipment</h2>
            {order.tracking.length === 0 ? (
              <p style={{ color: '#64748b' }}>Not yet shipped.</p>
            ) : (
              <ul style={{ paddingLeft: 16 }}>
                {order.tracking.map((t, i) => (
                  <li key={i} style={{ marginBottom: 8 }}>
                    <strong>{t.courier.toUpperCase()}</strong> — {t.status}
                    {t.consignmentNumber ? ` (${t.consignmentNumber})` : ''}
                    {t.url ? (
                      <>
                        {' '}
                        ·{' '}
                        <a href={t.url} target="_blank" rel="noreferrer">
                          Track
                        </a>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <p style={{ marginTop: 32 }}>
              Need to return or replace?{' '}
              <a href={`/returns/new?orderId=${order.id}`} style={{ color: branding.primaryColor }}>
                Open a return request
              </a>
              .
            </p>
          </div>
        ) : null}

        {!branding.hidePoweredBy ? (
          <footer style={{ marginTop: 24, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
            Powered by Cashflow COD
          </footer>
        ) : null}
      </div>
    </div>
  );
}
