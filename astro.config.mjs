// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

// Static site for GitHub Pages on its own domain (public/CNAME), so the base stays "/".
export default defineConfig({
  site: "https://openrepairrecord.com",
  trailingSlash: "ignore",
  integrations: [
    react(),
    sitemap({ filter: (page) => !/\/(impressum|privacy)\/$/.test(page) }),
  ],
  build: { format: "directory" },
  devToolbar: { enabled: false },
});
