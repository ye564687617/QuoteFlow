import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { backupStatus, disconnectGoogleDrive, runGoogleDriveBackup } from "@/lib/google-drive-backup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await apiUser(UserRole.ADMIN);
    return NextResponse.json(await backupStatus());
  } catch (error) {
    return apiError(error);
  }
}

export async function POST() {
  try {
    const actor = await apiUser(UserRole.ADMIN);
    const result = await runGoogleDriveBackup();
    await db.auditLog.create({ data: { actorId: actor.id, action: "GOOGLE_DRIVE_BACKUP_COMPLETED", entityType: "CloudBackupConnection", entityId: "google-drive", details: { checksum: result.lastChecksum, size: result.lastBackupSize } } });
    return NextResponse.json({ backup: result });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE() {
  try {
    const actor = await apiUser(UserRole.ADMIN);
    await disconnectGoogleDrive();
    await db.auditLog.create({ data: { actorId: actor.id, action: "GOOGLE_DRIVE_DISCONNECTED", entityType: "CloudBackupConnection", entityId: "google-drive" } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
