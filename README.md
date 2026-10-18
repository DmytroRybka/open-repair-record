# Open Repair Record

**What does a completed repair actually mean?** An open guide and a free tool for writing a clear repair completion
report: what was reported, what the contractor says was done, what was checked and by whom, what the resident
answered, and who closed the record and why.

Site: <https://openrepairrecord.com>

- **Guide:** what "completed" means, the six parts of a record, a weak report next to a good one, common mistakes, and
  copy-ready contractor instructions.
- **Builder** (`/build/`): one form, a live check for contradictions and missing parts, print / PDF, JSON download and
  upload, and copy-ready messages for the contractor and the resident. Everything runs in the browser; nothing is
  uploaded.
- **Format 1.0** (`/format/`): a small JSON format with a JSON Schema (draft 2020-12), five fictional example records,
  and an informal mapping to an existing housing repair schema.

Open Repair Record is a practical guide and toolkit, not an official standard.

## Principles

1. Keep each source separate: the contractor's statement, a check, the resident's answer and the closure are
   different things.
2. No reply means no reply. Silence is never turned into a confirmation.
3. A temporary fix is not a fix: what is left gets an owner and a date.
4. Say what a check did not cover.
5. Add, don't rewrite: corrections and reopenings are new entries.
6. A record is not a certificate, and a photo is never required.

## Develop

Node 20 or newer.

```bash
npm install
npm run dev          # http://localhost:4321
npm test             # unit tests (Vitest): the checks, the schema, the messages, JSON round trip
npm run test:e2e     # end-to-end (Playwright, uses the installed Chrome): the five scenarios, print, 375 px
npm run build        # static site in dist/
```

Code layout:

| Path | What |
|---|---|
| `src/lib/record.ts` | The record type, `clean()` for export |
| `src/lib/checks.ts` | "Check a report": contradictions, missing parts, tips |
| `src/lib/messages.ts` | Messages asking the contractor or the resident for what is missing |
| `src/lib/validate.ts` | JSON Schema validation (Ajv) |
| `src/schema/orr-1.0.schema.json` | The schema, served at `/schema/orr-1.0.schema.json` |
| `src/examples/*.json` | The five fictional examples, served at `/examples/<slug>.json` |
| `src/components/Builder.tsx` | The builder (React island) |
| `src/components/ReportView.tsx` | The report, rendered at build time on example pages and live in the builder |

## Self-hosted (inside a company network)

The same site without the visit counter and without any request outside its own server:

```bash
docker run -d -p 8080:8080 --read-only --tmpfs /tmp ghcr.io/dmytrorybka/open-repair-record-editor:1.0
```

Or `npm run build:onprem` and serve `dist/` from any web server (a `web.config` for IIS is included). A version tag
(`v1.0.0`) publishes the image and a zip to GitHub Releases (`.github/workflows/release.yml`).
`npm run test:onprem` proves every page makes no outside request and the editor works under the image's CSP.
After changing the schema, run `npm run gen:validator`: the validator is precompiled so the browser never needs eval.

## Hosting

GitHub Pages, from `.github/workflows/pages.yml`, on the custom domain in `public/CNAME`.

## Licences

- Guide, template and examples: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (see `LICENSE-CONTENT.md`).
- Code and JSON Schema: [MIT](LICENSE).

Initiated by the [PMFriend](https://pmfriend.com/) team. Contact: support@pmfriend.com.
