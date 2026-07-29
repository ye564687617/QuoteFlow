import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { customerSchema, nullable } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const user = await apiUser();
    const search = new URL(request.url).searchParams.get("search")?.trim() ?? "";
    const customers = await db.customer.findMany({
      where: {
        archivedAt: null,
        ...(user.role === UserRole.ADMIN ? {} : { ownerId: user.id }),
        ...(search ? { OR: [{ internalLabel: { contains: search, mode: "insensitive" } }, { recipientName: { contains: search, mode: "insensitive" } }, { companyName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : {}),
      },
      include: { owner: { select: { displayName: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ customers });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await apiUser();
    const data = customerSchema.parse(await request.json());
    const customer = await db.customer.create({
      data: {
        ownerId: user.id,
        internalLabel: data.internalLabel,
        recipientName: nullable(data.recipientName),
        companyName: nullable(data.companyName),
        telephone: nullable(data.telephone),
        email: nullable(data.email),
        taxId: nullable(data.taxId),
        shipTo: nullable(data.shipTo),
        notes: nullable(data.notes),
      },
    });
    await db.auditLog.create({ data: { actorId: user.id, action: "CUSTOMER_CREATED", entityType: "Customer", entityId: customer.id } });
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
