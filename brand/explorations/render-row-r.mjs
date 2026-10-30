import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1536, height: 440 }, deviceScaleFactor: 2 });
await page.goto("file://" + path.join(dir, "relay-row-r-round2.html"));
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(dir, "relay-row-r-round2.png") });
await browser.close();
