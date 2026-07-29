import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { prepareProductImage } from "@/lib/storage";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser(UserRole.ADMIN);
    const { id } = await context.params;
    if (!(await db.product.findUnique({ where: { id }, select: { id: true } }))) throw new ApiError(404, "产品不存在");
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) throw new ApiError(400, "请选择产品图片");
    const image = await prepareProductImage(id, Buffer.from(await file.arrayBuffer()), file.type);
    const asset = await db.$transaction(async (tx) => {
      await tx.productAsset.updateMany({ where: { productId: id, isPrimary: true }, data: { isPrimary: false } });
      const created = await tx.productAsset.create({ data: { productId: id, ...image, isPrimary: true } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "PRODUCT_IMAGE_UPDATED", entityType: "Product", entityId: id } });
      return created;
    });
    return NextResponse.json({ asset });
  } catch (error) {
    return apiError(error);
  }
}
