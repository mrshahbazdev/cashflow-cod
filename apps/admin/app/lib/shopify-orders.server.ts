import type { Form, Shop, Submission } from '@prisma/client';
import type { Field, FormSchema } from '@cashflow-cod/form-schema';
import prisma from '../db.server';
import { unauthenticated } from '../shopify.server';

type CreateDraftArgs = {
  shop: Shop;
  form: Form;
  submission: Submission;
  data: Record<string, unknown>;
  productId: string | null;
  variantId: string | null;
  /**
   * Pre-validated discount summary (see `lib/discounts.server.ts`).
   * When supplied we forward it as a Shopify `appliedDiscount` and persist
   * the savings amount on the resulting Order row.
   */
  discount?: {
    id: string;
    code: string;
    type: string;
    amount: number;
    freeShipping: boolean;
  } | null;
  /**
   * Optional flat savings produced by the QuantityOffer ladder. Applied as a
   * second `appliedDiscount` line so merchants see both reasons in Shopify.
   */
  quantityDiscount?: { description: string; amount: number } | null;
  items?: Array<{
    productId: string;
    variantId: string;
    quantity: number;
    title?: string;
    price?: number;
  }>;
};

const DRAFT_ORDER_CREATE = `
  mutation DraftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        invoiceUrl
        order { id legacyResourceId name }
      }
      userErrors { field message }
    }
  }
`;

const DRAFT_ORDER_COMPLETE = `
  mutation DraftOrderComplete($id: ID!, $paymentPending: Boolean) {
    draftOrderComplete(id: $id, paymentPending: $paymentPending) {
      draftOrder {
        id
        order { id legacyResourceId name }
      }
      userErrors { field message }
    }
  }
`;

export async function createDraftOrderForSubmission(args: CreateDraftArgs) {
  const { shop, form, submission, data, variantId, discount, quantityDiscount } = args;

  const { admin } = await unauthenticated.admin(shop.domain);

  // Probe: does this offline token work for ANY admin GraphQL call? If the
  // token itself is broken (uninstall/reinstall race, revoked, expired etc.)
  // every mutation will 403 — including ones that don't touch protected
  // customer data. Surfacing the probe result first lets us tell that
  // failure mode apart from a Protected-Customer-Data refusal.
  try {
    const probe = await admin.graphql(
      'query CashflowCodTokenProbe { shop { name myshopifyDomain } }',
    );
    const probeJson = (await probe.json()) as {
      data?: { shop?: { name?: string; myshopifyDomain?: string } };
      errors?: Array<{ message: string }>;
    };
    // eslint-disable-next-line no-console
    console.warn(
      `[Cashflow COD] token probe for ${shop.domain}: ` +
        `name=${probeJson.data?.shop?.name ?? 'unknown'} ` +
        `errors=${JSON.stringify(probeJson.errors ?? [])}`,
    );
  } catch (probeErr) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Cashflow COD] token probe THREW for ${shop.domain}: ` +
        (probeErr instanceof Error ? probeErr.message : String(probeErr)),
    );
  }

  const schema = form.schema as unknown as FormSchema;
  const fields: Field[] = schema?.steps?.flatMap((s) => s.fields) ?? [];
  const byType = (t: string) => fields.find((f) => f.type === t);

  const name = (data[byType('text')?.key ?? 'name'] as string) || '';
  const [firstName, ...rest] = name.trim().split(/\s+/);
  const lastName = rest.join(' ');
  const phone = (data[byType('phone')?.key ?? 'phone'] as string) || undefined;
  const email = (data[byType('email')?.key ?? 'email'] as string) || undefined;
  const addressLine1 = (data[byType('address')?.key ?? 'address'] as string) || undefined;
  const city = (data[byType('city')?.key ?? 'city'] as string) || undefined;
  const postalCode = (data[byType('postal_code')?.key ?? 'postal_code'] as string) || undefined;
  const country = (data[byType('country')?.key ?? 'country'] as string) || undefined;

  let lineItems;
  if (args.items && args.items.length > 0) {
    lineItems = args.items.map((item) => ({
      variantId: toGid('ProductVariant', item.variantId),
      quantity: item.quantity,
    }));
  } else if (variantId) {
    lineItems = [{ variantId: toGid('ProductVariant', variantId), quantity: 1 }];
  } else {
    lineItems = [
      {
        title: form.name || 'Cash on Delivery order',
        quantity: 1,
        originalUnitPriceWithCurrency: {
          amount: '0.00',
          currencyCode: shop.settings
            ? ((shop.settings as Record<string, unknown>).currency as string) || 'USD'
            : 'USD',
        },
      },
    ];
  }

  const shippingAddress =
    addressLine1 || city
      ? {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          address1: addressLine1,
          city,
          zip: postalCode,
          country: country || undefined,
          phone,
        }
      : undefined;

  const tags = ['cashflow-cod', `form:${form.slug}`];
  if (discount) tags.push(`discount:${discount.code}`);

  const customAttributes = Object.entries(data)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim().length > 0)
    .map(([k, v]) => ({ key: `cod.${k}`, value: String(v) }))
    .slice(0, 20);

  // Prefer the code-based discount; fall back to the quantity ladder if present.
  // Shopify only accepts a single appliedDiscount per draft order, so we pick
  // the larger of the two to surface the bigger saving.
  let appliedDiscount: Record<string, unknown> | undefined;
  const discountAmount = discount && discount.type !== 'free_shipping' ? discount.amount : 0;
  const qtyAmount = quantityDiscount?.amount ?? 0;
  if (discountAmount >= qtyAmount && discount && discount.type !== 'free_shipping') {
    appliedDiscount = {
      title: `Discount ${discount.code}`,
      description: `Code ${discount.code}`,
      value: discount.amount,
      valueType: 'FIXED_AMOUNT',
    };
  } else if (qtyAmount > 0 && quantityDiscount) {
    appliedDiscount = {
      title: 'Quantity discount',
      description: quantityDiscount.description,
      value: quantityDiscount.amount,
      valueType: 'FIXED_AMOUNT',
    };
  }

  // Build the customer summary as protected key/value pairs so the merchant
  // can still fulfil orders even on shops that have not granted Protected
  // Customer Data Access. Shopify rejects shippingAddress / firstName /
  // email / phone fields with a top-level 403 on those shops, but custom
  // attributes are unrestricted and surface in the draft-order detail view.
  const merchantSummaryAttrs: Array<{ key: string; value: string }> = [];
  if (name) merchantSummaryAttrs.push({ key: '_cashflow_customer', value: name });
  if (phone) merchantSummaryAttrs.push({ key: '_cashflow_phone', value: phone });
  if (email) merchantSummaryAttrs.push({ key: '_cashflow_email', value: email });
  const summaryAddress = [addressLine1, city, postalCode, country].filter(Boolean).join(', ');
  if (summaryAddress)
    merchantSummaryAttrs.push({ key: '_cashflow_address', value: summaryAddress });

  const input: Record<string, unknown> = {
    email,
    phone,
    note: `Placed via Cashflow COD form "${form.name}" (submission ${submission.id})`,
    tags,
    lineItems,
    shippingAddress,
    customAttributes,
  };
  if (appliedDiscount) input.appliedDiscount = appliedDiscount;

  // Same payload but stripped of every Shopify-classified Protected Customer
  // Data field. Used as a fallback when the first attempt is rejected with
  // a 403 — merchant still gets a draft order, customer PII is preserved
  // in customAttributes (and in our admin DB) for fulfilment.
  const inputWithoutProtected: Record<string, unknown> = {
    note: `Placed via Cashflow COD form "${form.name}" (submission ${submission.id}). Customer details available in Cashflow COD admin.`,
    tags: [...tags, 'cashflow-no-pii'],
    lineItems,
    customAttributes: [...customAttributes, ...merchantSummaryAttrs].slice(0, 25),
  };
  if (appliedDiscount) inputWithoutProtected.appliedDiscount = appliedDiscount;

  let response: Response;
  let usedFallback = false;
  try {
    response = await admin.graphql(DRAFT_ORDER_CREATE, { variables: { input } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/403\s*Forbidden|GraphQL Client:\s*Forbidden/i.test(msg)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[Cashflow COD] draftOrderCreate 403 for ${shop.domain} — retrying without ` +
          `protected customer fields (PII goes into customAttributes instead).`,
      );
      response = await admin.graphql(DRAFT_ORDER_CREATE, {
        variables: { input: inputWithoutProtected },
      });
      usedFallback = true;
    } else {
      throw err;
    }
  }
  const payload = (await response.json()) as {
    data?: {
      draftOrderCreate: {
        draftOrder: { id: string; invoiceUrl: string | null } | null;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    };
  };
  const errs = payload.data?.draftOrderCreate.userErrors ?? [];
  if (errs.length > 0) {
    throw new Error(errs.map((e) => `${e.field?.join('.')}: ${e.message}`).join('; '));
  }
  const draft = payload.data?.draftOrderCreate.draftOrder;
  if (!draft) throw new Error('Draft order creation returned no data');
  if (usedFallback) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Cashflow COD] draftOrderCreate fallback succeeded for ${shop.domain}, ` +
        `draft id=${draft.id}.`,
    );
  }

  const completeResp = await admin.graphql(DRAFT_ORDER_COMPLETE, {
    variables: { id: draft.id, paymentPending: true },
  });
  const completePayload = (await completeResp.json()) as {
    data?: {
      draftOrderComplete: {
        draftOrder: {
          id: string;
          order: { id: string; legacyResourceId: string; name: string } | null;
        } | null;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    };
  };
  const completeErrs = completePayload.data?.draftOrderComplete.userErrors ?? [];
  if (completeErrs.length > 0) {
    throw new Error(completeErrs.map((e) => `${e.field?.join('.')}: ${e.message}`).join('; '));
  }
  const order = completePayload.data?.draftOrderComplete.draftOrder?.order;

  const subtotal = 0;
  const currency = ((shop.settings as Record<string, unknown> | null)?.currency as string) || null;

  const shopRecord = await prisma.shop.findUnique({ where: { domain: shop.domain } });
  if (!shopRecord) throw new Error('Shop record missing');

  return prisma.order.create({
    data: {
      shopId: shopRecord.id,
      formId: form.id,
      submissionId: submission.id,
      shopifyOrderGid: order?.id ?? draft.id,
      shopifyOrderId: order?.legacyResourceId ?? null,
      phone: phone ?? null,
      phoneNormalized: phone ? phone.replace(/[^\d+]/g, '') : null,
      email: email?.toLowerCase() ?? null,
      customerName: [firstName, lastName].filter(Boolean).join(' ') || null,
      addressLine1: addressLine1 ?? null,
      city: city ?? null,
      postalCode: postalCode ?? null,
      country: country ?? null,
      lineItems: lineItems as unknown as object,
      subtotal,
      total: subtotal,
      currency,
      disposition: 'NEW',
    },
  });
}

function toGid(resource: string, id: string): string {
  if (id.startsWith('gid://')) return id;
  return `gid://shopify/${resource}/${id}`;
}
