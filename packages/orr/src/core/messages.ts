/** Copy-ready texts (WhatsApp, SMS, e-mail) that ask for the parts a record is missing. */
import { isBlank, latestWork, type RepairRecord } from "./record";
import { formatDate } from "./labels";

function jobRef(r: RepairRecord): string {
  const parts = [r.id ? `job ${r.id}` : "the job", r.context.location ? `at ${r.context.location}` : ""];
  return parts.filter(Boolean).join(" ");
}

function short(text: string | undefined, max = 60): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim().replace(/[.!]+$/, "");
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Asks the contractor for what the record does not have yet. */
export function contractorRequest(r: RepairRecord): string {
  const work = r.work.filter((w) => !isBlank(w));
  const last = latestWork({ ...r, work });
  const name = last?.by?.name?.split(" ")[0];
  const asks: string[] = [];
  if (!last || isBlank(last.done)) asks.push("what you did");
  if (!last || isBlank(last.diagnosis)) asks.push("what caused it, if you know");
  if (r.checks.filter((c) => !isBlank(c)).length === 0) {
    asks.push("how you checked that it works (a test, a measurement or a photo)");
  }
  const unfinished = last && (last.outcome === "temporary_fix" || last.outcome === "partial" || last.follow_up_needed);
  if (!last || (unfinished && r.open_items.filter((o) => !isBlank(o)).length === 0)) {
    asks.push("anything still left to do, and when");
  }
  const greeting = `Hello${name ? ` ${name}` : ""},`;
  const symptom = r.context.symptom ? ` ("${short(r.context.symptom)}")` : "";
  if (asks.length === 0) {
    return `${greeting} thank you for the report on ${jobRef(r)}${symptom}. I have everything I need.`;
  }
  return [
    `${greeting} about ${jobRef(r)}${symptom}, could you please send me:`,
    ...asks.map((a, i) => `${i + 1}. ${a}`),
    "Thank you.",
  ].join("\n");
}

/** Asks the resident whether the problem is solved. Never assumes the answer. */
export function residentRequest(r: RepairRecord): string {
  const work = r.work.filter((w) => !isBlank(w));
  const last = latestWork({ ...r, work });
  const who = last?.by?.company || last?.by?.name || "The contractor";
  const when = last?.at ? ` on ${formatDate(last.at)}` : "";
  const about = r.context.symptom ? `your report "${short(r.context.symptom)}"` : "your repair request";
  const where = r.context.location ? ` (${r.context.location})` : "";
  return [
    `Hello, about ${about}${where}: ${who} reports the work was done${when}.`,
    "Is the problem solved? Please reply 1 for yes or 2 for no. You can also tell us in your own words.",
  ].join("\n");
}
