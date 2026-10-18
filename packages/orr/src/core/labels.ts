import type {
  Area, CheckMethod, CheckRole, ClosureReasonCode, EvidenceType, HistoryKind, Person, ReporterRole,
} from "./record";

export { OUTCOME_LABELS, RESIDENT_LABELS } from "./checks";

export const AREA_LABELS: Record<Area, string> = { unit: "A unit", common_area: "A common area" };

export const REPORTER_LABELS: Record<ReporterRole, string> = {
  resident: "Resident",
  owner: "Owner",
  staff: "Staff",
  inspection: "Inspection",
  other: "Other",
};

export const CHECK_ROLE_LABELS: Record<CheckRole, string> = {
  technician: "Technician",
  coordinator: "Coordinator",
  inspector: "Inspector",
  resident: "Resident",
  other: "Someone else",
};

export const CHECK_METHOD_LABELS: Record<CheckMethod, string> = {
  test_run: "Test run",
  measurement: "Measurement",
  visual: "Looked at it",
  photo_review: "Reviewed a photo",
  other: "Other",
};

export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  photo: "Photo",
  measurement: "Measurement",
  test_log: "Test log",
  certificate: "Certificate",
  document: "Document",
  other: "Other",
};

export const CLOSURE_LABELS: Record<ClosureReasonCode, string> = {
  confirmed_by_resident: "Confirmed by the resident",
  work_reported_done_no_reply: "Work reported done, no reply from the resident",
  administrative: "Closed for an administrative reason",
  duplicate: "Duplicate of another record",
  cancelled: "Cancelled",
  other: "Other reason",
};

export const HISTORY_LABELS: Record<HistoryKind, string> = {
  resident_reply: "Resident replied",
  revisit: "Revisit",
  correction: "Correction",
  reopened: "Reopened",
  note: "Note",
};

/** "2026-10-12T14:20" → "12 Oct 2026, 14:20". Shown as written: no time zone conversion. */
export function formatDate(value: string | undefined): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  if (!m) return value;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const date = `${Number(m[3])} ${months[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
  return m[4] ? `${date}, ${m[4]}:${m[5]}` : date;
}

export function personLabel(p: Person | undefined): string {
  if (!p) return "";
  const head = [p.name, p.company].filter(Boolean).join(", ");
  return p.role ? (head ? `${head} (${p.role})` : p.role) : head;
}
