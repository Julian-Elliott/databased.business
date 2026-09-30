// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";

// Static datasheets, served by Cloudflare Workers static assets (wrangler.json). Pages are prerendered.
export default defineConfig({
  site: "https://databased.business",
  integrations: [sitemap()],
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  build: { format: "directory" },
});
