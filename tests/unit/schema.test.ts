import { describe, expect, it } from "vitest";
import { parseRecordFile, validateRecord } from "../../src/lib/validate";
import { emptyRecord } from "../../src/lib/record";
import { EXAMPLES, exampleBySlug } from "../../src/examples";
import { contractorRequest, residentRequest } from "../../src/lib/messages";

describe("the JSON Schema", () => {
  it.each(EXAMPLES.map((e) => [e.slug]))("accepts the %s example", (slug) => {
    expect(validateRecord(exampleBySlug(slug)!.record)).toEqual({ ok: true, errors: [] });
  });

  it("accepts an empty record", () => {
    expect(validateRecord(emptyRecord()).ok).toBe(true);
  });

  it("refuses an unknown resident answer", () => {
    const r = structuredClone(exampleBySlug("ac-no-reply")!.record) as unknown as Record<string, any>;
    r.resident.status = "assumed_ok";
    const v = validateRecord(r);
    expect(v.ok).toBe(false);
    expect(v.errors.join(" ")).toContain("resident.status");
  });

  it("refuses an open record with a closure", () => {
    const r = structuredClone(exampleBySlug("kitchen-tap")!.record);
    r.status = "open";
    expect(validateRecord(r).ok).toBe(false);
  });

  it("refuses unknown fields and odd dates", () => {
    const r = structuredClone(exampleBySlug("kitchen-tap")!.record) as unknown as Record<string, any>;
    r.done = true;
    r.context.reported_at = "yesterday";
    const v = validateRecord(r);
    expect(v.errors).toEqual(expect.arrayContaining(['the file: unknown field "done"']));
    expect(v.errors.join(" ")).toContain("context.reported_at: not a date");
  });
});

describe("reading a file", () => {
  it("explains a file that is not JSON or not a record", () => {
    expect(parseRecordFile("{oops").errors[0]).toMatch(/not valid JSON/);
    expect(parseRecordFile('{"hello": 1}').errors[0]).toMatch(/not an Open Repair Record 0.1/);
  });

  it("reads an example back", () => {
    const text = JSON.stringify(exampleBySlug("ac-reopened")!.record);
    expect(parseRecordFile(text).record?.id).toBe("Q-1204");
  });
});

describe("messages", () => {
  it("asks the contractor only for what is missing", () => {
    const r = structuredClone(exampleBySlug("kitchen-tap")!.record);
    expect(contractorRequest(r)).toMatch(/I have everything I need/);
    r.checks = [];
    const text = contractorRequest(r);
    expect(text).toMatch(/how you checked that it works/);
    expect(text).not.toMatch(/what you did/);
  });

  it("asks the contractor for everything when nothing is written", () => {
    const text = contractorRequest(emptyRecord());
    expect(text).toMatch(/what you did/);
    expect(text).toMatch(/anything still left to do/);
  });

  it("asks the resident a yes/no question and assumes nothing", () => {
    const text = residentRequest(exampleBySlug("ac-no-reply")!.record);
    expect(text).toContain("Bluepoint Cooling reports the work was done on 11 Oct 2026, 10:30");
    expect(text).toMatch(/reply 1 for yes or 2 for no/);
  });
});
