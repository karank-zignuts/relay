import { test as base, expect } from "@playwright/test";

// Fails any test that hits a page error or a failed same-origin / Supabase call, so live bugs surface as text.
export const test = base.extend({
  page: async ({ page }, use) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
    page.on("response", (response) => {
      if (response.status() < 500) return;
      const host = new URL(response.url()).hostname;
      const own = host === "localhost" || host === "127.0.0.1" || host.endsWith(".supabase.co");
      if (own) problems.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    });
    await use(page);
    expect(problems, "console/network problems").toEqual([]);
  },
});
export { expect };
