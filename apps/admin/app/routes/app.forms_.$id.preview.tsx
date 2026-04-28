import { useEffect, useRef } from 'react';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { BlockStack, Card, InlineStack, Layout, Page, Text } from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import { getForm } from '../lib/forms.server';
import { formSchema, type FormSchema } from '@cashflow-cod/form-schema';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*script\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

function scopeCss(css: string, scopeSelector: string): string {
  if (!css) return '';
  const clean = css
    .replace(/@import[^;]+;?/gi, '')
    .replace(/url\(\s*javascript:[^)]*\)/gi, 'url(about:blank)');
  const blocks = clean.split('}');
  let out = '';
  for (const block of blocks) {
    const braceIdx = block.indexOf('{');
    if (braceIdx === -1) {
      out += block;
      continue;
    }
    const selector = block.slice(0, braceIdx).trim();
    const body = block.slice(braceIdx);
    if (!selector || selector.charAt(0) === '@') {
      out += selector + body + '}';
      continue;
    }
    const scoped = selector
      .split(',')
      .map((s) => {
        const t = s.trim();
        if (!t) return '';
        if (t.startsWith(scopeSelector)) return t;
        return `${scopeSelector} ${t}`;
      })
      .filter(Boolean)
      .join(', ');
    out += scoped + body + '}';
  }
  return out;
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const id = params.id ?? '';
  const form = await getForm(shop.id, id);
  if (!form) throw new Response('Form not found', { status: 404 });
  const parsed = formSchema.safeParse(form.schema);
  const schema: FormSchema | null = parsed.success ? parsed.data : null;
  return json({ id, name: form.name, slug: form.slug, schema });
};

function fieldHtml(field: FormSchema['steps'][number]['fields'][number]): string {
  const id = `cod_${field.key}`;
  const label = escapeHtml(field.label || field.key);
  const placeholder = escapeHtml(field.placeholder ?? '');
  const required = field.validation?.required ? ' *' : '';
  const widthClass = `cashflow-cod-col-${field.width || 'full'}`;
  const labelTag = `<label class="cashflow-cod-label" for="${id}">${label}<span class="cashflow-cod-required">${required}</span></label>`;
  let input = '';
  if (field.type === 'textarea') {
    input = `<textarea id="${id}" placeholder="${placeholder}" rows="3"></textarea>`;
  } else if (field.type === 'select' || field.type === 'country') {
    const opts = (field.options ?? [])
      .map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`)
      .join('');
    input = `<select id="${id}"><option value="">${placeholder || 'Select…'}</option>${opts}</select>`;
  } else if (field.type === 'checkbox') {
    return `<div class="cashflow-cod-field ${widthClass}"><label class="cashflow-cod-checkbox"><input type="checkbox" /><span>${label}</span></label></div>`;
  } else if (field.type === 'divider') {
    return `<hr class="cashflow-cod-divider" />`;
  } else if (field.type === 'html') {
    return `<div class="cashflow-cod-html">${sanitizeHtml(field.label ?? '')}</div>`;
  } else if (field.type === 'hidden') {
    return '';
  } else {
    const inputType = field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text';
    input = `<input id="${id}" type="${inputType}" placeholder="${placeholder}" />`;
  }
  return `<div class="cashflow-cod-field ${widthClass}">${labelTag}${input}</div>`;
}

function buildPreviewHtml(schema: FormSchema): string {
  const scopedCss = schema.customCss ? scopeCss(schema.customCss, '.cashflow-cod-widget') : '';
  const header = schema.customHtmlHeader
    ? `<div class="cashflow-cod-custom-header">${sanitizeHtml(schema.customHtmlHeader)}</div>`
    : '';
  const footer = schema.customHtmlFooter
    ? `<div class="cashflow-cod-custom-footer">${sanitizeHtml(schema.customHtmlFooter)}</div>`
    : '';
  const fieldsHtml = schema.steps
    .flatMap((s) => s.fields)
    .map(fieldHtml)
    .join('');
  const subtitle = schema.subtitle
    ? `<p class="cashflow-cod-subtitle">${escapeHtml(schema.subtitle)}</p>`
    : '';
  const legal = schema.legalText
    ? `<p class="cashflow-cod-legal">${escapeHtml(schema.legalText)}</p>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: #f6f6f7; }
  .cashflow-cod-preview-wrap { max-width: 520px; margin: 0 auto; padding: 16px; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #202223; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
  .cashflow-cod-widget { background: #fff; padding: 24px; border-radius: 12px; border: 1px solid #e1e3e5; }
  .cashflow-cod-title { margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #202223; }
  .cashflow-cod-subtitle { margin: 0 0 16px; color: #6d7175; font-size: 14px; }
  .cashflow-cod-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .cashflow-cod-col-full { grid-column: 1 / -1; }
  .cashflow-cod-col-half { grid-column: span 1; }
  .cashflow-cod-col-third { grid-column: span 1; }
  .cashflow-cod-field { display: flex; flex-direction: column; }
  .cashflow-cod-label { font-size: 13px; margin-bottom: 4px; color: #202223; font-weight: 500; }
  .cashflow-cod-required { color: #d72c0d; }
  .cashflow-cod-checkbox { display: inline-flex; align-items: center; gap: 8px; padding: 8px 0; font-size: 14px; }
  .cashflow-cod-divider { border: none; border-top: 1px solid #e1e3e5; margin: 8px 0; }
  .cashflow-cod-html { font-size: 14px; color: #6d7175; }
  .cashflow-cod-field input, .cashflow-cod-field select, .cashflow-cod-field textarea {
    padding: 10px 12px; border: 1px solid #c9cccf; border-radius: 8px; font: inherit; font-size: 14px; color: #202223; background: #fff;
  }
  .cashflow-cod-field input:focus, .cashflow-cod-field select:focus, .cashflow-cod-field textarea:focus {
    outline: none; border-color: #008060; box-shadow: 0 0 0 2px rgba(0, 128, 96, 0.15);
  }
  .cashflow-cod-submit {
    margin-top: 16px; width: 100%; padding: 12px; border: 0; border-radius: 8px;
    background: #008060; color: #fff; font-weight: 600; font-size: 15px; cursor: pointer;
  }
  .cashflow-cod-submit:hover { filter: brightness(1.06); }
  .cashflow-cod-legal { color: #6d7175; font-size: 12px; margin-top: 12px; line-height: 1.5; }
  ${scopedCss}
</style>
</head>
<body>
<div class="cashflow-cod-preview-wrap">
  <div class="cashflow-cod-widget">
    ${header}
    <h2 class="cashflow-cod-title">${escapeHtml(schema.title)}</h2>
    ${subtitle}
    <div class="cashflow-cod-grid">${fieldsHtml}</div>
    <button type="button" class="cashflow-cod-submit">${escapeHtml(schema.submitLabel)}</button>
    ${legal}
    ${footer}
  </div>
</div>
</body>
</html>`;
}

export default function FormPreviewRoute() {
  const data = useLoaderData<typeof loader>();
  const html = data.schema ? buildPreviewHtml(data.schema) : '';
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current && html) {
      iframeRef.current.srcdoc = html;
    }
  }, [html]);

  return (
    <Page
      title={`Preview: ${data.name}`}
      backAction={{ content: 'Back to form', url: `/app/forms/${data.id}` }}
      primaryAction={{ content: 'Edit form', url: `/app/forms/${data.id}` }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <InlineStack gap="200">
                <Text as="p" tone="subdued">
                  Storefront preview &mdash; reflects custom CSS / HTML in real time.
                </Text>
              </InlineStack>
              {data.schema ? (
                <iframe
                  ref={iframeRef}
                  title="Form preview"
                  style={{
                    width: '100%',
                    minHeight: 720,
                    border: '1px solid #e1e3e5',
                    borderRadius: 12,
                    background: '#f6f6f7',
                  }}
                />
              ) : (
                <Text as="p" tone="critical">
                  Form schema is invalid. Open the editor and re-save.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
