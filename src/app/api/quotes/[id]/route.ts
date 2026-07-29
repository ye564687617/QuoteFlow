import { NextResponse } from "next/server";
import { apiError, apiUser } from "@/lib/api";
import { deleteDraftRevision, getQuoteRevision, saveQuoteRevision, serializeRevision } from "@/lib/quotes";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser();
    const { id } = await context.params;
    return NextResponse.json({ revision: serializeRevision(await getQuoteRevision(id, user)) });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser();
    const { id } = await context.params;
    return NextResponse.json({ revision: serializeRevision(await saveQuoteRevision(id, user, await request.json())) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser();
    const { id } = await context.params;
    return NextResponse.json({ ok: true, ...(await deleteDraftRevision(id, user)) });
  } catch (error) {
    return apiError(error);
  }
}
