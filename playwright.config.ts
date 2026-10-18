import { defineConfig, devices } from "@playwright/test";

// Runs against the built site, in the installed Chrome (no browser download needed).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4329", channel: "chrome", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "phone", use: { viewport: { width: 375, height: 812 }, isMobile: false, channel: "chrome" } },
  ],
  webServer: {
    command: "npm run build && npx astro preview --port 4329",
    url: "http://localhost:4329/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
