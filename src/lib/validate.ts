import Ajv2020 from "ajv/dist/2020";
import schema from "../schema/orr-0.1.schema.json";
import type { RepairRecord } from "./record";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validator = ajv.compile<RepairRecord>(schema);

export interface Validation {
  ok: boolean;
  errors: string[];
}

/** Validates a parsed file against the ORR 0.1 JSON Schema and explains each problem in a line. */
export function validateRecord(data: unknown): Validation {
  const ok = validator(data);
  const errors = (validator.errors ?? []).map((e) => {
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

/** Reads the text of a .json file, or explains why it is not an Open Repair Record 0.1. */
export function parseRecordFile(text: string): { record?: RepairRecord; errors: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { errors: ["This file is not valid JSON."] };
  }
  if (!data || typeof data !== "object" || (data as { orr_version?: unknown }).orr_version !== "0.1") {
    return { errors: ['This is not an Open Repair Record 0.1 file (no "orr_version": "0.1").'] };
  }
  const v = validateRecord(data);
  return v.ok ? { record: data as RepairRecord, errors: [] } : { errors: v.errors };
}
