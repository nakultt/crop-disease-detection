import { expect, test } from "@playwright/test";

test("the landing page introduces the product and links to sign-up", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Spot crop disease early",
  );
  await page
    .getByRole("link", { name: "Get started — it's free" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
});

test("the crops library lists every supported crop", async ({ page }) => {
  await page.goto("/crops");
  await expect(page.locator(".crop-card")).toHaveCount(14);
  await page.getByText("Late blight").first().click();
  await expect(
    page
      .getByText(/Destroy infected tubers|Apply fungicide immediately/)
      .first(),
  ).toBeVisible();
});

test("switching language re-renders the page and persists", async ({
  page,
}) => {
  await page.goto("/about");
  await page
    .getByRole("combobox", { name: "Display Language" })
    .first()
    .selectOption("hi");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  // The heading is translated, not English.
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(
    "About PlantGuard",
  );
});

test("app pages redirect signed-out visitors to sign-in", async ({ page }) => {
  for (const path of ["/dashboard", "/scan", "/settings", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(
      new RegExp(`/sign-in\\?next=${encodeURIComponent(path)}`),
    );
  }
});

test("unknown pages get a friendly 404", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "We couldn't find that page" }),
  ).toBeVisible();
});

test("security headers are present", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["content-security-policy"]).toMatch(
    /script-src 'self' 'nonce-/,
  );
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["cross-origin-embedder-policy"]).toBe("require-corp");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("health, robots, sitemap and manifest are served", async ({ request }) => {
  expect((await request.get("/api/health")).ok()).toBe(true);
  expect(await (await request.get("/robots.txt")).text()).toContain(
    "Disallow: /dashboard",
  );
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/crops");
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.short_name).toBe("PlantGuard");
  expect((await request.get("/icons/512")).headers()["content-type"]).toBe(
    "image/png",
  );
});
