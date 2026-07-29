import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { parseProductImport } from "@/lib/product-import";
import { normalizePn } from "@/lib/validation";
import { buildVariantLabels, normalizeDescription } from "@/lib/product-variants";

export async function POST(request: Request) {
  try {
    await apiUser(UserRole.ADMIN);
    const form = await request.formData();
    const workbook = form.get("workbook");
    const images = form.get("images");
    if (!(workbook instanceof File)) throw new ApiError(400, "请选择 Excel 文件");
    const { records } = await parseProductImport(Buffer.from(await workbook.arrayBuffer()), images instanceof File && images.size ? Buffer.from(await images.arrayBuffer()) : null);
    const existing = await db.product.findMany({ where: { pnNormalized: { in: records.filter((record) => record.pn).map((record) => normalizePn(record.pn)) } }, select: { id: true, pnNormalized: true, description: true, descriptionNormalized: true } });
    const existingSet = new Set(existing.map((product) => `${product.pnNormalized}:${product.descriptionNormalized}`));
    const labels = buildVariantLabels([
      ...existing,
      ...records.map((record) => ({ id: `row-${record.rowNumber}`, description: record.description, descriptionNormalized: normalizeDescription(record.description) })),
    ]);
    const rows = records.map((record) => ({ ...record, variantLabel: labels.get(`row-${record.rowNumber}`) ?? "Variant 1", status: record.errors.length ? "ERROR" : record.duplicate ? "DUPLICATE" : existingSet.has(`${normalizePn(record.pn)}:${normalizeDescription(record.description)}`) ? "UPDATE" : "NEW", hasImage: Boolean(record.imageBytes), imageEntryName: undefined, imageBytes: undefined, attributes: undefined }));
    return NextResponse.json({ rows, summary: { total: rows.length, new: rows.filter((row) => row.status === "NEW").length, update: rows.filter((row) => row.status === "UPDATE").length, duplicates: rows.filter((row) => row.status === "DUPLICATE").length, errors: rows.filter((row) => row.status === "ERROR").length, images: rows.filter((row) => row.hasImage).length } });
  } catch (error) {
    return apiError(error);
  }
}
