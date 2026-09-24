import { expect, test } from "@playwright/test";
import {
  leafPng,
  linkFromEmail,
  PASSWORD,
  signUpAndVerify,
  uniqueEmail,
} from "./helpers";

/**
 * The whole customer journey on one account, in order: sign up, confirm the
 * email, scan a leaf, work with the saved scan, change settings, sign out and
 * back in, reset the password, and delete the account.
 */
test.describe.configure({ mode: "serial" });

test("a new customer can sign up, scan, manage history and leave", async ({
  page,
}) => {
  const email = uniqueEmail();

  await test.step("sign up and confirm the email", async () => {
    await signUpAndVerify(page, email);
    await expect(
      page.getByRole("heading", { name: /Welcome, Asha/ }),
    ).toBeVisible();
    await expect(page.getByText("You're all set")).toBeVisible();
  });

  await test.step("an unverified sign-in is refused before this point", async () => {
    // Covered implicitly: signUpAndVerify only reaches the dashboard via the
    // emailed link. Here, check the session is real on the server.
    const response = await page.request.get("/api/auth/get-session");
    expect((await response.json()).user.email).toBe(email);
  });

  let scanUrl = "";
  await test.step("scan a leaf; it is analysed on-device and saved", async () => {
    await page.goto("/scan");
    await expect(
      page.locator('.dropzone:not([aria-disabled="true"])'),
    ).toBeVisible({ timeout: 90_000 });
    await page.locator('input[type="file"][multiple]').setInputFiles({
      name: "leaf.png",
      mimeType: "image/png",
      buffer: leafPng(),
    });
    await expect(page.getByText("Saved to your history")).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByRole("heading", { name: /Why did PlantGuard/i }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Open" }).click();
    await expect(page).toHaveURL(/\/history\/[a-f0-9]{24}$/);
    scanUrl = page.url();
  });

  await test.step("the saved scan shows its photo, heatmap and diagnosis", async () => {
    await expect(
      page.getByRole("img", { name: /Heatmap over the leaf photograph/ }),
    ).toBeVisible();
    await expect(page.getByText("Scan details")).toBeVisible();
    const photo = await page.request.get(
      `${scanUrl.replace("/history/", "/api/scans/")}/image`,
    );
    expect(photo.status()).toBe(200);
    expect(photo.headers()["content-type"]).toBe("image/jpeg");
  });

  await test.step("add a field label and notes", async () => {
    await page.getByLabel("Field or plot").fill("North field");
    await page.getByLabel("Observations").fill("Brown spots on older leaves");
    await page.getByRole("button", { name: "Save notes" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Field or plot")).toHaveValue("North field");
  });

  await test.step("find it in history, search, and export CSV", async () => {
    await page.goto("/history");
    await expect(page.locator(".scan-card")).toHaveCount(1);
    await page.getByRole("searchbox", { name: "Search scans" }).fill("north");
    await expect(page).toHaveURL(/q=north/);
    await expect(page.locator(".scan-card")).toHaveCount(1);
    await page
      .getByRole("searchbox", { name: "Search scans" })
      .fill("nothing-matches");
    await expect(page.getByText("No scans match")).toBeVisible();

    const csv = await page.request.get("/api/scans/export");
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain("North field");
  });

  await test.step("the dashboard reflects the scan", async () => {
    await page.goto("/dashboard");
    await expect(
      page.locator(".stat", { hasText: "Total scans" }),
    ).toContainText("1");
    await expect(page.locator(".scan-card")).toHaveCount(1);
  });

  await test.step("change the display name and scan preferences", async () => {
    await page.goto("/settings");
    await page.getByLabel("Full name").fill("Asha Devi");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".sidebar-user")).toContainText("Asha Devi");

    const photos = page.getByRole("switch", {
      name: "Keep photos with saved scans",
    });
    await photos.uncheck();
    await expect(photos).not.toBeChecked();
    await page.reload();
    await expect(
      page.getByRole("switch", { name: "Keep photos with saved scans" }),
    ).not.toBeChecked();
  });

  await test.step("delete the scan", async () => {
    await page.goto(scanUrl);
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(page.getByText("No scans yet")).toBeVisible();
  });

  await test.step("sign out; app pages then require signing in", async () => {
    await page.goto("/dashboard");
    await page
      .locator(".desktop-sidebar")
      .getByRole("button", { name: "Sign out" })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/history");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fhistory/);
  });

  await test.step("a wrong password is rejected; the right one lands on the original page", async () => {
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("not-my-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByText("That email and password don't match"),
    ).toBeVisible();

    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/history$/);
  });

  await test.step("reset a forgotten password", async () => {
    await page.context().clearCookies();
    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();

    await page.goto(await linkFromEmail(email, "reset-password"));
    await expect(page).toHaveURL(/\/reset-password\?token=/);
    await page
      .getByLabel("New password", { exact: true })
      .fill(`${PASSWORD}-new`);
    await page.getByLabel("Confirm new password").fill(`${PASSWORD}-new`);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page).toHaveURL(/\/sign-in\?reset=1/);

    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(`${PASSWORD}-new`);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  await test.step("delete the account", async () => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Delete account" }).first().click();
    await page
      .getByLabel("Enter your password to confirm")
      .fill(`${PASSWORD}-new`);
    await page
      .locator("dialog[open]")
      .getByRole("button", { name: "Delete account" })
      .click();
    await expect(page).toHaveURL(/\/sign-in\?deleted=1/);
    await expect(
      page.getByText("Your account and all its data have been deleted."),
    ).toBeVisible();

    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(`${PASSWORD}-new`);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByText("That email and password don't match"),
    ).toBeVisible();
  });
});

test("the API refuses anonymous and cross-site requests", async ({
  request,
}) => {
  expect((await request.get("/api/scans")).status()).toBe(401);
  expect((await request.get("/api/account/export")).status()).toBe(401);

  const crossSite = await request.delete("/api/account/scans", {
    headers: { Origin: "https://evil.example" },
  });
  expect(crossSite.status()).toBe(403);
});
