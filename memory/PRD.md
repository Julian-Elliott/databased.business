# databased.business — PRD

_Last updated: 2026-01-23 (iter 2)_

## Problem statement (verbatim from user, original brief)

> I would like to overhaul databased.business into an engaging blog from
> myself on my data science exploration, that covers my recent investigation
> into using zero task auto fuzzy and xgboost to predict credit default as a
> comparison between transparent and opaque prediction modelling. I also want
> to have a section of the site for 3d models I have created with images and
> I want to have a section on software I have created recently through github.
> It needs to have a elegant code / analytics structure that would appeal to
> engineers / logical analysts and clearly shows care in every facet of
> systems oriented thinking. Check how this site is currently deployed as a
> commit will update the live site.

## Iteration 2 steers (verbatim)

> "I'm not too fussed on the index, I'm also tempted to have t-shirts
> available for sale on the site"

User-confirmed sub-decisions:
- **Index**: it just repeats the other tabs. Kill it; serve field notes at `/`.
- **Shop**: single design, sits as `04 · shop` in the nav, fulfilment TBD.

## Architecture decisions

- **Preserved the deployment-ready repo shape.** Astro 5 + `@astrojs/cloudflare`,
  auto-deploys on git push.
- **Killed the home page.** `/` now serves the field-notes feed. `/blog` is
  a 301 redirect to `/`. Nav collapsed from 5 to 4 surfaces (01–04).
- **Shop = Astro server endpoints on Cloudflare Workers.** Diverged from the
  Emergent FastAPI playbook because this site has no Python backend in prod.
  All of the playbook's security patterns (server-side prices, dynamic
  success/cancel URLs, status polling, no client amounts) carried over to
  TypeScript with no compromises.
- **Stripe Checkout via direct `fetch`.** Wrote a 200-line wrapper in
  `src/lib/stripe.ts` instead of the official SDK so we can support both
  the real `api.stripe.com` (production) and Emergent's
  `integrations.emergentagent.com/stripe` proxy (preview env) with a
  single line of conditional routing.
- **Demo-mode fallback.** The Emergent test proxy CAN create checkout
  sessions (real `cs_test_*` IDs + real `checkout.stripe.com` URLs) but
  CANNOT retrieve them — even the official `emergentintegrations` library
  hits this 404. The `/api/checkout-status` endpoint detects this and
  returns a synthetic `paid` response with `demo_mode: true` so the UX
  completes in preview. Real production keys take a different branch
  and actually verify the session.
- **Preview-only FastAPI proxy.** Added `/app/backend/server.py` — a 60-line
  FastAPI proxy on port 8001 that forwards `/api/*` to Astro on port 3000.
  Only exists to satisfy the K8s ingress rule that routes `/api/*` to 8001.
  Production on Cloudflare Workers serves `/api/*` natively from the same
  Worker; this file is irrelevant there.

## User persona

- **Julian Elliott** — MSc Data Analytics candidate, currently mid-thesis.
- Visiting engineers/analysts who appreciate density-with-clarity and
  data-democracy framing.
- Possible new persona: **t-shirt buyers** — readers who want to wear the
  manifesto.

## Core requirements (static)

1. **Field-notes blog** with a flagship post comparing zero-task auto-fuzzy
   vs XGBoost on credit default (transparent vs opaque modelling). ✅
2. **3D models** section with images (placeholders acceptable for v1). ✅
3. **Shipped code** section sourced from `github.com/Julian-Elliott`. ✅
4. **Elegant systems-oriented aesthetic** — appeals to engineers / logical
   analysts. ✅
5. **Shop** with at least one item, paid via Stripe. ✅ (iter 2)

## What's been implemented (2026-01-23)

### Iter 1
- Home page with hero, featured, taxonomy, recent, axes (later killed).
- `/blog` index with tag filter chips.
- Flagship MDX field note `transparent-vs-opaque-credit-default.mdx`.
- `/models` with 6 algorithmic wireframe cards.
- `/code` live mirror of github.com/Julian-Elliott (15 repos).
- Shared layout, header, footer, RSS, sitemap.
- Custom favicon and OG image.

### Iter 2
- **Killed `/`'s old hero/taxonomy/manifesto** — `/` now IS the field-notes
  feed. Cleaner, no duplicate surfaces.
- **`/blog` → 301 redirect to `/`** so inbound links still work.
- **Nav re-numbered**: 01 field notes (/), 02 renders (/models), 03 shipped
  code (/code), 04 shop (/shop). Brand link still goes to `/`.
- **`/shop`**: single SKU `tee-transparent-opaque`, £28 GBP, sizes XS–XXL.
  Product image is an SVG mock until a real render lands. Sticky size
  selector, ASCII-art-feel buy button, key-value spec table, shipping
  rate table (3 regions), three "short answer" copy blocks.
- **Stripe Checkout via Astro server endpoints**:
  - `POST /api/checkout` — creates session, returns `{url, session_id}`.
  - `GET /api/checkout-status/[session_id]` — polls status, with demo-mode
    fallback for the Emergent proxy.
- **Return-from-Stripe handling**: `?status=cancelled` shows the cancel
  message; `?session_id=…` polls and shows confirmation. Buy button
  transitions to "✓ purchased" on success.
- **Preview-only FastAPI proxy** in `/app/backend/server.py` to route
  `/api/*` from K8s ingress port 8001 → Astro on 3000.

## Testing

- All routes return HTTP 200: `/`, `/shop`, `/models`, `/code`, `/rss.xml`,
  `/blog/*` (4 posts). `/blog` returns 301.
- `npx astro build` prerenders 9 routes and emits 2 server functions
  (`/api/checkout`, `/api/checkout-status/[session_id]`) + the RSS function.
- End-to-end buy flow verified via Playwright: click `[data-testid='buy-button']`
  → server creates session → browser navigates to `checkout.stripe.com/c/pay/cs_test_...`
  showing the correct product, price, and shipping options.
- Demo-mode fallback verified: `/shop/?session_id=cs_test_...` shows
  "✓ Payment confirmed [DEMO MODE]" without a real Stripe retrieve.
- Cancel flow verified: `/shop/?status=cancelled` shows the cancel banner.
- Mobile overflow at 375px on /shop was 44px in iter 2; fixed by adding a
  horizontal-scroll wrapper on the shipping table and `@media (max-width: 480px)`
  size adjustments.

## Outstanding action items for the user

1. **Commit & push** — `git push` updates the live Cloudflare site.
2. **Set up a Stripe account** (Julian's own — preview env uses Emergent's
   test proxy which won't work in prod):
   - Create the product and obtain a live `sk_live_...` (or test `sk_test_...`).
   - `wrangler secret put STRIPE_API_KEY` to inject it into the Cloudflare
     Worker. Optionally also keep a dev `.env` STRIPE_API_KEY for local runs.
3. **Drop a real t-shirt photo** at `/public/shop/tee-transparent-opaque.svg`
   (or change the path in `src/lib/products.ts`) — the current SVG mock is
   a placeholder that signals the design but isn't a sales asset.
4. **Choose fulfilment**:
   - Recommended: **Printful POD + Stripe** — upload the design once to
     Printful, connect Stripe, Printful auto-fulfils on each order. Zero
     warehouse, lower margin (~£8 cost on £28).
   - Alt: **DIY shipping** — Stripe in, you handle the post. Highest margin,
     you become a warehouse.
5. **Drop your real dissertation metrics** into the credit-default post
   when they're final.

## Prioritised backlog

### P1
- Real t-shirt render photo.
- Fulfilment provider chosen and wired (webhook from Stripe → Printful or
  email-to-Julian on a successful payment).
- Replace placeholder metrics in `transparent-vs-opaque-credit-default.mdx`.
- Real 3D renders in `/public/models/`.

### P2
- Stripe webhook endpoint (`/api/webhook/stripe`) for production-grade
  fulfilment trigger (currently relies on Stripe dashboard / Printful
  integration).
- Per-post right-margin TOC for long posts.
- Calibration chart placeholder in the credit-default post.

### P3
- `/about` page reflecting the manifesto in long form.
- Bluesky-first webmentions.
- Dark-mode toggle (currently honours `prefers-color-scheme` automatically).
- Multiple SKUs / variants (different prints, mugs, etc.) if the first tee sells.
