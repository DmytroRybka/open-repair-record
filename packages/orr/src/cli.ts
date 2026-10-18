// orr: the Open Repair Record command line. See run.ts for the commands.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { run } from "./run";
import { renderReportHtml } from "./render";

const color = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const code = run(
  process.argv.slice(2),
  {
    out: (s) => process.stdout.write(s + "\n"),
    err: (s) => process.stderr.write(s + "\n"),
    columns: process.stdout.columns || 100,
    color,
    readStdin: () => readFileSync(0, "utf8"),
    schemaPath: fileURLToPath(new URL("../schema/orr-1.0.schema.json", import.meta.url)),
  },
  renderReportHtml,
);
process.exitCode = code;
