import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

// Tiny env loader for .env.e2e (test accounts) and .env.local (Supabase URL and anon key). Both are gitignored.
for (const file of [".env.e2e", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  globalTeardown: "./e2e/global-teardown.ts",
  outputDir: "./test-results",
  fullyParallel: true,
  workers: 2, // the dev server compiles on demand; more workers cause slow first paint and flaky waits
  retries: 0,
  // Terse output keeps token cost low: only failures print detail.
  reporter: [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { baseURL: BASE_URL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], ...(process.env.E2E_USE_BUNDLED_CHROMIUM === "1" ? {} : { channel: "chrome" }) },
    },
    {
      name: "chromium",
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], ...(process.env.E2E_USE_BUNDLED_CHROMIUM === "1" ? {} : { channel: "chrome" }) },
      dependencies: ["setup"],
    },
  ],
  webServer: { command: `npm run dev -- -p ${new URL(BASE_URL).port || 3000}`, url: BASE_URL, reuseExistingServer: true, timeout: 180_000, env: { NEXT_PUBLIC_SHOW_TEST_USERS: "1" } },
});
