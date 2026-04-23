/**
 * Phase 3.5 — seed the FormTemplate marketplace with a small catalog.
 * Idempotent: uses upsert by slug.
 *
 * Run (locally or post-deploy):
 *   pnpm --filter @cashflow-cod/admin exec tsx prisma/seed-templates.ts
 */
import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type TemplateSeed = {
  slug: string;
  name: string;
  category: string;
  region: string | null;
  language: string;
  description: string;
  isFeatured?: boolean;
  schema: Record<string, unknown>;
};

const baseContactFields = [
  { key: 'customerName', label: 'Full name', type: 'text', required: true },
  { key: 'phone', label: 'Phone number', type: 'phone', required: true },
  { key: 'addressLine1', label: 'Address', type: 'text', required: true },
  { key: 'city', label: 'City', type: 'text', required: true },
  { key: 'province', label: 'Province / region', type: 'text', required: false },
];

const TEMPLATES: TemplateSeed[] = [
  {
    slug: 'pk-apparel-standard',
    name: 'Pakistan — Apparel (Standard)',
    category: 'apparel',
    region: 'PK',
    language: 'en',
    description:
      'Sizes, color, qty + shipping address for clothing stores. OTP-required. Mobile-first.',
    isFeatured: true,
    schema: {
      steps: [
        {
          title: 'Your order',
          fields: [
            {
              key: 'size',
              label: 'Size',
              type: 'select',
              required: true,
              options: [
                { value: 'S', label: 'Small' },
                { value: 'M', label: 'Medium' },
                { value: 'L', label: 'Large' },
                { value: 'XL', label: 'Extra large' },
              ],
            },
            {
              key: 'color',
              label: 'Color',
              type: 'select',
              required: true,
              options: [
                { value: 'black', label: 'Black' },
                { value: 'white', label: 'White' },
                { value: 'navy', label: 'Navy' },
              ],
            },
            { key: 'quantity', label: 'Quantity', type: 'number', required: true, min: 1, max: 10 },
          ],
        },
        {
          title: 'Delivery details',
          fields: baseContactFields,
        },
      ],
      requireOtp: true,
      language: 'en',
    },
  },
  {
    slug: 'pk-electronics-standard',
    name: 'Pakistan — Electronics (Standard)',
    category: 'electronics',
    region: 'PK',
    language: 'en',
    description:
      'Higher AOV → partial advance + phone verification. Includes warranty disclosure field.',
    schema: {
      steps: [
        { title: 'Your order', fields: [] },
        { title: 'Delivery details', fields: baseContactFields },
      ],
      requireOtp: true,
      requirePartialAdvance: true,
      language: 'en',
    },
  },
  {
    slug: 'pk-food-bakery',
    name: 'Pakistan — Food & bakery',
    category: 'food',
    region: 'PK',
    language: 'en',
    description:
      'Delivery slot picker + pickup/delivery toggle. Perishable — no reschedule beyond 24h.',
    schema: {
      steps: [
        {
          title: 'Your order',
          fields: [
            {
              key: 'deliverySlot',
              label: 'Delivery slot',
              type: 'select',
              required: true,
              options: [
                { value: 'morning', label: 'Morning (9am–12pm)' },
                { value: 'afternoon', label: 'Afternoon (12pm–4pm)' },
                { value: 'evening', label: 'Evening (4pm–8pm)' },
              ],
            },
          ],
        },
        { title: 'Delivery details', fields: baseContactFields },
      ],
      requireOtp: false,
      language: 'en',
    },
  },
  {
    slug: 'in-apparel-standard',
    name: 'India — Apparel (Standard)',
    category: 'apparel',
    region: 'IN',
    language: 'en',
    description:
      'Pincode + COD partial advance (ShipRocket / Delhivery friendly). Adds GSTIN-optional field.',
    schema: {
      steps: [
        { title: 'Your order', fields: [] },
        {
          title: 'Delivery details',
          fields: [
            ...baseContactFields,
            { key: 'pincode', label: 'Pincode', type: 'text', required: true },
            { key: 'gstin', label: 'GSTIN (optional)', type: 'text', required: false },
          ],
        },
      ],
      requireOtp: true,
      language: 'en',
    },
  },
  {
    slug: 'mena-electronics-ar',
    name: 'MENA — Electronics (Arabic)',
    category: 'electronics',
    region: 'MENA',
    language: 'ar',
    description: 'RTL layout, Arabic copy, WhatsApp OTP, Emirates/Saudi city picker.',
    schema: {
      steps: [
        { title: 'طلبك', fields: [] },
        {
          title: 'تفاصيل التوصيل',
          fields: [
            { key: 'customerName', label: 'الاسم الكامل', type: 'text', required: true },
            { key: 'phone', label: 'رقم الهاتف', type: 'phone', required: true },
            { key: 'addressLine1', label: 'العنوان', type: 'text', required: true },
            { key: 'city', label: 'المدينة', type: 'text', required: true },
          ],
        },
      ],
      requireOtp: true,
      language: 'ar',
      direction: 'rtl',
    },
  },
  {
    slug: 'global-services-booking',
    name: 'Global — Services booking',
    category: 'services',
    region: 'GLOBAL',
    language: 'en',
    description: 'Date + time + notes. Good for salons, cleaning, repair services.',
    schema: {
      steps: [
        {
          title: 'Booking',
          fields: [
            { key: 'bookingDate', label: 'Preferred date', type: 'date', required: true },
            { key: 'bookingTime', label: 'Preferred time', type: 'time', required: true },
            { key: 'notes', label: 'Notes', type: 'textarea', required: false },
          ],
        },
        { title: 'Your details', fields: baseContactFields },
      ],
      requireOtp: false,
      language: 'en',
    },
  },
  {
    slug: 'pk-pharmacy-otc',
    name: 'Pakistan — Pharmacy (OTC)',
    category: 'pharmacy',
    region: 'PK',
    language: 'en',
    description:
      'Compliance disclaimer, prescription-upload toggle, age-verification checkbox.',
    schema: {
      steps: [
        {
          title: 'Your order',
          fields: [
            {
              key: 'ageVerified',
              label: 'I am 18 or older',
              type: 'checkbox',
              required: true,
            },
          ],
        },
        { title: 'Delivery details', fields: baseContactFields },
      ],
      requireOtp: true,
      language: 'en',
    },
  },
];

async function main() {
  for (const t of TEMPLATES) {
    await prisma.formTemplate.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        name: t.name,
        category: t.category,
        region: t.region,
        language: t.language,
        description: t.description,
        isFeatured: t.isFeatured ?? false,
        schema: t.schema as Prisma.InputJsonValue,
      },
      update: {
        name: t.name,
        category: t.category,
        region: t.region,
        language: t.language,
        description: t.description,
        isFeatured: t.isFeatured ?? false,
        schema: t.schema as Prisma.InputJsonValue,
      },
    });
    console.log(`seeded: ${t.slug}`);
  }
  console.log(`Done — ${TEMPLATES.length} templates upserted.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
