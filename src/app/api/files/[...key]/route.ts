import { NextResponse } from "next/server";
import { apiError, apiUser } from "@/lib/api";
import { mimeFromPath, storage } from "@/lib/storage";

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  try {
    await apiUser();
    const { key } = await context.params;
    const storageKey = key.join("/");
    const data = await storage.read(storageKey);
    return new NextResponse(data, { headers: { "Content-Type": mimeFromPath(storageKey), "Cache-Control": "private, max-age=3600" } });
  } catch (error) {
    return apiError(error);
  }
}
