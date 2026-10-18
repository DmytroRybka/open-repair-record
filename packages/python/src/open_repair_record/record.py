"""The record: version, an empty record, and clean() for export. Records are plain dicts, as parsed from JSON."""
from __future__ import annotations

import copy
from typing import Any, Dict, List, Optional

ORR_VERSION = "1.0"
SCHEMA_URL = "https://openrepairrecord.com/schema/orr-1.0.schema.json"

RepairRecord = Dict[str, Any]

_LISTS = ("work", "checks", "evidence", "open_items", "history")
_KEY_ORDER = (
    "orr_version", "id", "title", "timezone", "related_ids", "context", "work", "checks", "evidence", "resident",
    "open_items", "status", "closure", "history",
)
_MISSING = object()

# JavaScript's whitespace (String.prototype.trim and \s), so trimming matches the TypeScript core exactly.
JS_WHITESPACE = "".join(chr(c) for c in (
    0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0xA0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF,
))


def js_trim(s: str) -> str:
    return s.strip(JS_WHITESPACE)


def empty_record() -> RepairRecord:
    return {
        "orr_version": ORR_VERSION,
        "context": {"area": "unit"},
        "work": [],
        "checks": [],
        "evidence": [],
        "resident": {"status": "not_asked"},
        "open_items": [],
        "status": "open",
        "history": [],
    }


def is_blank(value: Any) -> bool:
    """True when nothing is written in it, so an empty "add a check" row does not count as a check."""
    if value is None:
        return True
    if isinstance(value, bool):
        return not value
    if isinstance(value, str):
        return js_trim(value) == ""
    if isinstance(value, list):
        return all(is_blank(v) for v in value)
    if isinstance(value, dict):
        return all(is_blank(v) for v in value.values())
    return False


def latest_work(work: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """The last statement that has something in it: where the work stands now."""
    filled = [w for w in work if not is_blank(w)]
    return filled[-1] if filled else None


def _prune(value: Any) -> Any:
    """Empty strings, False, None, empty objects and empty lists all mean "not written" and are removed."""
    if isinstance(value, list):
        items = [v for v in (_prune(x) for x in value) if v is not _MISSING]
        return items if items else _MISSING
    if isinstance(value, dict):
        entries = {k: v for k, v in ((k, _prune(x)) for k, x in value.items()) if v is not _MISSING}
        return entries if entries else _MISSING
    if isinstance(value, str):
        stripped = js_trim(value)
        return stripped if stripped else _MISSING
    if value is None or value is False:
        return _MISSING
    return value


def clean(record: RepairRecord) -> RepairRecord:
    """Drops what nobody wrote and returns the keys in a stable order: export, import, export gives the same file."""
    out = _prune(copy.deepcopy(record))
    if out is _MISSING or not isinstance(out, dict):
        out = {}
    out["orr_version"] = ORR_VERSION
    out.setdefault("context", {})
    for key in _LISTS:
        out.setdefault(key, [])
    out.setdefault("resident", {"status": "not_asked"})
    out.setdefault("status", "open")
    if out["status"] == "open":
        out.pop("closure", None)
    ordered = {k: out[k] for k in _KEY_ORDER if k in out}
    ordered.update({k: v for k, v in out.items() if k not in ordered})
    return ordered
