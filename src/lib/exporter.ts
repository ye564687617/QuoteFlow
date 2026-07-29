import fs from "node:fs";
import dns from "node:dns/promises";
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

async function renderUrl(revisionId: string, withBank: boolean) {
  const url = new URL(env().APP_URL);
  if (url.protocol === "http:" && url.hostname === "app") {
    const { address } = await dns.lookup(url.hostname, { family: 4 });
    url.hostname = address;
  }
  url.pathname = `/render/quotes/${encodeURIComponent(revisionId)}`;
  url.search = new URLSearchParams({ token: env().EXPORT_RENDER_TOKEN, bank: withBank ? "1" : "0" }).toString();
  return url.toString();
}

export function sanitizeExportError(message: string) {
  return message.replace(/([?&]token=)[^&\s"']+/gi, "$1[REDACTED]");
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
    browser = await chromium.launch({
      executablePath: chromiumPath(),
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server", "--disable-features=HttpsUpgrades"],
    });
    const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 2 });
    await page.emulateMedia({ media: "screen" });
    const render = async (withBank: boolean) => {
      await page.goto(await renderUrl(pending.revisionId, withBank), { waitUntil: "networkidle", timeout: 60_000 });
      await page.waitForSelector("[data-quote-ready='true']", { timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      const documentNode = page.locator(".quote-document");
      const box = await documentNode.boundingBox();
      if (!box) throw new Error("报价版式渲染失败");
      if (box.height > 28_000) throw new Error("报价内容过长，请拆分为两张报价后重试");
      const png = await documentNode.screenshot({ type: "png", animations: "disabled" });
      await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((node) => node.remove()));
      await page.addStyleTag({ content: "html, body, .canvas { margin: 0 !important; padding: 0 !important; min-height: 0 !important; background: #fff !important; } .document { margin: 0 !important; }" });
      const pdfBox = await documentNode.boundingBox();
      if (!pdfBox) throw new Error("PDF 版式渲染失败");
      // Chromium converts CSS pixels to PDF points and can round the final row
      // onto a second page. A small white allowance keeps the long PI on one page.
      const pdf = await page.pdf({ width: `${Math.ceil(pdfBox.width) + 2}px`, height: `${Math.ceil(pdfBox.height) + 64}px`, margin: { top: "0", right: "0", bottom: "0", left: "0" }, printBackground: true });
      return { png, pdf };
    };
    const noBank = await render(false);
    const withBank = await render(true);
    const basePath = `quotes/${pending.revision.seriesId}/R${String(pending.revision.revisionNumber).padStart(2, "0")}`;
    const paths = { pngNoBankPath: `${basePath}-no-bank.png`, pngWithBankPath: `${basePath}-with-bank.png`, pdfNoBankPath: `${basePath}-no-bank.pdf`, pdfWithBankPath: `${basePath}-with-bank.pdf` };
    await Promise.all([storage.put(paths.pngNoBankPath, noBank.png), storage.put(paths.pngWithBankPath, withBank.png), storage.put(paths.pdfNoBankPath, noBank.pdf), storage.put(paths.pdfWithBankPath, withBank.pdf)]);
    await db.$transaction([
      db.quoteRevision.update({ where: { id: pending.revisionId }, data: { exportedAt: new Date() } }),
      db.exportJob.update({ where: { id: pending.id }, data: { status: "READY", ...paths, finishedAt: new Date() } }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? sanitizeExportError(error.message).slice(0, 1000) : "未知导出错误";
    await db.exportJob.update({ where: { id: pending.id }, data: { status: "FAILED", error: message, finishedAt: new Date() } });
    console.error(`Export ${pending.id} failed`, error);
  } finally {
    await browser?.close();
  }
  return true;
}
