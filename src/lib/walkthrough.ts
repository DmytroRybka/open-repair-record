/**
 * "Build a record step by step" on the format page: the same file grows one part at a time, and the part being
 * explained is highlighted. Rendered to HTML at build time; the page script only swaps the prepared versions.
 */
import type { RepairRecord } from "./record";

export interface Step {
  id: string;
  title: string;
  text: string;
  keys: string[];
}

export const STEPS: Step[] = [
  {
    id: "fundamentals",
    title: "Fundamentals",
    text: "Every record starts with the format version and your own job number, so any tool knows how to read it and anyone can match it to the original job card.",
    keys: ["orr_version", "id", "title"],
  },
  {
    id: "reported",
    title: "What was reported",
    text: "Where, when, who reported it, and the symptom in the reporter's own words. The diagnosis stays out of here: it is the contractor's view, and goes in their statement.",
    keys: ["context"],
  },
  {
    id: "contractor",
    title: "What the contractor says",
    text: "One entry per visit, each with a name and a time. The outcome is what the contractor reports, not a verdict: resolved, temporary fix, partly done, not done, or no access.",
    keys: ["work"],
  },
  {
    id: "checks",
    title: "Checks",
    text: "Who checked, how, what they found, and what they did not cover. Here the technician ran a 15-minute test, and the coordinator reviewed the photo but did not inspect the unit.",
    keys: ["checks"],
  },
  {
    id: "evidence",
    title: "Evidence",
    text: "What backs a statement or a check, with what it shows and who made it. Files stay where they are; the record only names them. Evidence is never required.",
    keys: ["evidence"],
  },
  {
    id: "resident",
    title: "The resident",
    text: "The answer to one question: is the problem solved? This resident was asked on 11 Oct and never answered, so the record says no_reply, with the date. Silence is never a yes.",
    keys: ["resident"],
  },
  {
    id: "open",
    title: "Still open",
    text: "Anything left to do, with an owner and a date. Empty here, because the contractor reports a full fix. A temporary fix would need an entry.",
    keys: ["open_items"],
  },
  {
    id: "closure",
    title: "Closure",
    text: "Closing is a decision, so it has an author and a reason. This job was closed as \"work reported done, no reply from the resident\": honest, and good enough.",
    keys: ["status", "closure"],
  },
  {
    id: "history",
    title: "Later additions",
    text: "Whatever comes later is added, never rewritten: a late reply, a revisit, a correction. If the record is reopened, the old closure is kept here exactly as it was.",
    keys: ["history"],
  },
];

export interface RenderedStep extends Step {
  /** The file so far, as highlighted HTML. */
  html: string;
  /** Only this step's part, for small screens. */
  snippet: string;
}

export function renderSteps(record: RepairRecord): RenderedStep[] {
  return STEPS.map((step, i) => {
    const upTo = STEPS.slice(0, i + 1).flatMap((s) => s.keys);
    return {
      ...step,
      html: renderFile(record, upTo, new Set(step.keys)),
      snippet: renderFile(record, step.keys, new Set()),
    };
  });
}

function renderFile(record: RepairRecord, keys: string[], highlight: Set<string>): string {
  const data = record as unknown as Record<string, unknown>;
  const present = keys.filter((k) => k in data);
  const out: string[] = ["{"];
  present.forEach((key, i) => {
    const block = JSON.stringify(data[key], null, 2).split("\n");
    const lines = block.map((line, j) => (j === 0 ? `  "${key}": ${line}` : `  ${line}`));
    if (i < present.length - 1) lines[lines.length - 1] += ",";
    const html = lines.map(colour).join("\n");
    out.push(highlight.has(key) ? `<span class="hl">${html}</span>` : html);
  });
  out.push("}");
  return out.join("\n");
}

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d+)?\b/g;

function colour(line: string): string {
  let html = "";
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    html += escape(line.slice(last, m.index));
    if (m[1] !== undefined) {
      html += m[2] ? `<span class="k">${escape(m[1])}</span>${m[2]}` : `<span class="s">${escape(m[1])}</span>`;
    } else {
      html += `<span class="n">${escape(m[0])}</span>`;
    }
    last = (m.index ?? 0) + m[0].length;
  }
  return html + escape(line.slice(last));
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
