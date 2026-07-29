import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await apiUser();
    const { jobId } = await context.params;
    const job = await db.exportJob.findUnique({ where: { id: jobId }, include: { revision: { include: { series: true } } } });
    if (!job || (user.role !== UserRole.ADMIN && job.revision.series.salespersonId !== user.id)) throw new ApiError(404, "导出任务不存在");
    return NextResponse.json({ job });
  } catch (error) {
    return apiError(error);
  }
}
