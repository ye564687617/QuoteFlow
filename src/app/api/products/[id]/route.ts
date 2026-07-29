import { Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizePn, nullable, productSchema } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser(UserRole.ADMIN);
    const { id } = await context.params;
    const data = productSchema.parse(await request.json());
    const product = await db.product.update({
      where: { id },
      data: { pn: data.pn, pnNormalized: normalizePn(data.pn), name: nullable(data.name), description: data.description, unit: data.unit, category: nullable(data.category), attributes: data.attributes === null ? Prisma.JsonNull : data.attributes as Prisma.InputJsonValue | undefined },
      include: { assets: { where: { isPrimary: true }, take: 1 } },
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
