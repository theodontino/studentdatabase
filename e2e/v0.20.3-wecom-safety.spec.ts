import { expect, test } from "@playwright/test";

test("active WeCom import survives refresh and offers stop-and-rollback", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("student-track:wecom-access", JSON.stringify({
    version: "wecom-third-party-notice-v1",
    acceptedAt: new Date().toISOString(),
  })));
  let requestedMode = "";
  await page.route("**/api/wecom/auto-import", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          active: true,
          run: {
            id: "test-active-run",
            status: "running",
            messageCount: 100,
            batchCount: 20,
            communicationCount: 8,
            receiptCounts: { pending: 60, imported: 30, no_value: 5, needs_review: 5 },
            progress: 40,
            cancelRequestedAt: null,
            cancelMode: null,
          },
        }),
      });
      return;
    }
    if (route.request().method() === "DELETE") {
      requestedMode = (route.request().postDataJSON() as { mode?: string }).mode || "";
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ accepted: true, rollbackRequested: true }),
      });
      return;
    }
    await route.abort();
  });

  await page.goto("/wecom");
  await expect(page.getByText("企微导入正在后台运行…")).toBeVisible();
  await expect(page.getByText("已写入 8 条 · 待处理 60 条 · 待复核 5 条")).toBeVisible();
  await page.getByRole("button", { name: "停止并回滚本次" }).click();
  await expect(page.getByRole("dialog")).toContainText("只撤销本次运行产生的增量");
  await page.getByRole("button", { name: "停止并回滚", exact: true }).click();
  await expect.poll(() => requestedMode).toBe("stop_and_rollback");
});
