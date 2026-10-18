/**
 * open-repair-record: read, validate and check Open Repair Record 1.0 files.
 *
 *   import { parse, check } from "open-repair-record";
 *   const { record, errors } = parse(text);        // JSON text -> record, or the schema errors in plain words
 *   const findings = check(record);                // contradictions, missing parts, tips
 *
 * The same code runs the editor at openrepairrecord.com, so a file gets the same answers everywhere.
 * No dependencies; works in Node.js 18+, browsers, Deno and Bun.
 */
export {
  ORR_VERSION,
  clean,
  emptyRecord,
  isBlank,
  latestWork,
  type Area,
  type Check,
  type CheckMethod,
  type CheckRole,
  type Closure,
  type ClosureReasonCode,
  type Context,
  type Evidence,
  type EvidenceType,
  type HistoryEntry,
  type HistoryKind,
  type OpenItem,
  type Outcome,
  type Person,
  type RepairRecord,
  type ReporterRole,
  type ResidentResponse,
  type ResidentStatus,
  type WorkEntry,
} from "./core/record";
export {
  checkRecord as check,
  checkRecord,
  OUTCOME_LABELS,
  RESIDENT_LABELS,
  type Finding,
  type Level,
  type Section,
} from "./core/checks";
export {
  parseRecordFile as parse,
  parseRecordFile,
  validateRecord as validate,
  validateRecord,
  type Validation,
} from "./core/validate";
export { contractorRequest, residentRequest } from "./core/messages";
export {
  AREA_LABELS,
  CHECK_METHOD_LABELS,
  CHECK_ROLE_LABELS,
  CLOSURE_LABELS,
  EVIDENCE_LABELS,
  HISTORY_LABELS,
  REPORTER_LABELS,
  formatDate,
  personLabel,
} from "./core/labels";

/** The URL of the JSON Schema for this version. The file itself ships in the package: open-repair-record/schema. */
export const SCHEMA_URL = "https://openrepairrecord.com/schema/orr-1.0.schema.json";
