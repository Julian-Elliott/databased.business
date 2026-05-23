import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  // Type-check frontmatter using a schema
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // Transform string to Date object
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    tag: z.string().optional(),
    readingTime: z.string().optional(),
    // Tiny 12-point sparkline series rendered as a glyph for the post.
    spark: z.array(z.number()).optional(),
    draft: z.boolean().optional(),
  }),
});

export const collections = { blog };
