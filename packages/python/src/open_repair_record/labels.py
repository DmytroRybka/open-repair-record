"""Human labels for every code, and the two small formatters the messages and reports use."""
from __future__ import annotations

import re
from typing import Any, Mapping, Optional

AREA_LABELS = {"unit": "A unit", "common_area": "A common area"}

REPORTER_LABELS = {
    "resident": "Resident",
    "owner": "Owner",
    "staff": "Staff",
    "inspection": "Inspection",
    "other": "Other",
}

CHECK_ROLE_LABELS = {
    "technician": "Technician",
    "coordinator": "Coordinator",
    "inspector": "Inspector",
    "resident": "Resident",
    "other": "Someone else",
}

CHECK_METHOD_LABELS = {
    "test_run": "Test run",
    "measurement": "Measurement",
    "visual": "Looked at it",
    "photo_review": "Reviewed a photo",
    "other": "Other",
}

EVIDENCE_LABELS = {
    "photo": "Photo",
    "measurement": "Measurement",
    "test_log": "Test log",
    "certificate": "Certificate",
    "document": "Document",
    "other": "Other",
}

CLOSURE_LABELS = {
    "confirmed_by_resident": "Confirmed by the resident",
    "work_reported_done_no_reply": "Work reported done, no reply from the resident",
    "administrative": "Closed for an administrative reason",
    "duplicate": "Duplicate of another record",
    "cancelled": "Cancelled",
    "other": "Other reason",
}

HISTORY_LABELS = {
    "resident_reply": "Resident replied",
    "revisit": "Revisit",
    "correction": "Correction",
    "reopened": "Reopened",
    "note": "Note",
}

RESIDENT_LABELS = {
    "resolved": "Resolved",
    "not_resolved": "Not resolved",
    "not_asked": "Not asked yet",
    "pending": "Asked, waiting for an answer",
    "no_reply": "No reply",
    "not_applicable": "Not applicable",
}

OUTCOME_LABELS = {
    "resolved": "Resolved",
    "temporary_fix": "Temporary fix",
    "partial": "Partly done",
    "not_done": "Not done",
    "no_access": "No access",
}

_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
_DATE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?")


def format_date(value: Optional[str]) -> str:
    """"2026-10-12T14:20" -> "12 Oct 2026, 14:20". Shown as written: no time zone conversion."""
    if not value:
        return ""
    m = _DATE.match(value)
    if not m:
        return value
    month = int(m.group(2))
    name = _MONTHS[month - 1] if 1 <= month <= 12 else m.group(2)
    date = f"{int(m.group(3))} {name} {m.group(1)}"
    return f"{date}, {m.group(4)}:{m.group(5)}" if m.group(4) else date


def person_label(p: Optional[Mapping[str, Any]]) -> str:
    """"Ravi Kumar, Bluepoint Cooling (AC technician)"."""
    if not p:
        return ""
    head = ", ".join(x for x in (p.get("name"), p.get("company")) if x)
    role = p.get("role")
    if role:
        return f"{head} ({role})" if head else role
    return head
