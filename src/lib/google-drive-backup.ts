import crypto from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { ApiError } from "@/lib/api";
import { env } from "@/lib/env";
import { db } from "@/lib/db";

const execFileAsync = promisify(execFile);
const CONNECTION_ID = "google-drive";
const BACKUP_FILE_NAME = "QuoteFlow-latest-backup.tar.gz";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const BACKUP_STORAGE_DIRECTORIES = ["products", "quotes", "imports", "company"] as const;

function googleConfig() {
  const values = env();
  if (!values.GOOGLE_CLIENT_ID || !values.GOOGLE_CLIENT_SECRET || !values.BACKUP_ENCRYPTION_KEY || values.BACKUP_ENCRYPTION_KEY.length < 16) {
    throw new ApiError(503, "尚未配置 Google Drive 备份参数");
  }
  const redirectUri = values.GOOGLE_OAUTH_REDIRECT_URI || `${values.APP_URL}/api/backups/google/callback`;
  return { clientId: values.GOOGLE_CLIENT_ID, clientSecret: values.GOOGLE_CLIENT_SECRET, encryptionKey: values.BACKUP_ENCRYPTION_KEY, redirectUri };
}

function encryptionKey(value: string) {
  return crypto.createHash("sha256").update(value).digest();
}

export function encryptRefreshToken(token: string, secret: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptRefreshToken(value: string, secret: string) {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("备份令牌格式无效");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(secret), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}

export function backupConfiguration() {
  const values = env();
  return { configured: Boolean(values.GOOGLE_CLIENT_ID && values.GOOGLE_CLIENT_SECRET && values.BACKUP_ENCRYPTION_KEY && values.BACKUP_ENCRYPTION_KEY.length >= 16) };
}

export async function backupStatus() {
  const connection = await db.cloudBackupConnection.findUnique({ where: { id: CONNECTION_ID } });
  return {
    configured: backupConfiguration().configured,
    connected: Boolean(connection),
    accountEmail: connection?.accountEmail ?? null,
    driveFileName: connection?.driveFileName ?? BACKUP_FILE_NAME,
    driveFileId: connection?.driveFileId ?? null,
    driveWebViewLink: connection?.driveWebViewLink ?? null,
    status: connection?.status ?? "NOT_CONNECTED",
    lastBackupAt: connection?.lastBackupAt?.toISOString() ?? null,
    lastBackupSize: connection?.lastBackupSize?.toString() ?? null,
    lastChecksum: connection?.lastChecksum ?? null,
    lastError: connection?.lastError ?? null,
  };
}

export function googleAuthorizationUrl(state: string) {
  const config = googleConfig();
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "true", scope: `openid email ${DRIVE_SCOPE}`, state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function responseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!response.ok) throw new Error(typeof data === "object" && data && "error_description" in data ? String(data.error_description) : `Google Drive 请求失败（${response.status}）`);
  return data as T;
}

export async function exchangeAuthorizationCode(code: string) {
  const config = googleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code" }) });
  const token = await responseJson<{ access_token: string; refresh_token?: string }>(response);
  if (!token.refresh_token) throw new Error("Google 没有返回刷新令牌，请重新授权并允许离线访问");
  const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
  const user = await responseJson<{ email: string }>(userResponse);
  return { email: user.email, refreshTokenEncrypted: encryptRefreshToken(token.refresh_token, config.encryptionKey) };
}

export async function saveGoogleDriveConnection(accountEmail: string, refreshTokenEncrypted: string) {
  return db.cloudBackupConnection.upsert({
    where: { id: CONNECTION_ID },
    update: { accountEmail, refreshTokenEncrypted, status: "IDLE", lastError: null },
    create: { id: CONNECTION_ID, accountEmail, refreshTokenEncrypted },
  });
}

async function accessToken(refreshTokenEncrypted: string) {
  const config = googleConfig();
  const refreshToken = decryptRefreshToken(refreshTokenEncrypted, config.encryptionKey);
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ refresh_token: refreshToken, client_id: config.clientId, client_secret: config.clientSecret, grant_type: "refresh_token" }) });
  return (await responseJson<{ access_token: string }>(response)).access_token;
}

function databaseUrlForDump() {
  const url = new URL(env().DATABASE_URL);
  url.searchParams.delete("schema");
  return url.toString();
}

async function dumpDatabase(target: string) {
  try {
    await execFileAsync("pg_dump", [databaseUrlForDump(), "--format=custom", `--file=${target}`], { maxBuffer: 2 * 1024 * 1024 });
    return;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT" || process.env.NODE_ENV === "production") throw error;
  }

  const databaseUrl = new URL(env().DATABASE_URL);
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
  const databaseUser = decodeURIComponent(databaseUrl.username);
  const child = spawn("docker", ["compose", "exec", "-T", "postgres", "pg_dump", "-U", databaseUser, "--format=custom", databaseName], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => { stderr = `${stderr}${chunk}`.slice(-4000); });
  const completed = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `Docker pg_dump 失败（${code}）`)));
  });
  await Promise.all([pipeline(child.stdout, createWriteStream(target)), completed]);
}

export async function createBackupArchive() {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "quoteflow-backup-"));
  const databaseDump = path.join(tempDirectory, "database.dump");
  const manifest = path.join(tempDirectory, "manifest.json");
  const archive = path.join(os.tmpdir(), `${BACKUP_FILE_NAME}.${crypto.randomUUID()}`);
  const storageRoot = path.resolve(env().STORAGE_ROOT);
  try {
    await fs.mkdir(storageRoot, { recursive: true });
    await Promise.all(BACKUP_STORAGE_DIRECTORIES.map((name) => fs.mkdir(path.join(storageRoot, name), { recursive: true })));
    await dumpDatabase(databaseDump);
    await fs.writeFile(manifest, JSON.stringify({ format: "QuoteFlow backup v1", createdAt: new Date().toISOString(), database: "PostgreSQL custom dump", files: BACKUP_STORAGE_DIRECTORIES }, null, 2));
    await execFileAsync("tar", ["-czf", archive, "-C", tempDirectory, "database.dump", "manifest.json", "-C", storageRoot, ...BACKUP_STORAGE_DIRECTORIES], { maxBuffer: 2 * 1024 * 1024 });
    const file = await fs.stat(archive);
    const hash = crypto.createHash("md5");
    await new Promise<void>((resolve, reject) => { const stream = createReadStream(archive); stream.on("data", (chunk) => hash.update(chunk)); stream.on("error", reject); stream.on("end", () => resolve()); });
    return { archive, size: file.size, checksum: hash.digest("hex") };
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

type DriveFile = { id: string; name?: string; size?: string; md5Checksum?: string; webViewLink?: string };

async function uploadArchive(token: string, archive: string, size: number, fileId: string | null): Promise<DriveFile> {
  const metadata = JSON.stringify({ name: BACKUP_FILE_NAME, mimeType: "application/gzip" });
  let targetId = fileId;
  let initiation: Response;
  if (targetId) {
    initiation = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(targetId)}?uploadType=resumable&fields=id,name,size,md5Checksum,webViewLink`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "application/gzip", "X-Upload-Content-Length": String(size) }, body: metadata });
    if (initiation.status === 404) targetId = null;
  }
  if (!targetId) initiation = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,md5Checksum,webViewLink", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "application/gzip", "X-Upload-Content-Length": String(size) }, body: metadata });
  if (!initiation!.ok) throw new Error(`Google Drive 无法创建上传任务（${initiation!.status}）`);
  const location = initiation!.headers.get("location");
  if (!location) throw new Error("Google Drive 未返回上传地址");
  const stream = createReadStream(archive);
  const uploadResponse = await fetch(location, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/gzip", "Content-Length": String(size) }, body: stream as unknown as BodyInit, duplex: "half" } as RequestInit & { duplex: "half" });
  return responseJson<DriveFile>(uploadResponse);
}

export async function runGoogleDriveBackup() {
  googleConfig();
  const connection = await db.cloudBackupConnection.findUnique({ where: { id: CONNECTION_ID } });
  if (!connection) throw new ApiError(409, "请先绑定 Google Drive");
  if (connection.status === "RUNNING" && Date.now() - connection.updatedAt.getTime() < 30 * 60 * 1000) throw new ApiError(409, "备份正在进行中，请稍候");
  await db.cloudBackupConnection.update({ where: { id: CONNECTION_ID }, data: { status: "RUNNING", lastError: null } });
  let archive: string | null = null;
  try {
    const created = await createBackupArchive();
    archive = created.archive;
    const token = await accessToken(connection.refreshTokenEncrypted);
    const file = await uploadArchive(token, archive, created.size, connection.driveFileId);
    if (file.md5Checksum && file.md5Checksum !== created.checksum) throw new Error("Google Drive 校验值不一致，备份未确认完整");
    const saved = await db.cloudBackupConnection.update({ where: { id: CONNECTION_ID }, data: { status: "SUCCEEDED", driveFileId: file.id, driveFileName: file.name || BACKUP_FILE_NAME, driveWebViewLink: file.webViewLink ?? null, lastBackupAt: new Date(), lastBackupSize: BigInt(created.size), lastChecksum: created.checksum, lastError: null } });
    return { status: saved.status, lastBackupAt: saved.lastBackupAt?.toISOString() ?? null, lastBackupSize: String(created.size), lastChecksum: created.checksum, driveFileId: file.id, driveWebViewLink: file.webViewLink ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "在线备份失败";
    await db.cloudBackupConnection.update({ where: { id: CONNECTION_ID }, data: { status: "FAILED", lastError: message } });
    throw new ApiError(500, message);
  } finally {
    if (archive) await fs.rm(archive, { force: true });
  }
}

export async function disconnectGoogleDrive() {
  await db.cloudBackupConnection.deleteMany({ where: { id: CONNECTION_ID } });
}
