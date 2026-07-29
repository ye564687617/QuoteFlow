import crypto from "node:crypto";
import { Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { imageMime, ImportRecord, parseProductImport } from "@/lib/product-import";
import { prepareProductImage, storage } from "@/lib/storage";
import { normalizePn, nullable } from "@/lib/validation";

export async function POST(request: Request) {
  const writtenKeys: string[] = [];
  try {
    const user = await apiUser(UserRole.ADMIN);
    const form = await request.formData();
    const workbook = form.get("workbook");
    const images = form.get("images");
    const mode = form.get("mode") === "update" ? "update" : "skip";
    if (!(workbook instanceof File)) throw new ApiError(400, "请选择 Excel 文件");
    const parsed = await parseProductImport(Buffer.from(await workbook.arrayBuffer()), images instanceof File && images.size ? Buffer.from(await images.arrayBuffer()) : null);
    const invalid = parsed.records.filter((record) => record.errors.length);
    if (invalid.length) throw new ApiError(400, `有 ${invalid.length} 行未通过检查，请修正后重新导入`);

    const existing = await db.product.findMany({ where: { pnNormalized: { in: parsed.records.map((record) => normalizePn(record.pn)) } } });
    const existingMap = new Map(existing.map((product) => [product.pnNormalized, product]));
    const prepared: Array<{
      record: ImportRecord;
      current: (typeof existing)[number] | undefined;
      productId: string;
      image: Awaited<ReturnType<typeof prepareProductImage>> | null;
    }> = [];
    for (const record of parsed.records) {
      if (record.duplicate) continue;
      const current = existingMap.get(normalizePn(record.pn));
      if (current && mode === "skip") continue;
      const productId = current?.id ?? crypto.randomUUID();
      let image = null;
      if (record.imageEntryName && record.imageBytes) {
        image = await prepareProductImage(productId, record.imageBytes, imageMime(record.imageEntryName));
        writtenKeys.push(image.storagePath, image.thumbnailPath);
      }
      prepared.push({ record, current, productId, image });
    }

    await db.$transaction(async (tx) => {
      for (const item of prepared) {
        const data = { pn: item.record.pn, pnNormalized: normalizePn(item.record.pn), name: nullable(item.record.name), description: item.record.description, unit: item.record.unit, category: nullable(item.record.category), attributes: item.record.attributes as Prisma.InputJsonValue };
        if (item.current) await tx.product.update({ where: { id: item.current.id }, data: { ...data, archivedAt: null } });
        else await tx.product.create({ data: { id: item.productId, ...data } });
        if (item.image) {
          await tx.productAsset.updateMany({ where: { productId: item.productId, isPrimary: true }, data: { isPrimary: false } });
          await tx.productAsset.create({ data: { productId: item.productId, ...item.image, isPrimary: true } });
        }
      }
      await tx.auditLog.create({ data: { actorId: user.id, action: "PRODUCTS_IMPORTED", entityType: "Product", entityId: "bulk", details: { mode, imported: prepared.length, skipped: parsed.records.length - prepared.length } } });
    });
    return NextResponse.json({ imported: prepared.length, skipped: parsed.records.length - prepared.length });
  } catch (error) {
    await Promise.all(writtenKeys.map((key) => storage.remove(key)));
    return apiError(error);
  }
}
