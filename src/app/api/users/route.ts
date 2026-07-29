import { UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";

const userSchema = z.object({
  email: z.string().trim().min(1, "邮箱不能为空").email("邮箱格式不正确"),
  password: z.string().min(10, "密码至少 10 位"),
  displayName: z.string().trim().min(1, "姓名不能为空").max(100, "姓名不能超过 100 个字符"),
  piPrefix: z.string().trim().regex(/^[A-Za-z0-9]+$/, "PI 前缀只能使用英文字母和数字").max(30),
  role: z.nativeEnum(UserRole),
});

export async function GET() {
  try {
    await apiUser(UserRole.ADMIN);
    const users = await db.user.findMany({ select: { id: true, email: true, displayName: true, piPrefix: true, role: true, active: true, createdAt: true }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ users });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await apiUser(UserRole.ADMIN);
    const data = userSchema.parse(await request.json());
    const user = await db.user.create({ data: { email: data.email.toLowerCase(), passwordHash: await hash(data.password, 12), displayName: data.displayName, piPrefix: data.piPrefix, role: data.role } });
    await db.auditLog.create({ data: { actorId: actor.id, action: "USER_CREATED", entityType: "User", entityId: user.id } });
    return NextResponse.json({ user: { id: user.id, email: user.email, displayName: user.displayName, piPrefix: user.piPrefix, role: user.role, active: user.active } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
