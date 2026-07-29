import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { createQuote, serializeRevision } from "@/lib/quotes";

export async function GET(request: Request) {
  try {
    const user = await apiUser();
    const search = new URL(request.url).searchParams.get("search")?.trim() ?? "";
    const revisions = await db.quoteRevision.findMany({
      where: {
        ...(user.role === UserRole.ADMIN ? {} : { series: { salespersonId: user.id } }),
        ...(search ? { OR: [{ displayPiNumber: { contains: search, mode: "insensitive" } }, { recipientName: { contains: search, mode: "insensitive" } }, { customerCompanyName: { contains: search, mode: "insensitive" } }] } : {}),
      },
      include: { series: { include: { salesperson: { select: { displayName: true } }, customer: { select: { internalLabel: true } } } }, exportJob: true, _count: { select: { items: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ revisions: serializeRevision(revisions) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await apiUser();
    const { customerId } = z.object({ customerId: z.string().optional().nullable() }).parse(await request.json());
    const series = await createQuote(user, customerId);
    return NextResponse.json({ revisionId: series.revisions[0].id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
