import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { chromium, type Page } from "playwright";

const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";

async function healthy(): Promise<boolean> {
  try {
    const res = await fetch(`${base}/api/health`);
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean; services?: unknown };
    return body.ok === true && Array.isArray(body.services);
  } catch {
    return false;
  }
}

async function ensureServer(): Promise<ChildProcess | null> {
  if (await healthy()) return null;
  const child = spawn("npm run dev", { shell: true, stdio: "inherit" });
  for (let i = 0; i < 60; i++) {
    if (await healthy()) return child;
    await new Promise((r) => setTimeout(r, 2000));
  }
  child.kill();
  throw new Error("Dev server did not become healthy at " + base);
}

async function bookJob(page: Page, name: string, email: string) {
  await page.getByRole("button", { name: "Book this job" }).click();
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Mobile phone").fill("8135550142");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Book this job" }).click();
  await page.getByTestId("quote-sent").waitFor();
}

async function quote(page: Page) {
  const viewed = page.waitForResponse((r) => r.url().includes("/event") && r.request().method() === "POST");
  await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
  await viewed;
  await page.getByLabel("Street address").fill("123 Oak Street");
  const option = page.getByRole("option").first();
  await option.waitFor({ timeout: 15000 });
  await option.click();
  await page.getByRole("button", { name: "House wash" }).click();
  await page.getByRole("button", { name: "See the price" }).click();
  const total = page.getByTestId("quote-total");
  await total.waitFor();
  assert.match(await total.innerText(), /\$/);
  await bookJob(page, "Jane Homeowner", "jane@example.com");
}

/** No autocomplete — homeowner types the address and still gets a price. */
async function quoteManual(page: Page) {
  const viewed = page.waitForResponse((r) => r.url().includes("/event") && r.request().method() === "POST");
  await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
  await viewed;
  await page.getByRole("button", { name: "Enter details manually" }).click();
  await page.getByLabel("Full address").fill("999 No Match Lane, Tampa, FL 33602");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("No satellite match").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "House wash" }).click();
  await page.getByRole("button", { name: "See the price" }).click();
  const total = page.getByTestId("quote-total");
  await total.waitFor();
  assert.match(await total.innerText(), /\$/);
  await bookJob(page, "Manual Path", "manual@example.com");
}

async function main() {
  const child = await ensureServer();
  const browser = await chromium.launch();
  try {
    const desktop = await browser.newPage();
    await quote(desktop);

    const manual = await browser.newPage();
    await quoteManual(manual);

    const phone = await browser.newPage({ viewport: { width: 390, height: 800 } });
    await phone.goto(`${base}/demo`);
    const box = await phone.getByLabel("Street address").boundingBox();
    assert.ok(box && box.width > 240 && box.width <= 390, `address width ${box?.width}`);
  } finally {
    await browser.close();
    if (child?.pid) {
      if (process.platform === "win32") spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"]);
      else child.kill();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
