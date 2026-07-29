import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { customerSchema, nullable } from "@/lib/validation";

async function ownedCustomer(id: string, user: Awaited<ReturnType<typeof apiUser>>) {
  const customer = await db.customer.findUnique({ where: { id } });
  if (!customer || (user.role !== UserRole.ADMIN && customer.ownerId !== user.id)) throw new ApiError(404, "客户不存在");
  return customer;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser();
    const { id } = await context.params;
    await ownedCustomer(id, user);
    const data = customerSchema.parse(await request.json());
    const customer = await db.customer.update({
      where: { id },
      data: { internalLabel: data.internalLabel, recipientName: nullable(data.recipientName), companyName: nullable(data.companyName), telephone: nullable(data.telephone), email: nullable(data.email), taxId: nullable(data.taxId), shipTo: nullable(data.shipTo), notes: nullable(data.notes) },
    });
    await db.auditLog.create({ data: { actorId: user.id, action: "CUSTOMER_UPDATED", entityType: "Customer", entityId: id } });
    return NextResponse.json({ customer });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser();
    const { id } = await context.params;
    await ownedCustomer(id, user);
    const customer = await db.customer.update({ where: { id }, data: { archivedAt: new Date() } });
    await db.auditLog.create({ data: { actorId: user.id, action: "CUSTOMER_ARCHIVED", entityType: "Customer", entityId: id } });
    return NextResponse.json({ customer });
  } catch (error) {
    return apiError(error);
  }
}
