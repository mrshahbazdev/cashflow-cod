/**
 * Phase 4.4 — Public landing-page renderer.
 *
 * URL: /f/:slug — e.g. /f/summer-sale-2026
 *
 * No Shopify admin session: this is a fully public, SEO-friendly HTML page
 * hosted at the app's own domain. Merchants point Facebook/TikTok/Google ads
 * here to bypass the Shopify storefront entirely. The page embeds the normal
 * storefront widget with the linked form's slug.
 */
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import {
  getLandingPageBySlug,
  recordLandingView,
} from '../lib/landing-pages.server';
import { resolvePack, isRtl } from '../lib/i18n.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const slug = params.slug;
  if (!slug) throw new Response('Not found', { status: 404 });
  const page = await getLandingPageBySlug(slug);
  if (!page || !page.isPublished) {
    throw new Response('Landing page not published', { status: 404 });
  }
  void recordLandingView(slug);

  const url = new URL(request.url);
  const lang = url.searchParams.get('lang') ?? page.form.direction === 'rtl' ? 'ur' : 'en';
  const pack = resolvePack(lang);
  const rtl = isRtl(lang);

  const utm = {
    utm_source: url.searchParams.get('utm_source'),
    utm_medium: url.searchParams.get('utm_medium'),
    utm_campaign: url.searchParams.get('utm_campaign'),
    utm_term: url.searchParams.get('utm_term'),
    utm_content: url.searchParams.get('utm_content'),
  };

  return json({
    page,
    lang,
    rtl,
    pack,
    utm,
    shopDomain: page.shop?.domain ?? '',
  });
};

export default function LandingPage() {
  const { page, rtl, pack, utm, shopDomain } = useLoaderData<typeof loader>();
  const theme = (page.theme ?? {}) as {
    backgroundColor?: string;
    textColor?: string;
    accentColor?: string;
  };
  const bg = theme.backgroundColor ?? '#ffffff';
  const fg = theme.textColor ?? '#111827';
  const accent = theme.accentColor ?? '#10b981';

  return (
    <html lang="en" dir={rtl ? 'rtl' : 'ltr'}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{page.title}</title>
        {page.headline ? <meta name="description" content={page.headline} /> : null}
        <style>{`
          *{box-sizing:border-box}
          body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:${bg};color:${fg};line-height:1.5}
          .hero{max-width:720px;margin:0 auto;padding:48px 20px;text-align:center}
          .hero h1{font-size:2.25rem;margin:0 0 12px}
          .hero p.sub{font-size:1.125rem;color:${fg};opacity:.8;margin:0 0 24px}
          .hero img{max-width:100%;border-radius:8px;margin-bottom:24px}
          .body{max-width:720px;margin:0 auto;padding:0 20px 24px}
          .cta{max-width:480px;margin:0 auto;padding:24px 20px}
          .cta button{background:${accent};color:#fff;border:none;padding:14px 28px;font-size:1rem;border-radius:6px;cursor:pointer;width:100%}
        `}</style>
      </head>
      <body>
        <div className="hero">
          {page.heroImage ? <img src={page.heroImage} alt="" /> : null}
          <h1>{page.headline ?? page.title}</h1>
          {page.subheadline ? <p className="sub">{page.subheadline}</p> : null}
        </div>
        {page.bodyHtml ? (
          <div className="body" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
        ) : null}
        <div className="cta">
          <div
            id="cashflow-cod-form"
            data-shop={shopDomain}
            data-form={page.form.slug}
            data-utm-source={utm.utm_source ?? ''}
            data-utm-medium={utm.utm_medium ?? ''}
            data-utm-campaign={utm.utm_campaign ?? ''}
            data-landing-slug={page.slug}
          />
          <noscript>
            <p>{pack['error.required'] ?? 'Please enable JavaScript to continue.'}</p>
          </noscript>
          <script
            async
            src="/public/widget.js"
            data-cashflow-cod-widget="true"
          />
        </div>
      </body>
    </html>
  );
}
