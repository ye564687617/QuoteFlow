"use client";

import { Button } from "@fluentui/react-components";
import { ArrowSync24Regular, CloudArrowUp24Regular, DismissCircle24Regular, Open24Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { fetchJson } from "@/lib/client-api";
import styles from "./BackupManager.module.css";

type BackupStatus = {
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
  driveFileName: string;
  driveFileId: string | null;
  driveWebViewLink: string | null;
  status: string;
  lastBackupAt: string | null;
  lastBackupSize: string | null;
  lastChecksum: string | null;
  lastError: string | null;
};

function fileSize(value: string | null) {
  if (!value) return "—";
  const bytes = Number(value);
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function backupTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Shanghai" }).format(new Date(value)) : "尚未备份";
}

export function BackupManager({ initialStatus, initialMessage = "", initialError = "" }: { initialStatus: BackupStatus; initialMessage?: string; initialError?: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState(initialError);

  async function refresh() {
    const latest = await fetchJson<BackupStatus>("/api/backups/google");
    setStatus(latest);
  }

  async function backup() {
    if (!window.confirm(status.driveFileId ? "将使用最新数据覆盖 Google Drive 中的旧备份。继续吗？" : "现在将数据库和全部文件备份到 Google Drive。继续吗？")) return;
    setBusy(true);
    setMessage("");
    setError("");
    setStatus((current) => ({ ...current, status: "RUNNING", lastError: null }));
    try {
      await fetchJson("/api/backups/google", { method: "POST" });
      await refresh();
      setMessage("云端备份已完成，并已通过文件校验。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "备份失败");
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("确定解除绑定吗？Google Drive 中已经上传的备份文件会保留。")) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await fetchJson("/api/backups/google", { method: "DELETE" });
      await refresh();
      setMessage("Google Drive 已解除绑定，云盘中的备份文件没有删除。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "解除绑定失败");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <header className="page-header"><div><h1>在线备份</h1><p>数据库、产品图片和报价图片统一备份到 Google Drive</p></div></header>
    {error ? <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div> : null}
    {message ? <div className="success-banner" style={{ marginBottom: 12 }}>{message}</div> : null}
    <section className={`panel ${styles.panel}`}>
      <div className={styles.connection}>
        <span className={styles.driveIcon}><CloudArrowUp24Regular /></span>
        <div><h2>Google Drive</h2><p>{status.connected ? `已绑定 ${status.accountEmail}` : status.configured ? "尚未绑定 Google 账户" : "服务器尚未配置 Google OAuth 凭据"}</p></div>
        <span className={`status ${status.connected ? "status-final" : "status-draft"}`}>{status.connected ? "已连接" : "未连接"}</span>
      </div>

      {!status.configured ? <div className={styles.configuration}><strong>需要完成服务器配置</strong><p>请在环境变量中填写 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GOOGLE_OAUTH_REDIRECT_URI 和 BACKUP_ENCRYPTION_KEY，然后重启应用。</p></div> : null}

      <dl className={styles.details}>
        <div><dt>云端文件</dt><dd>{status.driveFileId ? status.driveFileName : "首次备份时创建"}</dd></div>
        <div><dt>最近备份</dt><dd>{backupTime(status.lastBackupAt)}</dd></div>
        <div><dt>备份大小</dt><dd>{fileSize(status.lastBackupSize)}</dd></div>
        <div><dt>完整性校验</dt><dd>{status.lastChecksum ? <span className={styles.verified}>已验证 · {status.lastChecksum.slice(0, 12)}…</span> : "—"}</dd></div>
      </dl>

      {status.lastError ? <div className="error-banner">上次备份失败：{status.lastError}</div> : null}

      <div className={styles.actions}>
        {status.connected ? <>
          <Button appearance="primary" icon={busy ? <ArrowSync24Regular /> : <CloudArrowUp24Regular />} disabled={busy} onClick={backup}>{busy ? "正在打包并上传" : status.driveFileId ? "更新云端备份" : "立即备份"}</Button>
          {status.driveWebViewLink ? <Button as="a" href={status.driveWebViewLink} target="_blank" rel="noreferrer" icon={<Open24Regular />}>在 Google Drive 查看</Button> : null}
          <Button appearance="subtle" icon={<ArrowSync24Regular />} disabled={busy} as="a" href="/api/backups/google/connect">重新绑定</Button>
          <Button appearance="subtle" icon={<DismissCircle24Regular />} disabled={busy} onClick={disconnect} style={{ color: "var(--danger)" }}>解除绑定</Button>
        </> : <Button as="a" href="/api/backups/google/connect" appearance="primary" icon={<CloudArrowUp24Regular />} disabled={!status.configured}>绑定 Google Drive</Button>}
      </div>
    </section>
  </>;
}
