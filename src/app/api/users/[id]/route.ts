import { UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";

const schema = z.object({
  email: z.string().trim().min(1, "邮箱不能为空").email("邮箱格式不正确"),
  displayName: z.string().trim().min(1, "姓名不能为空").max(100, "姓名不能超过 100 个字符"),
  piPrefix: z.string().trim().regex(/^[A-Za-z0-9]+$/, "PI 前缀只能使用英文字母和数字").max(30, "PI 前缀不能超过 30 个字符"),
  role: z.nativeEnum(UserRole),
  active: z.boolean(),
  password: z.union([z.string().min(10, "新密码至少 10 位"), z.literal("")]).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await apiUser(UserRole.ADMIN);
    const { id } = await context.params;
    const data = schema.parse(await request.json());
    if (id === actor.id && !data.active) throw new ApiError(400, "不能停用当前登录账号");
    const user = await db.user.update({
      where: { id },
      data: { email: data.email.toLowerCase(), displayName: data.displayName, piPrefix: data.piPrefix, role: data.role, active: data.active, ...(data.password ? { passwordHash: await hash(data.password, 12) } : {}) },
      select: { id: true, email: true, displayName: true, piPrefix: true, role: true, active: true },
    });
    await db.auditLog.create({ data: { actorId: actor.id, action: "USER_UPDATED", entityType: "User", entityId: id } });
    return NextResponse.json({ user });
  } catch (error) {
    return apiError(error);
  }
}
