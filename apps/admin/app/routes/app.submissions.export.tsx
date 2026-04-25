import type { LoaderFunctionArgs } from '@remix-run/node';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';

const COLUMNS = [
  'id',
  'createdAt',
  'formId',
  'formName',
  'formSlug',
  'status',
  'phone',
  'email',
  'country',
  'riskScore',
  'abVariant',
  'orderId',
  'orderTotal',
  'orderCurrency',
  'disposition',
  'name',
  'address',
  'city',
  'postal_code',
] as const;

function csvField(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });

  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('range') ?? '90')));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const formId = url.searchParams.get('formId') || undefined;

  const submissions = await prisma.submission.findMany({
    where: {
      form: { shopId: shop.id, ...(formId ? { id: formId } : {}) },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 10000,
    select: {
      id: true,
      createdAt: true,
      formId: true,
      status: true,
      phone: true,
      email: true,
      country: true,
      riskScore: true,
      abVariant: true,
      fields: true,
      form: { select: { name: true, slug: true } },
      order: {
        select: {
          id: true,
          total: true,
          currency: true,
          disposition: true,
        },
      },
    },
  });

  const lines: string[] = [COLUMNS.join(',')];
  for (const s of submissions) {
    const fields = (s.fields as Record<string, unknown> | null) ?? {};
    const row = [
      s.id,
      s.createdAt.toISOString(),
      s.formId,
      s.form?.name ?? '',
      s.form?.slug ?? '',
      s.status,
      s.phone ?? '',
      s.email ?? '',
      s.country ?? '',
      s.riskScore ?? '',
      s.abVariant ?? '',
      s.order?.id ?? '',
      s.order?.total != null ? String(s.order.total) : '',
      s.order?.currency ?? '',
      s.order?.disposition ?? '',
      fields['name'] ?? fields['full_name'] ?? '',
      fields['address'] ?? '',
      fields['city'] ?? '',
      fields['postal_code'] ?? '',
    ].map(csvField);
    lines.push(row.join(','));
  }

  // Prepend a UTF-8 BOM so Excel renders non-ASCII characters correctly.
  const body = '\uFEFF' + lines.join('\r\n') + '\r\n';
  const filename = `cashflow-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
};
