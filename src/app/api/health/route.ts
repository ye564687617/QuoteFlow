import { constants } from "node:fs";
import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    const storageRoot = (process.env.STORAGE_ROOT ?? "./data").replace(/\/+$/, "");
    for (const directory of ["products", "quotes", "imports", "company"]) {
      const target = `${storageRoot}/${directory}`;
      await fs.mkdir(target, { recursive: true });
      await fs.access(target, constants.R_OK | constants.W_OK);
    }
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
