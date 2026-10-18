import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

// The Content-Security-Policy the Docker image sends, read from the shipped nginx.conf.
const CSP = /Content-Security-Policy "([^"]+)"/.exec(readFileSync("deploy/nginx.conf", "utf8"))![1]!;

const PAGES = [
  "/", "/guide/", "/guide/parts/", "/guide/good-and-weak/", "/guide/mistakes/", "/guide/contractors/",
  "/examples/", "/examples/kitchen-tap/", "/examples/ac-reopened/", "/build/", "/build/?example=ceiling-leak",
  "/format/", "/template/", "/faq/", "/about/", "/privacy/", "/self-host/",
];

test("no page of the self-hosted copy makes a request outside its own server", async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const outside: string[] = [];
  page.on("request", (r) => {
    const url = r.url();
    if (!url.startsWith(origin) && !url.startsWith("data:") && !url.startsWith("blob:")) outside.push(url);
  });
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: "networkidle" });
  }
  // The editor itself: load an example, switch to the report, and run the check.
  await page.goto("/build/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "A temporary fix" }).click();
  await page.getByRole("tab", { name: "Report" }).click();
  await expect(page.locator(".report")).toContainText("Temporary fix");
  await page.waitForLoadState("networkidle");
  expect(outside, outside.join("\n")).toEqual([]);
});

test("the self-hosted copy says what it is and stays out of search engines", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('script[src*="cloudflareinsights"]')).toHaveCount(0);
  await expect(page.locator("[data-edition=onprem]")).toContainText("Self-hosted copy, version");
  await expect(page.locator('footer a[href="/impressum/"]')).toHaveCount(0);
  await page.goto("/privacy/");
  await expect(page.locator("h1")).toHaveText("This is a self-hosted copy");
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
  expect((await request.get("/CNAME")).status()).toBe(404);
  expect((await request.get("/sitemap-index.xml")).status()).toBe(404);
});

test("the editor works under the image's Content-Security-Policy (no eval, nothing from elsewhere)", async ({ page }) => {
  await page.route("**/*", async (route) => {
    const response = await route.fetch();
    const headers = { ...response.headers() };
    if ((headers["content-type"] ?? "").includes("text/html")) headers["content-security-policy"] = CSP;
    await route.fulfill({ response, headers });
  });
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") problems.push(m.text()); });
  await page.goto("/build/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "No reply from the resident" }).click();
  await expect(page.getByTestId("all-clear")).toBeVisible();
  await page.locator("#sec-closure").getByLabel("Why").selectOption("confirmed_by_resident");
  await expect(page.locator('[data-code="confirmed-without-yes"]')).toBeVisible();
  await page.getByTestId("import-file").setInputFiles({
    name: "r.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ orr_version: "1.0", context: {}, work: [], checks: [], evidence: [], open_items: [], status: "open", history: [], resident: { status: "assumed_ok" } })),
  });
  await expect(page.getByRole("status")).toContainText("resident.status");
  await page.goto("/format/", { waitUntil: "networkidle" });
  expect(problems, problems.join(" | ")).toEqual([]);
});
