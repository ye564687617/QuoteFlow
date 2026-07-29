import { NextResponse } from "next/server";
import { apiError, apiUser } from "@/lib/api";
import { createRevision, serializeRevision } from "@/lib/quotes";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser();
    const { id } = await context.params;
    return NextResponse.json({ revision: serializeRevision(await createRevision(id, user)) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
