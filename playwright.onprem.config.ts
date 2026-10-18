import { defineConfig, devices } from "@playwright/test";

// The self-hosted copy: built with ORR_EDITION=onprem and served locally. See tests/e2e-onprem.
export default defineConfig({
  testDir: "tests/e2e-onprem",
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4330", channel: "chrome" },
  projects: [{ name: "onprem", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  webServer: {
    command: "npm run build:onprem && npx astro preview --port 4330",
    url: "http://localhost:4330/",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
