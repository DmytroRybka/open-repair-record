"""The shared vectors (vectors/orr-1.0.json, generated from the TypeScript core) must give the same answers here."""
import json
import pathlib

import pytest

import open_repair_record as orr

ROOT = pathlib.Path(__file__).resolve().parents[3]
VECTORS = json.loads((ROOT / "vectors" / "orr-1.0.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", VECTORS["records"], ids=[c["name"] for c in VECTORS["records"]])
def test_record(case):
    v = orr.validate(case["input"])
    assert v.ok == case["valid"]
    assert sorted(v.errors) == case["errors"]
    if case["valid"]:
        assert orr.check(case["input"]) == case["findings"]
        assert orr.contractor_request(case["input"]) == case["contractor_request"]
        assert orr.resident_request(case["input"]) == case["resident_request"]
        cleaned = orr.clean(case["input"])
        assert cleaned == case["clean"]
        assert list(cleaned) == list(case["clean"])


@pytest.mark.parametrize("case", VECTORS["texts"], ids=[c["name"] for c in VECTORS["texts"]])
def test_text(case):
    result = orr.parse(case["text"])
    assert (result.record is not None) == case["ok"]
    assert sorted(result.errors) == case["errors"]
    if case["ok"]:
        assert result.record["orr_version"] == case["orr_version"]


def test_the_shipped_schema_is_the_sites_schema():
    shipped = json.loads((ROOT / "packages/python/src/open_repair_record/schema/orr-1.0.schema.json").read_text(encoding="utf-8"))
    assert shipped == json.loads((ROOT / "src/schema/orr-1.0.schema.json").read_text(encoding="utf-8"))


SUPPORTED = {
    "$schema", "$id", "$ref", "$defs", "title", "description", "examples", "type", "properties", "required",
    "additionalProperties", "items", "enum", "const", "pattern", "if", "then",
}


def _keywords(node, found):
    if isinstance(node, dict):
        for k, v in node.items():
            found.add(k)
            if k in ("properties", "$defs"):
                for sub in v.values():
                    _keywords(sub, found)
            elif k not in ("enum", "const", "examples", "required"):
                _keywords(v, found)
    elif isinstance(node, list):
        for x in node:
            _keywords(x, found)
    return found


def test_the_validator_understands_every_keyword_the_schema_uses():
    assert _keywords(orr.SCHEMA, set()) - SUPPORTED == set()
