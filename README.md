# databased.business — datasets, published as datasheets

> Data, based in reality.

Datasets Julian Elliott collected, cleaned or rebuilt, each with a **datasheet** in the electronics sense:
key specifications, characteristic curves, pinout (schema), absolute maximum ratings (known limits),
a typical application (a query that runs in your browser), provenance, and a revision history.

Built with [Astro 5](https://astro.build), deployed to [Cloudflare Workers](https://workers.cloudflare.com)
as static assets. A `git push` to `main` updates the live site.

## Layout

```
src/content/datasheets/*.json   the datasheets (editorial front: specs, limits, query, revisions)
public/data/<id>/               the releases: Parquet partitions, datapackage.json, checks.log, summary.json
scripts/fetch_neso.py           DS-001 pipeline (NESO carbon intensity), run daily by .github/workflows/data.yml
scripts/build_sample.py         the DS-001 seed release built from data fetched 30 Sep 2026
src/pages/                      / (the shelf) and /datasheets/<id>/
src/components/Explorer.astro   DuckDB-WASM query panel; nothing leaves the browser
```

## How a release happens

1. **Raw stays private.** Captures, exports and API pulls live on Julian's machine, never in this repository.
2. **The manifest decides.** `datapackage.json` names every column a release may carry, its type, unit and licence.
3. **Checks run in public.** Row counts, gaps, nulls and ranges run on the built files; results are in `checks.log`
   and on the datasheet.
4. **Files are the release.** Parquet with a revision date. The datasheet is the label on the tin, not the tin.

## DS-001 pipeline

`.github/workflows/data.yml` runs `scripts/fetch_neso.py` daily. The first run backfills from 11 May 2018
(about 440 API calls, 14-day windows) and commits yearly partitions plus monthly ones for the current year;
later runs refetch only the current partition. Partitions are small on purpose: git-friendly, and DuckDB-WASM
loads only what a query needs. If the data ever outgrows the repository, point the workflow at an R2 bucket
and keep the same paths.

## Develop

```sh
npm install
npm run dev                      # http://localhost:4321
python3 scripts/build_sample.py  # rebuild the DS-001 seed files (needs pyarrow)
npm run build && npx wrangler dev
```

Data licence: DS-001 derives from the NESO Carbon Intensity API (https://api.carbonintensity.org.uk), CC BY 4.0.
