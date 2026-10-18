"""Open Repair Record 1.0: read, validate and check repair completion records.

    from open_repair_record import parse, check
    result = parse(text)                 # JSON text -> result.record, or result.errors in plain words
    for f in check(result.record):       # {"code", "level", "section", "message", "index"?}
        print(f["level"], f["section"], f["message"])

The same rules, codes and messages as the editor at openrepairrecord.com and the TypeScript package. No dependencies.
"""
from .checks import check, check_record, outcome_label, resident_label
from .labels import (
    AREA_LABELS,
    CHECK_METHOD_LABELS,
    CHECK_ROLE_LABELS,
    CLOSURE_LABELS,
    EVIDENCE_LABELS,
    HISTORY_LABELS,
    OUTCOME_LABELS,
    REPORTER_LABELS,
    RESIDENT_LABELS,
    format_date,
    person_label,
)
from .messages import contractor_request, resident_request
from .record import ORR_VERSION, SCHEMA_URL, RepairRecord, clean, empty_record, is_blank, latest_work
from .validate import SCHEMA, ParseResult, Validation, parse, parse_record_file, validate, validate_record

__version__ = "1.0.0"

__all__ = [
    "ORR_VERSION", "SCHEMA", "SCHEMA_URL", "RepairRecord", "ParseResult", "Validation",
    "parse", "parse_record_file", "validate", "validate_record", "check", "check_record", "clean", "empty_record",
    "is_blank", "latest_work", "contractor_request", "resident_request", "format_date", "person_label",
    "resident_label", "outcome_label", "AREA_LABELS", "CHECK_METHOD_LABELS", "CHECK_ROLE_LABELS", "CLOSURE_LABELS",
    "EVIDENCE_LABELS", "HISTORY_LABELS", "OUTCOME_LABELS", "REPORTER_LABELS", "RESIDENT_LABELS", "__version__",
]
