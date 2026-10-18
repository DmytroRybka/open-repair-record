"""Validation against the Open Repair Record 1.0 JSON Schema, with the same plain-words messages as the editor.

The schema file ships with the package and is read here, so the rules are the schema's own. The interpreter covers
exactly the keywords the schema uses (type, properties, required, additionalProperties, items, enum, const, pattern,
$ref, if/then, boolean schemas); tests/test_schema_keywords.py fails if the schema starts using anything else.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from importlib import resources
from typing import Any, Dict, List, Optional, Tuple

from .record import RepairRecord

SCHEMA: Dict[str, Any] = json.loads(
    resources.files("open_repair_record").joinpath("schema/orr-1.0.schema.json").read_text(encoding="utf-8")
)

_TYPES = {
    "object": lambda v: isinstance(v, dict),
    "array": lambda v: isinstance(v, list),
    "string": lambda v: isinstance(v, str),
    "boolean": lambda v: isinstance(v, bool),
}


@dataclass
class Validation:
    ok: bool
    errors: List[str] = field(default_factory=list)


@dataclass
class ParseResult:
    record: Optional[RepairRecord]
    errors: List[str] = field(default_factory=list)


def _resolve(schema: Any) -> Any:
    if isinstance(schema, dict) and "$ref" in schema:
        ref = schema["$ref"]
        if not ref.startswith("#/$defs/"):
            raise ValueError(f"unsupported $ref {ref}")
        target = SCHEMA["$defs"][ref[len("#/$defs/"):]]
        merged = dict(target)
        merged.update({k: v for k, v in schema.items() if k != "$ref"})
        return merged
    return schema


def _errors(value: Any, schema: Any, path: Tuple[Any, ...], out: List[Tuple[Tuple[Any, ...], str, Dict[str, Any]]]):
    """Collects (path, keyword, params) like Ajv with allErrors: type-specific keywords only run on that type."""
    schema = _resolve(schema)
    if schema is False:
        out.append((path, "false schema", {}))
        return
    if schema is True:
        return
    kind = schema.get("type")
    if kind is not None and not _TYPES[kind](value):
        out.append((path, "type", {"type": kind}))
    if "const" in schema and not _json_equal(value, schema["const"]):
        out.append((path, "const", {}))
    if "enum" in schema and not any(_json_equal(value, e) for e in schema["enum"]):
        out.append((path, "enum", {"allowedValues": schema["enum"]}))
    if isinstance(value, dict):
        for name in schema.get("required", []):
            if name not in value:
                out.append((path, "required", {"missingProperty": name}))
        props = schema.get("properties", {})
        for name, sub in props.items():
            if name in value:
                _errors(value[name], sub, path + (name,), out)
        if schema.get("additionalProperties") is False:
            for name in value:
                if name not in props:
                    out.append((path, "additionalProperties", {"additionalProperty": name}))
        if "if" in schema:
            probe: List[Tuple[Tuple[Any, ...], str, Dict[str, Any]]] = []
            _errors(value, schema["if"], path, probe)
            if not probe and "then" in schema:
                _errors(value, schema["then"], path, out)
    if isinstance(value, list) and "items" in schema:
        for i, item in enumerate(value):
            _errors(item, schema["items"], path + (i,), out)
    # re.ASCII: like JavaScript's \d, only 0-9 count as digits (Arabic-Indic digits are not a date here either).
    if isinstance(value, str) and "pattern" in schema and not re.search(schema["pattern"], value, re.ASCII):
        out.append((path, "pattern", {}))


def _json_equal(a: Any, b: Any) -> bool:
    """Equality as JSON sees it: True is not 1."""
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    return a == b


def _message(path: Tuple[Any, ...], keyword: str, params: Dict[str, Any]) -> Optional[str]:
    where = ".".join(str(p) for p in path) if path else "the file"
    if keyword == "additionalProperties":
        return f'{where}: unknown field "{params["additionalProperty"]}"'
    if keyword == "enum":
        return f"{where}: must be one of {', '.join(params['allowedValues'])}"
    if keyword == "pattern":
        return f"{where}: not a date like 2026-10-12 or 2026-10-12T14:20"
    if keyword == "required":
        return f'{where}: the required part "{params["missingProperty"]}" is missing'
    if keyword == "false schema":
        return "an open record cannot have a closure" if where == "closure" else f"{where}: boolean schema is false"
    if keyword == "type":
        return f"{where}: must be {params['type']}"
    if keyword == "const":
        return f"{where}: must be equal to constant"
    return f"{where}: is not valid"


def validate(data: Any) -> Validation:
    """Validates parsed JSON against the schema and explains each problem in a line."""
    found: List[Tuple[Tuple[Any, ...], str, Dict[str, Any]]] = []
    _errors(data, SCHEMA, (), found)
    messages: List[str] = []
    for path, keyword, params in found:
        text = _message(path, keyword, params)
        if text and text not in messages:
            messages.append(text)
    return Validation(ok=not found, errors=messages)


def _reject_constant(name: str):
    raise ValueError(name)


def parse(text: str) -> ParseResult:
    """Reads the text of a .json file, or explains why it is not an Open Repair Record 1.0."""
    try:
        data = json.loads(text, parse_constant=_reject_constant)
    except (ValueError, TypeError):
        return ParseResult(None, ["This file is not valid JSON."])
    # Files saved on launch day carried the pre-release number "0.1"; the fields are identical, so they open as 1.0.
    if isinstance(data, dict) and data.get("orr_version") == "0.1":
        data["orr_version"] = "1.0"
    if not isinstance(data, dict) or data.get("orr_version") != "1.0":
        return ParseResult(None, ['This is not an Open Repair Record 1.0 file (no "orr_version": "1.0").'])
    v = validate(data)
    return ParseResult(data, []) if v.ok else ParseResult(None, v.errors)


validate_record = validate
parse_record_file = parse
