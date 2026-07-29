import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, SessionUser } from "@/lib/auth";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiUser(role?: UserRole): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "请先登录");
  if (role && user.role !== role) throw new ApiError(403, "没有执行此操作的权限");
  return user;
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return NextResponse.json({ error: firstIssue?.message || "提交的数据不完整", details: error.flatten() }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: "服务器处理失败，请稍后重试" }, { status: 500 });
}
