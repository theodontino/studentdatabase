import { expect, test } from "@playwright/test";

test.describe("v0.19.0 workflow UX", () => {
  test("WeComCatch long paths stay inside the dedicated workspace card", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("student-track:wecom-access", JSON.stringify({
      version: "wecom-third-party-notice-v1",
      acceptedAt: new Date().toISOString(),
    })));
    const longPath = "/private/tmp/wecomcatch/runtime/runs/archive-pending-20260715-very-long-task-name-that-must-not-expand-the-workspace.json";
    await page.route("**/api/wecomcatch/status", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        command: "status",
        scriptPath: `${longPath}/bin/wecomcatch-wrapper.sh`,
        stdout: "",
        stderr: "",
        parsed: { job_status: "exited", log_path: longPath, report_path: `${longPath}/report-with-another-unbroken-segment.json` },
      }),
    }));
    await page.setViewportSize({ width: 1180, height: 900 });
    await page.goto("/wecom");
    await page.getByRole("button", { name: "读取状态" }).click();
    await expect(page.locator("pre").filter({ hasText: "report_path" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const output = page.locator("pre").filter({ hasText: "report_path" });
    const card = output.locator("xpath=ancestor::section[1]");
    const [outputBox, cardBox] = await Promise.all([output.boundingBox(), card.boundingBox()]);
    expect(outputBox).not.toBeNull();
    expect(cardBox).not.toBeNull();
    expect(outputBox!.x + outputBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1);
  });
});
