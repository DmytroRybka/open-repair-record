// Builds the npm package: dist/index.js (the library, no dependencies), dist/cli.js (the orr command, React bundled
// in for `orr render`), dist/index.d.ts (types), and copies the JSON Schema and the licence next to them.
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const at = (p) => resolve(here, p);
rmSync(at("dist"), { recursive: true, force: true });

// "?raw" imports (the stylesheet for `orr render`) become text, as Vite does it.
const raw = {
  name: "raw",
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: resolve(a.resolveDir, a.path.slice(0, -"?raw".length)), namespace: "raw" }));
    b.onLoad({ filter: /.*/, namespace: "raw" }, (a) => ({ contents: readFileSync(a.path, "utf8"), loader: "text" }));
  },
};

await build({
  entryPoints: [at("src/index.ts")],
  outfile: at("dist/index.js"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2021",
  legalComments: "none",
});
await build({
  entryPoints: [at("src/cli.ts")],
  outfile: at("dist/cli.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  jsx: "automatic",
  minify: true,
  plugins: [raw],
  define: { "process.env.NODE_ENV": '"production"' },
  // React's server renderer is CommonJS; give the ESM bundle a require() for its Node built-ins.
  banner: { js: "#!/usr/bin/env node\nimport { createRequire as __orrRequire } from 'node:module'; const require = __orrRequire(import.meta.url);" },
  legalComments: "none",
});

const tsc = spawnSync(`npx tsc -p "${at("tsconfig.json")}"`, { stdio: "inherit", shell: true });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

mkdirSync(at("schema"), { recursive: true });
copyFileSync(at("../../src/schema/orr-1.0.schema.json"), at("schema/orr-1.0.schema.json"));
copyFileSync(at("../../LICENSE"), at("LICENSE"));
console.log("packages/orr built: dist/index.js, dist/cli.js, dist/index.d.ts, schema/");
