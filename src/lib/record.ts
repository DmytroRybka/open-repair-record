/**
 * Open Repair Record 0.1: the shape of one repair record.
 *
 * Each source of information stays separate: what was reported, what the contractor says, what was checked and
 * by whom, what the resident answered, and who closed the record and why. There is deliberately no single "done"
 * flag, and silence from the resident is stored as `no_reply`, never as a confirmation.
 *
 * Dates are ISO 8601 strings as the person entered them: "2026-10-12" or "2026-10-12T14:20" (local time of the
 * property), optionally with a zone offset. `timezone` names the zone when it matters.
 */

export const ORR_VERSION = "0.1" as const;

export type Area = "unit" | "common_area";
export type ReporterRole = "resident" | "owner" | "staff" | "inspection" | "other";
export type Outcome = "resolved" | "temporary_fix" | "partial" | "not_done" | "no_access";
export type CheckRole = "technician" | "coordinator" | "inspector" | "resident" | "other";
export type CheckMethod = "test_run" | "measurement" | "visual" | "photo_review" | "other";
export type EvidenceType = "photo" | "measurement" | "test_log" | "certificate" | "document" | "other";
export type ResidentStatus = "resolved" | "not_resolved" | "not_asked" | "pending" | "no_reply" | "not_applicable";
export type ClosureReasonCode =
  | "confirmed_by_resident"
  | "work_reported_done_no_reply"
  | "administrative"
  | "duplicate"
  | "cancelled"
  | "other";
export type HistoryKind = "resident_reply" | "revisit" | "correction" | "reopened" | "note";

export interface Person {
  name?: string;
  company?: string;
  role?: string;
}

export interface Context {
  /** Where: building and unit, or the common area ("Tower 2, lobby"). */
  location?: string;
  area?: Area;
  /** The equipment, if known: an asset tag or a plain label ("AC unit, bedroom 2"). */
  asset?: string;
  reported_at?: string;
  reported_by_role?: ReporterRole;
  /** What was reported, in the reporter's terms. The symptom, not the diagnosis. */
  symptom?: string;
}

/** One contractor statement: a visit, or a report of work done. */
export interface WorkEntry {
  by?: Person;
  at?: string;
  /** What the contractor says was done. */
  done?: string;
  /** The contractor's view of the cause. */
  diagnosis?: string;
  outcome?: Outcome;
  follow_up_needed?: boolean;
  follow_up?: string;
}

export interface Check {
  by_role?: CheckRole;
  by_name?: string;
  at?: string;
  method?: CheckMethod;
  /** What the check found. */
  result?: string;
  /** What the check did not cover ("did not inspect the unit"). */
  limits?: string;
}

export interface Evidence {
  type?: EvidenceType;
  description?: string;
  taken_by?: string;
  taken_at?: string;
  /** A file name or a link. Nothing is uploaded by the builder. */
  reference?: string;
}

export interface ResidentResponse {
  status: ResidentStatus;
  asked_at?: string;
  answered_at?: string;
  /** The resident's own words, verbatim. */
  words?: string;
  channel?: string;
}

export interface OpenItem {
  what?: string;
  owner?: string;
  next_step?: string;
  due?: string;
}

export interface Closure {
  closed_by?: Person;
  closed_at?: string;
  reason_code?: ClosureReasonCode;
  reason?: string;
}

/** A later addition. Earlier entries are never rewritten; corrections are added here. */
export interface HistoryEntry {
  at?: string;
  by?: string;
  kind?: HistoryKind;
  text?: string;
  /** For `reopened`: the closure that was in force before the record was reopened, kept verbatim. */
  previous_closure?: Closure;
}

export interface RepairRecord {
  orr_version: typeof ORR_VERSION;
  /** The operator's own reference: a ticket or job number. */
  id?: string;
  title?: string;
  timezone?: string;
  /** Other records about the same problem, such as an earlier job that was closed. */
  related_ids?: string[];
  context: Context;
  work: WorkEntry[];
  checks: Check[];
  evidence: Evidence[];
  resident: ResidentResponse;
  open_items: OpenItem[];
  status: "open" | "closed";
  /** Present only while the record is closed. */
  closure?: Closure;
  history: HistoryEntry[];
}

export function emptyRecord(): RepairRecord {
  return {
    orr_version: ORR_VERSION,
    context: { area: "unit" },
    work: [],
    checks: [],
    evidence: [],
    resident: { status: "not_asked" },
    open_items: [],
    status: "open",
    history: [],
  };
}

/** The last contractor statement, which is the one that describes where the work stands now. */
export function latestWork(record: RepairRecord): WorkEntry | undefined {
  return record.work.length ? record.work[record.work.length - 1] : undefined;
}

/**
 * Drops empty strings, empty optional objects and unset values so that an exported file only says what someone
 * actually wrote. Required lists stay, even when empty. Exporting, importing and exporting again gives the same
 * file.
 */
export function clean(record: RepairRecord): RepairRecord {
  const out = (prune(record) ?? {}) as RepairRecord;
  out.orr_version = ORR_VERSION;
  out.context ??= {};
  for (const key of ["work", "checks", "evidence", "open_items", "history"] as const) {
    out[key] = (out[key] ?? []) as never;
  }
  out.resident ??= { status: "not_asked" };
  out.status ??= "open";
  if (out.status === "open") delete out.closure;
  // The same key order every time, so two exports of the same record are the same text.
  const ordered: Record<string, unknown> = {};
  for (const key of KEY_ORDER) if (key in out) ordered[key] = (out as unknown as Record<string, unknown>)[key];
  for (const [key, v] of Object.entries(out)) if (!(key in ordered)) ordered[key] = v;
  return ordered as unknown as RepairRecord;
}

const KEY_ORDER = [
  "orr_version", "id", "title", "timezone", "related_ids", "context", "work", "checks", "evidence", "resident",
  "open_items", "status", "closure", "history",
];

/** Empty strings, `false`, `null`, empty objects and empty lists all mean "not written" and are removed. */
function prune(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(prune).filter((v) => v !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => [k, prune(v)] as const)
      .filter(([, v]) => v !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (typeof value === "string") return value.trim() === "" ? undefined : value.trim();
  if (value === null || value === false) return undefined;
  return value;
}

/** True when the object has nothing written in it, so an empty "Add a check" row does not count as a check. */
export function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "boolean") return !value;
  if (Array.isArray(value)) return value.every(isBlank);
  if (typeof value === "object") return Object.values(value as object).every(isBlank);
  return false;
}
