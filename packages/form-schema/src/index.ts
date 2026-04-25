import { z } from 'zod';

export const fieldTypeSchema = z.enum([
  'text',
  'email',
  'phone',
  'textarea',
  'select',
  'radio',
  'checkbox',
  'city',
  'address',
  'postal_code',
  'country',
  'hidden',
  'html',
  'divider',
]);

export type FieldType = z.infer<typeof fieldTypeSchema>;

export const validationRuleSchema = z.object({
  required: z.boolean().optional(),
  minLength: z.number().int().positive().optional(),
  maxLength: z.number().int().positive().optional(),
  pattern: z.string().optional(),
  customMessage: z.string().optional(),
});

export const conditionSchema = z.object({
  fieldKey: z.string(),
  operator: z.enum(['eq', 'neq', 'in', 'not_in', 'contains', 'exists']),
  value: z.unknown().optional(),
});

export const fieldSchema = z.object({
  id: z.string(),
  key: z.string().regex(/^[a-z_][a-z0-9_]*$/i, 'must be a valid identifier'),
  type: fieldTypeSchema,
  label: z.string().default(''),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  defaultValue: z.unknown().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  validation: validationRuleSchema.optional(),
  conditions: z.array(conditionSchema).optional(),
  width: z.enum(['full', 'half', 'third']).default('full'),
});

export type Field = z.infer<typeof fieldSchema>;

export const stepSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  fields: z.array(fieldSchema),
});

export const formSchema = z.object({
  version: z.literal(1).default(1),
  title: z.string().default('Cash on Delivery'),
  subtitle: z.string().optional(),
  submitLabel: z.string().default('Place order'),
  layout: z.enum(['single', 'multi_step']).default('single'),
  steps: z.array(stepSchema).min(1),
  trustBadges: z.array(z.string()).optional(),
  legalText: z.string().optional(),
  /**
   * Per-form custom presentation hooks. CSS is wrapped to scope rules to the
   * widget root; HTML is rendered into header / footer slots with `<script>`
   * tags stripped. Both are optional.
   */
  customCss: z.string().max(50_000).optional(),
  customHtmlHeader: z.string().max(20_000).optional(),
  customHtmlFooter: z.string().max(20_000).optional(),
  /** Whether the storefront should expose a "Have a discount code?" input. */
  allowDiscountCode: z.boolean().optional(),
});

export type FormSchema = z.infer<typeof formSchema>;

export const defaultFormSchema: FormSchema = {
  version: 1,
  title: 'Cash on Delivery',
  submitLabel: 'Place order',
  layout: 'single',
  steps: [
    {
      id: 'step-1',
      fields: [
        {
          id: 'f-name',
          key: 'name',
          type: 'text',
          label: 'Full name',
          placeholder: 'Ahmad Khan',
          validation: { required: true, minLength: 2 },
          width: 'full',
        },
        {
          id: 'f-phone',
          key: 'phone',
          type: 'phone',
          label: 'Phone number',
          placeholder: '03xx-xxxxxxx',
          validation: { required: true },
          width: 'full',
        },
        {
          id: 'f-address',
          key: 'address',
          type: 'address',
          label: 'Delivery address',
          validation: { required: true },
          width: 'full',
        },
        {
          id: 'f-city',
          key: 'city',
          type: 'city',
          label: 'City',
          validation: { required: true },
          width: 'half',
        },
        {
          id: 'f-postal',
          key: 'postal_code',
          type: 'postal_code',
          label: 'Postal code',
          width: 'half',
        },
      ],
    },
  ],
};
