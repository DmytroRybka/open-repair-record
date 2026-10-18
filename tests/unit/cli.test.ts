import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run, type Io } from "../../packages/orr/src/run";
import { renderReportHtml } from "../../packages/orr/src/render";
import * as orr from "../../packages/orr/src/index";
import { exampleBySlug } from "../../src/examples";

function io(stdin = ""): Io & { stdout: string; stderr: string } {
  const o = {
    stdout: "",
    stderr: "",
    columns: 100,
    color: false,
    out(s: string) { o.stdout += s + "\n"; },
    err(s: string) { o.stderr += s + "\n"; },
    readStdin: () => stdin,
  };
  return o;
}

const dir = mkdtempSync(join(tmpdir(), "orr-"));
function file(name: string, data: unknown): string {
  const p = join(dir, name);
  writeFileSync(p, typeof data === "string" ? data : JSON.stringify(data));
  return p;
}
const example = (slug: string) => structuredClone(exampleBySlug(slug)!.record);

describe("orr check", () => {
  it("passes the examples, one folder at a time", () => {
    const t = io();
    expect(run(["check", "src/examples"], t)).toBe(0);
    expect(t.stdout.match(/✓ Valid\. Nothing missing/g)).toHaveLength(5);
  });

  it("fails on a contradiction, with the finding in the table", () => {
    const r = example("ac-no-reply");
    r.closure!.reason_code = "confirmed_by_resident";
    const t = io();
    expect(run(["check", file("contradiction.json", r)], t)).toBe(1);
    expect(t.stdout).toContain("│ contradiction │ Closure");
    expect(t.stdout).toContain("✗ Valid against the schema, but the record contradicts itself");
  });

  it("reports missing parts but passes, unless --strict", () => {
    const r = example("kitchen-tap");
    delete r.checks[0]!.result;
    const p = file("missing.json", r);
    expect(run(["check", p], io())).toBe(0);
    expect(run(["check", "--strict", p], io())).toBe(1);
  });

  it("explains a file that is not a record", () => {
    const t = io();
    expect(run(["check", file("bad.json", { orr_version: "1.0", resident: { status: "maybe" } })], t)).toBe(1);
    expect(t.stdout).toContain('the required part "context" is missing');
    expect(t.stdout).toContain("resident.status: must be one of");
    expect(run(["check", file("notjson.json", "{oops")], io())).toBe(1);
    expect(run(["check", join(dir, "nope.json")], io())).toBe(1);
  });

  it("reads standard input with -, and answers in JSON with --json", () => {
    const t = io(JSON.stringify(example("ceiling-leak")));
    expect(run(["check", "-", "--json"], t)).toBe(0);
    const [result] = JSON.parse(t.stdout);
    expect(result).toMatchObject({ file: "-", valid: true, counts: { contradiction: 0, missing: 0 } });
  });
});

describe("the other commands", () => {
  it("validate checks the schema only", () => {
    const r = example("ac-no-reply");
    r.closure!.reason_code = "confirmed_by_resident";
    const t = io();
    expect(run(["validate", file("schema-only.json", r)], t)).toBe(0);
    expect(t.stdout).toContain("✓ Valid against the Open Repair Record 1.0 schema.");
  });

  it("new writes an empty record that is valid", () => {
    const t = io();
    expect(run(["new"], t)).toBe(0);
    expect(orr.validate(JSON.parse(t.stdout)).ok).toBe(true);
  });

  it("render writes a standalone report page", () => {
    const out = join(dir, "report.html");
    expect(run(["render", "src/examples/ac-reopened.json", "-o", out], io(), renderReportHtml)).toBe(0);
    const html = readFileSync(out, "utf8");
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain("Earlier closure, kept as it was");
    expect(html).not.toMatch(/<script|https?:\/\/[^"'\s]*\.(js|css)/);
  });

  it("usage errors exit with 2; help and version exit with 0", () => {
    expect(run([], io())).toBe(2);
    expect(run(["frobnicate"], io())).toBe(2);
    expect(run(["check"], io())).toBe(2);
    const t = io();
    expect(run(["--version"], t)).toBe(0);
    expect(t.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("the library", () => {
  it("exposes parse, validate and check with the editor's answers", () => {
    const { record, errors } = orr.parse(readFileSync("src/examples/ac-no-reply.json", "utf8"));
    expect(errors).toEqual([]);
    expect(orr.check(record!)).toEqual([]);
    expect(orr.ORR_VERSION).toBe("1.0");
    expect(orr.SCHEMA_URL).toBe("https://openrepairrecord.com/schema/orr-1.0.schema.json");
    expect(orr.residentRequest(record!)).toContain("reply 1 for yes or 2 for no");
  });
});
