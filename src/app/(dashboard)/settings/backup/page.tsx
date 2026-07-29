import { BackupManager } from "@/components/BackupManager";
import { requireAdmin } from "@/lib/auth";
import { backupStatus } from "@/lib/google-drive-backup";

export default async function BackupPage({ searchParams }: { searchParams: Promise<{ connected?: string; backupError?: string }> }) {
  await requireAdmin();
  const [status, query] = await Promise.all([backupStatus(), searchParams]);
  return <BackupManager initialStatus={status} initialMessage={query.connected ? "Google Drive 已绑定，可以开始备份。" : ""} initialError={query.backupError ?? ""} />;
}
