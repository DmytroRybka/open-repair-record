# open-repair-record (Python)

Read, validate and check [Open Repair Record](https://openrepairrecord.com) 1.0 files: what a completed repair actually
means. No dependencies; Python 3.9+.

The same rules, codes and messages as the editor at openrepairrecord.com, the TypeScript package and the .NET library:
all of them pass the same shared test vectors.

```bash
pip install open-repair-record
```

```python
from open_repair_record import parse, check, resident_request

result = parse(open("Q-1204.orr.json", encoding="utf-8").read())
if result.record is None:
    print("Not a valid record:", result.errors)          # plain words, e.g. 'resident.status: must be one of ...'
else:
    for f in check(result.record):                        # contradictions, missing parts, tips
        print(f["level"], f["section"], f.get("index"), f["message"])
    print(resident_request(result.record))                # a neutral yes/no question for the resident
```

Also: `validate(data)` for parsed JSON, `clean(record)` (drops what nobody wrote, stable key order), `empty_record()`,
`contractor_request(record)`, the labels for every code, `format_date`, `ORR_VERSION`, `SCHEMA_URL`, and `SCHEMA`
(the JSON Schema itself, shipped in the package). Records are plain `dict`s, exactly as parsed from JSON.

Findings look like `{"code": "confirmed-without-yes", "level": "contradiction", "section": "closure", "message": "..."}`;
`index` is added for entries in a list (`work`, `checks`, `evidence`, `open_items`, `history`), counted from 0.

No reply stays no reply; a closure "confirmed by the resident" needs the resident's yes; a temporary fix needs an open
item; a photo is never required. The rules: [openrepairrecord.com/format/](https://openrepairrecord.com/format/).

MIT. Initiated by the [PMFriend](https://pmfriend.com/) team.
