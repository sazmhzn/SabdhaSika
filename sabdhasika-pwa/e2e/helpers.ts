import { expect, type Page } from "@playwright/test";

/** Unique account per test — device-local auth means no server cleanup needed. */
export function testAccount() {
  const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  return { email: `pw-${n}@example.com`, password: "Playwright123!", name: "PW Tester" };
}

export async function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  return errors;
}

export async function collectFailedRequests(page: Page) {
  const failed: string[] = [];
  page.on("response", (res) => {
    if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`);
  });
  return failed;
}

/** Register via UI. Ends on /onboarding (fresh account) or /learn. */
export async function registerViaUI(
  page: Page,
  account = testAccount(),
) {
  await page.goto("/register");
  await page.getByLabel(/email/i).fill(account.email);
  await page.getByLabel(/^password/i).fill(account.password);
  const nameField = page.getByLabel(/your name/i);
  if (await nameField.count()) await nameField.fill(account.name);
  await page.getByRole("button", { name: /create account/i }).click();
  // Redirect effect fires on session — allow either destination, then settle:
  // content (not just URL) proves which screen actually rendered. Scoped to
  // heading / learn copy: Next's route announcer echoes the document title
  // ("...learn the words that matter") and would double-match a bare getByText.
  const step0 = page.getByRole("heading", { name: /learn the words/i });
  const learn = page.getByText(/words? left|done for today/i);
  await expect(step0.or(learn).first()).toBeVisible({ timeout: 20_000 });
  return account;
}

/** Walk the 5-step onboarding with defaults (ja/en/25) through to /learn. */
export async function completeOnboardingDefaults(page: Page) {
  await expect(page).toHaveURL(/\/onboarding/);
  // Step 0 → Get Started
  await page.getByRole("button", { name: /get started/i }).click();
  // Step 1 → Continue (default ja)
  await page.getByRole("button", { name: /^continue$/i }).click();
  // Step 2 → Continue (default en)
  await page.getByRole("button", { name: /^continue$/i }).click();
  // Step 3 → Continue (default 25)
  await page.getByRole("button", { name: /^continue$/i }).click();
  // Step 4 → Start Learning
  await page.getByRole("button", { name: /start learning/i }).click();
  await expect(page).toHaveURL(/\/learn/, { timeout: 20_000 });
}

/** Fresh account + onboarding → lands on /learn ready to study. */
export async function freshOnboardedPage(page: Page) {
  const account = await registerViaUI(page);
  if (page.url().includes("/onboarding")) await completeOnboardingDefaults(page);
  await expect(page).toHaveURL(/\/learn/);
  return account;
}

/** Fail loudly on console errors, ignoring known-benign noise. */
export function assertNoConsoleErrors(errors: string[]) {
  const benign = [
    /ResizeObserver loop/i,
    /third-party cookie/i,
    /Failed to load resource: the server responded with a status of 404/i,
  ];
  const real = errors.filter((e) => !benign.some((re) => re.test(e)));
  expect(real, `console errors:\n${real.join("\n")}`).toEqual([]);
}
