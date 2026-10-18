/**
 * `orr render`: the same report the editor prints, as one standalone HTML file (styles inline, no scripts, nothing
 * loaded from elsewhere). Open it in a browser and print, or save as PDF.
 */
import { renderToStaticMarkup } from "react-dom/server";
import ReportView from "../../../src/components/ReportView";
import css from "../../../src/styles/global.css?raw";
import type { RepairRecord } from "./index";

export function renderReportHtml(record: RepairRecord): string {
  const title = ["Repair record", record.id, record.title].filter(Boolean).join(" · ");
  const body = renderToStaticMarkup(<ReportView record={record} />);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${css}</style>
</head>
<body>
<main class="wrap" style="padding:24px 16px;max-width:900px">${body}</main>
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
