// Shared test vectors for every Open Repair Record library. The TypeScript core (the one the editor runs) is the
// reference: for each input it records the schema errors, the findings, the two messages and the cleaned record.
// The Python and .NET test suites load vectors/orr-1.0.json and must give the same answers.
//   node packages/orr/build.mjs && node scripts/gen-vectors.mjs      (a unit test fails if the file is stale)
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

export const TARGET = new URL("../vectors/orr-1.0.json", import.meta.url);

const examples = Object.fromEntries(
  readdirSync(new URL("../src/examples/", import.meta.url)).filter((f) => f.endsWith(".json")).sort()
    .map((f) => [f.replace(/\.json$/, ""), JSON.parse(readFileSync(new URL(`../src/examples/${f}`, import.meta.url), "utf8"))]),
);
const ex = (slug) => structuredClone(examples[slug]);
const edit = (slug, fn) => { const r = ex(slug); fn(r); return r; };

/** [name, input]. Inputs are JSON values; "text" cases are raw strings for parse(). */
function cases(lib) {
  const list = Object.keys(examples).map((s) => [`example ${s}`, ex(s)]);
  const add = (name, value) => list.push([name, value]);

  // Contradictions
  add("confirmed without a yes", edit("ac-no-reply", (r) => { r.closure.reason_code = "confirmed_by_resident"; }));
  add("no-reply reason while the resident answered", edit("kitchen-tap", (r) => { r.closure.reason_code = "work_reported_done_no_reply"; }));
  add("closed although not resolved", edit("ac-reopened", (r) => { r.status = "closed"; r.closure = { closed_by: { name: "Lina" }, closed_at: "2026-10-21", reason_code: "administrative", reason: "x" }; }));
  add("closed after no access", edit("no-access", (r) => { r.status = "closed"; r.closure = { closed_by: { name: "Lina" }, closed_at: "2026-10-14", reason_code: "other", reason: "x" }; }));
  add("duplicate closes anything", edit("no-access", (r) => { r.status = "closed"; r.closure = { closed_by: { name: "Lina" }, closed_at: "2026-10-14", reason_code: "duplicate" }; }));
  add("not applicable in a unit", edit("kitchen-tap", (r) => { r.resident = { status: "not_applicable" }; }));
  add("common area, not applicable, not asked closure", edit("kitchen-tap", (r) => { r.context.area = "common_area"; r.resident = { status: "not_applicable" }; r.closure.reason_code = "administrative"; r.closure.reason = "Lobby light."; }));
  // Missing parts and tips
  add("empty record", lib.emptyRecord());
  add("blank rows only", (() => { const r = lib.emptyRecord(); r.work.push({}); r.checks.push({}); r.evidence.push({}); r.open_items.push({}); r.history.push({}); return r; })());
  add("statement without who, when, outcome or text", edit("kitchen-tap", (r) => { r.work = [{ diagnosis: "Worn cartridge." }]; }));
  add("follow-up needed but not described", edit("kitchen-tap", (r) => { r.work[0].follow_up_needed = true; }));
  add("temporary fix without an open item", edit("ceiling-leak", (r) => { r.open_items = []; }));
  add("partial work without an open item", edit("ceiling-leak", (r) => { r.open_items = []; r.work[0].outcome = "partial"; }));
  add("later full fix", edit("ceiling-leak", (r) => { r.open_items = []; r.work.push({ by: { name: "Sam" }, at: "2026-10-22", done: "Ceiling repaired.", outcome: "resolved" }); }));
  add("resolved without a cause", edit("kitchen-tap", (r) => { delete r.work[0].diagnosis; }));
  add("no checks", edit("kitchen-tap", (r) => { r.checks = []; }));
  add("no checks after no access", edit("no-access", (r) => { r.checks = []; }));
  add("check without result, who or limits", edit("kitchen-tap", (r) => { r.checks[0] = { method: "visual" }; }));
  add("evidence without description", edit("kitchen-tap", (r) => { delete r.evidence[0].description; }));
  add("no reply without asked date", edit("ac-no-reply", (r) => { delete r.resident.asked_at; }));
  add("pending without asked date", edit("ceiling-leak", (r) => { delete r.resident.asked_at; }));
  add("answer without words or date", edit("kitchen-tap", (r) => { delete r.resident.words; delete r.resident.answered_at; }));
  add("open item without what, owner or due", edit("ceiling-leak", (r) => { r.open_items = [{ next_step: "Call the decorator." }]; }));
  add("closed with nothing filled in", edit("kitchen-tap", (r) => { r.closure = {}; }));
  add("administrative closure without reason", edit("kitchen-tap", (r) => { r.closure.reason_code = "administrative"; }));
  add("closed while pending", edit("ceiling-leak", (r) => { r.open_items = []; r.status = "closed"; r.closure = { closed_by: { name: "Lina" }, closed_at: "2026-10-09", reason_code: "other", reason: "x" }; }));
  add("closed without asking", edit("kitchen-tap", (r) => { r.resident = { status: "not_asked" }; r.closure.reason_code = "administrative"; r.closure.reason = "Contractor's word."; }));
  add("closed with open items", edit("ceiling-leak", (r) => { r.status = "closed"; r.closure = { closed_by: { name: "Lina" }, closed_at: "2026-10-09", reason_code: "other", reason: "x" }; }));
  add("history entry without text or date", edit("kitchen-tap", (r) => { r.history = [{ by: "Lina", kind: "note" }]; }));
  add("reopened entry needs no text", edit("kitchen-tap", (r) => { r.history = [{ at: "2026-10-08", by: "Lina", kind: "reopened" }]; }));
  add("no id, no location, no symptom", edit("kitchen-tap", (r) => { delete r.id; delete r.context.location; delete r.context.symptom; }));
  // Schema errors
  add("not an object", ["orr_version", "1.0"]);
  add("unknown fields, top and nested", edit("kitchen-tap", (r) => { r.done = true; r.work[0].signed = "yes"; r.resident.mood = "happy"; }));
  add("bad enums at three depths", edit("kitchen-tap", (r) => { r.resident.status = "assumed_ok"; r.work[0].outcome = "done"; r.context.area = "garden"; }));
  add("bad dates", edit("kitchen-tap", (r) => { r.context.reported_at = "yesterday"; r.work[0].at = "06/10/2026"; r.closure.closed_at = "2026-10-07 08:30"; }));
  add("open record with a closure", edit("kitchen-tap", (r) => { r.status = "open"; }));
  add("missing required parts", { orr_version: "1.0", resident: {} });
  add("wrong types", edit("kitchen-tap", (r) => { r.work = { done: "x" }; r.checks[0].result = 42; r.resident.words = ["yes"]; r.context = "Flat 2B"; r.work_extra = null; }));
  add("wrong version", edit("kitchen-tap", (r) => { r.orr_version = "2.0"; }));
  add("number where a date goes", edit("kitchen-tap", (r) => { r.context.reported_at = 20261005; }));
  add("follow_up_needed as text", edit("kitchen-tap", (r) => { r.work[0].follow_up_needed = "yes"; }));
  return list;
}

const TEXTS = [
  ["text: not JSON", "{oops"],
  ["text: JSON but not a record", '{"hello": 1}'],
  ["text: a launch-day 0.1 file", JSON.stringify({ ...ex("kitchen-tap"), orr_version: "0.1" })],
  ["text: a valid record", JSON.stringify(ex("ac-reopened"))],
  ["text: an invalid record", JSON.stringify({ orr_version: "1.0", resident: { status: "maybe" } })],
];

/** lib: the open-repair-record core (the built package from the command line, the TypeScript source in tests). */
export function generate(lib) {
  const records = cases(lib).map(([name, input]) => {
    const v = lib.validate(input);
    const out = { name, input, valid: v.ok, errors: [...v.errors].sort() };
    if (v.ok) {
      out.findings = lib.check(input);
      out.contractor_request = lib.contractorRequest(input);
      out.resident_request = lib.residentRequest(input);
      out.clean = lib.clean(input);
    }
    return out;
  });
  const texts = TEXTS.map(([name, text]) => {
    const p = lib.parse(text);
    return { name, text, ok: Boolean(p.record), errors: [...p.errors].sort(), ...(p.record ? { orr_version: p.record.orr_version } : {}) };
  });
  return JSON.stringify({ format: "orr-1.0", note: "Generated by scripts/gen-vectors.mjs from the TypeScript core. Do not edit.", records, texts }, null, 2) + "\n";
}

if (process.argv[1]?.endsWith("gen-vectors.mjs")) {
  const lib = await import(new URL("../packages/orr/dist/index.js", import.meta.url).href);
  const fresh = generate(lib);
  if (process.argv.includes("--check")) {
    // Used by npm test: the committed vectors must match what the TypeScript core says today.
    if (readFileSync(TARGET, "utf8") !== fresh) {
      console.error("vectors/orr-1.0.json is stale: run node packages/orr/build.mjs && node scripts/gen-vectors.mjs");
      process.exit(1);
    }
    console.log("vectors/orr-1.0.json is up to date");
  } else {
    writeFileSync(TARGET, fresh);
    console.log("vectors/orr-1.0.json written");
  }
}
