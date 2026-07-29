import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { authenticate, createSession } from "@/lib/auth";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const data = schema.parse(await request.json());
    const user = await authenticate(data.email, data.password);
    if (!user) return NextResponse.json({ error: "邮箱或密码不正确" }, { status: 401 });
    await createSession(user);
    return NextResponse.json({ user: { id: user.id, displayName: user.displayName, role: user.role } });
  } catch (error) {
    return apiError(error);
  }
}
