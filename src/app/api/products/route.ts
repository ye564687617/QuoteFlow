import { Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizePn, nullable, productSchema } from "@/lib/validation";
import { normalizeDescription, refreshVariantLabels } from "@/lib/product-variants";

export async function GET(request: Request) {
  try {
    await apiUser();
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const archived = url.searchParams.get("archived") === "true";
    const products = await db.product.findMany({
      where: {
        archivedAt: archived ? { not: null } : null,
        ...(search ? { OR: [{ pn: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] } : {}),
      },
      include: { assets: { where: { isPrimary: true }, take: 1 } },
      orderBy: [{ pnNormalized: "asc" }, { descriptionNormalized: "asc" }],
      take: 200,
    });
    return NextResponse.json({ products });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await apiUser(UserRole.ADMIN);
    const data = productSchema.parse(await request.json());
    const pnNormalized = normalizePn(data.pn);
    const descriptionNormalized = normalizeDescription(data.description);
    const product = await db.$transaction(async (tx) => {
      const duplicate = await tx.product.findFirst({ where: { pnNormalized, descriptionNormalized } });
      if (duplicate) throw new ApiError(409, "相同 P/N 和 Description 的产品已存在");
      const created = await tx.product.create({
        data: {
          pn: data.pn, pnNormalized, name: nullable(data.name), description: data.description, descriptionNormalized,
          variantLabel: "Variant", unit: data.unit, regularPriceUsd: data.regularPriceUsd,
          attributes: data.attributes === null ? Prisma.JsonNull : data.attributes as Prisma.InputJsonValue | undefined,
        },
      });
      await refreshVariantLabels(tx, pnNormalized);
      return tx.product.findUniqueOrThrow({ where: { id: created.id }, include: { assets: { where: { isPrimary: true }, take: 1 } } });
    });
    await db.auditLog.create({ data: { actorId: user.id, action: "PRODUCT_CREATED", entityType: "Product", entityId: product.id } });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
