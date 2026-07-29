import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(process.env.STORAGE_ROOT ?? "./data");
const db = new PrismaClient();

async function emptyDirectory(target: string) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(target);
  await Promise.all(entries.map((entry) => fs.rm(path.join(target, entry), { recursive: true, force: true })));
}

async function main() {
  if (process.env.CONFIRM_CLEAR_BUSINESS !== "DELETE_BUSINESS_DATA") {
    throw new Error("为防止误删，请使用 CONFIRM_CLEAR_BUSINESS=DELETE_BUSINESS_DATA pnpm storage:clear-business");
  }
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.quoteSeries.deleteMany(),
    db.customer.deleteMany(),
    db.product.deleteMany(),
  ]);
  for (const name of ["products", "quotes", "imports"]) {
    const target = path.join(root, name);
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Invalid storage target");
    await emptyDirectory(target);
    console.log(`Cleared ${target}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
