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

  const lineItems = variantId
    ? [{ variantId: toGid('ProductVariant', variantId), quantity: 1 }]
    : [
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

  const response = await admin.graphql(DRAFT_ORDER_CREATE, { variables: { input } });
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
