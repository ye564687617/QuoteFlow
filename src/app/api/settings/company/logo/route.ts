import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { prepareCompanyLogo } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const user = await apiUser(UserRole.ADMIN);
    const form = await request.formData();
    const file = form.get("logo");
    if (!(file instanceof File)) throw new ApiError(400, "请选择公司 Logo");
    const logoPath = await prepareCompanyLogo(Buffer.from(await file.arrayBuffer()), file.type);
    await db.$transaction([
      db.companyProfile.update({ where: { id: "default" }, data: { logoPath } }),
      db.auditLog.create({ data: { actorId: user.id, action: "COMPANY_LOGO_UPDATED", entityType: "CompanyProfile", entityId: "default" } }),
    ]);
    return NextResponse.json({ logoPath });
  } catch (error) {
    return apiError(error);
  }
}
