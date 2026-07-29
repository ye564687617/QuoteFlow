import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser();
    const { id } = await context.params;
    const revision = await db.quoteRevision.findUnique({ where: { id }, include: { series: true } });
    if (!revision || (user.role !== UserRole.ADMIN && revision.series.salespersonId !== user.id)) throw new ApiError(404, "报价不存在");
    const query = new URL(request.url).searchParams;
    const format = query.get("format") === "pdf" ? "pdf" : query.get("format") === "png" || !query.get("format") ? "png" : null;
    const bank = query.get("bank") === "1";
    if (!format) throw new ApiError(400, "导出格式不正确");
    const job = await db.exportJob.findUnique({ where: { revisionId: revision.id } });
    const path = format === "png" ? (bank ? job?.pngWithBankPath : job?.pngNoBankPath) : (bank ? job?.pdfWithBankPath : job?.pdfNoBankPath);
    if (!path) throw new ApiError(409, "报价文件尚未生成");
    const data = await storage.read(path);
    const suffix = bank ? "-with-bank" : "-no-bank";
    return new NextResponse(data, { headers: { "Content-Type": format === "pdf" ? "application/pdf" : "image/png", "Content-Disposition": `attachment; filename="${revision.displayPiNumber}${suffix}.${format}"` } });
  } catch (error) {
    return apiError(error);
  }
}
