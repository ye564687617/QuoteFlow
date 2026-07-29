import { Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizePn, nullable, productSchema } from "@/lib/validation";
import { normalizeDescription, refreshVariantLabels } from "@/lib/product-variants";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser(UserRole.ADMIN);
    const { id } = await context.params;
    const data = productSchema.parse(await request.json());
    const pnNormalized = normalizePn(data.pn);
    const descriptionNormalized = normalizeDescription(data.description);
    const product = await db.$transaction(async (tx) => {
      const duplicate = await tx.product.findFirst({ where: { pnNormalized, descriptionNormalized, id: { not: id } } });
      if (duplicate) throw new ApiError(409, "相同 P/N 和 Description 的产品已存在");
      const before = await tx.product.findUniqueOrThrow({ where: { id }, select: { pnNormalized: true } });
      await tx.product.update({
        where: { id },
        data: { pn: data.pn, pnNormalized, name: nullable(data.name), description: data.description, descriptionNormalized, unit: data.unit, regularPriceUsd: data.regularPriceUsd, attributes: data.attributes === null ? Prisma.JsonNull : data.attributes as Prisma.InputJsonValue | undefined },
      });
      await refreshVariantLabels(tx, before.pnNormalized);
      if (before.pnNormalized !== pnNormalized) await refreshVariantLabels(tx, pnNormalized);
      return tx.product.findUniqueOrThrow({ where: { id }, include: { assets: { where: { isPrimary: true }, take: 1 } } });
    });
    await db.auditLog.create({ data: { actorId: user.id, action: "PRODUCT_UPDATED", entityType: "Product", entityId: id } });
    return NextResponse.json({ product });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser(UserRole.ADMIN);
    const { id } = await context.params;
    const product = await db.product.update({ where: { id }, data: { archivedAt: new Date() } });
    await db.auditLog.create({ data: { actorId: user.id, action: "PRODUCT_ARCHIVED", entityType: "Product", entityId: id } });
    return NextResponse.json({ product });
  } catch (error) {
    return apiError(error);
  }
}
