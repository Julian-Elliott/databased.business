# databased.business — PRD

_Last updated: 2026-01-23_

## Problem statement (verbatim from user)

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

## Architecture decisions

- **Preserved the deployment-ready repo shape.** The user's existing
  GitHub repo (`Julian-Elliott/databased.business`) is an Astro 5 +
  `@astrojs/cloudflare` site auto-deployed on `git push`. Did **not**
  restructure into the Emergent default `/app/frontend` React layout. Instead
  added `/app/frontend/package.json` as a one-line bridge that runs
  `astro dev` from `/app` on port 3000 to satisfy the read-only supervisor.
- **Allowed all Vite hosts.** Added `vite.server.allowedHosts: true` to
  `astro.config.mjs` so the Emergent preview ingress can reach the dev server.
- **Aesthetic.** INTP-T scientific minimalism per user description:
  cream paper background, ink type, hairline rules, numbered taxonomy
  (00/01/02/03), mono lowercase metadata, signal-orange accent, petrol-blue
  counterweight. Fonts: Fraunces (display, variable), IBM Plex Sans (body),
  IBM Plex Mono (data labels). Deliberately avoided AI-slop patterns
  (Inter, purple gradients, centred cards).
- **GitHub fetch at build time.** `/code` page uses `fetch` against
  `api.github.com/users/Julian-Elliott/repos` during prerender. Falls back to
  a static 1-item list if the API is unreachable. Reads `GITHUB_TOKEN` if set.

## User persona

- **Julian Elliott** — MSc Data Analytics candidate, currently mid-thesis.
- Visiting engineers/analysts who appreciate density-with-clarity and
  data-democracy framing.

## Core requirements (static)

1. **Field-notes blog** with a flagship post comparing zero-task auto-fuzzy
   vs XGBoost on credit default (transparent vs opaque modelling).
2. **3D models** section with images (placeholders acceptable for v1).
3. **Shipped code** section sourced from `github.com/Julian-Elliott`.
4. **Elegant systems-oriented aesthetic** — appeals to engineers / logical
   analysts.

## What's been implemented (2026-01-23)

- Home page (`/`) with hero ("transparent / opaque."), 4-section layout
  (featured note, three-surfaces taxonomy, recent notes, three-axes manifesto).
- Blog index (`/blog`) with tag filter chips (all / credit-default / literacy /
  governance / democratisation).
- Flagship MDX field note:
  `src/content/blog/transparent-vs-opaque-credit-default.mdx` — full scaffold
  with TLDR, methodology for both models, comparison table with placeholder
  metrics, decision framework, deployment recommendation. Placeholder numbers
  ready to be filled in from the dissertation.
- `/models` gallery — 6 placeholder cards with deterministic algorithmic
  wireframe SVGs derived from each title. Ready to be replaced with real
  renders by editing `src/data/models.ts`.
- `/code` page — live mirror of `Julian-Elliott`'s public repos, sorted by
  last push, language filter chips, decorative activity sparklines, fallback
  on API failure.
- Shared layout, header, footer, RSS feed, sitemap (auto-generated).
- Custom favicon (sparkline mark) and OG image (`og-default.svg`).
- Cloudflare deploy contract preserved — `npm run deploy` still works.

## Testing

- All 9 routes return HTTP 200 (`/`, `/blog`, `/blog/*` × 4, `/models`,
  `/code`, `/rss.xml`).
- `npx astro build` completes cleanly, prerenders all 7 page routes plus RSS.
- Testing subagent verified 28/29 frontend checks — single issue (mobile
  hero overflow at 375px) was fixed by adding a `@media (max-width: 560px)`
  breakpoint that stacks the two halves of the hero headline.
- GitHub fetch returned 15 real repos during testing (no rate-limit hit).

## Prioritised backlog

### P1 — Author content

- Replace placeholder metrics in the credit-default post with the
  dissertation's actual AUC / accuracy / F1 / Brier numbers.
- Drop real 3D renders into `/public/models/` and flip the matching
  `placeholder: false` in `src/data/models.ts`. Optionally add a
  `<model-viewer>` web-component if `.glb` files exist.

### P2 — Polish

- Add a small per-post table-of-contents in the right margin for long posts
  (the credit-default post already has 8 sections).
- Reliability diagram / calibration chart placeholder in the credit-default
  post — currently described in prose.
- Optional MathJax/KaTeX wiring if the credit-default post grows formulas.
- Dark-mode toggle (currently honours `prefers-color-scheme` automatically).

### P3 — Nice-to-have

- A `/about` page reflecting the manifesto in long form.
- Webmentions / commenting bridge (Bluesky-first).
- A subscribe-by-email widget (Buttondown / Listmonk) tied to the RSS feed.

## Next tasks

1. **User to commit & push** the repo so Cloudflare deploys the new site.
2. Replace placeholders in `transparent-vs-opaque-credit-default.mdx`
   when dissertation numbers are final.
3. Add real renders + decide whether `/models` should host interactive
   GLB viewers.
