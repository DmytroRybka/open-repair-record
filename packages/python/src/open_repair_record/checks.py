"""Check a report: contradictions, missing parts and small improvements. The same rules, codes and messages as the
editor at openrepairrecord.com. It reads only what is written: it never judges the work, never asks for a photo,
and never turns silence into a confirmation."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .labels import OUTCOME_LABELS, RESIDENT_LABELS
from .record import RepairRecord, is_blank, latest_work

Finding = Dict[str, Any]
"""{"code", "level" ("contradiction" | "warning" | "tip"), "section", "message", and "index" for list entries}."""

_ENDS_THE_JOB = {"duplicate", "cancelled"}
_RANK = {"contradiction": 0, "warning": 1, "tip": 2}


def resident_label(status: str) -> str:
    return RESIDENT_LABELS[status]


def outcome_label(outcome: Optional[str]) -> str:
    return OUTCOME_LABELS.get(outcome, outcome) if outcome else "not stated"


def check(r: RepairRecord) -> List[Finding]:
    out: List[Finding] = []

    def add(code: str, level: str, section: str, message: str, index: Optional[int] = None) -> None:
        f: Finding = {"code": code, "level": level, "section": section, "message": message}
        if index is not None:
            f["index"] = index
        out.append(f)

    context = r.get("context") or {}
    resident = r.get("resident") or {}
    closure = r.get("closure")
    all_work = r.get("work") or []
    all_checks = r.get("checks") or []
    work = [w for w in all_work if not is_blank(w)]
    checks = [c for c in all_checks if not is_blank(c)]
    open_items = [o for o in (r.get("open_items") or []) if not is_blank(o)]
    last = latest_work(all_work)
    closed = r.get("status") == "closed"
    reason = closure.get("reason_code") if isinstance(closure, dict) else None
    ends_the_job = reason is not None and reason in _ENDS_THE_JOB
    res = resident.get("status")
    area = context.get("area")
    in_unit = (area if area is not None else "unit") == "unit"

    # Contradictions: two parts of the record say different things.
    if closed and reason == "confirmed_by_resident" and res != "resolved":
        add("confirmed-without-yes", "contradiction", "closure",
            f'Closed as "confirmed by the resident", but the resident\'s answer is "{resident_label(res)}".')
    if closed and reason == "work_reported_done_no_reply" and res != "no_reply":
        add("no-reply-reason-mismatch", "contradiction", "closure",
            f'Closed as "no reply from the resident", but the resident\'s answer is "{resident_label(res)}".')
    if closed and res == "not_resolved" and not ends_the_job:
        add("closed-resident-not-resolved", "contradiction", "closure",
            "The resident says the problem is not solved, but the record is closed. Reopen it, or say why it was closed.")
    if closed and last and last.get("outcome") in ("no_access", "not_done") and not ends_the_job:
        add("closed-last-visit-unfinished", "contradiction", "closure",
            f'The last visit says "{outcome_label(last.get("outcome"))}", but the record is closed.')
    if in_unit and res == "not_applicable":
        add("not-applicable-in-unit", "warning", "resident",
            '"Not applicable" is meant for common areas. For a unit, ask the resident, or say why you could not.')

    # What happened.
    if is_blank(context.get("symptom")):
        add("no-symptom", "warning", "context", "Say what was reported, in the reporter's words.")
    if is_blank(context.get("location")):
        add("no-location", "warning", "context", "Say where: the building and unit, or the common area.")
    if is_blank(r.get("id")):
        add("no-id", "tip", "context", "Add your job or ticket number, so the report can be matched to your system.")

    # Contractor statements.
    if not work:
        add("no-work", "warning", "work", "No contractor statement yet: who says what was done, and when.")
    for i, w in enumerate(all_work):
        if is_blank(w):
            continue
        if is_blank(w.get("by")):
            add("work-no-by", "warning", "work", "Say who made this statement.", i)
        if is_blank(w.get("at")):
            add("work-no-at", "warning", "work", "Add when the work was done.", i)
        if not w.get("outcome"):
            add("work-no-outcome", "warning", "work", "Choose the outcome the contractor reports.", i)
        if is_blank(w.get("done")) and w.get("outcome") != "no_access":
            add("work-no-done", "warning", "work", "Describe what was done, in the contractor's words.", i)
        if w.get("follow_up_needed") and is_blank(w.get("follow_up")):
            add("work-follow-up-blank", "warning", "work", "Follow-up is needed: say what it is.", i)
    if last and (last.get("outcome") in ("temporary_fix", "partial") or last.get("follow_up_needed")) and not open_items:
        add("unfinished-no-open-item", "warning", "open_items",
            "The latest work is not a full fix. Add an open item: what is left, who owns it, and by when.")
    if last and last.get("outcome") == "resolved" and is_blank(last.get("diagnosis")):
        index = max(i for i, w in enumerate(all_work) if w is last)
        add("no-diagnosis", "tip", "work", "If the contractor knows the cause, add it. It helps when the fault comes back.",
            index)

    # Checks.
    if work and not checks and (last or {}).get("outcome") != "no_access":
        add("no-checks", "tip", "checks",
            "No check is recorded. That is fine, but the report will show the contractor's statement only.")
    for i, c in enumerate(all_checks):
        if is_blank(c):
            continue
        if is_blank(c.get("result")):
            add("check-no-result", "warning", "checks", "Write what the check found.", i)
        if not c.get("by_role") and is_blank(c.get("by_name")):
            add("check-no-by", "warning", "checks", "Say who checked.", i)
        if is_blank(c.get("limits")):
            add("check-no-limits", "tip", "checks", 'Say what the check did not cover, e.g. "did not inspect the unit".', i)

    # Evidence.
    for i, e in enumerate(r.get("evidence") or []):
        if is_blank(e):
            continue
        if is_blank(e.get("description")):
            add("evidence-no-description", "tip", "evidence", "Say what this item shows.", i)

    # The resident.
    if res == "no_reply" and is_blank(resident.get("asked_at")):
        add("no-reply-no-asked-at", "warning", "resident", "No reply: add when the resident was asked.")
    if res == "pending" and is_blank(resident.get("asked_at")):
        add("pending-no-asked-at", "warning", "resident", "Waiting for an answer: add when the resident was asked.")
    if res in ("resolved", "not_resolved") and is_blank(resident.get("words")):
        add("answer-no-words", "tip", "resident", "Quote the resident's own words.")
    if res in ("resolved", "not_resolved") and is_blank(resident.get("answered_at")):
        add("answer-no-date", "tip", "resident", "Add when the resident answered.")

    # Open items.
    for i, o in enumerate(r.get("open_items") or []):
        if is_blank(o):
            continue
        if is_blank(o.get("what")):
            add("open-item-no-what", "warning", "open_items", "Say what is still open.", i)
        if is_blank(o.get("owner")) or is_blank(o.get("due")):
            add("open-item-no-owner", "tip", "open_items", "Give this open item an owner and a date.", i)

    # Closure.
    if closed:
        c = closure if isinstance(closure, dict) else {}
        if is_blank(c.get("closed_by")):
            add("closed-no-by", "warning", "closure", "Say who closed the record.")
        if is_blank(c.get("closed_at")):
            add("closed-no-at", "warning", "closure", "Add when the record was closed.")
        if not c.get("reason_code"):
            add("closed-no-reason", "warning", "closure", "Choose why the record was closed.")
        elif c.get("reason_code") in ("administrative", "other") and is_blank(c.get("reason")):
            add("closed-reason-blank", "warning", "closure", "Explain the reason in a sentence.")
        if not ends_the_job and res == "pending":
            add("closed-while-pending", "warning", "closure", "Closed while still waiting for the resident's answer.")
        if not ends_the_job and in_unit and res == "not_asked":
            add("closed-not-asked", "warning", "closure",
                "Closed without asking the resident. If you could not ask, say why in the reason.")
        if not ends_the_job and open_items:
            n = len(open_items)
            add("closed-with-open-items", "warning", "closure",
                f"Closed with {n} open item{'' if n == 1 else 's'}. Keep the record open, "
                "or say in the reason who follows them up.")

    # History.
    for i, h in enumerate(r.get("history") or []):
        if is_blank(h):
            continue
        if is_blank(h.get("text")) and h.get("kind") != "reopened":
            add("history-no-text", "warning", "history", "Write what this later entry says.", i)
        if is_blank(h.get("at")):
            add("history-no-at", "warning", "history", "Add when this was added.", i)

    return sorted(out, key=lambda f: _RANK[f["level"]])


check_record = check
