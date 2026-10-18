/**
 * The readable report: one page that says who said what. Rendered at build time on the example pages, live in the
 * builder, and on paper through the print styles. It never adds a verdict of its own.
 */
import { isBlank, latestWork, type Closure, type RepairRecord } from "../lib/record";
import {
  AREA_LABELS, CHECK_METHOD_LABELS, CHECK_ROLE_LABELS, CLOSURE_LABELS, EVIDENCE_LABELS, HISTORY_LABELS,
  OUTCOME_LABELS, REPORTER_LABELS, RESIDENT_LABELS, formatDate, personLabel,
} from "../lib/labels";

interface Props {
  record: RepairRecord;
}

export default function ReportView({ record: r }: Props) {
  const work = r.work.filter((w) => !isBlank(w));
  const checks = r.checks.filter((c) => !isBlank(c));
  const evidence = r.evidence.filter((e) => !isBlank(e));
  const openItems = r.open_items.filter((o) => !isBlank(o));
  const history = r.history.filter((h) => !isBlank(h));
  const last = latestWork({ ...r, work });
  const closed = r.status === "closed";
  const title = r.title || r.context.symptom || "Repair record";
  const checkers = [...new Set(checks.map((c) => (c.by_role ? CHECK_ROLE_LABELS[c.by_role] : c.by_name) ?? ""))]
    .filter(Boolean);

  return (
    <article className="report" aria-label="Repair record">
      <header className="report-head">
        <div>
          <div className="report-kicker">Repair record{r.id ? ` · ${r.id}` : ""}</div>
          <h2>{title}</h2>
          {r.context.location && <div className="muted">{r.context.location}</div>}
        </div>
        <div className="report-status">
          <span className={`status-pill ${closed ? "status-closed" : "status-open"}`}>{closed ? "Closed" : "Open"}</span>
          {closed && r.closure?.reason_code && (
            <div className="small muted" style={{ marginTop: 6, maxWidth: 260 }}>{CLOSURE_LABELS[r.closure.reason_code]}</div>
          )}
        </div>
      </header>

      <dl className="summary">
        <div>
          <dt>Contractor reports</dt>
          <dd>
            {last?.outcome ? OUTCOME_LABELS[last.outcome] : "No statement yet"}
            {last && <span className="who">{personLabel(last.by) || "Not stated who"}</span>}
          </dd>
        </div>
        <div>
          <dt>Checked</dt>
          <dd>
            {checks.length ? `${checks.length} check${checks.length === 1 ? "" : "s"}` : "No check recorded"}
            {checkers.length > 0 && <span className="who">by {checkers.join(", ").toLowerCase()}</span>}
          </dd>
        </div>
        <div>
          <dt>Resident</dt>
          <dd>
            {RESIDENT_LABELS[r.resident.status]}
            {r.resident.answered_at && <span className="who">{formatDate(r.resident.answered_at)}</span>}
            {!r.resident.answered_at && r.resident.asked_at && (
              <span className="who">asked {formatDate(r.resident.asked_at)}</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Record</dt>
          <dd>
            {closed ? "Closed" : openItems.length ? `Open · ${openItems.length} item${openItems.length === 1 ? "" : "s"} left` : "Open"}
            {closed && <span className="who">{[personLabel(r.closure?.closed_by), formatDate(r.closure?.closed_at)].filter(Boolean).join(", ")}</span>}
          </dd>
        </div>
      </dl>

      <section>
        <h3>1 · What was reported</h3>
        {r.context.symptom ? <p className="quote">{r.context.symptom}</p> : <p className="none">Not written.</p>}
        <dl className="kv">
          {r.context.area && <><dt>Area</dt><dd>{AREA_LABELS[r.context.area]}</dd></>}
          {r.context.asset && <><dt>Equipment</dt><dd>{r.context.asset}</dd></>}
          {(r.context.reported_at || r.context.reported_by_role) && (
            <>
              <dt>Reported</dt>
              <dd>
                {[formatDate(r.context.reported_at), r.context.reported_by_role && `by ${REPORTER_LABELS[r.context.reported_by_role].toLowerCase()}`]
                  .filter(Boolean).join(", ")}
              </dd>
            </>
          )}
        </dl>
      </section>

      <section>
        <h3>2 · What the contractor says</h3>
        {work.length === 0 && <p className="none">No contractor statement yet.</p>}
        {work.map((w, i) => (
          <div className="entry" key={i}>
            <div className="claim">
              Statement by <strong>{personLabel(w.by) || "someone not named"}</strong>
              {w.at && <> · {formatDate(w.at)}</>}
            </div>
            <dl className="kv">
              <dt>Outcome</dt><dd><strong>{w.outcome ? OUTCOME_LABELS[w.outcome] : "Not stated"}</strong></dd>
              {w.done && <><dt>Done</dt><dd>{w.done}</dd></>}
              {w.diagnosis && <><dt>Cause</dt><dd>{w.diagnosis}</dd></>}
              {(w.follow_up_needed || w.follow_up) && <><dt>Follow-up</dt><dd>{w.follow_up || "Needed, not described"}</dd></>}
            </dl>
          </div>
        ))}
      </section>

      <section>
        <h3>3 · Checks</h3>
        {checks.length === 0 && <p className="none">No check is recorded, so this report rests on the statement above.</p>}
        {checks.map((c, i) => (
          <div className="entry" key={i}>
            <div className="claim">
              Checked by <strong>{[c.by_role && CHECK_ROLE_LABELS[c.by_role], c.by_name].filter(Boolean).join(", ") || "someone not named"}</strong>
              {c.method && <> · {CHECK_METHOD_LABELS[c.method]}</>}
              {c.at && <> · {formatDate(c.at)}</>}
            </div>
            <div>{c.result || <span className="none">No result written.</span>}</div>
            {c.limits && <div className="limits"><span className="muted">Did not cover: </span>{c.limits}</div>}
          </div>
        ))}
      </section>

      <section>
        <h3>4 · Evidence</h3>
        {evidence.length === 0 && <p className="none">None listed.</p>}
        {evidence.map((e, i) => (
          <div className="entry" key={i}>
            <div className="claim">
              <strong>{e.type ? EVIDENCE_LABELS[e.type] : "Item"}</strong>
              {e.taken_by && <> · {e.taken_by}</>}
              {e.taken_at && <> · {formatDate(e.taken_at)}</>}
            </div>
            <div>{e.description || <span className="none">Not described.</span>}</div>
            {e.reference && <div className="small muted">File: {e.reference}</div>}
          </div>
        ))}
      </section>

      <section>
        <h3>5 · The resident</h3>
        <p style={{ margin: "0 0 6px" }}><strong>{RESIDENT_LABELS[r.resident.status]}</strong></p>
        {r.resident.words && <p className="quote">“{r.resident.words}”</p>}
        <dl className="kv">
          {r.resident.asked_at && <><dt>Asked</dt><dd>{formatDate(r.resident.asked_at)}</dd></>}
          {r.resident.answered_at && <><dt>Answered</dt><dd>{formatDate(r.resident.answered_at)}</dd></>}
          {r.resident.channel && <><dt>Channel</dt><dd>{r.resident.channel}</dd></>}
        </dl>
        {r.resident.status === "no_reply" && (
          <p className="note">No reply is recorded as no reply. It is not a confirmation.</p>
        )}
      </section>

      <section>
        <h3>6 · Still open</h3>
        {openItems.length === 0 && <p className="none">Nothing recorded as still open.</p>}
        {openItems.map((o, i) => (
          <div className="entry" key={i}>
            <div>{o.what || <span className="none">Not described.</span>}</div>
            <dl className="kv">
              {o.owner && <><dt>Owner</dt><dd>{o.owner}</dd></>}
              {o.next_step && <><dt>Next step</dt><dd>{o.next_step}</dd></>}
              {o.due && <><dt>Due</dt><dd>{formatDate(o.due)}</dd></>}
            </dl>
          </div>
        ))}
      </section>

      <section>
        <h3>7 · Closure</h3>
        {closed ? <ClosureLines closure={r.closure} /> : <p className="none">This record is open.</p>}
      </section>

      {history.length > 0 && (
        <section>
          <h3>8 · Later additions</h3>
          {history.map((h, i) => (
            <div className="entry" key={i}>
              <div className="claim">
                <strong>{h.kind ? HISTORY_LABELS[h.kind] : "Added"}</strong>
                {h.at && <> · {formatDate(h.at)}</>}
                {h.by && <> · {h.by}</>}
              </div>
              {h.text && <div>{h.text}</div>}
              {h.previous_closure && (
                <div className="small muted" style={{ marginTop: 4 }}>
                  Earlier closure, kept as it was: <ClosureInline closure={h.previous_closure} />
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <footer className="report-foot">
        <span>Made with Open Repair Record 1.0 · openrepairrecord.com</span>
        <span>This record shows who said what. It is not a safety certificate or an inspection.</span>
      </footer>
    </article>
  );
}

function ClosureLines({ closure }: { closure?: Closure }) {
  if (!closure) return <p className="none">Closed, no details written.</p>;
  return (
    <dl className="kv">
      <dt>Closed by</dt><dd>{personLabel(closure.closed_by) || "Not stated"}</dd>
      <dt>When</dt><dd>{formatDate(closure.closed_at) || "Not stated"}</dd>
      <dt>Why</dt><dd>{closure.reason_code ? CLOSURE_LABELS[closure.reason_code] : "Not stated"}</dd>
      {closure.reason && <><dt>Note</dt><dd>{closure.reason}</dd></>}
    </dl>
  );
}

function ClosureInline({ closure }: { closure: Closure }) {
  return (
    <>
      {[
        closure.reason_code && CLOSURE_LABELS[closure.reason_code],
        personLabel(closure.closed_by),
        formatDate(closure.closed_at),
      ].filter(Boolean).join(", ")}
      {closure.reason && <> ({closure.reason})</>}
    </>
  );
}
