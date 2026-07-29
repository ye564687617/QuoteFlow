import fs from "node:fs";
import { chromium } from "playwright-core";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";

function chromiumPath() {
  const configured = env().CHROMIUM_EXECUTABLE_PATH;
  if (configured) return configured;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("未找到 Chromium，请设置 CHROMIUM_EXECUTABLE_PATH");
  return found;
}

export async function processNextExport() {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
  await db.exportJob.updateMany({
    where: { status: "PROCESSING", startedAt: { lt: staleBefore }, attempts: { lt: 3 } },
    data: { status: "PENDING", startedAt: null, error: "导出进程中断，任务已自动重新排队" },
  });
  await db.exportJob.updateMany({
    where: { status: "PROCESSING", startedAt: { lt: staleBefore }, attempts: { gte: 3 } },
    data: { status: "FAILED", finishedAt: new Date(), error: "导出进程连续中断，请检查 Worker 日志后重试" },
  });
  const pending = await db.exportJob.findFirst({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { revision: { include: { series: true } } } });
  if (!pending) return false;
  const claimed = await db.exportJob.updateMany({ where: { id: pending.id, status: "PENDING" }, data: { status: "PROCESSING", attempts: { increment: 1 }, startedAt: new Date(), error: null } });
  if (!claimed.count) return true;

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ executablePath: chromiumPath(), headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 2 });
    const url = `${env().APP_URL}/render/quotes/${pending.revisionId}?token=${encodeURIComponent(env().EXPORT_RENDER_TOKEN)}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector("[data-quote-ready='true']", { timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    const documentNode = page.locator(".quote-document");
    const box = await documentNode.boundingBox();
    if (!box) throw new Error("报价版式渲染失败");
    if (box.height > 28_000) throw new Error("报价内容过长，请拆分为两张报价后重试");
    const png = await documentNode.screenshot({ type: "png", animations: "disabled" });
    const outputPath = `quotes/${pending.revision.seriesId}/R${String(pending.revision.revisionNumber).padStart(2, "0")}.png`;
    await storage.put(outputPath, png);
    await db.$transaction([
      db.quoteRevision.update({ where: { id: pending.revisionId }, data: { exportedPath: outputPath, exportedAt: new Date() } }),
      db.exportJob.update({ where: { id: pending.id }, data: { status: "READY", outputPath, finishedAt: new Date() } }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "未知导出错误";
    await db.exportJob.update({ where: { id: pending.id }, data: { status: "FAILED", error: message, finishedAt: new Date() } });
    console.error(`Export ${pending.id} failed`, error);
  } finally {
    await browser?.close();
  }
  return true;
}
