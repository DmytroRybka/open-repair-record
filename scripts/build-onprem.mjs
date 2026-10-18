// Builds the self-hosted copy into dist/: the same site with ORR_EDITION=onprem, then removes what only the public
// site needs (custom domain, sitemaps, llms.txt), blocks crawlers, and adds a web.config for IIS.
// Used by `npm run build:onprem`, the Dockerfile and the release workflow, so all three ship the same files.
import { spawnSync } from "node:child_process";
import { copyFileSync, rmSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const dist = join(root, "dist");

const build = spawnSync("npx", ["astro", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, ORR_EDITION: "onprem" },
});
if (build.status !== 0) process.exit(build.status ?? 1);

for (const name of readdirSync(dist)) {
  if (name === "CNAME" || name === "llms.txt" || /^sitemap.*\.xml$/.test(name)) rmSync(join(dist, name));
}
writeFileSync(join(dist, "robots.txt"), "User-agent: *\nDisallow: /\n");
copyFileSync(join(root, "deploy", "web.config"), join(dist, "web.config"));
console.log("Self-hosted copy written to dist/");
