// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { readFileSync } from "node:fs";

// ORR_EDITION=onprem builds the self-hosted copy: no analytics, no links to the public site in <head>, noindex.
const edition = process.env.ORR_EDITION === "onprem" ? "onprem" : "public";
const version = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

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
  vite: { define: { __ORR_EDITION__: JSON.stringify(edition), __ORR_VERSION__: JSON.stringify(version) } },
});
