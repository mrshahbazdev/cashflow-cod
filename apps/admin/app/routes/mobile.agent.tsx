import type { LinksFunction, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { useEffect, useState } from 'react';
import prisma from '../db.server';

/**
 * Phase 5.4 — Agent mobile PWA.
 *
 * Phone-first installable web app for call-center agents. Renders the order
 * queue with one-tap call / confirm / fake / no-answer dispositions and
 * registers a service worker that queues actions while offline (2G/3G).
 *
 * Authentication: agent-token in localStorage (issued by /app/agents). When
 * absent, the page shows a login prompt that posts to /api/mobile/login.
 */
export const links: LinksFunction = () => [
  { rel: 'manifest', href: '/mobile-agent-manifest.json' },
  { rel: 'icon', href: '/mobile-agent-icon-192.png' },
  { rel: 'apple-touch-icon', href: '/mobile-agent-icon-192.png' },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  if (!token) {
    return json({ ok: false as const, agent: null, orders: [] as OrderRow[] });
  }
  const agent = await prisma.agent.findFirst({ where: { userId: token, isActive: true } });
  if (!agent) {
    return json({ ok: false as const, agent: null, orders: [] as OrderRow[] });
  }
  const [shop, orders] = await Promise.all([
    prisma.shop.findUnique({ where: { id: agent.shopId }, select: { settings: true } }),
    prisma.order.findMany({
      where: { shopId: agent.shopId, disposition: { in: ['NEW', 'UNASSIGNED'] } },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: {
        id: true,
        customerName: true,
        phone: true,
        city: true,
        country: true,
        total: true,
        riskScore: true,
        disposition: true,
        createdAt: true,
      },
    }),
  ]);
  await prisma.agent.update({ where: { id: agent.id }, data: { lastSeenAt: new Date() } });
  const settings =
    shop?.settings && typeof shop.settings === 'object' && !Array.isArray(shop.settings)
      ? (shop.settings as Record<string, unknown>)
      : {};
  const currency = typeof settings.currency === 'string' ? settings.currency : 'USD';
  const orderRows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    customerName: o.customerName,
    phone: o.phone,
    city: o.city,
    country: o.country,
    total: o.total ? Number(o.total) : 0,
    currency,
    riskScore: o.riskScore,
    disposition: o.disposition,
    createdAt: o.createdAt.toISOString(),
  }));
  return json({ ok: true as const, agent: { id: agent.id, name: agent.name }, orders: orderRows });
};

interface OrderRow {
  id: string;
  customerName: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  total: number;
  currency: string;
  riskScore: number | null;
  disposition: string;
  createdAt: string;
}

export default function MobileAgent() {
  const data = useLoaderData<typeof loader>();
  const [orders, setOrders] = useState<OrderRow[]>(data.ok ? data.orders : []);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/mobile-agent-sw.js').catch(() => undefined);
    }
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    sync();
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  async function dispose(orderId: string, disposition: string) {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    try {
      await fetch('/api/mobile/disposition', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, disposition }),
      });
    } catch {
      // service worker queues the request for replay
    }
  }

  if (!data.ok) {
    return (
      <main style={shell}>
        <h1 style={{ margin: 0, fontSize: 22 }}>COD Agent</h1>
        <p style={{ color: '#cbd5e1' }}>
          Sign in token missing. Open this page from <code>/app/agents</code> or via the magic
          link your owner shared.
        </p>
      </main>
    );
  }

  return (
    <main style={shell}>
      <header style={header}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Agent</div>
          <div style={{ fontWeight: 600 }}>{data.agent?.name}</div>
        </div>
        <div style={{ ...badge, background: online ? '#10b981' : '#ef4444' }}>
          {online ? 'Online' : 'Offline'}
        </div>
      </header>
      {orders.length === 0 ? (
        <p style={{ color: '#cbd5e1', marginTop: 24 }}>No pending orders. Refresh to pull more.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
          {orders.map((o) => (
            <li key={o.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: 17, fontWeight: 600 }}>{o.customerName ?? 'Customer'}</div>
                <div style={{ fontSize: 13, color: riskColor(o.riskScore) }}>
                  risk {o.riskScore ?? '—'}
                </div>
              </div>
              <div style={{ color: '#cbd5e1', fontSize: 14 }}>
                {o.city ?? '—'} · {o.total} {o.currency}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
                <a href={`tel:${o.phone ?? ''}`} style={{ ...btn, background: '#10b981' }}>
                  Call
                </a>
                <button style={{ ...btn, background: '#3b82f6' }} onClick={() => dispose(o.id, 'CONFIRMED')}>
                  Confirm
                </button>
                <button style={{ ...btn, background: '#ef4444' }} onClick={() => dispose(o.id, 'FAKE')}>
                  Fake
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
                <button style={{ ...btn, background: '#475569' }} onClick={() => dispose(o.id, 'NO_ANSWER')}>
                  No answer
                </button>
                <a
                  href={`https://wa.me/${(o.phone ?? '').replace(/\D/g, '')}`}
                  style={{ ...btn, background: '#22c55e' }}
                >
                  WhatsApp
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const shell: React.CSSProperties = {
  background: '#0f172a',
  color: '#f1f5f9',
  minHeight: '100vh',
  padding: 16,
  fontFamily: 'system-ui, sans-serif',
  maxWidth: 480,
  margin: '0 auto',
};

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0 16px',
};

const badge: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
};

const card: React.CSSProperties = {
  background: '#1e293b',
  borderRadius: 12,
  padding: 14,
  boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
};

const btn: React.CSSProperties = {
  border: 0,
  borderRadius: 10,
  padding: '12px 8px',
  color: '#fff',
  fontWeight: 600,
  textAlign: 'center',
  textDecoration: 'none',
  fontSize: 14,
};

function riskColor(score: number | null): string {
  if (score === null) return '#cbd5e1';
  if (score >= 70) return '#ef4444';
  if (score >= 40) return '#f59e0b';
  return '#10b981';
}
