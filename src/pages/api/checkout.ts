import type { APIRoute } from 'astro';
import {
  createCheckoutSession,
  StripeError,
  type AllowedCountry,
} from '../../lib/stripe';
import { getProduct, isValidSize } from '../../lib/products';

// This endpoint must run as a server function — never prerendered.
export const prerender = false;

interface Body {
  sku?: string;
  size?: string;
  /** Provided by the client as `window.location.origin` — used to build
   *  the Stripe success/cancel URLs without hard-coding the host. */
  origin?: string;
}

export const POST: APIRoute = async ({ request }) => {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const sku = (body.sku ?? '').trim();
  const size = (body.size ?? '').trim().toUpperCase();
  const origin = sanitiseOrigin(body.origin);

  if (!origin) {
    return json({ error: 'Missing or invalid `origin`.' }, 400);
  }

  const product = getProduct(sku);
  if (!product) {
    return json({ error: `Unknown SKU: ${sku}` }, 400);
  }

  if (!isValidSize(product, size)) {
    return json(
      { error: `Invalid size for ${sku}. Allowed: ${product.sizes.join(', ')}` },
      400,
    );
  }

  const allowedCountries: AllowedCountry[] = Array.from(
    new Set(product.shipping_rates.flatMap((r) => r.allowed_countries)),
  );

  try {
    const session = await createCheckoutSession({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: product.currency,
            unit_amount: product.unit_amount,
            product_data: {
              name: `${product.name} · size ${size}`,
              description: product.description,
              images: product.image ? [`${origin}${product.image}`] : undefined,
              metadata: { sku: product.sku, size },
            },
          },
        },
      ],
      shipping_address_collection: { allowed_countries: allowedCountries },
      shipping_options: product.shipping_rates.map((r) => ({
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: r.display_name,
          fixed_amount: { amount: r.amount, currency: r.currency },
          delivery_estimate: {
            minimum: { unit: r.delivery.unit, value: r.delivery.min },
            maximum: { unit: r.delivery.unit, value: r.delivery.max },
          },
        },
      })),
      // Build URLs from the request origin — never hard-code, per playbook.
      success_url: `${origin}/shop/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop/?status=cancelled`,
      metadata: {
        sku: product.sku,
        size,
        source: 'databased.business/shop',
      },
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return json({ error: 'Stripe did not return a checkout URL.' }, 502);
    }

    return json({ url: session.url, session_id: session.id }, 200);
  } catch (err) {
    const msg =
      err instanceof StripeError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Unknown Stripe error.';
    console.error('[checkout] stripe error', err);
    return json({ error: `Stripe error: ${msg}` }, 502);
  }
};

function sanitiseOrigin(origin?: string): string | null {
  if (!origin) return null;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
