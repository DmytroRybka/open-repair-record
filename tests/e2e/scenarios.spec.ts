import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

/** Each scenario starts from an empty browser, so no draft from another test leaks in. */
test.beforeEach(async ({ page }) => {
  await page.goto("/build/");
  await page.evaluate(() => localStorage.clear());
});

const check = (page: Page) => page.getByTestId("check-panel");
const finding = (page: Page, code: string) => check(page).locator(`[data-code="${code}"]`);
const field = (page: Page, section: string, label: string) =>
  page.locator(`#sec-${section}`).getByLabel(label, { exact: true });

async function openExample(page: Page, slug: string) {
  await page.goto(`/build/?example=${slug}`);
  await expect(page.getByRole("status")).toContainText("Loaded the example");
}

test("1 · a normal repair, built from scratch and confirmed by the resident", async ({ page }) => {
  await page.goto("/build/");
  await expect(finding(page, "no-symptom")).toBeVisible();

  await field(page, "context", "Job or ticket number").fill("R-3001");
  await field(page, "context", "Where").fill("Harbour View, Flat 5D");
  await field(page, "context", "What was reported").fill("The kitchen tap keeps dripping.");
  await field(page, "work", "Name").fill("Sam Okafor");
  await field(page, "work", "When").fill("2026-10-06T10:40");
  await page.locator("#sec-work").getByLabel("Resolved", { exact: true }).check();
  await field(page, "work", "What was done").fill("Replaced the worn cartridge.");
  await field(page, "checks", "Who checked").selectOption("technician");
  await field(page, "checks", "What the check found").fill("No drip after 10 minutes.");
  await page.locator("#sec-resident").getByLabel("Resolved", { exact: true }).check();
  await page.locator("#sec-resident").getByLabel(/^The resident's words/).fill("Fixed, thanks.");
  await page.locator("#sec-closure").getByLabel("Closed", { exact: true }).check();
  await field(page, "closure", "Closed by").fill("Lina Haddad");
  await field(page, "closure", "When").fill("2026-10-07T08:30");
  await field(page, "closure", "Why").selectOption("confirmed_by_resident");

  await expect(page.getByTestId("all-clear")).toBeVisible();
  await expect(check(page).locator(".finding-contradiction")).toHaveCount(0);

  await page.getByRole("tab", { name: "Report" }).click();
  const report = page.locator(".report");
  await expect(report).toContainText("Statement by Sam Okafor");
  await expect(report).toContainText("Confirmed by the resident");
  await expect(report.locator(".status-pill")).toHaveText("Closed");

  // The draft survives a reload.
  await page.reload();
  await expect(field(page, "context", "Job or ticket number")).toHaveValue("R-3001");
});

test("2 · a temporary fix needs an open item, and the record stays open", async ({ page }) => {
  await openExample(page, "ceiling-leak");
  await expect(check(page).locator(".finding-warning")).toHaveCount(0);

  await page.locator("#sec-open_items").getByRole("button", { name: "Remove open item 1" }).click();
  await expect(finding(page, "unfinished-no-open-item")).toBeVisible();

  await page.locator("#sec-open_items").getByRole("button", { name: /Add an open item/ }).click();
  await field(page, "open_items", "What is open").fill("Repair the ceiling.");
  await field(page, "open_items", "Owner").fill("Lina Haddad");
  await expect(finding(page, "unfinished-no-open-item")).toHaveCount(0);

  await page.getByRole("tab", { name: "Report" }).click();
  await expect(page.locator(".report .status-pill")).toHaveText("Open");
  await expect(page.locator(".report")).toContainText("Temporary fix");
});

test("3 · no reply stays no reply; claiming a confirmation is a contradiction", async ({ page }) => {
  await openExample(page, "ac-no-reply");
  await expect(page.getByTestId("all-clear")).toBeVisible();

  await field(page, "closure", "Why").selectOption("confirmed_by_resident");
  await expect(finding(page, "confirmed-without-yes")).toBeVisible();
  await expect(finding(page, "confirmed-without-yes")).toContainText('the resident\'s answer is "No reply"');

  await field(page, "closure", "Why").selectOption("work_reported_done_no_reply");
  await expect(finding(page, "confirmed-without-yes")).toHaveCount(0);

  // The resident message opens in WhatsApp, with the brand's icon drawn inline (nothing loaded from elsewhere).
  const wa = page.getByRole("link", { name: "Open in WhatsApp" });
  await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
  await expect(wa.locator("svg path")).toHaveCount(1);

  await page.getByRole("tab", { name: "Report" }).click();
  await expect(page.locator(".report")).toContainText("No reply is recorded as no reply. It is not a confirmation.");
  await expect(page.locator(".report")).toContainText("Did not cover: Did not inspect the unit.");
});

test("4 · reopening keeps the earlier closure and overwrites nothing", async ({ page }) => {
  await openExample(page, "ac-no-reply");
  await page.getByRole("button", { name: "Reopen this record" }).click();

  await expect(page.locator("#sec-closure").getByLabel("Open", { exact: true })).toBeChecked();
  await expect(page.locator("#sec-history")).toContainText("Keeps the earlier closure: Work reported done, no reply from the resident");
  await field(page, "history", "What it says").fill("Resident wrote: dripping again.");

  await page.getByRole("tab", { name: "Report" }).click();
  const report = page.locator(".report");
  await expect(report.locator(".status-pill")).toHaveText("Open");
  await expect(report).toContainText("Earlier closure, kept as it was");
  await expect(report).toContainText("Statement by Ravi Kumar");
});

test("5 · no access: nothing may be closed as done", async ({ page }) => {
  await openExample(page, "no-access");
  await expect(check(page).locator(".finding-warning, .finding-contradiction")).toHaveCount(0);

  await page.locator("#sec-closure").getByLabel("Closed", { exact: true }).check();
  await field(page, "closure", "Why").selectOption("other");
  await expect(finding(page, "closed-last-visit-unfinished")).toBeVisible();
  await expect(finding(page, "closed-with-open-items")).toBeVisible();
});

test("JSON: download, open again, download again: the same file", async ({ page }) => {
  await openExample(page, "ac-reopened");
  const first = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const a = await (await first).path();
  const textA = await readFile(a, "utf8");
  expect(JSON.parse(textA).id).toBe("Q-1204");

  await page.getByRole("button", { name: "New blank record" }).click();
  await page.getByRole("button", { name: "Replace it" }).click();
  await expect(field(page, "context", "Job or ticket number")).toHaveValue("");

  await page.getByTestId("import-file").setInputFiles(a);
  await expect(page.getByRole("status")).toContainText("Opened");
  await expect(field(page, "context", "Job or ticket number")).toHaveValue("Q-1204");

  const second = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const textB = await readFile(await (await second).path(), "utf8");
  expect(textB).toBe(textA);
});

test("JSON: a file that is not a record is refused with reasons", async ({ page }) => {
  await page.getByTestId("import-file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      orr_version: "1.0", context: {}, work: [], checks: [], evidence: [], open_items: [], status: "open", history: [],
      resident: { status: "assumed_ok" },
    })),
  });
  await expect(page.getByRole("status")).toContainText('"bad.json" could not be opened');
  await expect(page.getByRole("status")).toContainText("resident.status");
});

test("print: the report is printed, not the form", async ({ page }) => {
  await openExample(page, "ac-no-reply");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#sec-context")).toBeHidden();
  await expect(page.locator(".print-only .report")).toBeVisible();
  await expect(page.locator(".builder-side")).toBeHidden();
});

test("the example pages render the report without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/examples/ac-reopened/");
  await expect(page.locator(".report")).toContainText("Reopened");
  await expect(page.locator(".report")).toContainText("It's dripping again, same place.");
  const json = await (await page.request.get("/examples/ac-reopened.json")).json();
  expect(json.status).toBe("open");
  const schema = await (await page.request.get("/schema/orr-1.0.schema.json")).json();
  expect(schema.title).toBe("Open Repair Record 1.0");
  await context.close();
});

test("no page scrolls sideways on a phone", async ({ page }, info) => {
  test.skip(info.project.name !== "phone");
  for (const path of ["/", "/guide/", "/guide/parts/", "/examples/ac-no-reply/", "/build/", "/format/", "/template/"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("format page: the walkthrough highlights the part in view, and the reference comes from the schema", async ({ page }, info) => {
  await page.goto("/format/");
  await expect(page.locator(".ref code", { hasText: "resident.status" }).first()).toBeVisible();
  await expect(page.locator(".ref")).toContainText(["no_reply: asked and nothing came back"]);
  test.skip(info.project.name !== "desktop", "the sticky file panel is desktop only");
  // Bring the card into the band the page watches (about 40% down the screen).
  await page.evaluate(() => {
    const el = document.getElementById("step-resident")!;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.4);
  });
  await expect(page.locator("#step-resident")).toHaveClass(/is-active/);
  await expect(page.locator("[data-walk-code] .hl").first()).toContainText('"resident"');
});
