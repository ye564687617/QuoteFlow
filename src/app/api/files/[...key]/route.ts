import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { mimeFromPath, storage } from "@/lib/storage";

async function canReadFile(user: Awaited<ReturnType<typeof apiUser>>, storageKey: string) {
  if (storageKey.startsWith("products/")) return Boolean(await db.productAsset.findFirst({ where: { OR: [{ storagePath: storageKey }, { thumbnailPath: storageKey }] }, select: { id: true } }));
  if (storageKey.startsWith("company/") || storageKey.startsWith("imports/")) return user.role === UserRole.ADMIN;
  if (storageKey.startsWith("quotes/")) {
    const job = await db.exportJob.findFirst({
      where: {
        OR: [{ pngNoBankPath: storageKey }, { pngWithBankPath: storageKey }, { pdfNoBankPath: storageKey }, { pdfWithBankPath: storageKey }],
        ...(user.role === UserRole.ADMIN ? {} : { revision: { series: { salespersonId: user.id } } }),
      },
      select: { id: true },
    });
    return Boolean(job);
  }
  return false;
}

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  try {
    const user = await apiUser();
    const { key } = await context.params;
    const storageKey = key.join("/");
    if (!(await canReadFile(user, storageKey))) throw new ApiError(404, "文件不存在");
    const data = await storage.read(storageKey);
    return new NextResponse(data, { headers: { "Content-Type": mimeFromPath(storageKey), "Cache-Control": "private, max-age=3600" } });
  } catch (error) {
    return apiError(error);
  }
}
