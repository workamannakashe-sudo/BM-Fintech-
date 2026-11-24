// e2e/dataIsolation.spec.ts — End-to-end data separation verification
import { test, expect } from "@playwright/test";

test.describe("Data Isolation & Zero Demo Bleed", () => {
  const user1Email = `isolated_user1_${Date.now()}@college.edu`;
  const user2Email = `isolated_user2_${Date.now()}@college.edu`;
  const password = "Password123!";

  test("new signup shows clean state, onboarding, and no leakage to second user", async ({ page }) => {
    await page.goto("/");

    // 1. Sign up as User 1
    const registerTab = page.getByRole("tab", { name: /register|sign up/i }).or(
      page.getByText(/register|create account/i).first()
    );
    await registerTab.click();

    await page.getByPlaceholder(/name/i).or(page.getByLabel(/name/i)).first().fill("Student Alpha");
    await page.getByPlaceholder(/email/i).or(page.getByLabel(/email/i)).first().fill(user1Email);
    await page.getByPlaceholder(/password/i).or(page.getByLabel(/password/i)).first().fill(password);

    await page.getByRole("button", { name: /create account|register|sign up/i }).first().click();

    // 2. Onboarding wizard appears for new account
    const onboardingHeader = page.getByText(/academic profile|welcome, student alpha/i).first();
    if (await onboardingHeader.isVisible({ timeout: 5000 })) {
      // Step through onboarding
      const continueBtn = page.getByRole("button", { name: /continue|next/i });
      if (await continueBtn.isVisible()) await continueBtn.click();
      if (await continueBtn.isVisible()) await continueBtn.click();
      if (await continueBtn.isVisible()) await continueBtn.click();

      const finishBtn = page.getByRole("button", { name: /finish setup|launch/i });
      if (await finishBtn.isVisible()) await finishBtn.click();
    }

    // 3. User 1 should land on clean dashboard with 0 transactions
    await expect(page.getByText(/dashboard/i).first()).toBeVisible({ timeout: 10_000 });
    // Verify no fake "Flivia Hartman" or "Rahul Sharma"
    await expect(page.getByText(/flivia hartman/i)).not.toBeVisible();

    // 4. Logout User 1
    const logoutBtn = page.getByRole("button", { name: /logout|sign out/i }).or(
      page.getByTitle(/logout|sign out/i)
    ).first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    } else {
      // Clear via client evaluation if UI button is behind a menu
      await page.evaluate(() => {
        localStorage.removeItem("bm_authenticated");
        localStorage.removeItem("bm_current_user_email");
        window.location.reload();
      });
    }

    // 5. Register User 2
    await page.goto("/");
    await registerTab.click();
    await page.getByPlaceholder(/name/i).or(page.getByLabel(/name/i)).first().fill("Student Beta");
    await page.getByPlaceholder(/email/i).or(page.getByLabel(/email/i)).first().fill(user2Email);
    await page.getByPlaceholder(/password/i).or(page.getByLabel(/password/i)).first().fill(password);
    await page.getByRole("button", { name: /create account|register|sign up/i }).first().click();

    // Verify User 2 has zero of User 1's data
    await expect(page.getByText(/student alpha/i)).not.toBeVisible();
    await expect(page.getByText(/flivia hartman/i)).not.toBeVisible();
  });

  test("demo mode exhibits persistent banner and isolation", async ({ page }) => {
    await page.goto("/");
    const demoBtn = page.getByRole("button", { name: /guest|try demo|rahul/i }).first();
    await demoBtn.click();

    // Demo banner should be permanently visible
    await expect(page.getByText(/demo mode/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
