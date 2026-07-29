import { UserRole } from "@prisma/client";
import { compare } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const COOKIE_NAME = "quoteflow_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  piPrefix: string;
  role: UserRole;
};

function secret() {
  return new TextEncoder().encode(env().SESSION_SECRET);
}

export async function authenticate(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user?.active || !(await compare(password, user.passwordHash))) return null;
  return user;
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secret());
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = await db.user.findUnique({ where: { id: String(payload.id) } });
    if (!user?.active) return null;
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      piPrefix: user.piPrefix,
      role: user.role,
    };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) redirect("/quotes");
  return user;
}
