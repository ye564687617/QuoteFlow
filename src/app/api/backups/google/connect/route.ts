import crypto from "node:crypto";
import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError, apiUser } from "@/lib/api";
import { googleAuthorizationUrl } from "@/lib/google-drive-backup";

const STATE_COOKIE = "quoteflow_google_oauth_state";

export async function GET() {
  try {
    await apiUser(UserRole.ADMIN);
    const state = crypto.randomBytes(24).toString("base64url");
    const response = NextResponse.redirect(googleAuthorizationUrl(state));
    response.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 10 * 60 });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
