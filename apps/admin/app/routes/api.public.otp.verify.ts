import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { formSchema } from '@cashflow-cod/form-schema';
import prisma from '../db.server';
import { preflight, withCors } from '../lib/cors.server';
import { verifyOtpForSubmission } from '../lib/otp.server';
import { createDraftOrderForSubmission } from '../lib/shopify-orders.server';
import { contextFromOrder, firePixelsForShop } from '../lib/pixels.server';

export const loader = async () => withCors(json({ error: 'Method not allowed' }, { status: 405 }));

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') {
    return withCors(json({ error: 'Method not allowed' }, { status: 405 }));
  }

  let body: {
    submissionId?: string;
    code?: string;
    productId?: string;
    variantId?: string;
    tracking?: {
      fbp?: string;
      fbc?: string;
      ttclid?: string;
      ttp?: string;
      scClickId?: string;
      epik?: string;
      sourceUrl?: string;
    };
  };
  try {
    body = await request.json();
  } catch {
    return withCors(json({ error: 'Invalid JSON' }, { status: 400 }));
  }
  const { submissionId, code, productId, variantId } = body;
  if (!submissionId || !code) {
    return withCors(json({ error: '`submissionId` and `code` required' }, { status: 400 }));
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { form: { include: { shop: true } } },
  });
  if (!submission) return withCors(json({ error: 'Submission not found' }, { status: 404 }));
  if (!submission.requiresOtp) {
    return withCors(json({ ok: true, message: 'OTP not required for this submission' }));
  }

  const result = await verifyOtpForSubmission(submissionId, code);
  if (!result.ok) {
    return withCors(json({ ok: false, error: result.reason }, { status: 400 }));
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: 'VERIFIED' },
  });

  const parsed = formSchema.safeParse(submission.form.schema);
  if (!parsed.success) {
    return withCors(json({ ok: false, error: 'Form schema invalid' }, { status: 500 }));
  }

  try {
    const order = await createDraftOrderForSubmission({
      shop: submission.form.shop,
      form: submission.form,
      submission,
      data: (submission.fields as Record<string, unknown>) ?? {},
      productId: productId ?? null,
      variantId: variantId ?? null,
    });
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'CONVERTED' },
    });
    const xff = request.headers.get('x-forwarded-for') ?? '';
    const ip = xff.split(',')[0]?.trim() || null;
    void firePixelsForShop({
      shopId: submission.form.shopId,
      event: 'Purchase',
      ctx: contextFromOrder({
        order,
        form: submission.form,
        submission,
        client: {
          ...(body.tracking ?? {}),
          ip,
          userAgent: request.headers.get('user-agent'),
          sourceUrl: body.tracking?.sourceUrl ?? `https://${submission.form.shop.domain}/`,
        },
        productId: productId ?? null,
        variantId: variantId ?? null,
      }),
    });
    return withCors(
      json({
        ok: true,
        orderId: order.id,
        message: 'Verification successful. Your order has been placed.',
      }),
    );
  } catch (err) {
    return withCors(
      json(
        {
          ok: false,
          error: `Verified, but could not place order: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`,
        },
        { status: 400 },
      ),
    );
  }
};
