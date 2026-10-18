/**
 * The orr command line, as a function: run(argv, io) returns the exit code. cli.ts wires it to the process; tests
 * call it directly.
 *
 *   orr check <file|dir|->...   schema + the editor's checks, as a table (or --json); exit 1 on a contradiction
 *   orr validate <file|dir|->...  the JSON Schema only
 *   orr render <file> [-o out.html]  the readable report as a standalone HTML page, ready to print
 *   orr new [-o file.json]       an empty record to fill in
 *   orr schema                   where the JSON Schema is
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { SCHEMA_URL, checkRecord, clean, emptyRecord, parseRecordFile, type Finding, type RepairRecord } from "./index";
import pkg from "../package.json";

export interface Io {
  out(text: string): void;
  err(text: string): void;
  /** Terminal width for the table. */
  columns: number;
  color: boolean;
  readStdin(): string;
  /** Where the bundled schema file is, if known. */
  schemaPath?: string;
}

type Render = (record: RepairRecord) => string;

const USAGE = `Open Repair Record ${pkg.version} (format 1.0)

Usage:
  orr check <file|dir|->...      Validate against the schema and run the checks
  orr validate <file|dir|->...   Validate against the JSON Schema only
  orr render <file> [-o out.html]  Write the readable report as an HTML page
  orr new [-o file.json]         Start an empty record
  orr schema                     Show where the JSON Schema is

Options:
  --json      Machine-readable output (check, validate)
  --strict    Also fail when something is missing, not only on contradictions
  -o, --out   Output file (render, new)
  -h, --help  This help        -v, --version  The version

Exit codes: 0 fine · 1 a file is invalid, unreadable or contradicts itself (or misses parts, with --strict) · 2 usage
More: https://openrepairrecord.com/tools/`;

const SECTION: Record<Finding["section"], string> = {
  context: "What was reported",
  work: "Statement",
  checks: "Check",
  evidence: "Evidence",
  resident: "The resident",
  open_items: "Open item",
  closure: "Closure",
  history: "Later addition",
};
const LEVEL: Record<Finding["level"], string> = { contradiction: "contradiction", warning: "missing", tip: "tip" };

interface FileResult {
  file: string;
  valid: boolean;
  errors: string[];
  findings: Finding[];
  counts: { contradiction: number; missing: number; tip: number };
}

export function run(argv: string[], io: Io, render?: Render): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        json: { type: "boolean" },
        strict: { type: "boolean" },
        out: { type: "string", short: "o" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (e) {
    io.err(`${(e as Error).message}\n\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;
  const [command, ...rest] = positionals;
  if (values.version) {
    io.out(pkg.version);
    return 0;
  }
  if (values.help || !command || command === "help") {
    io.out(USAGE);
    return command || values.help ? 0 : 2;
  }

  switch (command) {
    case "check":
    case "validate": {
      if (rest.length === 0) {
        io.err(`orr ${command}: name at least one file, folder or - for standard input.`);
        return 2;
      }
      const results = expand(rest).map((f) => evaluate(f, io, command === "check"));
      if (values.json) io.out(JSON.stringify(results, null, 2));
      else results.forEach((r) => printResult(r, io, command === "check"));
      const failed = results.some((r) => !r.valid || r.counts.contradiction > 0 || (values.strict && r.counts.missing > 0));
      return failed ? 1 : 0;
    }
    case "render": {
      if (!render) {
        io.err("orr render is not available here.");
        return 2;
      }
      if (rest.length !== 1) {
        io.err("orr render: name exactly one file.");
        return 2;
      }
      const { record, errors } = parseRecordFile(read(rest[0]!, io) ?? "");
      if (!record) {
        io.err(`${rest[0]}: not a valid Open Repair Record 1.0 file.\n${errors.map((e) => `  - ${e}`).join("\n")}`);
        return 1;
      }
      const html = render(record);
      if (values.out) {
        writeFileSync(values.out, html);
        io.err(`Wrote ${values.out}. Open it in a browser and print, or save as PDF.`);
      } else {
        io.out(html);
      }
      return 0;
    }
    case "new": {
      const text = JSON.stringify(clean(emptyRecord()), null, 2) + "\n";
      if (values.out) {
        writeFileSync(values.out, text, { flag: "wx" });
        io.err(`Wrote ${values.out}.`);
      } else {
        io.out(text.trimEnd());
      }
      return 0;
    }
    case "schema": {
      io.out(io.schemaPath ? `${SCHEMA_URL}\n${io.schemaPath}` : SCHEMA_URL);
      return 0;
    }
    default:
      io.err(`Unknown command "${command}".\n\n${USAGE}`);
      return 2;
  }
}

/** Files as given; folders become their *.json files; "-" is standard input. */
function expand(paths: string[]): string[] {
  return paths.flatMap((p) => {
    if (p === "-") return [p];
    try {
      if (statSync(p).isDirectory()) {
        return readdirSync(p).filter((n) => n.toLowerCase().endsWith(".json")).sort().map((n) => join(p, n));
      }
    } catch {
      /* not there: reported when read */
    }
    return [p];
  });
}

function read(file: string, io: Io): string | undefined {
  try {
    return file === "-" ? io.readStdin() : readFileSync(file, "utf8");
  } catch (e) {
    return undefined;
  }
}

function evaluate(file: string, io: Io, withChecks: boolean): FileResult {
  const text = read(file, io);
  const counts = { contradiction: 0, missing: 0, tip: 0 };
  if (text === undefined) return { file, valid: false, errors: ["Cannot read the file."], findings: [], counts };
  const { record, errors } = parseRecordFile(text);
  if (!record) return { file, valid: false, errors, findings: [], counts };
  const findings = withChecks ? checkRecord(record) : [];
  for (const f of findings) counts[LEVEL[f.level] as keyof typeof counts]++;
  return { file, valid: true, errors: [], findings, counts };
}

/* ---------------------------------------------------------------------------------------------- */

function printResult(r: FileResult, io: Io, withChecks: boolean) {
  const c = paint(io.color);
  io.out(`${c.bold(withChecks ? "Checking" : "Validating")} ${r.file} ${c.dim("(Open Repair Record 1.0)")}`);
  if (!r.valid) {
    io.out(table([["Result", "Where", "Problem"], ...r.errors.map((e) => [c.red("invalid"), "schema", e])], io.columns));
    io.out(`${c.red("✗")} Not a valid record: ${r.errors.length} problem${r.errors.length === 1 ? "" : "s"}.\n`);
    return;
  }
  if (r.findings.length > 0) {
    const rows = r.findings.map((f) => [
      f.level === "contradiction" ? c.red(LEVEL[f.level]) : f.level === "warning" ? c.yellow(LEVEL[f.level]) : c.dim(LEVEL[f.level]),
      `${SECTION[f.section]}${f.index !== undefined ? ` ${f.index + 1}` : ""}`,
      f.message,
    ]);
    io.out(table([["Result", "Where", "Finding"], ...rows], io.columns));
  }
  const { contradiction, missing, tip } = r.counts;
  const counts = `${contradiction} contradiction${contradiction === 1 ? "" : "s"} · ${missing} missing · ${tip} tip${tip === 1 ? "" : "s"}`;
  const tips = tip ? ` (${tip} tip${tip === 1 ? "" : "s"})` : "";
  if (!withChecks) io.out(`${c.green("✓")} Valid against the Open Repair Record 1.0 schema.\n`);
  else if (contradiction > 0) io.out(`${c.red("✗")} Valid against the schema, but the record contradicts itself: ${counts}.\n`);
  else if (missing > 0) io.out(`${c.yellow("!")} Valid, with parts missing: ${counts}.\n`);
  else io.out(`${c.green("✓")} Valid. Nothing missing that the check can see${tips}.\n`);
}

/** A box-drawn table; the last column wraps to fit the terminal. Cells may carry ANSI colour codes. */
function table(rows: string[][], columns: number): string {
  const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
  const fixed = [0, 1].map((i) => Math.max(...rows.map((r) => plain(r[i] ?? "").length)));
  const last = Math.max(24, Math.min(80, columns - fixed[0]! - fixed[1]! - 10));
  const widths = [fixed[0]!, fixed[1]!, last];
  const line = (l: string, m: string, r: string) => l + widths.map((w) => "─".repeat(w + 2)).join(m) + r;
  const out = [line("╭", "┬", "╮")];
  rows.forEach((row, i) => {
    const wrapped = wrap(row[2] ?? "", last);
    wrapped.forEach((part, j) => {
      const cells = [j === 0 ? row[0]! : "", j === 0 ? row[1]! : "", part];
      out.push("│" + cells.map((cell, k) => ` ${cell}${" ".repeat(widths[k]! - plain(cell).length)} `).join("│") + "│");
    });
    if (i === 0) out.push(line("├", "┼", "┤"));
  });
  out.push(line("╰", "┴", "╯"));
  return out.join("\n");
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > width) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur || lines.length === 0) lines.push(cur);
  return lines;
}

function paint(on: boolean) {
  const wrapWith = (code: string) => (s: string) => (on ? `\x1b[${code}m${s}\x1b[0m` : s);
  return { red: wrapWith("31"), yellow: wrapWith("33"), green: wrapWith("32"), dim: wrapWith("2"), bold: wrapWith("1") };
}
