import type { LoaderFunctionArgs } from '@remix-run/node';
import prisma from '../db.server';
import { corsHeaders, handleOptions } from '../lib/cors.server';

/** Public lookup: given a recovery token, return the stored partialData to pre-fill the form. */
export async function loader({ request, params }: LoaderFunctionArgs) {
  if (request.method === 'OPTIONS') return handleOptions(request);
  const url = new URL(request.url);
  const token = url.searchParams.get('t');
  const slug = params.formSlug;
  if (!token || !slug) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing params' }), {
      status: 400,
      headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
    });
  }
  const abandoned = await prisma.abandonedForm.findUnique({
    where: { recoveryToken: token },
    include: { form: { select: { slug: true, shopId: true } } },
  });
  if (!abandoned || abandoned.form.slug !== slug) {
    return new Response(JSON.stringify({ ok: false, error: 'Recovery token not found' }), {
      status: 404,
      headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
    });
  }
  return new Response(
    JSON.stringify({ ok: true, partialData: abandoned.partialData ?? {} }),
    {
      status: 200,
      headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
    },
  );
}
