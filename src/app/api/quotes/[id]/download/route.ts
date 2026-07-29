import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser();
    const { id } = await context.params;
    const revision = await db.quoteRevision.findUnique({ where: { id }, include: { series: true } });
    if (!revision || (user.role !== UserRole.ADMIN && revision.series.salespersonId !== user.id)) throw new ApiError(404, "报价不存在");
    if (!revision.exportedPath) throw new ApiError(409, "报价图片尚未生成");
    const data = await storage.read(revision.exportedPath);
    return new NextResponse(data, { headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${revision.displayPiNumber}.png"` } });
  } catch (error) {
    return apiError(error);
  }
}
