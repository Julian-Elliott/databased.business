# databased.business

> Field notes on data, models, and what we can defend in plain English.

Personal site for Julian Elliott — currently reading an MSc in Data Analytics
at the University of Huddersfield. The site is organised around a single
animating tension: **transparent** models versus **opaque** ones, and the
case work in between.

Built with [Astro 5](https://astro.build) and deployed to
[Cloudflare Workers](https://workers.cloudflare.com). A `git push` to `main`
updates the live site.

## Surfaces

```
00  index            /                  taxonomy + manifesto
01  field notes      /blog              long-form essays
02  renders          /models            3D modelling catalogue
03  shipped code     /code              live mirror of github.com/Julian-Elliott
```

The flagship field note is
[*Transparent vs Opaque: Predicting Credit Default with Zero-Task Auto-Fuzzy
and XGBoost*](src/content/blog/transparent-vs-opaque-credit-default.mdx) — a
side-by-side investigation of an interpretable fuzzy rule system against
gradient boosted trees, drawn from MSc research.

## Stack

- **Framework**: Astro 5 (MDX content collections)
- **Adapter**: `@astrojs/cloudflare`
- **Type system**: TypeScript (strict)
- **Typography**: Fraunces (display) · IBM Plex Sans (body) · IBM Plex Mono
- **Palette**: cream paper, deep ink, signal orange, petrol blue
- **Data**: GitHub REST API for `/code` at build time; static MDX for posts

## Local development

```bash
npm install
npm run dev    # http://localhost:4321 (or 3000 if started via /app/frontend bridge)
```

## Build & deploy

```bash
npm run build           # static prerender → dist/
npm run deploy          # astro build && wrangler deploy
```

## Authoring

New field note:

```bash
$ touch src/content/blog/<slug>.mdx
```

Frontmatter contract:

```yaml
---
title: "..."
description: "..."
pubDate: "Jan 18 2026"
tag: "credit-default"      # optional, drives the filter chips
readingTime: "14 min"      # optional
spark: [4, 5, 4, 7, ...]   # optional 12-point sparkline glyph
draft: false               # optional
---
```

Real 3D render images drop into `/public/models/<slug>.{jpg,webp}` and the
matching entry in `src/data/models.ts` flips `placeholder: false` and gains
an `image` field. Until then, each card shows an algorithmic wireframe
derived deterministically from its title.

## Project structure

```
src/
  components/   header, footer, post row, repo card, model card, sparkline, rubric
  content/blog/ MDX field notes
  data/         models.ts (3D catalogue)
  layouts/      BlogPost.astro
  lib/          github.ts, stripe.ts (direct-fetch wrapper), products.ts (SKU catalogue)
  pages/        index (= field notes), blog/[slug], models/, code/, shop/, api/checkout(.ts), api/checkout-status/[id]
  styles/       global.css (full design system)
  consts.ts     site title, sections (4 surfaces), author profile links
```

## Shop / Stripe

`/shop` sells a single t-shirt (`tee-transparent-opaque`, £28 GBP).
Checkout is implemented as Astro server endpoints (`src/pages/api/checkout.ts`
and `src/pages/api/checkout-status/[session_id].ts`) that compile to
Cloudflare Worker functions on deploy. No external backend required.

To go live with your own Stripe account:

```bash
# put your real key into the live Worker
wrangler secret put STRIPE_API_KEY

# locally:
cp .dev.vars.example .dev.vars        # then edit
# or set STRIPE_API_KEY in /app/.env
```

The product catalogue lives in `src/lib/products.ts` — change the price,
shipping rates, or SKU there. Prices are server-side only; the client
never sends an amount.

## Principles

- **Show the working.** Every claim ships with its data, code, and decisions.
- **Prefer the model you can defend.** Interpretability is a regulatory artefact, not a vibe.
- **Plain English is the deliverable.** A model nobody can summarise is a model nobody owns.

## Contact

- Email: [julian@databased.business](mailto:julian@databased.business)
- LinkedIn: [julianelliott](https://www.linkedin.com/in/julianelliott)
- GitHub: [Julian-Elliott](https://github.com/Julian-Elliott)
- Bluesky: [databased.business](https://bsky.app/profile/databased.business)
