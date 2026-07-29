import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export interface FileStorage {
  put(key: string, data: Uint8Array): Promise<void>;
  read(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  remove(key: string): Promise<void>;
  absolutePath(key: string): string;
}

function safeKey(key: string) {
  const normalized = path.posix.normalize(key.replaceAll("\\", "/")).replace(/^\/+/, "");
  if (normalized.startsWith("..") || normalized.includes("/../")) throw new Error("Invalid storage key");
  return normalized;
}

export class LocalFileStorage implements FileStorage {
  constructor(private root = path.resolve(process.env.STORAGE_ROOT ?? "./data")) {}

  absolutePath(key: string) {
    const target = path.resolve(this.root, safeKey(key));
    if (!target.startsWith(`${this.root}${path.sep}`)) throw new Error("Invalid storage path");
    return target;
  }

  async put(key: string, data: Uint8Array) {
    const target = this.absolutePath(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temp, data);
    await fs.rename(temp, target);
  }

  read(key: string) {
    return fs.readFile(this.absolutePath(key));
  }

  async exists(key: string) {
    try {
      await fs.access(this.absolutePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async remove(key: string) {
    await fs.rm(this.absolutePath(key), { force: true });
  }
}

export const storage = new LocalFileStorage();

const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function prepareProductImage(productId: string, bytes: Buffer, mimeType: string) {
  const extension = imageExtensions[mimeType];
  if (!extension) throw new Error("只支持 JPG、PNG 或 WebP 图片");
  if (bytes.length > 12 * 1024 * 1024) throw new Error("产品图片不能超过 12MB");

  const id = crypto.randomUUID();
  const original = await sharp(bytes).rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).toBuffer();
  const metadata = await sharp(original).metadata();
  const thumbnail = await sharp(original).resize({ width: 320, height: 240, fit: "contain", background: "#ffffff" }).webp({ quality: 82 }).toBuffer();
  const storagePath = `products/${productId}/${id}.${extension}`;
  const thumbnailPath = `products/${productId}/${id}.thumb.webp`;
  await storage.put(storagePath, original);
  await storage.put(thumbnailPath, thumbnail);
  return {
    storagePath,
    thumbnailPath,
    mimeType,
    byteSize: original.length,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}

export async function prepareCompanyLogo(bytes: Buffer, mimeType: string) {
  if (!imageExtensions[mimeType]) throw new Error("只支持 JPG、PNG 或 WebP 图片");
  if (bytes.length > 8 * 1024 * 1024) throw new Error("公司 Logo 不能超过 8MB");
  const id = crypto.randomUUID();
  const output = await sharp(bytes).rotate().resize({ width: 1000, height: 360, fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
  const storagePath = `company/${id}.webp`;
  await storage.put(storagePath, output);
  return storagePath;
}

export function mimeFromPath(key: string) {
  const extension = path.extname(key).toLowerCase();
  return extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
}
