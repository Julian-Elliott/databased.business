// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  site: "https://databased.business",
  integrations: [mdx(), sitemap()],
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  // Vite dev-server tweaks (Emergent preview ingress + LAN access).
  vite: {
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
    },
  },
});
