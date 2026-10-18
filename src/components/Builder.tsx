/**
 * The report builder. Everything stays in this browser: the draft is kept in localStorage, files are read and
 * written locally, and nothing is sent anywhere.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { checkRecord, type Finding, type Section } from "../lib/checks";
import {
  clean, emptyRecord, isBlank, type Check, type Closure, type Evidence, type HistoryEntry, type OpenItem,
  type RepairRecord, type WorkEntry,
} from "../lib/record";
import {
  CHECK_METHOD_LABELS, CHECK_ROLE_LABELS, CLOSURE_LABELS, EVIDENCE_LABELS, HISTORY_LABELS, OUTCOME_LABELS,
  REPORTER_LABELS, RESIDENT_LABELS,
} from "../lib/labels";
import { contractorRequest, residentRequest } from "../lib/messages";
import { parseRecordFile } from "../lib/validate";
import { EXAMPLES, exampleBySlug } from "../examples";
import ReportView from "./ReportView";

const DRAFT_KEY = "orr.draft.v1";

/** A new record opens with one blank statement and one blank check: the quick path for a simple job. */
function starter(): RepairRecord {
  const r = emptyRecord();
  r.work = [{}];
  r.checks = [{}];
  return r;
}

function loadDraft(): RepairRecord | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = parseRecordFile(raw);
    if (!parsed.record) return null;
    // Saved files drop blank rows; put the quick-path rows back so a reloaded draft looks the same.
    if (!meaningful(parsed.record)) return starter();
    if (parsed.record.work.length === 0) parsed.record.work.push({});
    return parsed.record;
  } catch {
    return null;
  }
}

function saveDraft(r: RepairRecord) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(clean(r)));
  } catch {
    /* Private window or storage blocked: the builder still works, the draft just isn't kept. */
  }
}

/** True when someone has written something worth keeping. */
function meaningful(record: RepairRecord): boolean {
  const c = clean(record);
  return !isBlank(c.context.symptom) || !isBlank(c.context.location) || c.work.length > 0 || !isBlank(c.id);
}

type Banner = { kind: "info" | "error" | "ok"; text: string; lines?: string[]; action?: { label: string; run: () => void } };

export default function Builder() {
  const [record, setRecord] = useState<RepairRecord>(starter);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<"form" | "report">("form");
  const [banner, setBanner] = useState<Banner | null>(null);
  const [fromExample, setFromExample] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("example");
    const example = slug ? exampleBySlug(slug) : undefined;
    const draft = loadDraft();
    if (example && (!draft || !meaningful(draft))) {
      setRecord(structuredClone(example.record));
      setFromExample(example.slug);
      setBanner({ kind: "ok", text: `Loaded the example "${example.name}". Change anything you like.` });
    } else if (example && draft) {
      setRecord(draft);
      setBanner({
        kind: "info",
        text: `Your saved draft is open. Replace it with the example "${example.name}"?`,
        action: { label: "Replace my draft", run: () => { setRecord(structuredClone(example.record)); setFromExample(example.slug); setBanner(null); } },
      });
    } else if (draft) {
      setRecord(draft);
    }
    setReady(true);
  }, []);

  // A record is a few kilobytes, so it is saved on every change: closing the tab never loses the last keystrokes.
  useEffect(() => {
    if (ready) saveDraft(record);
  }, [record, ready]);

  const findings = useMemo(() => checkRecord(record), [record]);
  const update = (fn: (draft: RepairRecord) => void) =>
    setRecord((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  const replaceWith = (next: RepairRecord, okText: string, slug: string | null = null) => {
    const go = () => { setRecord(next); setFromExample(slug); setView("form"); setBanner({ kind: "ok", text: okText }); };
    if (meaningful(record)) {
      setBanner({ kind: "info", text: "This replaces the record you are working on.", action: { label: "Replace it", run: go } });
    } else {
      go();
    }
  };

  const exportJson = () => {
    const data = clean(record);
    const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `repair-record-${(data.id || "draft").replace(/[^A-Za-z0-9_-]+/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    const text = await file.text();
    const parsed = parseRecordFile(text);
    if (!parsed.record) {
      setBanner({ kind: "error", text: `"${file.name}" could not be opened.`, lines: parsed.errors.slice(0, 6) });
      return;
    }
    replaceWith(parsed.record, `Opened "${file.name}".`);
  };

  const print = () => {
    setView("report");
    window.setTimeout(() => window.print(), 50);
  };

  const reopen = () =>
    update((r) => {
      const previous: Closure | undefined = r.closure ? clean({ ...emptyRecord(), status: "closed", closure: r.closure }).closure : undefined;
      r.history.push({ at: nowLocal(), kind: "reopened", text: "", ...(previous ? { previous_closure: previous } : {}) });
      r.status = "open";
      delete r.closure;
    });

  const goTo = (f: Finding) => {
    setView("form");
    window.setTimeout(() => {
      const el = document.getElementById(f.index !== undefined ? `${f.section}-${f.index}` : `sec-${f.section}`)
        ?? document.getElementById(`sec-${f.section}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      const focusable = el?.querySelector<HTMLElement>("input, select, textarea");
      focusable?.focus({ preventScroll: true });
    }, 30);
  };

  return (
    <>
    <section className="start-bar no-print" aria-labelledby="start-title">
      <div className="start-text">
        <h2 id="start-title">Start from an example</h2>
        <p>Open a worked example and change it, or start with a blank record.</p>
      </div>
      <div className="start-actions">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.slug}
            type="button"
            className={`chip${fromExample === ex.slug ? " is-on" : ""}`}
            aria-pressed={fromExample === ex.slug}
            title={ex.lesson}
            onClick={() => replaceWith(structuredClone(ex.record), `Loaded the example "${ex.name}". Change anything you like.`, ex.slug)}
          >
            {ex.name}
          </button>
        ))}
        <button type="button" className="chip chip-blank" onClick={() => replaceWith(starter(), "Started a new record.")}>New blank record</button>
      </div>
    </section>
    <div className="builder">
      <div className="builder-main">
        <div className="toolbar">
          <div className="tabs" role="tablist" aria-label="View">
            <button role="tab" aria-selected={view === "form"} onClick={() => setView("form")}>Form</button>
            <button role="tab" aria-selected={view === "report"} onClick={() => setView("report")}>Report</button>
          </div>
          <div className="btn-row">
            <button className="btn btn-small" onClick={print}>Print or save as PDF</button>
            <button className="btn btn-small" onClick={exportJson}>Download JSON</button>
            <button className="btn btn-small" onClick={() => fileInput.current?.click()}>Open JSON</button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              aria-label="Open a JSON record"
              data-testid="import-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importJson(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <MobileCheck findings={findings} />

        {banner && (
          <div className={`banner ${banner.kind === "error" ? "banner-error" : banner.kind === "ok" ? "banner-ok" : ""}`} role="status">
            <div>
              {banner.text}
              {banner.lines && <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{banner.lines.map((l) => <li key={l}>{l}</li>)}</ul>}
            </div>
            <div className="btn-row">
              {banner.action && <button className="btn btn-small btn-primary" onClick={banner.action.run}>{banner.action.label}</button>}
              <button className="btn btn-small btn-quiet" onClick={() => setBanner(null)}>{banner.action ? "Cancel" : "Dismiss"}</button>
            </div>
          </div>
        )}

        {view === "report" ? (
          <ReportView record={record} />
        ) : (
          <>
            <Form record={record} update={update} findings={findings} reopen={reopen} />
            {/* Printing from the form view (Ctrl+P) still prints the report, not the form. */}
            <div className="print-only"><ReportView record={record} /></div>
          </>
        )}
      </div>

      <aside className="builder-side no-print" aria-label="Check and tools">
        <CheckPanel findings={findings} goTo={goTo} />
        <MessagesPanel record={record} />
      </aside>
    </div>
    </>
  );
}

/* ---------------------------------------------------------------------------------------------- */

/** On a phone the check panel sits below the form, so a one-line summary at the top links down to it. */
function MobileCheck({ findings }: { findings: Finding[] }) {
  const c = findings.filter((f) => f.level === "contradiction").length;
  const w = findings.filter((f) => f.level === "warning").length;
  return (
    <a className="mobile-check no-print" href="#check-title">
      <span>
        <strong>Check:</strong>{" "}
        {c + w === 0 ? "nothing missing" : (
          <>
            {c > 0 && <span className="bad">{c} contradiction{c === 1 ? "" : "s"}</span>}
            {c > 0 && w > 0 && " · "}
            {w > 0 && <span className="warn">{w} missing</span>}
          </>
        )}
      </span>
      <span aria-hidden="true">See ↓</span>
    </a>
  );
}

function CheckPanel({ findings, goTo }: { findings: Finding[]; goTo: (f: Finding) => void }) {
  const count = (l: Finding["level"]) => findings.filter((f) => f.level === l).length;
  const label = { contradiction: "Contradiction", warning: "Missing", tip: "Tip" } as const;
  const serious = count("contradiction") + count("warning");
  return (
    <section className="panel" aria-labelledby="check-title" data-testid="check-panel">
      <h2 id="check-title">
        Check
        <span className="counts">
          {count("contradiction")} contradiction{count("contradiction") === 1 ? "" : "s"} · {count("warning")} missing · {count("tip")} tip{count("tip") === 1 ? "" : "s"}
        </span>
      </h2>
      {serious === 0 && (
        <p className="all-clear" data-testid="all-clear">
          Nothing missing that the check can see. It reads what is written; it does not judge the work itself.
        </p>
      )}
      <ul className="findings">
        {findings.map((f, i) => (
          <li key={`${f.code}-${f.index ?? ""}-${i}`} className={`finding finding-${f.level}`} data-code={f.code}>
            <button onClick={() => goTo(f)}>
              <span className="lvl">{label[f.level]}{f.index !== undefined ? ` · ${SECTION_LABELS[f.section]} ${f.index + 1}` : ` · ${SECTION_LABELS[f.section]}`}</span>
              {f.message}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const SECTION_LABELS: Record<Section, string> = {
  context: "What was reported",
  work: "Statement",
  checks: "Check",
  evidence: "Evidence",
  resident: "The resident",
  open_items: "Open item",
  closure: "Closure",
  history: "Later addition",
};

function MessagesPanel({ record }: { record: RepairRecord }) {
  const [which, setWhich] = useState<"contractor" | "resident">("contractor");
  const [copied, setCopied] = useState(false);
  const text = which === "contractor" ? contractorRequest(record) : residentRequest(record);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section className="panel" aria-labelledby="msg-title">
      <h2 id="msg-title">Ask for what is missing</h2>
      <div className="tabs" role="tablist" aria-label="Message to">
        <button role="tab" aria-selected={which === "contractor"} onClick={() => setWhich("contractor")}>Contractor</button>
        <button role="tab" aria-selected={which === "resident"} onClick={() => setWhich("resident")}>Resident</button>
      </div>
      <div className="msg-box" data-testid="message-text">{text}</div>
      <div className="btn-row">
        <button className="btn btn-small" onClick={copy}>{copied ? "Copied" : "Copy text"}</button>
        <a className="btn btn-small btn-quiet" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
          Open in WhatsApp
        </a>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------------------------- */

type Update = (fn: (draft: RepairRecord) => void) => void;

function Form({ record: r, update, findings, reopen }: { record: RepairRecord; update: Update; findings: Finding[]; reopen: () => void }) {
  const flagged = (section: Section, index?: number) =>
    findings.some((f) => f.section === section && f.index === index && f.level !== "tip");

  return (
    <form onSubmit={(e) => e.preventDefault()} aria-label="Repair record">
      <Fieldset id="sec-context" n={1} title="What was reported" hint="The symptom in the reporter's words. Keep the diagnosis for the contractor's statement.">
        <div className="fields fields-2">
          <Text label="Job or ticket number" value={r.id} onChange={(v) => update((d) => { d.id = v; })} placeholder="e.g. Q-1204" />
          <Text label="Short title" optional value={r.title} onChange={(v) => update((d) => { d.title = v; })} placeholder="e.g. AC dripping water" />
        </div>
        <div className="fields fields-2" style={{ marginTop: 12 }}>
          <Text label="Where" value={r.context.location} onChange={(v) => update((d) => { d.context.location = v; })} placeholder="Building and unit, or the common area" />
          <Text label="Equipment" optional value={r.context.asset} onChange={(v) => update((d) => { d.context.asset = v; })} placeholder="Asset tag or a label" />
        </div>
        <div style={{ marginTop: 12 }}>
          <Radios
            label="Area"
            name="area"
            value={r.context.area ?? "unit"}
            options={{ unit: "A unit", common_area: "A common area" }}
            onChange={(v) => update((d) => { d.context.area = v as "unit" | "common_area"; })}
          />
        </div>
        <div className="fields fields-2" style={{ marginTop: 12 }}>
          <DateTime label="Reported" value={r.context.reported_at} onChange={(v) => update((d) => { d.context.reported_at = v; })} />
          <Select label="Reported by" value={r.context.reported_by_role} options={REPORTER_LABELS} onChange={(v) => update((d) => { d.context.reported_by_role = v as never; })} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Area label="What was reported" value={r.context.symptom} onChange={(v) => update((d) => { d.context.symptom = v; })} placeholder='e.g. "Water is dripping from the AC in the living room."' />
        </div>
      </Fieldset>

      <Fieldset id="sec-work" n={2} title="What the contractor says" hint="Each visit or report of work is one statement, with who made it and when.">
        <List
          items={r.work}
          section="work"
          flagged={flagged}
          noun="Statement"
          onAdd={() => update((d) => { d.work.push({}); })}
          onRemove={(i) => update((d) => { d.work.splice(i, 1); })}
          addLabel="Add another statement"
          render={(w: WorkEntry, i) => (
            <>
              <div className="fields fields-3">
                <Text label="Name" value={w.by?.name} onChange={(v) => update((d) => { (d.work[i]!.by ??= {}).name = v; })} />
                <Text label="Company" optional value={w.by?.company} onChange={(v) => update((d) => { (d.work[i]!.by ??= {}).company = v; })} />
                <Text label="Role" optional value={w.by?.role} onChange={(v) => update((d) => { (d.work[i]!.by ??= {}).role = v; })} placeholder="e.g. Plumber" />
              </div>
              <div style={{ marginTop: 12 }}>
                <DateTime label="When" value={w.at} onChange={(v) => update((d) => { d.work[i]!.at = v; })} />
              </div>
              <div style={{ marginTop: 12 }}>
                <Radios label="Outcome the contractor reports" name={`outcome-${i}`} value={w.outcome} options={OUTCOME_LABELS}
                  onChange={(v) => update((d) => { d.work[i]!.outcome = v as never; })} />
              </div>
              <div className="fields" style={{ marginTop: 12 }}>
                <Area label="What was done" value={w.done} onChange={(v) => update((d) => { d.work[i]!.done = v; })} placeholder="In the contractor's words" />
                <Text label="Cause" optional value={w.diagnosis} onChange={(v) => update((d) => { d.work[i]!.diagnosis = v; })} placeholder="If known" />
                <label className="check-field">
                  <input type="checkbox" checked={Boolean(w.follow_up_needed)} onChange={(e) => update((d) => { d.work[i]!.follow_up_needed = e.target.checked; })} />
                  Follow-up needed
                </label>
                {(w.follow_up_needed || w.follow_up) && (
                  <Text label="What follow-up" value={w.follow_up} onChange={(v) => update((d) => { d.work[i]!.follow_up = v; })} />
                )}
              </div>
            </>
          )}
        />
      </Fieldset>

      <Fieldset id="sec-checks" n={3} title="Checks" hint="Who checked, how, what they found, and what the check did not cover. Leave this empty if nobody checked.">
        <List
          items={r.checks}
          section="checks"
          flagged={flagged}
          noun="Check"
          onAdd={() => update((d) => { d.checks.push({}); })}
          onRemove={(i) => update((d) => { d.checks.splice(i, 1); })}
          addLabel="Add a check"
          render={(c: Check, i) => (
            <>
              <div className="fields fields-3">
                <Select label="Who checked" value={c.by_role} options={CHECK_ROLE_LABELS} onChange={(v) => update((d) => { d.checks[i]!.by_role = v as never; })} />
                <Text label="Name" optional value={c.by_name} onChange={(v) => update((d) => { d.checks[i]!.by_name = v; })} />
                <Select label="How" value={c.method} options={CHECK_METHOD_LABELS} onChange={(v) => update((d) => { d.checks[i]!.method = v as never; })} />
              </div>
              <div className="fields" style={{ marginTop: 12 }}>
                <DateTime label="When" value={c.at} onChange={(v) => update((d) => { d.checks[i]!.at = v; })} />
                <Area label="What the check found" value={c.result} onChange={(v) => update((d) => { d.checks[i]!.result = v; })} placeholder="e.g. Ran the unit for 15 minutes: no leak while watching." />
                <Text label="What it did not cover" optional value={c.limits} onChange={(v) => update((d) => { d.checks[i]!.limits = v; })} placeholder="e.g. Did not inspect the unit." />
              </div>
            </>
          )}
        />
      </Fieldset>

      <Fieldset id="sec-evidence" n={4} title="Evidence" hint="Photos, measurements, test logs or certificates. Write the file name or a link: nothing is uploaded. A photo is never required.">
        <List
          items={r.evidence}
          section="evidence"
          flagged={flagged}
          noun="Item"
          onAdd={() => update((d) => { d.evidence.push({}); })}
          onRemove={(i) => update((d) => { d.evidence.splice(i, 1); })}
          addLabel="Add evidence"
          render={(e: Evidence, i) => (
            <>
              <div className="fields fields-2">
                <Select label="Type" value={e.type} options={EVIDENCE_LABELS} onChange={(v) => update((d) => { d.evidence[i]!.type = v as never; })} />
                <Text label="File name or link" optional value={e.reference} onChange={(v) => update((d) => { d.evidence[i]!.reference = v; })} />
              </div>
              <div className="fields" style={{ marginTop: 12 }}>
                <Text label="What it shows" value={e.description} onChange={(v) => update((d) => { d.evidence[i]!.description = v; })} />
              </div>
              <div className="fields fields-2" style={{ marginTop: 12 }}>
                <Text label="Taken by" optional value={e.taken_by} onChange={(v) => update((d) => { d.evidence[i]!.taken_by = v; })} />
                <DateTime label="Taken" value={e.taken_at} onChange={(v) => update((d) => { d.evidence[i]!.taken_at = v; })} />
              </div>
            </>
          )}
        />
      </Fieldset>

      <Fieldset id="sec-resident" n={5} title="The resident" hint="Is the problem solved, in the resident's view? No reply stays no reply.">
        <Radios label="The resident's answer" name="resident" value={r.resident.status} options={RESIDENT_LABELS}
          onChange={(v) => update((d) => { d.resident.status = v as never; })} />
        <div className="fields fields-3" style={{ marginTop: 12 }}>
          <DateTime label="Asked" value={r.resident.asked_at} onChange={(v) => update((d) => { d.resident.asked_at = v; })} />
          <DateTime label="Answered" value={r.resident.answered_at} onChange={(v) => update((d) => { d.resident.answered_at = v; })} />
          <Text label="Channel" optional value={r.resident.channel} onChange={(v) => update((d) => { d.resident.channel = v; })} placeholder="e.g. WhatsApp" />
        </div>
        <div style={{ marginTop: 12 }}>
          <Area label="The resident's words" optional value={r.resident.words} onChange={(v) => update((d) => { d.resident.words = v; })} placeholder="Quote them as written" />
        </div>
      </Fieldset>

      <Fieldset id="sec-open_items" n={6} title="Still open" hint="Anything left to do: what, who owns it, the next step and a date.">
        <List
          items={r.open_items}
          section="open_items"
          flagged={flagged}
          noun="Open item"
          onAdd={() => update((d) => { d.open_items.push({}); })}
          onRemove={(i) => update((d) => { d.open_items.splice(i, 1); })}
          addLabel="Add an open item"
          render={(o: OpenItem, i) => (
            <div className="fields fields-2">
              <Text label="What is open" value={o.what} onChange={(v) => update((d) => { d.open_items[i]!.what = v; })} />
              <Text label="Owner" value={o.owner} onChange={(v) => update((d) => { d.open_items[i]!.owner = v; })} />
              <Text label="Next step" optional value={o.next_step} onChange={(v) => update((d) => { d.open_items[i]!.next_step = v; })} />
              <DateOnly label="Due" value={o.due} onChange={(v) => update((d) => { d.open_items[i]!.due = v; })} />
            </div>
          )}
        />
      </Fieldset>

      <Fieldset id="sec-closure" n={7} title="Closure" hint="Who closed the record, when, and why.">
        <Radios label="The record is" name="status" value={r.status} options={{ open: "Open", closed: "Closed" }}
          onChange={(v) => update((d) => {
            d.status = v as "open" | "closed";
            if (d.status === "closed") d.closure ??= {};
            else delete d.closure;
          })} />
        {r.status === "closed" && (
          <>
            <div className="fields fields-3" style={{ marginTop: 12 }}>
              <Text label="Closed by" value={r.closure?.closed_by?.name} onChange={(v) => update((d) => { ((d.closure ??= {}).closed_by ??= {}).name = v; })} />
              <Text label="Role" optional value={r.closure?.closed_by?.role} onChange={(v) => update((d) => { ((d.closure ??= {}).closed_by ??= {}).role = v; })} placeholder="e.g. Coordinator" />
              <DateTime label="When" value={r.closure?.closed_at} onChange={(v) => update((d) => { (d.closure ??= {}).closed_at = v; })} />
            </div>
            <div className="fields" style={{ marginTop: 12 }}>
              <Select label="Why" value={r.closure?.reason_code} options={CLOSURE_LABELS} onChange={(v) => update((d) => { (d.closure ??= {}).reason_code = v as never; })} />
              <Text label="Reason in your words" optional value={r.closure?.reason} onChange={(v) => update((d) => { (d.closure ??= {}).reason = v; })} />
            </div>
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-small" onClick={reopen}>Reopen this record</button>
              <span className="small muted">Keeps this closure in the later additions and opens the record again.</span>
            </div>
          </>
        )}
      </Fieldset>

      <Fieldset id="sec-history" n={8} title="Later additions" hint="A late reply, a revisit or a correction. Add a new entry instead of rewriting an earlier one.">
        <List
          items={r.history}
          section="history"
          flagged={flagged}
          noun="Addition"
          onAdd={() => update((d) => { d.history.push({ at: nowLocal() }); })}
          onRemove={(i) => update((d) => { d.history.splice(i, 1); })}
          addLabel="Add a later addition"
          render={(h: HistoryEntry, i) => (
            <>
              <div className="fields fields-3">
                <DateTime label="When" value={h.at} onChange={(v) => update((d) => { d.history[i]!.at = v; })} />
                <Text label="By" value={h.by} onChange={(v) => update((d) => { d.history[i]!.by = v; })} />
                <Select label="Kind" value={h.kind} options={HISTORY_LABELS} onChange={(v) => update((d) => { d.history[i]!.kind = v as never; })} />
              </div>
              <div style={{ marginTop: 12 }}>
                <Area label="What it says" value={h.text} onChange={(v) => update((d) => { d.history[i]!.text = v; })} />
              </div>
              {h.previous_closure && (
                <p className="small muted" style={{ margin: "8px 0 0" }}>
                  Keeps the earlier closure: {h.previous_closure.reason_code ? CLOSURE_LABELS[h.previous_closure.reason_code] : "no reason"}
                  {h.previous_closure.closed_at ? `, ${h.previous_closure.closed_at.replace("T", " ")}` : ""}.
                </p>
              )}
            </>
          )}
        />
      </Fieldset>
    </form>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function Fieldset({ id, n, title, hint, children }: { id: string; n: number; title: string; hint: string; children: ReactNode }) {
  return (
    <fieldset className="fieldset" id={id}>
      <legend className="fieldset-title"><span className="part-num" style={{ margin: 0 }}>{n}</span>{title}</legend>
      <p className="hint">{hint}</p>
      {children}
    </fieldset>
  );
}

function List<T>({ items, section, flagged, noun, onAdd, onRemove, addLabel, render }: {
  items: T[];
  section: Section;
  flagged: (s: Section, i?: number) => boolean;
  noun: string;
  onAdd: () => void;
  onRemove: (i: number) => void;
  addLabel: string;
  render: (item: T, i: number) => ReactNode;
}) {
  return (
    <>
      {items.map((item, i) => (
        <div className={`item${flagged(section, i) ? " flag-ring" : ""}`} id={`${section}-${i}`} key={i} data-testid={`${section}-item`}>
          <div className="item-head">
            <span>{noun} {i + 1}</span>
            <button type="button" className="btn btn-small btn-quiet" onClick={() => onRemove(i)} aria-label={`Remove ${noun.toLowerCase()} ${i + 1}`}>Remove</button>
          </div>
          {render(item, i)}
        </div>
      ))}
      <button type="button" className="btn btn-small" onClick={onAdd}>+ {items.length === 0 ? addLabel.replace(/^Add another/, "Add a") : addLabel}</button>
    </>
  );
}

function Text({ label, value, onChange, placeholder, optional }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string; optional?: boolean }) {
  return (
    <label className="field">
      <span>{label}{optional && <em> (optional)</em>}</span>
      <input type="text" value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Area({ label, value, onChange, placeholder, optional }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string; optional?: boolean }) {
  return (
    <label className="field">
      <span>{label}{optional && <em> (optional)</em>}</span>
      <textarea value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} rows={3} />
    </label>
  );
}

/** Dates are kept as written, in the property's local time. A value with seconds or an offset is shown trimmed
 * and only replaced when someone edits it. */
function DateTime({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  const shown = value ? (value.length === 10 ? `${value}T00:00` : value.slice(0, 16)) : "";
  return (
    <label className="field">
      <span>{label}</span>
      <input type="datetime-local" value={shown} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function DateOnly({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="date" value={value ? value.slice(0, 10) : ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value?: string; options: Record<string, string>; onChange: (v: string | undefined) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">—</option>
        {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </label>
  );
}

function Radios({ label, name, value, options, onChange }: { label: string; name: string; value?: string; options: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <div className="field" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      <div className="radio-row">
        {Object.entries(options).map(([k, v]) => (
          <label key={k}>
            <input type="radio" name={name} value={k} checked={value === k} onChange={() => onChange(k)} />
            {v}
          </label>
        ))}
      </div>
    </div>
  );
}

function nowLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
