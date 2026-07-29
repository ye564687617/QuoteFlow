import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { exchangeAuthorizationCode, saveGoogleDriveConnection } from "@/lib/google-drive-backup";

const STATE_COOKIE = "quoteflow_google_oauth_state";

function settingsUrl(request: Request, parameters: Record<string, string>) {
  const url = new URL("/settings/backup", request.url);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const store = await cookies();
  try {
    const actor = await apiUser(UserRole.ADMIN);
    if (query.get("error")) throw new Error("Google 授权已取消");
    const state = query.get("state");
    const expectedState = store.get(STATE_COOKIE)?.value;
    if (!state || !expectedState || state !== expectedState) throw new Error("Google 授权状态已失效，请重新绑定");
    const code = query.get("code");
    if (!code) throw new Error("Google 没有返回授权码");
    const connection = await exchangeAuthorizationCode(code);
    await saveGoogleDriveConnection(connection.email, connection.refreshTokenEncrypted);
    await db.auditLog.create({ data: { actorId: actor.id, action: "GOOGLE_DRIVE_CONNECTED", entityType: "CloudBackupConnection", entityId: "google-drive" } });
    const response = NextResponse.redirect(settingsUrl(request, { connected: "1" }));
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (error) {
    const response = NextResponse.redirect(settingsUrl(request, { backupError: error instanceof Error ? error.message : "Google Drive 绑定失败" }));
    response.cookies.delete(STATE_COOKIE);
    return response;
  }
}
