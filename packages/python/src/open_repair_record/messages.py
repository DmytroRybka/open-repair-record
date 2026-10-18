"""Copy-ready texts (WhatsApp, SMS, e-mail) that ask for the parts a record is missing."""
from __future__ import annotations

import re
from typing import List

from .labels import format_date
from .record import JS_WHITESPACE, RepairRecord, is_blank, js_trim, latest_work

_RUNS = re.compile("[" + re.escape(JS_WHITESPACE) + "]+")


def _utf16_len(s: str) -> int:
    return len(s.encode("utf-16-le")) // 2


def _utf16_slice(s: str, units: int) -> str:
    """The first `units` UTF-16 code units, as JavaScript's slice counts them."""
    out, used = [], 0
    for ch in s:
        size = 2 if ord(ch) > 0xFFFF else 1
        if used + size > units:
            break
        out.append(ch)
        used += size
    return "".join(out)


def _short(text, limit: int = 60) -> str:
    if not text:
        return ""
    t = re.sub(r"[.!]+$", "", js_trim(_RUNS.sub(" ", text)))
    return _utf16_slice(t, limit - 1).rstrip(JS_WHITESPACE) + "…" if _utf16_len(t) > limit else t


def _job_ref(r: RepairRecord) -> str:
    context = r.get("context") or {}
    parts = [f"job {r['id']}" if r.get("id") else "the job", f"at {context['location']}" if context.get("location") else ""]
    return " ".join(p for p in parts if p)


def contractor_request(r: RepairRecord) -> str:
    """Asks the contractor for what the record does not have yet."""
    context = r.get("context") or {}
    last = latest_work(r.get("work") or [])
    name = ((last or {}).get("by") or {}).get("name")
    first = name.split(" ")[0] if name else None
    asks: List[str] = []
    if not last or is_blank(last.get("done")):
        asks.append("what you did")
    if not last or is_blank(last.get("diagnosis")):
        asks.append("what caused it, if you know")
    if not [c for c in (r.get("checks") or []) if not is_blank(c)]:
        asks.append("how you checked that it works (a test, a measurement or a photo)")
    unfinished = last and (last.get("outcome") in ("temporary_fix", "partial") or last.get("follow_up_needed"))
    if not last or (unfinished and not [o for o in (r.get("open_items") or []) if not is_blank(o)]):
        asks.append("anything still left to do, and when")
    greeting = f"Hello{' ' + first if first else ''},"
    symptom = f' ("{_short(context.get("symptom"))}")' if context.get("symptom") else ""
    if not asks:
        return f"{greeting} thank you for the report on {_job_ref(r)}{symptom}. I have everything I need."
    lines = [f"{greeting} about {_job_ref(r)}{symptom}, could you please send me:"]
    lines += [f"{i + 1}. {a}" for i, a in enumerate(asks)]
    lines.append("Thank you.")
    return "\n".join(lines)


def resident_request(r: RepairRecord) -> str:
    """Asks the resident whether the problem is solved. Never assumes the answer."""
    context = r.get("context") or {}
    last = latest_work(r.get("work") or [])
    by = (last or {}).get("by") or {}
    who = by.get("company") or by.get("name") or "The contractor"
    when = f" on {format_date(last['at'])}" if last and last.get("at") else ""
    about = f'your report "{_short(context.get("symptom"))}"' if context.get("symptom") else "your repair request"
    where = f" ({context['location']})" if context.get("location") else ""
    return "\n".join([
        f"Hello, about {about}{where}: {who} reports the work was done{when}.",
        "Is the problem solved? Please reply 1 for yes or 2 for no. You can also tell us in your own words.",
    ])
