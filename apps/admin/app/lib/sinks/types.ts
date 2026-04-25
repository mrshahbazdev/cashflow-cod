/**
 * Shared types for marketing/data sinks (Klaviyo, Omnisend, Google Sheets, …).
 *
 * A sink is a "fire-and-forget" outbound integration: when an order is placed
 * (or a submission begins), we push a payload to a third-party system. Errors
 * are captured but never block the customer-facing response.
 */
import type { Order, Submission, Form, Shop } from '@prisma/client';

export type SinkEvent =
  | { kind: 'submission.created'; submission: Submission; form: Form; shop: Shop }
  | { kind: 'order.placed'; order: Order; submission: Submission; form: Form; shop: Shop }
  | {
      kind: 'order.disposition.changed';
      order: Order;
      previous: string;
      next: string;
      shop: Shop;
    };

export interface SinkResult {
  ok: boolean;
  error?: string;
  responseStatus?: number;
}

export interface SinkAdapter {
  /** Stable provider key, also stored in `Integration.provider`. */
  readonly provider: string;
  /** Human-readable label for the admin UI. */
  readonly displayName: string;
  /** Field hints rendered as helpText next to the credentials input. */
  readonly credentialsHelp: string;
  /** Top-level keys expected on `Integration.credentials`. */
  readonly credentialFields: ReadonlyArray<{
    key: string;
    label: string;
    type: 'text' | 'password' | 'textarea';
    required?: boolean;
    placeholder?: string;
  }>;
  fire(
    credentials: Record<string, unknown>,
    settings: Record<string, unknown>,
    event: SinkEvent,
  ): Promise<SinkResult>;
}
