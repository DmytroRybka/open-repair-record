/**
 * "Check a report": finds contradictions, missing parts and small improvements in a record.
 *
 * It reads only what is written. It never judges the quality of the work, never asks for a photo, and never
 * turns silence into a confirmation.
 */
import { isBlank, latestWork, type RepairRecord } from "./record";

export type Level = "contradiction" | "warning" | "tip";
export type Section = "context" | "work" | "checks" | "evidence" | "resident" | "open_items" | "closure" | "history";

export interface Finding {
  code: string;
  level: Level;
  section: Section;
  /** Which entry in a list the finding is about, counted from 0. */
  index?: number;
  message: string;
}

const ENDS_THE_JOB = new Set(["duplicate", "cancelled"]);

export function checkRecord(r: RepairRecord): Finding[] {
  const out: Finding[] = [];
  const add = (code: string, level: Level, section: Section, message: string, index?: number) =>
    out.push(index === undefined ? { code, level, section, message } : { code, level, section, message, index });

  const work = r.work.filter((w) => !isBlank(w));
  const checks = r.checks.filter((c) => !isBlank(c));
  const openItems = r.open_items.filter((o) => !isBlank(o));
  const last = latestWork({ ...r, work });
  const closed = r.status === "closed";
  const reason = r.closure?.reason_code;
  const endsTheJob = reason !== undefined && ENDS_THE_JOB.has(reason);
  const res = r.resident.status;
  const inUnit = (r.context.area ?? "unit") === "unit";

  // Contradictions: two parts of the record say different things.
  if (closed && reason === "confirmed_by_resident" && res !== "resolved") {
    add("confirmed-without-yes", "contradiction", "closure",
      `Closed as "confirmed by the resident", but the resident's answer is "${residentLabel(res)}".`);
  }
  if (closed && reason === "work_reported_done_no_reply" && res !== "no_reply") {
    add("no-reply-reason-mismatch", "contradiction", "closure",
      `Closed as "no reply from the resident", but the resident's answer is "${residentLabel(res)}".`);
  }
  if (closed && res === "not_resolved" && !endsTheJob) {
    add("closed-resident-not-resolved", "contradiction", "closure",
      "The resident says the problem is not solved, but the record is closed. Reopen it, or say why it was closed.");
  }
  if (closed && last && (last.outcome === "no_access" || last.outcome === "not_done") && !endsTheJob) {
    add("closed-last-visit-unfinished", "contradiction", "closure",
      `The last visit says "${outcomeLabel(last.outcome)}", but the record is closed.`);
  }
  if (inUnit && res === "not_applicable") {
    add("not-applicable-in-unit", "warning", "resident",
      '"Not applicable" is meant for common areas. For a unit, ask the resident, or say why you could not.');
  }

  // What happened.
  if (isBlank(r.context.symptom)) {
    add("no-symptom", "warning", "context", "Say what was reported, in the reporter's words.");
  }
  if (isBlank(r.context.location)) {
    add("no-location", "warning", "context", "Say where: the building and unit, or the common area.");
  }
  if (isBlank(r.id)) {
    add("no-id", "tip", "context", "Add your job or ticket number, so the report can be matched to your system.");
  }

  // Contractor statements.
  if (work.length === 0) {
    add("no-work", "warning", "work", "No contractor statement yet: who says what was done, and when.");
  }
  r.work.forEach((w, i) => {
    if (isBlank(w)) return;
    if (isBlank(w.by)) add("work-no-by", "warning", "work", "Say who made this statement.", i);
    if (isBlank(w.at)) add("work-no-at", "warning", "work", "Add when the work was done.", i);
    if (!w.outcome) add("work-no-outcome", "warning", "work", "Choose the outcome the contractor reports.", i);
    if (isBlank(w.done) && w.outcome !== "no_access") {
      add("work-no-done", "warning", "work", "Describe what was done, in the contractor's words.", i);
    }
    if (w.follow_up_needed && isBlank(w.follow_up)) {
      add("work-follow-up-blank", "warning", "work", "Follow-up is needed: say what it is.", i);
    }
  });
  if (last && (last.outcome === "temporary_fix" || last.outcome === "partial" || last.follow_up_needed)
      && openItems.length === 0) {
    add("unfinished-no-open-item", "warning", "open_items",
      "The latest work is not a full fix. Add an open item: what is left, who owns it, and by when.");
  }
  if (last && last.outcome === "resolved" && isBlank(last.diagnosis)) {
    add("no-diagnosis", "tip", "work", "If the contractor knows the cause, add it. It helps when the fault comes back.",
      r.work.lastIndexOf(last));
  }

  // Checks.
  if (work.length > 0 && checks.length === 0 && last?.outcome !== "no_access") {
    add("no-checks", "tip", "checks",
      "No check is recorded. That is fine, but the report will show the contractor's statement only.");
  }
  r.checks.forEach((c, i) => {
    if (isBlank(c)) return;
    if (isBlank(c.result)) add("check-no-result", "warning", "checks", "Write what the check found.", i);
    if (!c.by_role && isBlank(c.by_name)) add("check-no-by", "warning", "checks", "Say who checked.", i);
    if (isBlank(c.limits)) {
      add("check-no-limits", "tip", "checks", 'Say what the check did not cover, e.g. "did not inspect the unit".', i);
    }
  });

  // Evidence.
  r.evidence.forEach((e, i) => {
    if (isBlank(e)) return;
    if (isBlank(e.description)) add("evidence-no-description", "tip", "evidence", "Say what this item shows.", i);
  });

  // The resident.
  if (res === "no_reply" && isBlank(r.resident.asked_at)) {
    add("no-reply-no-asked-at", "warning", "resident", "No reply: add when the resident was asked.");
  }
  if (res === "pending" && isBlank(r.resident.asked_at)) {
    add("pending-no-asked-at", "warning", "resident", "Waiting for an answer: add when the resident was asked.");
  }
  if ((res === "resolved" || res === "not_resolved") && isBlank(r.resident.words)) {
    add("answer-no-words", "tip", "resident", "Quote the resident's own words.");
  }
  if ((res === "resolved" || res === "not_resolved") && isBlank(r.resident.answered_at)) {
    add("answer-no-date", "tip", "resident", "Add when the resident answered.");
  }

  // Open items.
  r.open_items.forEach((o, i) => {
    if (isBlank(o)) return;
    if (isBlank(o.what)) add("open-item-no-what", "warning", "open_items", "Say what is still open.", i);
    if (isBlank(o.owner) || isBlank(o.due)) {
      add("open-item-no-owner", "tip", "open_items", "Give this open item an owner and a date.", i);
    }
  });

  // Closure.
  if (closed) {
    const c = r.closure ?? {};
    if (isBlank(c.closed_by)) add("closed-no-by", "warning", "closure", "Say who closed the record.");
    if (isBlank(c.closed_at)) add("closed-no-at", "warning", "closure", "Add when the record was closed.");
    if (!c.reason_code) {
      add("closed-no-reason", "warning", "closure", "Choose why the record was closed.");
    } else if ((c.reason_code === "administrative" || c.reason_code === "other") && isBlank(c.reason)) {
      add("closed-reason-blank", "warning", "closure", "Explain the reason in a sentence.");
    }
    if (!endsTheJob && res === "pending") {
      add("closed-while-pending", "warning", "closure", "Closed while still waiting for the resident's answer.");
    }
    if (!endsTheJob && inUnit && res === "not_asked") {
      add("closed-not-asked", "warning", "closure",
        "Closed without asking the resident. If you could not ask, say why in the reason.");
    }
    if (!endsTheJob && openItems.length > 0) {
      add("closed-with-open-items", "warning", "closure",
        `Closed with ${openItems.length} open item${openItems.length === 1 ? "" : "s"}. Keep the record open, ` +
        "or say in the reason who follows them up.");
    }
  }

  // History.
  r.history.forEach((h, i) => {
    if (isBlank(h)) return;
    if (isBlank(h.text) && h.kind !== "reopened") {
      add("history-no-text", "warning", "history", "Write what this later entry says.", i);
    }
    if (isBlank(h.at)) add("history-no-at", "warning", "history", "Add when this was added.", i);
  });

  const rank: Record<Level, number> = { contradiction: 0, warning: 1, tip: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

export function residentLabel(s: RepairRecord["resident"]["status"]): string {
  return RESIDENT_LABELS[s];
}

export function outcomeLabel(o: string | undefined): string {
  return o ? (OUTCOME_LABELS as Record<string, string>)[o] ?? o : "not stated";
}

export const RESIDENT_LABELS = {
  resolved: "Resolved",
  not_resolved: "Not resolved",
  not_asked: "Not asked yet",
  pending: "Asked, waiting for an answer",
  no_reply: "No reply",
  not_applicable: "Not applicable",
} as const;

export const OUTCOME_LABELS = {
  resolved: "Resolved",
  temporary_fix: "Temporary fix",
  partial: "Partly done",
  not_done: "Not done",
  no_access: "No access",
} as const;
