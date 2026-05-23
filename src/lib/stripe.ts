/**
 * Tiny Stripe client built on `fetch`.
 *
 * Why not the official SDK? The SDK doesn't expose a path-prefix option,
 * and the Emergent test proxy lives at `https://integrations.emergentagent.com/stripe`
 * (mounted under `/stripe`). Real Stripe keys talk to `https://api.stripe.com`.
 * A 100-line wrapper covers both — and ships happily on Cloudflare Workers.
 *
 * Surface used by this site:
 *   - POST /v1/checkout/sessions  (create)
 *   - GET  /v1/checkout/sessions/{id}  (retrieve)
 *
 * Anything else, add here when needed.
 */

const REAL_BASE = 'https://api.stripe.com';
const PROXY_BASE = 'https://integrations.emergentagent.com/stripe';
const API_VERSION = '2024-12-18.acacia';

function readKey(): string {
  const fromImportMeta =
    (import.meta as unknown as { env?: Record<string, string | undefined> })
      .env?.STRIPE_API_KEY;
  const fromProcess =
    typeof process !== 'undefined' ? process.env?.STRIPE_API_KEY : undefined;
  const key = fromImportMeta ?? fromProcess;
  if (!key) {
    throw new Error(
      'STRIPE_API_KEY is not set. Add it to /app/.env (and /app/.dev.vars) for dev, ' +
        'and to `wrangler secret put STRIPE_API_KEY` for production.',
    );
  }
  return key;
}

function baseUrl(key: string): string {
  return key.includes('sk_test_emergent') ? PROXY_BASE : REAL_BASE;
}

/**
 * Stripe expects form-encoded bodies with bracketed nested keys, e.g.:
 *   line_items[0][price_data][unit_amount]=2800
 * Convert a JS object recursively into that shape.
 */
export function toFormData(
  input: Record<string, unknown> | unknown[],
  prefix = '',
): URLSearchParams {
  const out = new URLSearchParams();

  const visit = (val: unknown, key: string): void => {
    if (val === undefined || val === null) return;
    if (Array.isArray(val)) {
      val.forEach((item, i) => visit(item, `${key}[${i}]`));
    } else if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        visit(v, key ? `${key}[${k}]` : k);
      }
    } else if (typeof val === 'boolean') {
      out.append(key, val ? 'true' : 'false');
    } else {
      out.append(key, String(val));
    }
  };

  if (Array.isArray(input)) {
    input.forEach((item, i) => visit(item, `${prefix}[${i}]`));
  } else {
    for (const [k, v] of Object.entries(input)) {
      visit(v, prefix ? `${prefix}[${k}]` : k);
    }
  }
  return out;
}

async function stripeFetch(
  path: string,
  init: { method: 'GET' | 'POST'; body?: Record<string, unknown> },
): Promise<unknown> {
  const key = readKey();
  const url = `${baseUrl(key)}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Stripe-Version': API_VERSION,
    'User-Agent': 'databased.business/1.0',
  };

  let body: string | undefined;
  if (init.method === 'POST' && init.body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = toFormData(init.body).toString();
  }

  const res = await fetch(url, { method: init.method, headers, body });
  const text = await res.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new StripeError(`Non-JSON response from Stripe (${res.status}): ${text.slice(0, 200)}`, res.status);
  }
  if (!res.ok) {
    const err = (payload as { error?: { message?: string; type?: string } })?.error;
    throw new StripeError(
      err?.message ?? `Stripe responded ${res.status}`,
      res.status,
      err?.type,
    );
  }
  return payload;
}

export class StripeError extends Error {
  constructor(
    message: string,
    public status: number,
    public type?: string,
  ) {
    super(message);
    this.name = 'StripeError';
  }
}

// ─── Types we use ─────────────────────────────────────────────────────

export type AllowedCountry = string;

export interface CreateCheckoutParams {
  mode: 'payment';
  payment_method_types: string[];
  line_items: Array<{
    quantity: number;
    price_data: {
      currency: string;
      unit_amount: number;
      product_data: {
        name: string;
        description?: string;
        images?: string[];
        metadata?: Record<string, string>;
      };
    };
  }>;
  shipping_address_collection?: { allowed_countries: AllowedCountry[] };
  shipping_options?: Array<{
    shipping_rate_data: {
      type: 'fixed_amount';
      display_name: string;
      fixed_amount: { amount: number; currency: string };
      delivery_estimate?: {
        minimum: { unit: string; value: number };
        maximum: { unit: string; value: number };
      };
    };
  }>;
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
  phone_number_collection?: { enabled: boolean };
  allow_promotion_codes?: boolean;
}

export interface CheckoutSession {
  id: string;
  url: string | null;
  status: string;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  customer_email: string | null;
  customer_details: { email: string | null } | null;
  metadata: Record<string, string>;
}

// ─── Calls ────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  params: CreateCheckoutParams,
): Promise<CheckoutSession> {
  return (await stripeFetch('/v1/checkout/sessions', {
    method: 'POST',
    body: params as unknown as Record<string, unknown>,
  })) as CheckoutSession;
}

export async function retrieveCheckoutSession(
  sessionId: string,
): Promise<CheckoutSession> {
  return (await stripeFetch(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'GET',
  })) as CheckoutSession;
}
