import type { RepairRecord } from "../lib/record";
import kitchenTap from "./kitchen-tap.json";
import ceilingLeak from "./ceiling-leak.json";
import acNoReply from "./ac-no-reply.json";
import acReopened from "./ac-reopened.json";
import noAccess from "./no-access.json";

export interface Example {
  slug: string;
  name: string;
  /** One line on what the example shows. */
  lesson: string;
  /** The page title: the situation, as people search for it. */
  seoTitle: string;
  record: RepairRecord;
}

/** Five fictional repairs. Every name, company and address in them is invented. */
export const EXAMPLES: Example[] = [
  {
    slug: "kitchen-tap",
    seoTitle: "Confirmed repair: example completion report",
    name: "A normal repair, confirmed",
    lesson: "The plumber fixes a dripping tap and tests it; the resident answers \"fixed\"; the coordinator closes it.",
    record: kitchenTap as RepairRecord,
  },
  {
    slug: "ceiling-leak",
    seoTitle: "Temporary repair (make safe): example report",
    name: "A temporary fix",
    lesson: "The leak is stopped but the ceiling is not repaired, so the record stays open with an owner and a date.",
    record: ceilingLeak as RepairRecord,
  },
  {
    slug: "ac-no-reply",
    seoTitle: "Resident did not reply: example repair report",
    name: "No reply from the resident",
    lesson: "The technician tested the AC, the coordinator did not inspect it, and the resident never answered. The report says so.",
    record: acNoReply as RepairRecord,
  },
  {
    slug: "ac-reopened",
    seoTitle: "Reopened repair: example completion report",
    name: "Dripping again: reopened",
    lesson: "Three days later the resident writes \"dripping again\". The record reopens and nothing earlier is overwritten.",
    record: acReopened as RepairRecord,
  },
  {
    slug: "no-access",
    seoTitle: "No access visit: example repair report",
    name: "No access",
    lesson: "Nobody was home. The visit is recorded as no access, a next step is set, and nothing is closed.",
    record: noAccess as RepairRecord,
  },
];

export function exampleBySlug(slug: string): Example | undefined {
  return EXAMPLES.find((e) => e.slug === slug);
}
