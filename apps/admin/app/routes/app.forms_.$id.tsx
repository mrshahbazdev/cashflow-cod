import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useActionData, useLoaderData, useNavigation } from '@remix-run/react';
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
  Toast,
  Frame,
  Banner,
} from '@shopify/polaris';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { nanoid } from 'nanoid';
import { useMemo, useState } from 'react';
import { ClientOnly } from '../components/ClientOnly';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import { deleteForm, getForm, updateForm } from '../lib/forms.server';
import {
  defaultFormSchema,
  fieldTypeSchema,
  formSchema,
  type Field,
  type FieldType,
  type FormSchema,
} from '@cashflow-cod/form-schema';

type LoaderForm = {
  id: string;
  name: string;
  slug: string;
  layout: string;
  placement: string;
  isActive: boolean;
  schema: FormSchema;
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const id = params.id;
  if (!id) throw new Response('Not found', { status: 404 });

  const form = await getForm(shop.id, id);
  if (!form) throw new Response('Form not found', { status: 404 });

  const parsed = formSchema.safeParse(form.schema);
  const schema: FormSchema = parsed.success ? parsed.data : defaultFormSchema;

  const loaderForm: LoaderForm = {
    id: form.id,
    name: form.name,
    slug: form.slug,
    layout: form.layout,
    placement: form.placement,
    isActive: form.isActive,
    schema,
  };

  return json({ form: loaderForm });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const id = params.id;
  if (!id) throw new Response('Not found', { status: 404 });

  const body = await request.formData();
  const intent = body.get('intent');

  if (intent === 'delete') {
    await deleteForm(shop.id, id);
    return redirect('/app/forms');
  }

  if (intent === 'save') {
    const name = String(body.get('name') ?? '');
    const slug = String(body.get('slug') ?? '');
    const layout = String(body.get('layout') ?? 'POPUP') as
      | 'POPUP'
      | 'EMBEDDED'
      | 'SLIDEOVER'
      | 'LANDING';
    const placement = String(body.get('placement') ?? 'product');
    const isActive = body.get('isActive') === 'on' || body.get('isActive') === '1';
    const schemaJson = String(body.get('schema') ?? '{}');

    let parsedSchema: FormSchema;
    try {
      parsedSchema = JSON.parse(schemaJson);
    } catch {
      return json({ ok: false, error: 'Invalid schema JSON' }, { status: 400 });
    }

    try {
      await updateForm(shop.id, id, {
        name,
        slug,
        layout,
        placement,
        isActive,
        schema: parsedSchema,
      });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message }, { status: 400 });
    }
    return json({ ok: true, savedAt: new Date().toISOString() });
  }

  return json({ ok: false, error: 'Unknown intent' }, { status: 400 });
};

export default function FormBuilderRoute() {
  const { form: initial } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [layout, setLayout] = useState(initial.layout);
  const [placement, setPlacement] = useState(initial.placement);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [schema, setSchema] = useState<FormSchema>(initial.schema);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(
    initial.schema.steps[0]?.fields[0]?.id ?? null,
  );

  const saving = nav.state !== 'idle' && nav.formData?.get('intent') === 'save';
  const saved = actionData && 'ok' in actionData && actionData.ok && 'savedAt' in actionData;
  const saveError = actionData && 'error' in actionData ? actionData.error : null;

  const [toastVisible, setToastVisible] = useState(false);
  if (saved && !toastVisible) setToastVisible(true);

  const selected = useMemo(() => {
    for (const step of schema.steps) {
      const f = step.fields.find((x) => x.id === selectedFieldId);
      if (f) return { step, field: f };
    }
    return null;
  }, [schema, selectedFieldId]);

  const updateSchema = (next: FormSchema) => setSchema(next);

  const addField = (type: FieldType, stepIndex: number) => {
    const id = nanoid(8);
    const key = suggestKeyForType(type, schema);
    const newField: Field = {
      id,
      key,
      type,
      label: labelForType(type),
      width: 'full',
      ...(type === 'select' || type === 'radio'
        ? {
            options: [
              { value: 'opt_1', label: 'Option 1' },
              { value: 'opt_2', label: 'Option 2' },
            ],
          }
        : {}),
    };
    const steps = schema.steps.map((s, i) =>
      i === stepIndex ? { ...s, fields: [...s.fields, newField] } : s,
    );
    updateSchema({ ...schema, steps });
    setSelectedFieldId(id);
  };

  const patchField = (fieldId: string, patch: Partial<Field>) => {
    const steps = schema.steps.map((s) => ({
      ...s,
      fields: s.fields.map((f) => (f.id === fieldId ? ({ ...f, ...patch } as Field) : f)),
    }));
    updateSchema({ ...schema, steps });
  };

  const removeField = (fieldId: string) => {
    const steps = schema.steps.map((s) => ({
      ...s,
      fields: s.fields.filter((f) => f.id !== fieldId),
    }));
    updateSchema({ ...schema, steps });
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const srcIdx = Number(result.source.droppableId.split(':')[1] ?? 0);
    const dstIdx = Number(result.destination.droppableId.split(':')[1] ?? 0);
    const steps = schema.steps.map((s) => ({ ...s, fields: [...s.fields] }));
    const src = steps[srcIdx];
    const dst = steps[dstIdx];
    if (!src || !dst) return;
    const [moved] = src.fields.splice(result.source.index, 1);
    if (!moved) return;
    dst.fields.splice(result.destination.index, 0, moved);
    updateSchema({ ...schema, steps });
  };

  const addStep = () => {
    updateSchema({
      ...schema,
      layout: 'multi_step',
      steps: [
        ...schema.steps,
        { id: nanoid(8), title: `Step ${schema.steps.length + 1}`, fields: [] },
      ],
    });
  };

  const removeStep = (stepIndex: number) => {
    if (schema.steps.length <= 1) return;
    const steps = schema.steps.filter((_, i) => i !== stepIndex);
    updateSchema({
      ...schema,
      steps,
      layout: steps.length > 1 ? 'multi_step' : 'single',
    });
  };

  return (
    <Frame>
      <Page
        backAction={{ content: 'Forms', url: '/app/forms' }}
        title={name || 'Untitled form'}
        titleMetadata={
          isActive ? <Badge tone="success">Active</Badge> : <Badge tone="attention">Draft</Badge>
        }
        subtitle={`/${slug}`}
        primaryAction={{
          content: saving ? 'Saving…' : 'Save',
          loading: saving,
          onAction: () => {
            (document.getElementById('form-save') as HTMLFormElement | null)?.requestSubmit();
          },
        }}
        secondaryActions={[
          {
            content: 'Preview',
            url: `/app/forms/${initial.id}/preview`,
          },
          {
            content: 'Embed snippets',
            url: `/app/forms/${initial.id}/embed`,
          },
          {
            content: 'Delete',
            destructive: true,
            onAction: () => {
              if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
                const f = document.createElement('form');
                f.method = 'post';
                const i = document.createElement('input');
                i.name = 'intent';
                i.value = 'delete';
                f.appendChild(i);
                document.body.appendChild(f);
                f.submit();
              }
            },
          },
        ]}
      >
        <RemixForm method="post" id="form-save">
          <input type="hidden" name="intent" value="save" />
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="layout" value={layout} />
          <input type="hidden" name="placement" value={placement} />
          <input type="hidden" name="isActive" value={isActive ? '1' : '0'} />
          <input type="hidden" name="schema" value={JSON.stringify(schema)} />
        </RemixForm>

        {saveError ? (
          <Box paddingBlockEnd="400">
            <Banner tone="critical" title="Could not save">
              <p>{saveError}</p>
            </Banner>
          </Box>
        ) : null}

        <Layout>
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Form settings
                  </Text>
                  <TextField label="Name" value={name} onChange={setName} autoComplete="off" />
                  <TextField
                    label="Slug"
                    value={slug}
                    onChange={setSlug}
                    autoComplete="off"
                    helpText="URL-friendly identifier used by the storefront widget."
                  />
                  <Select
                    label="Layout"
                    options={[
                      { label: 'Popup', value: 'POPUP' },
                      { label: 'Embedded', value: 'EMBEDDED' },
                      { label: 'Slide-over', value: 'SLIDEOVER' },
                      { label: 'Landing page', value: 'LANDING' },
                    ]}
                    value={layout}
                    onChange={setLayout}
                  />
                  <Select
                    label="Placement"
                    options={[
                      { label: 'Product page', value: 'product' },
                      { label: 'Cart page', value: 'cart' },
                      { label: 'Landing page', value: 'landing' },
                      { label: 'Custom', value: 'custom' },
                    ]}
                    value={placement}
                    onChange={setPlacement}
                  />
                  <Checkbox
                    label="Active on storefront"
                    checked={isActive}
                    onChange={setIsActive}
                  />
                  <Divider />
                  <TextField
                    label="Form title"
                    value={schema.title}
                    onChange={(v) => updateSchema({ ...schema, title: v })}
                    autoComplete="off"
                  />
                  <TextField
                    label="Subtitle"
                    value={schema.subtitle ?? ''}
                    onChange={(v) => updateSchema({ ...schema, subtitle: v })}
                    autoComplete="off"
                  />
                  <TextField
                    label="Submit button label"
                    value={schema.submitLabel}
                    onChange={(v) => updateSchema({ ...schema, submitLabel: v })}
                    autoComplete="off"
                  />
                  <TextField
                    label="Legal/disclaimer text"
                    value={schema.legalText ?? ''}
                    onChange={(v) => updateSchema({ ...schema, legalText: v })}
                    autoComplete="off"
                    multiline={2}
                  />
                  <Checkbox
                    label="Allow customers to enter a discount code"
                    checked={schema.allowDiscountCode !== false}
                    onChange={(v) => updateSchema({ ...schema, allowDiscountCode: v })}
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Custom CSS &amp; HTML
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Tweak the storefront widget&rsquo;s look with scoped CSS and inject extra markup
                    above / below the form. <code>&lt;script&gt;</code> tags are stripped from HTML
                    before render.
                  </Text>
                  <TextField
                    label="Custom CSS (scoped to .cashflow-cod-widget)"
                    value={schema.customCss ?? ''}
                    onChange={(v) => updateSchema({ ...schema, customCss: v || undefined })}
                    autoComplete="off"
                    multiline={6}
                    placeholder=".cashflow-cod-submit { background: #f43f5e; }"
                  />
                  <TextField
                    label="HTML before the form"
                    value={schema.customHtmlHeader ?? ''}
                    onChange={(v) => updateSchema({ ...schema, customHtmlHeader: v || undefined })}
                    autoComplete="off"
                    multiline={4}
                    placeholder="<div class='trust-row'>Free delivery · 7-day returns</div>"
                  />
                  <TextField
                    label="HTML after the form"
                    value={schema.customHtmlFooter ?? ''}
                    onChange={(v) => updateSchema({ ...schema, customHtmlFooter: v || undefined })}
                    autoComplete="off"
                    multiline={4}
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Add field
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Click to add to {schema.layout === 'multi_step' ? 'the first step' : 'the form'}
                    .
                  </Text>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {fieldTypeSchema.options.map((t) => (
                      <Button key={t} onClick={() => addField(t, 0)} size="slim">
                        {labelForType(t)}
                      </Button>
                    ))}
                  </div>
                </BlockStack>
              </Card>

              {selected ? (
                <FieldEditor
                  field={selected.field}
                  allFields={schema.steps.flatMap((s) => s.fields)}
                  onChange={(patch) => patchField(selected.field.id, patch)}
                  onRemove={() => removeField(selected.field.id)}
                />
              ) : null}
            </BlockStack>
          </Layout.Section>

          <Layout.Section>
            <ClientOnly
              fallback={
                <Card>
                  <Text as="p" tone="subdued">
                    Loading builder…
                  </Text>
                </Card>
              }
            >
              {() => (
                <DragDropContext onDragEnd={onDragEnd}>
                  <BlockStack gap="400">
                    {schema.steps.map((step, stepIndex) => (
                      <Card key={step.id}>
                        <BlockStack gap="300">
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="200" blockAlign="center">
                              <Text as="h3" variant="headingSm">
                                {schema.steps.length > 1 ? `Step ${stepIndex + 1}` : 'Fields'}
                              </Text>
                              {schema.steps.length > 1 ? (
                                <TextField
                                  label=""
                                  labelHidden
                                  value={step.title ?? ''}
                                  onChange={(v) => {
                                    const steps = schema.steps.map((s, i) =>
                                      i === stepIndex ? { ...s, title: v } : s,
                                    );
                                    updateSchema({ ...schema, steps });
                                  }}
                                  autoComplete="off"
                                  placeholder="Step title"
                                />
                              ) : null}
                            </InlineStack>
                            <InlineStack gap="200">
                              <Button size="slim" onClick={() => addField('text', stepIndex)}>
                                + Text
                              </Button>
                              {schema.steps.length > 1 ? (
                                <Button
                                  size="slim"
                                  tone="critical"
                                  onClick={() => removeStep(stepIndex)}
                                >
                                  Remove step
                                </Button>
                              ) : null}
                            </InlineStack>
                          </InlineStack>
                          <Droppable droppableId={`step:${stepIndex}`}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                style={{
                                  minHeight: 60,
                                  padding: 8,
                                  background: snapshot.isDraggingOver
                                    ? 'rgba(0,128,96,0.05)'
                                    : 'transparent',
                                  borderRadius: 8,
                                }}
                              >
                                {step.fields.length === 0 ? (
                                  <Text as="p" tone="subdued">
                                    No fields yet. Use the field palette to add one.
                                  </Text>
                                ) : null}
                                {step.fields.map((f, idx) => (
                                  <Draggable key={f.id} draggableId={f.id} index={idx}>
                                    {(dp, ds) => (
                                      <div
                                        ref={dp.innerRef}
                                        {...dp.draggableProps}
                                        {...dp.dragHandleProps}
                                        onClick={() => setSelectedFieldId(f.id)}
                                        style={{
                                          ...dp.draggableProps.style,
                                          padding: 12,
                                          marginBottom: 8,
                                          background:
                                            selectedFieldId === f.id
                                              ? 'rgba(0,128,96,0.08)'
                                              : ds.isDragging
                                                ? '#f4f6f8'
                                                : '#ffffff',
                                          border:
                                            selectedFieldId === f.id
                                              ? '1px solid #008060'
                                              : '1px solid #e1e3e5',
                                          borderRadius: 8,
                                          cursor: 'grab',
                                        }}
                                      >
                                        <InlineStack align="space-between" blockAlign="center">
                                          <BlockStack gap="050">
                                            <InlineStack gap="200" blockAlign="center">
                                              <Text as="span" fontWeight="semibold">
                                                {f.label || f.key}
                                              </Text>
                                              <Badge>{f.type}</Badge>
                                              {f.validation?.required ? (
                                                <Badge tone="warning">Required</Badge>
                                              ) : null}
                                              {f.conditions && f.conditions.length > 0 ? (
                                                <Badge tone="info">Conditional</Badge>
                                              ) : null}
                                            </InlineStack>
                                            <Text as="span" tone="subdued" variant="bodySm">
                                              {f.key} · {f.width}
                                            </Text>
                                          </BlockStack>
                                          <div onClick={(e) => e.stopPropagation()}>
                                            <Button
                                              size="micro"
                                              tone="critical"
                                              onClick={() => removeField(f.id)}
                                            >
                                              Remove
                                            </Button>
                                          </div>
                                        </InlineStack>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </BlockStack>
                      </Card>
                    ))}
                    <Button onClick={addStep}>+ Add step</Button>
                  </BlockStack>
                </DragDropContext>
              )}
            </ClientOnly>
          </Layout.Section>
        </Layout>

        {toastVisible ? (
          <Toast content="Form saved" onDismiss={() => setToastVisible(false)} duration={2500} />
        ) : null}
      </Page>
    </Frame>
  );
}

function FieldEditor({
  field,
  allFields,
  onChange,
  onRemove,
}: {
  field: Field;
  allFields: Field[];
  onChange: (patch: Partial<Field>) => void;
  onRemove: () => void;
}) {
  const otherFields = allFields.filter((f) => f.id !== field.id);
  const hasOptions = field.type === 'select' || field.type === 'radio';

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingSm">
            Field: {field.label || field.key}
          </Text>
          <Button size="slim" tone="critical" onClick={onRemove}>
            Remove
          </Button>
        </InlineStack>
        <TextField
          label="Label"
          value={field.label}
          onChange={(v) => onChange({ label: v })}
          autoComplete="off"
        />
        <TextField
          label="Key"
          value={field.key}
          onChange={(v) => onChange({ key: v.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
          autoComplete="off"
          helpText="Internal identifier (letters, digits, underscores)."
        />
        <TextField
          label="Placeholder"
          value={field.placeholder ?? ''}
          onChange={(v) => onChange({ placeholder: v })}
          autoComplete="off"
        />
        <TextField
          label="Help text"
          value={field.helpText ?? ''}
          onChange={(v) => onChange({ helpText: v })}
          autoComplete="off"
        />
        <Select
          label="Width"
          options={[
            { label: 'Full', value: 'full' },
            { label: 'Half', value: 'half' },
            { label: 'Third', value: 'third' },
          ]}
          value={field.width}
          onChange={(v) => onChange({ width: v as 'full' | 'half' | 'third' })}
        />
        <Checkbox
          label="Required"
          checked={field.validation?.required ?? false}
          onChange={(checked) =>
            onChange({ validation: { ...field.validation, required: checked } })
          }
        />

        {hasOptions ? (
          <BlockStack gap="200">
            <Text as="h4" variant="headingXs">
              Options
            </Text>
            {(field.options ?? []).map((opt, i) => (
              <InlineStack key={i} gap="200" blockAlign="center">
                <div style={{ flex: 1 }}>
                  <TextField
                    label=""
                    labelHidden
                    value={opt.label}
                    onChange={(v) => {
                      const options = [...(field.options ?? [])];
                      const prev = options[i] ?? { value: '', label: '' };
                      options[i] = { value: prev.value, label: v };
                      onChange({ options });
                    }}
                    autoComplete="off"
                    placeholder="Label"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextField
                    label=""
                    labelHidden
                    value={opt.value}
                    onChange={(v) => {
                      const options = [...(field.options ?? [])];
                      const prev = options[i] ?? { value: '', label: '' };
                      options[i] = { value: v, label: prev.label };
                      onChange({ options });
                    }}
                    autoComplete="off"
                    placeholder="Value"
                  />
                </div>
                <Button
                  size="slim"
                  tone="critical"
                  onClick={() => {
                    const options = (field.options ?? []).filter((_, j) => j !== i);
                    onChange({ options });
                  }}
                >
                  ✕
                </Button>
              </InlineStack>
            ))}
            <Button
              size="slim"
              onClick={() =>
                onChange({
                  options: [
                    ...(field.options ?? []),
                    { value: `opt_${(field.options?.length ?? 0) + 1}`, label: 'Option' },
                  ],
                })
              }
            >
              + Add option
            </Button>
          </BlockStack>
        ) : null}

        <Divider />
        <Text as="h4" variant="headingXs">
          Conditional logic
        </Text>
        <Text as="p" tone="subdued" variant="bodySm">
          Show this field only when another field matches.
        </Text>
        {(field.conditions ?? []).map((cond, i) => (
          <InlineStack key={i} gap="200" blockAlign="center">
            <div style={{ flex: 1 }}>
              <Select
                label=""
                labelHidden
                options={[
                  { label: 'Select field…', value: '' },
                  ...otherFields.map((f) => ({ label: f.label || f.key, value: f.key })),
                ]}
                value={cond.fieldKey}
                onChange={(v) => {
                  const conditions = [...(field.conditions ?? [])];
                  const prev = conditions[i] ?? { fieldKey: '', operator: 'eq' as const };
                  conditions[i] = { ...prev, fieldKey: v };
                  onChange({ conditions });
                }}
              />
            </div>
            <Select
              label=""
              labelHidden
              options={[
                { label: 'equals', value: 'eq' },
                { label: 'not equals', value: 'neq' },
                { label: 'contains', value: 'contains' },
                { label: 'exists', value: 'exists' },
              ]}
              value={cond.operator}
              onChange={(v) => {
                const conditions = [...(field.conditions ?? [])];
                const prev = conditions[i] ?? { fieldKey: '', operator: 'eq' as const };
                conditions[i] = { ...prev, operator: v as typeof cond.operator };
                onChange({ conditions });
              }}
            />
            <div style={{ flex: 1 }}>
              <TextField
                label=""
                labelHidden
                value={String(cond.value ?? '')}
                onChange={(v) => {
                  const conditions = [...(field.conditions ?? [])];
                  const prev = conditions[i] ?? { fieldKey: '', operator: 'eq' as const };
                  conditions[i] = { ...prev, value: v };
                  onChange({ conditions });
                }}
                autoComplete="off"
                placeholder="Value"
              />
            </div>
            <Button
              size="slim"
              tone="critical"
              onClick={() => {
                const conditions = (field.conditions ?? []).filter((_, j) => j !== i);
                onChange({ conditions });
              }}
            >
              ✕
            </Button>
          </InlineStack>
        ))}
        <Button
          size="slim"
          onClick={() =>
            onChange({
              conditions: [
                ...(field.conditions ?? []),
                { fieldKey: '', operator: 'eq', value: '' },
              ],
            })
          }
        >
          + Add condition
        </Button>
      </BlockStack>
    </Card>
  );
}

function labelForType(t: FieldType): string {
  const map: Record<FieldType, string> = {
    text: 'Text',
    email: 'Email',
    phone: 'Phone',
    textarea: 'Textarea',
    select: 'Dropdown',
    radio: 'Radio',
    checkbox: 'Checkbox',
    city: 'City',
    address: 'Address',
    postal_code: 'Postal code',
    country: 'Country',
    hidden: 'Hidden',
    html: 'HTML block',
    divider: 'Divider',
  };
  return map[t];
}

function suggestKeyForType(t: FieldType, schema: FormSchema): string {
  const base = t === 'textarea' ? 'notes' : t;
  const existing = new Set(schema.steps.flatMap((s) => s.fields.map((f) => f.key)));
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}
