import type { RepairRecord } from "./record";
// Precompiled from the JSON Schema by scripts/gen-validator.mjs: no code is compiled in the browser, so the editor
// runs under a Content-Security-Policy without 'unsafe-eval'.
import validator from "./orr-validator.generated.js";

interface AjvError { instancePath: string; keyword: string; params: Record<string, unknown>; message?: string }
type Validator = ((data: unknown) => boolean) & { errors?: AjvError[] | null };
const run = validator as unknown as Validator;

export interface Validation {
  ok: boolean;
  errors: string[];
}

/** Validates a parsed file against the ORR 1.0 JSON Schema and explains each problem in a line. */
export function validateRecord(data: unknown): Validation {
  const ok = run(data);
  const errors = (run.errors ?? []).map((e) => {
    const where = e.instancePath ? e.instancePath.slice(1).replaceAll("/", ".") : "the file";
    if (e.keyword === "additionalProperties") {
      return `${where}: unknown field "${(e.params as { additionalProperty: string }).additionalProperty}"`;
    }
    if (e.keyword === "enum") {
      return `${where}: must be one of ${(e.params as { allowedValues: string[] }).allowedValues.join(", ")}`;
    }
    if (e.keyword === "pattern") return `${where}: not a date like 2026-10-12 or 2026-10-12T14:20`;
    if (e.keyword === "false schema" && where === "closure") return "an open record cannot have a closure";
    if (e.keyword === "if") return null;
    return `${where}: ${e.message ?? "is not valid"}`;
  });
  return { ok: Boolean(ok), errors: [...new Set(errors.filter((e): e is string => e !== null))] };
}

/** Reads the text of a .json file, or explains why it is not an Open Repair Record 1.0. */
export function parseRecordFile(text: string): { record?: RepairRecord; errors: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { errors: ["This file is not valid JSON."] };
  }
  // Files saved on launch day carried the pre-release number "0.1"; the fields are identical, so they open as 1.0.
  if (data && typeof data === "object" && (data as { orr_version?: unknown }).orr_version === "0.1") {
    (data as { orr_version: string }).orr_version = "1.0";
  }
  if (!data || typeof data !== "object" || (data as { orr_version?: unknown }).orr_version !== "1.0") {
    return { errors: ['This is not an Open Repair Record 1.0 file (no "orr_version": "1.0").'] };
  }
  const v = validateRecord(data);
  return v.ok ? { record: data as RepairRecord, errors: [] } : { errors: v.errors };
}
