import type { APIRoute } from 'astro';
import { retrieveCheckoutSession, StripeError } from '../../../lib/stripe';

export const prerender = false;

function isProxyMode(): boolean {
  const fromImportMeta =
    (import.meta as unknown as { env?: Record<string, string | undefined> })
      .env?.STRIPE_API_KEY;
  const fromProcess =
    typeof process !== 'undefined' ? process.env?.STRIPE_API_KEY : undefined;
  const key = fromImportMeta ?? fromProcess ?? '';
  return key.includes('sk_test_emergent');
}

export const GET: APIRoute = async ({ params }) => {
  const sessionId = params.session_id;
  if (!sessionId) {
    return json({ error: 'Missing session_id.' }, 400);
  }

  try {
    const session = await retrieveCheckoutSession(sessionId);
    return json(
      {
        status: session.status,
        payment_status: session.payment_status,
        amount_total: session.amount_total ?? 0,
        currency: session.currency ?? 'gbp',
        customer_email:
          session.customer_details?.email ?? session.customer_email ?? null,
        metadata: session.metadata ?? {},
        demo_mode: false,
      },
      200,
    );
  } catch (err) {
    // The Emergent test-proxy issues real Stripe Checkout URLs but doesn't
    // implement the session-retrieve endpoint. If we're running against
    // that proxy and the session looks well-formed, return a synthetic
    // "paid" status so the UX completes. Production keys hit the real
    // Stripe API and do not take this branch.
    const looksLikeStripeSession = /^cs_test_[A-Za-z0-9]{20,}$/.test(sessionId);
    if (
      isProxyMode() &&
      err instanceof StripeError &&
      err.status === 404 &&
      looksLikeStripeSession
    ) {
      console.warn(
        '[checkout-status] proxy returned 404; returning synthetic demo status for',
        sessionId,
      );
      return json(
        {
          status: 'complete',
          payment_status: 'paid',
          amount_total: 0,
          currency: 'gbp',
          customer_email: null,
          metadata: {},
          demo_mode: true,
          demo_note:
            'Emergent test proxy does not support session retrieval. ' +
            'Real Stripe keys verify properly in production.',
        },
        200,
      );
    }

    const msg =
      err instanceof StripeError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Unknown Stripe error.';
    console.error('[checkout-status] stripe error', err);
    return json({ error: msg }, 502);
  }
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
