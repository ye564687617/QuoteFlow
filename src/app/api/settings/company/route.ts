import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { nullable } from "@/lib/validation";

const companySchema = z.object({
  legalName: z.string().trim().min(1).max(300),
  plantAddress: z.string().max(1000).optional().nullable(),
  telephone: z.string().max(100).optional().nullable(),
  fax: z.string().max(100).optional().nullable(),
  mobile: z.string().max(100).optional().nullable(),
  website: z.string().max(200).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  skype: z.string().max(200).optional().nullable(),
  bankName: z.string().max(500).optional().nullable(),
  beneficiaryName: z.string().max(500).optional().nullable(),
  beneficiaryAccount: z.string().max(200).optional().nullable(),
  swiftCode: z.string().max(100).optional().nullable(),
  bankAddress: z.string().max(1000).optional().nullable(),
  companyAddress: z.string().max(1000).optional().nullable(),
  defaultDeliveryTerms: z.string().max(1000).optional().nullable(),
  defaultPaymentTerms: z.string().max(1000).optional().nullable(),
  defaultProductionTime: z.string().max(1000).optional().nullable(),
});

export async function GET() {
  try {
    await apiUser(UserRole.ADMIN);
    return NextResponse.json({ company: await db.companyProfile.findUnique({ where: { id: "default" } }) });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await apiUser(UserRole.ADMIN);
    const data = companySchema.parse(await request.json());
    const normalized = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, key === "legalName" ? value : nullable(value)]));
    const company = await db.companyProfile.upsert({ where: { id: "default" }, update: normalized, create: { id: "default", ...normalized, legalName: data.legalName } });
    await db.auditLog.create({ data: { actorId: user.id, action: "COMPANY_UPDATED", entityType: "CompanyProfile", entityId: "default" } });
    return NextResponse.json({ company });
  } catch (error) {
    return apiError(error);
  }
}
