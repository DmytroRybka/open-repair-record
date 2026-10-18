import { describe, expect, it } from "vitest";
import { checkRecord } from "../../src/lib/checks";
import { clean, emptyRecord, type RepairRecord } from "../../src/lib/record";
import { EXAMPLES, exampleBySlug } from "../../src/examples";

const codes = (r: RepairRecord, level?: string) =>
  checkRecord(r).filter((f) => !level || f.level === level).map((f) => f.code);

const copy = (slug: string): RepairRecord => structuredClone(exampleBySlug(slug)!.record);

describe("the five examples", () => {
  it.each(EXAMPLES.map((e) => [e.slug]))("%s has no contradiction and nothing missing", (slug) => {
    expect(codes(copy(slug), "contradiction")).toEqual([]);
    expect(codes(copy(slug), "warning")).toEqual([]);
  });
});

describe("contradictions", () => {
  it("closed as confirmed by the resident while the resident never answered", () => {
    const r = copy("ac-no-reply");
    r.closure!.reason_code = "confirmed_by_resident";
    expect(codes(r, "contradiction")).toContain("confirmed-without-yes");
  });

  it("a no-reply closure while the resident did answer", () => {
    const r = copy("kitchen-tap");
    r.closure!.reason_code = "work_reported_done_no_reply";
    expect(codes(r, "contradiction")).toContain("no-reply-reason-mismatch");
  });

  it("closed although the resident says it is not solved", () => {
    const r = copy("ac-reopened");
    r.status = "closed";
    r.closure = { closed_by: { name: "Lina" }, closed_at: "2026-10-21", reason_code: "administrative", reason: "x" };
    expect(codes(r, "contradiction")).toContain("closed-resident-not-resolved");
  });

  it("closed although the last visit had no access", () => {
    const r = copy("no-access");
    r.status = "closed";
    r.closure = { closed_by: { name: "Lina" }, closed_at: "2026-10-14", reason_code: "other", reason: "x" };
    expect(codes(r, "contradiction")).toContain("closed-last-visit-unfinished");
  });

  it("a duplicate may be closed whatever the last visit says", () => {
    const r = copy("no-access");
    r.status = "closed";
    r.closure = { closed_by: { name: "Lina" }, closed_at: "2026-10-14", reason_code: "duplicate" };
    expect(codes(r, "contradiction")).toEqual([]);
  });
});

describe("silence is never a confirmation", () => {
  it("no reply stays no reply, and a no-reply closure is not a contradiction", () => {
    const r = copy("ac-no-reply");
    expect(r.resident.status).toBe("no_reply");
    expect(codes(r, "contradiction")).toEqual([]);
  });

  it("no reply needs the date the resident was asked", () => {
    const r = copy("ac-no-reply");
    delete r.resident.asked_at;
    expect(codes(r, "warning")).toContain("no-reply-no-asked-at");
  });

  it("closing without asking the resident is flagged in a unit, not in a common area", () => {
    const r = copy("kitchen-tap");
    r.resident = { status: "not_asked" };
    r.closure!.reason_code = "administrative";
    r.closure!.reason = "Contractor's word.";
    expect(codes(r, "warning")).toContain("closed-not-asked");
    r.context.area = "common_area";
    r.resident = { status: "not_applicable" };
    expect(codes(r, "warning")).not.toContain("closed-not-asked");
    expect(codes(r, "warning")).not.toContain("not-applicable-in-unit");
  });

  it('"not applicable" in a unit is a warning', () => {
    const r = copy("kitchen-tap");
    r.resident = { status: "not_applicable" };
    expect(codes(r, "warning")).toContain("not-applicable-in-unit");
  });
});

describe("unfinished work", () => {
  it("a temporary fix with no open item", () => {
    const r = copy("ceiling-leak");
    r.open_items = [];
    expect(codes(r, "warning")).toContain("unfinished-no-open-item");
  });

  it("a later full fix makes an earlier temporary fix fine", () => {
    const r = copy("ceiling-leak");
    r.open_items = [];
    r.work.push({ by: { name: "Sam" }, at: "2026-10-22", done: "Ceiling repaired.", outcome: "resolved" });
    expect(codes(r, "warning")).not.toContain("unfinished-no-open-item");
  });

  it("closing with open items left", () => {
    const r = copy("ceiling-leak");
    r.status = "closed";
    r.closure = { closed_by: { name: "Lina" }, closed_at: "2026-10-09", reason_code: "other", reason: "x" };
    expect(codes(r, "warning")).toContain("closed-with-open-items");
  });
});

describe("checks and evidence", () => {
  it("a check with no result is a warning; no limits is a tip", () => {
    const r = copy("kitchen-tap");
    r.checks[0] = { by_role: "technician", method: "visual" };
    expect(codes(r, "warning")).toContain("check-no-result");
    expect(codes(r, "tip")).toContain("check-no-limits");
  });

  it("photos are never required", () => {
    const r = copy("kitchen-tap");
    r.evidence = [];
    expect(codes(r).some((c) => c.includes("photo") || c.includes("evidence"))).toBe(false);
  });

  it("no check at all is only a tip", () => {
    const r = copy("kitchen-tap");
    r.checks = [];
    expect(codes(r, "tip")).toContain("no-checks");
    expect(codes(r, "warning")).toEqual([]);
  });
});

describe("an empty record", () => {
  it("asks for what happened and who says what, and invents nothing", () => {
    const found = codes(emptyRecord());
    expect(found).toEqual(expect.arrayContaining(["no-symptom", "no-location", "no-work"]));
    expect(codes(emptyRecord(), "contradiction")).toEqual([]);
  });

  it("blank rows do not count as entries", () => {
    const r = emptyRecord();
    r.work.push({});
    r.checks.push({ by: undefined } as never);
    expect(codes(r)).toContain("no-work");
    expect(codes(r)).not.toContain("work-no-by");
  });
});

describe("clean", () => {
  it("drops what nobody wrote and keeps the required lists", () => {
    const r = emptyRecord();
    r.work.push({ by: { name: "  " }, done: "" });
    r.id = " ";
    const out = clean(r);
    expect(out).toEqual({
      orr_version: "0.1", context: { area: "unit" }, work: [], checks: [], evidence: [],
      resident: { status: "not_asked" }, open_items: [], status: "open", history: [],
    });
  });

  it("an open record carries no closure", () => {
    const r = copy("kitchen-tap");
    r.status = "open";
    expect(clean(r).closure).toBeUndefined();
  });

  it.each(EXAMPLES.map((e) => [e.slug]))("%s survives export, import and export unchanged", (slug) => {
    const once = JSON.stringify(clean(copy(slug)), null, 2);
    const twice = JSON.stringify(clean(JSON.parse(once)), null, 2);
    expect(twice).toBe(once);
    expect(JSON.parse(once)).toEqual(copy(slug));
  });
});
