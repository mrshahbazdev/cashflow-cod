/**
 * Curated catalog of default COD form templates seeded on first list.
 *
 * Each template here is a complete `FormSchema` plus catalog metadata. The
 * library is conservative: if a slug already exists in the DB we never
 * overwrite it, so merchants can hand-edit a seeded template without losing
 * their changes on the next deploy.
 */
import type { Prisma } from '@prisma/client';
import type { FormSchema } from '@cashflow-cod/form-schema';
import prisma from '../db.server';

interface DefaultTemplate {
  slug: string;
  name: string;
  category: 'apparel' | 'electronics' | 'food' | 'services' | 'pharmacy' | 'general';
  region?: 'PK' | 'IN' | 'MENA' | 'EU' | 'SEA' | 'GLOBAL';
  language: string;
  description: string;
  isFeatured?: boolean;
  schema: FormSchema;
}

const fNameRequired = {
  id: 'f-name',
  key: 'name',
  type: 'text' as const,
  label: 'Full name',
  placeholder: 'Your full name',
  validation: { required: true, minLength: 2 },
  width: 'full' as const,
};
const fPhoneRequired = {
  id: 'f-phone',
  key: 'phone',
  type: 'phone' as const,
  label: 'Phone number',
  placeholder: '03xx-xxxxxxx',
  validation: { required: true },
  width: 'full' as const,
};
const fAddress = {
  id: 'f-address',
  key: 'address',
  type: 'address' as const,
  label: 'Delivery address',
  placeholder: 'Street, building, area',
  validation: { required: true },
  width: 'full' as const,
};
const fCity = {
  id: 'f-city',
  key: 'city',
  type: 'city' as const,
  label: 'City',
  validation: { required: true },
  width: 'half' as const,
};
const fPostal = {
  id: 'f-postal',
  key: 'postal_code',
  type: 'postal_code' as const,
  label: 'Postal code',
  width: 'half' as const,
};
const fCountry = {
  id: 'f-country',
  key: 'country',
  type: 'country' as const,
  label: 'Country',
  validation: { required: true },
  width: 'full' as const,
};
const fEmail = {
  id: 'f-email',
  key: 'email',
  type: 'email' as const,
  label: 'Email (optional)',
  placeholder: 'you@example.com',
  width: 'full' as const,
};
const fNotes = {
  id: 'f-notes',
  key: 'notes',
  type: 'textarea' as const,
  label: 'Order notes (optional)',
  width: 'full' as const,
};

const DEFAULTS: DefaultTemplate[] = [
  {
    slug: 'cod-classic-single-step',
    name: 'Classic single-step COD',
    category: 'general',
    region: 'GLOBAL',
    language: 'en',
    description:
      'A clean, single-step COD form with name, phone, address, city, postal code. Best general-purpose default.',
    isFeatured: true,
    schema: {
      version: 1,
      title: 'Cash on Delivery',
      subtitle: 'Pay when your order arrives.',
      submitLabel: 'Place order',
      layout: 'single',
      trustBadges: ['Cash on Delivery', '7-day returns', 'Free shipping'],
      legalText: 'By placing this order you agree to our terms.',
      steps: [
        {
          id: 'step-1',
          fields: [fNameRequired, fPhoneRequired, fAddress, fCity, fPostal],
        },
      ],
    },
  },
  {
    slug: 'cod-multi-step-trust',
    name: 'Multi-step with trust badges',
    category: 'general',
    region: 'GLOBAL',
    language: 'en',
    description:
      'Two-step flow: contact info first, address second. Reduces drop-off on long forms.',
    isFeatured: true,
    schema: {
      version: 1,
      title: 'Order on delivery',
      subtitle: 'It only takes 30 seconds.',
      submitLabel: 'Confirm order',
      layout: 'multi_step',
      trustBadges: ['Cash on Delivery', 'Easy returns', 'Verified store'],
      legalText: 'No prepayment required.',
      steps: [
        {
          id: 'step-contact',
          title: 'Contact',
          fields: [fNameRequired, fPhoneRequired, fEmail],
        },
        {
          id: 'step-address',
          title: 'Delivery',
          fields: [fAddress, fCity, fPostal, fNotes],
        },
      ],
    },
  },
  {
    slug: 'cod-quantity-offer',
    name: 'Quantity-offer (1 / 2 / 3 ladder)',
    category: 'apparel',
    region: 'GLOBAL',
    language: 'en',
    description:
      'Single-step COD form with a quantity selector and built-in volume-discount messaging in the legal slot.',
    isFeatured: true,
    schema: {
      version: 1,
      title: 'Buy now — Cash on Delivery',
      subtitle: 'Buy more, save more.',
      submitLabel: 'Place order',
      layout: 'single',
      trustBadges: ['Buy 2 get 10% off', 'Buy 3 get 20% off'],
      legalText: 'Discounts auto-apply at checkout.',
      steps: [
        {
          id: 'step-1',
          fields: [
            {
              id: 'f-quantity',
              key: 'quantity',
              type: 'select',
              label: 'Quantity',
              options: [
                { value: '1', label: '1 piece' },
                { value: '2', label: '2 pieces (-10%)' },
                { value: '3', label: '3 pieces (-20%)' },
              ],
              validation: { required: true },
              width: 'full',
            },
            fNameRequired,
            fPhoneRequired,
            fAddress,
            fCity,
            fPostal,
          ],
        },
      ],
    },
  },
  {
    slug: 'cod-pakistan-urdu',
    name: 'Pakistan COD (Urdu UI)',
    category: 'general',
    region: 'PK',
    language: 'ur',
    description:
      'Localized for Pakistan: Urdu labels, address-first layout, optional landline field, courier-friendly postal code.',
    isFeatured: true,
    schema: {
      version: 1,
      title: 'کیش آن ڈیلیوری',
      subtitle: 'آرڈر گھر پر آنے پر ادائیگی',
      submitLabel: 'آرڈر پلیس کریں',
      layout: 'single',
      trustBadges: ['7 دن ریٹرن', 'مفت شپنگ'],
      legalText: 'آرڈر کرنے سے آپ ہماری شرائط سے متفق ہیں۔',
      steps: [
        {
          id: 'step-1',
          fields: [
            { ...fNameRequired, label: 'پورا نام' },
            { ...fPhoneRequired, label: 'موبائل نمبر', placeholder: '03xx xxxxxxx' },
            { ...fAddress, label: 'ڈیلیوری ایڈریس' },
            { ...fCity, label: 'شہر' },
            { ...fPostal, label: 'پوسٹل کوڈ' },
          ],
        },
      ],
    },
  },
  {
    slug: 'cod-india-multi-language',
    name: 'India COD (English / Hindi)',
    category: 'general',
    region: 'IN',
    language: 'en',
    description:
      'India-specific defaults: pincode validation, state field, optional landmark line. Works for tier-2/3 audiences.',
    isFeatured: false,
    schema: {
      version: 1,
      title: 'Order with Cash on Delivery',
      subtitle: 'Pay at your doorstep.',
      submitLabel: 'Place order',
      layout: 'single',
      trustBadges: ['7-day returns', 'Free shipping'],
      legalText: '',
      steps: [
        {
          id: 'step-1',
          fields: [
            fNameRequired,
            fPhoneRequired,
            fAddress,
            {
              id: 'f-landmark',
              key: 'landmark',
              type: 'text',
              label: 'Landmark (optional)',
              width: 'full',
            },
            fCity,
            {
              id: 'f-state',
              key: 'state',
              type: 'select',
              label: 'State',
              options: [
                'Andhra Pradesh',
                'Delhi',
                'Gujarat',
                'Karnataka',
                'Kerala',
                'Maharashtra',
                'Punjab',
                'Tamil Nadu',
                'Telangana',
                'Uttar Pradesh',
                'West Bengal',
              ].map((s) => ({ value: s, label: s })),
              validation: { required: true },
              width: 'half',
            },
            { ...fPostal, label: 'Pincode', validation: { required: true, pattern: '^\\d{6}$' } },
          ],
        },
      ],
    },
  },
  {
    slug: 'cod-mena-arabic',
    name: 'MENA COD (Arabic UI)',
    category: 'general',
    region: 'MENA',
    language: 'ar',
    description:
      'Right-to-left Arabic layout for the GCC. Country selector defaults to UAE, Saudi, Egypt, Kuwait.',
    isFeatured: false,
    schema: {
      version: 1,
      title: 'الدفع عند الاستلام',
      subtitle: 'ادفع عند تسليم الطلب.',
      submitLabel: 'تأكيد الطلب',
      layout: 'single',
      trustBadges: ['شحن مجاني', 'إرجاع خلال 7 أيام'],
      legalText: '',
      steps: [
        {
          id: 'step-1',
          fields: [
            { ...fNameRequired, label: 'الاسم الكامل' },
            { ...fPhoneRequired, label: 'رقم الهاتف' },
            { ...fAddress, label: 'عنوان التوصيل' },
            { ...fCity, label: 'المدينة' },
            {
              ...fCountry,
              label: 'الدولة',
              options: [
                { value: 'AE', label: 'الإمارات' },
                { value: 'SA', label: 'السعودية' },
                { value: 'EG', label: 'مصر' },
                { value: 'KW', label: 'الكويت' },
                { value: 'QA', label: 'قطر' },
                { value: 'BH', label: 'البحرين' },
                { value: 'OM', label: 'عُمان' },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    slug: 'cod-lead-capture-callback',
    name: 'Lead capture (call-me-back)',
    category: 'services',
    region: 'GLOBAL',
    language: 'en',
    description:
      'Minimal 2-field form for high-ticket items: name + phone. Use when you confirm orders by phone before booking the courier.',
    isFeatured: true,
    schema: {
      version: 1,
      title: "Don't miss out — request a callback",
      subtitle: 'We will confirm details by phone before booking.',
      submitLabel: 'Call me back',
      layout: 'single',
      trustBadges: ['Free callback', 'No prepayment'],
      legalText: '',
      steps: [
        {
          id: 'step-1',
          fields: [fNameRequired, fPhoneRequired, fNotes],
        },
      ],
    },
  },
  {
    slug: 'cod-pharmacy-prescription',
    name: 'Pharmacy COD (with prescription)',
    category: 'pharmacy',
    region: 'GLOBAL',
    language: 'en',
    description: 'COD form with prescription-required toggle and pharmacist verification note.',
    isFeatured: false,
    schema: {
      version: 1,
      title: 'Order medicine — Cash on Delivery',
      subtitle: 'A pharmacist will verify your prescription before dispatch.',
      submitLabel: 'Place order',
      layout: 'single',
      trustBadges: ['Verified pharmacist', 'Discreet packaging'],
      legalText: 'Prescription medicines require valid documentation.',
      steps: [
        {
          id: 'step-1',
          fields: [
            fNameRequired,
            fPhoneRequired,
            fAddress,
            fCity,
            fPostal,
            {
              id: 'f-rx',
              key: 'has_prescription',
              type: 'checkbox',
              label: 'I have a valid prescription for this order',
              width: 'full',
            },
            {
              id: 'f-rx-notes',
              key: 'rx_notes',
              type: 'textarea',
              label: 'Prescription notes / pharmacist instructions',
              width: 'full',
            },
          ],
        },
      ],
    },
  },
  {
    slug: 'cod-electronics-warranty',
    name: 'Electronics COD with warranty opt-in',
    category: 'electronics',
    region: 'GLOBAL',
    language: 'en',
    description:
      'COD with extended-warranty opt-in upsell field. Pair with a quantity-offer for accessories.',
    isFeatured: false,
    schema: {
      version: 1,
      title: 'Buy on COD',
      subtitle: 'With optional extended warranty.',
      submitLabel: 'Place order',
      layout: 'single',
      trustBadges: ['Brand-new sealed', '7-day return'],
      legalText: '',
      steps: [
        {
          id: 'step-1',
          fields: [
            fNameRequired,
            fPhoneRequired,
            fAddress,
            fCity,
            fPostal,
            {
              id: 'f-warranty',
              key: 'extended_warranty',
              type: 'checkbox',
              label: 'Add 1-year extended warranty (+$19)',
              width: 'full',
            },
          ],
        },
      ],
    },
  },
  {
    slug: 'cod-food-delivery',
    name: 'Food / restaurant COD',
    category: 'food',
    region: 'GLOBAL',
    language: 'en',
    description:
      'Optimized for food delivery: phone first, address with landmark, scheduled-delivery slot.',
    isFeatured: false,
    schema: {
      version: 1,
      title: 'Order food — pay on delivery',
      subtitle: 'Hot food, no card needed.',
      submitLabel: 'Place order',
      layout: 'single',
      trustBadges: ['Hot & fresh', 'Pay cash'],
      legalText: '',
      steps: [
        {
          id: 'step-1',
          fields: [
            fPhoneRequired,
            fNameRequired,
            fAddress,
            {
              id: 'f-landmark',
              key: 'landmark',
              type: 'text',
              label: 'Nearest landmark',
              width: 'full',
            },
            {
              id: 'f-slot',
              key: 'delivery_slot',
              type: 'select',
              label: 'Delivery slot',
              options: [
                { value: 'asap', label: 'As soon as possible' },
                { value: '12_14', label: '12:00 – 14:00' },
                { value: '14_16', label: '14:00 – 16:00' },
                { value: '18_20', label: '18:00 – 20:00' },
                { value: '20_22', label: '20:00 – 22:00' },
              ],
              validation: { required: true },
              width: 'full',
            },
          ],
        },
      ],
    },
  },
];

export async function ensureDefaultTemplatesSeeded(): Promise<number> {
  const existing = await prisma.formTemplate.findMany({
    where: { slug: { in: DEFAULTS.map((d) => d.slug) } },
    select: { slug: true },
  });
  const have = new Set(existing.map((e) => e.slug));
  const missing = DEFAULTS.filter((d) => !have.has(d.slug));
  if (missing.length === 0) return 0;
  await prisma.formTemplate.createMany({
    data: missing.map((m) => ({
      slug: m.slug,
      name: m.name,
      category: m.category,
      region: m.region,
      language: m.language,
      description: m.description,
      schema: m.schema as Prisma.InputJsonValue,
      isFeatured: Boolean(m.isFeatured),
    })),
    skipDuplicates: true,
  });
  return missing.length;
}

export const DEFAULT_TEMPLATE_SLUGS = DEFAULTS.map((d) => d.slug);
