import { Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizePn, nullable, productSchema } from "@/lib/validation";

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
      orderBy: [{ category: "asc" }, { pnNormalized: "asc" }],
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
    const product = await db.product.create({
      data: {
        pn: data.pn,
        pnNormalized: normalizePn(data.pn),
        name: nullable(data.name),
        description: data.description,
        unit: data.unit,
        category: nullable(data.category),
        attributes: data.attributes === null ? Prisma.JsonNull : data.attributes as Prisma.InputJsonValue | undefined,
      },
    });
    await db.auditLog.create({ data: { actorId: user.id, action: "PRODUCT_CREATED", entityType: "Product", entityId: product.id } });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
