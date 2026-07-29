import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { parseProductImport } from "@/lib/product-import";
import { normalizePn } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    await apiUser(UserRole.ADMIN);
    const form = await request.formData();
    const workbook = form.get("workbook");
    const images = form.get("images");
    if (!(workbook instanceof File)) throw new ApiError(400, "请选择 Excel 文件");
    const { records } = await parseProductImport(Buffer.from(await workbook.arrayBuffer()), images instanceof File && images.size ? Buffer.from(await images.arrayBuffer()) : null);
    const existing = await db.product.findMany({ where: { pnNormalized: { in: records.filter((record) => record.pn).map((record) => normalizePn(record.pn)) } }, select: { pnNormalized: true } });
    const existingSet = new Set(existing.map((product) => product.pnNormalized));
    const rows = records.map((record) => ({ ...record, status: record.errors.length ? "ERROR" : record.duplicate ? "DUPLICATE" : existingSet.has(normalizePn(record.pn)) ? "UPDATE" : "NEW", hasImage: Boolean(record.imageBytes), imageEntryName: undefined, imageBytes: undefined, attributes: undefined }));
    return NextResponse.json({ rows, summary: { total: rows.length, new: rows.filter((row) => row.status === "NEW").length, update: rows.filter((row) => row.status === "UPDATE").length, duplicates: rows.filter((row) => row.status === "DUPLICATE").length, errors: rows.filter((row) => row.status === "ERROR").length, images: rows.filter((row) => row.hasImage).length } });
  } catch (error) {
    return apiError(error);
  }
}
