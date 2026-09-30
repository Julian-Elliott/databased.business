import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// One datasheet per JSON file in src/content/datasheets/. The manifest that governs a release
// (which columns may be public) lives with the data as public/data/<id>/datapackage.json; this
// collection is the datasheet's editorial front: specs, limits, the typical query, revisions.
const datasheets = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/datasheets' }),
  schema: z.object({
    id: z.string(),
    order: z.number(),
    title: z.string(),
    summary: z.string(),
    status: z.enum(['released', 'sanitising', 'locating', 'cleaning', 'planned']),
    revision: z.string().optional(),
    licence: z.string().optional(),
    source: z.string().optional(),
    sourceUrl: z.string().optional(),
    coverage: z.string().optional(),
    cadence: z.string().optional(),
    units: z.string().optional(),
    formats: z.string().optional(),
    refresh: z.string().optional(),
    dataDir: z.string().optional(),
    specs: z.array(z.tuple([z.string(), z.string()])).default([]),
    schema: z.array(z.object({ field: z.string(), type: z.string(), description: z.string() })).default([]),
    limits: z.array(z.tuple([z.string(), z.string()])).default([]),
    query: z.string().optional(),
    queryNote: z.string().optional(),
    provenance: z.array(z.tuple([z.string(), z.string()])).default([]),
    revisions: z.array(z.tuple([z.string(), z.string()])).default([]),
    usedIn: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
    curves: z.boolean().default(false),
    noRelease: z.string().optional(),
    kv: z.array(z.tuple([z.string(), z.string()])).default([]),
  }),
});

export const collections = { datasheets };
