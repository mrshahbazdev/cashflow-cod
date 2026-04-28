import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import prisma from '../db.server';
import { postOnlyLoader, preflight, withCors } from '../lib/cors.server';
import { requestOtpForSubmission } from '../lib/otp.server';

export const loader = postOnlyLoader;

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') {
    return withCors(json({ error: 'Method not allowed' }, { status: 405 }));
  }
  let body: { submissionId?: string; channel?: 'SMS' | 'WHATSAPP' | 'EMAIL' | 'VOICE' };
  try {
    body = await request.json();
  } catch {
    return withCors(json({ error: 'Invalid JSON' }, { status: 400 }));
  }
  const { submissionId, channel } = body;
  if (!submissionId) {
    return withCors(json({ error: '`submissionId` required' }, { status: 400 }));
  }
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { form: { include: { shop: true } } },
  });
  if (!submission) return withCors(json({ error: 'Submission not found' }, { status: 404 }));

  try {
    const result = await requestOtpForSubmission({
      shop: submission.form.shop,
      submission,
      channel,
    });
    return withCors(json({ ok: true, ...result }));
  } catch (err) {
    return withCors(
      json(
        { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
        { status: 400 },
      ),
    );
  }
};
