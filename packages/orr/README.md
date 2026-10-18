# open-repair-record

Read, validate and check [Open Repair Record](https://openrepairrecord.com) 1.0 files: what a completed repair
actually means. A small TypeScript library with no dependencies, and the `orr` command line.

The same code runs the editor at openrepairrecord.com, so a file gets the same answers everywhere.

## The command line

```bash
npx open-repair-record check Q-1204.orr.json
```

```
Checking Q-1204.orr.json (Open Repair Record 1.0)
╭───────────────┬─────────┬──────────────────────────────────────────────────────────────╮
│ Result        │ Where   │ Finding                                                      │
├───────────────┼─────────┼──────────────────────────────────────────────────────────────┤
│ contradiction │ Closure │ Closed as "confirmed by the resident", but the resident's    │
│               │         │ answer is "No reply".                                        │
│ missing       │ Check 1 │ Write what the check found.                                  │
╰───────────────┴─────────┴──────────────────────────────────────────────────────────────╯
✗ Valid against the schema, but the record contradicts itself: 1 contradiction · 1 missing · 0 tips.
```

| Command | Does |
|---|---|
| `orr check <file\|folder\|->...` | Validates against the JSON Schema and runs the checks. Folders: every `*.json` in them. `-`: standard input |
| `orr validate <file\|folder\|->...` | The JSON Schema only |
| `orr render <file> -o report.html` | The readable report as one standalone HTML page, ready to print or save as PDF |
| `orr new -o file.json` | An empty record to fill in |
| `orr schema` | Where the JSON Schema is |

Options: `--json` for machine-readable output, `--strict` to fail on missing parts too.
Exit codes: `0` fine; `1` a file is invalid, unreadable or contradicts itself (or misses parts, with `--strict`);
`2` usage. So `orr check records/` works as a step in CI or before an import.

Install it globally with `npm install -g open-repair-record`, then run `orr`.

## The library

```ts
import { parse, check, residentRequest } from "open-repair-record";

const { record, errors } = parse(text);   // JSON text -> a record, or the schema errors in plain words
if (record) {
  for (const f of check(record)) {        // { level: "contradiction" | "warning" | "tip", section, index?, message }
    console.log(f.level, f.section, f.message);
  }
  console.log(residentRequest(record));   // a neutral yes/no question for the resident
}
```

Also exported: `validate(data)`, `clean(record)` (drops what nobody wrote, stable key order), `emptyRecord()`,
`contractorRequest(record)`, the labels for every code, `ORR_VERSION`, `SCHEMA_URL` and all the TypeScript types
(`RepairRecord`, `WorkEntry`, `Check`, `ResidentStatus`, …). The JSON Schema ships in the package:
`import schema from "open-repair-record/schema" with { type: "json" }`.

Works in Node.js 18+, browsers, Deno and Bun. The validator is precompiled from the schema, so it needs no `eval` and
runs under a strict Content-Security-Policy.

## Rules the check applies

No reply stays no reply; a closure "confirmed by the resident" needs the resident's yes; a temporary fix needs an
open item; a check should say what it found and what it did not cover; a photo is never required. The full list and
the reasoning: [openrepairrecord.com/format/](https://openrepairrecord.com/format/).

## Licence

MIT. The guide and examples on the site are CC BY 4.0. Initiated by the [PMFriend](https://pmfriend.com/) team.
