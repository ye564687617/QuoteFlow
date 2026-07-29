import { Prisma, QuoteStatus, UserRole } from "@prisma/client";
import Decimal from "decimal.js";
import { ApiError } from "@/lib/api";
import { SessionUser } from "@/lib/auth";
import { shanghaiDateParts } from "@/lib/dates";
import { db } from "@/lib/db";
import { lineAmount, quoteTotals } from "@/lib/money";
import { nullable, quoteDraftSchema } from "@/lib/validation";
import { storage } from "@/lib/storage";

export type CompanySnapshot = {
  legalName: string;
  plantAddress: string | null;
  telephone: string | null;
  fax: string | null;
  mobile: string | null;
  website: string | null;
  email: string | null;
  skype: string | null;
  logoPath: string | null;
  bankName: string | null;
  beneficiaryName: string | null;
  beneficiaryAccount: string | null;
  swiftCode: string | null;
  bankAddress: string | null;
  companyAddress: string | null;
};

function companySnapshot(company: Awaited<ReturnType<typeof getCompany>>) {
  return {
    legalName: company.legalName,
    plantAddress: company.plantAddress,
    telephone: company.telephone,
    fax: company.fax,
    mobile: company.mobile,
    website: company.website,
    email: company.email,
    skype: company.skype,
    logoPath: company.logoPath,
    bankName: company.bankName,
    beneficiaryName: company.beneficiaryName,
    beneficiaryAccount: company.beneficiaryAccount,
    swiftCode: company.swiftCode,
    bankAddress: company.bankAddress,
    companyAddress: company.companyAddress,
  };
}

async function getCompany() {
  const company = await db.companyProfile.findUnique({ where: { id: "default" } });
  if (!company) throw new ApiError(500, "请先配置公司资料");
  return company;
}

export function canAccessQuote(user: SessionUser, salespersonId: string) {
  return user.role === UserRole.ADMIN || user.id === salespersonId;
}

export async function createQuote(user: SessionUser, customerId?: string | null) {
  const { compact, databaseDate } = shanghaiDateParts();
  const sequenceLockKey = `${user.id}:${compact}`;
  const company = await getCompany();
  const customer = customerId ? await db.customer.findUnique({ where: { id: customerId } }) : null;
  if (customer && user.role !== UserRole.ADMIN && customer.ownerId !== user.id) throw new ApiError(403, "不能使用其他业务员的客户");

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sequenceLockKey}))`;
        const latest = await tx.quoteSeries.findFirst({
          where: { salespersonId: user.id, quoteDate: databaseDate },
          orderBy: { dailySequence: "desc" },
          select: { dailySequence: true },
        });
        const dailySequence = (latest?.dailySequence ?? 0) + 1;
        const basePiNumber = `${user.piPrefix}${compact}${String(dailySequence).padStart(2, "0")}`;
        return tx.quoteSeries.create({
          data: {
            basePiNumber,
            quoteDate: databaseDate,
            dailySequence,
            salespersonId: user.id,
            customerId: customer?.id,
            revisions: {
              create: {
                revisionNumber: 1,
                displayPiNumber: basePiNumber,
                revisionDate: databaseDate,
                recipientName: customer?.recipientName,
                customerCompanyName: customer?.companyName,
                telephone: customer?.telephone,
                email: customer?.email,
                taxId: customer?.taxId,
                shipTo: customer?.shipTo,
                companySnapshot: companySnapshot(company),
                salespersonSnapshot: { id: user.id, displayName: user.displayName, email: user.email, piPrefix: user.piPrefix },
                deliveryTerms: company.defaultDeliveryTerms,
                paymentTerms: company.defaultPaymentTerms,
                productionTime: company.defaultProductionTime,
              },
            },
          },
          include: { revisions: true },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt === 19 || !(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2002", "P2034"].includes(error.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 15 * (attempt + 1)));
    }
  }
  throw new ApiError(409, "PI 编号分配失败，请重试");
}

export async function getQuoteRevision(id: string, user?: SessionUser) {
  const revision = await db.quoteRevision.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      exportJob: true,
      series: { include: { salesperson: { select: { displayName: true } }, customer: { select: { internalLabel: true } } } },
    },
  });
  if (!revision || (user && !canAccessQuote(user, revision.series.salespersonId))) throw new ApiError(404, "报价不存在");
  return revision;
}

export async function saveQuoteRevision(id: string, user: SessionUser, input: unknown) {
  const data = quoteDraftSchema.parse(input);
  const current = await getQuoteRevision(id, user);
  if (current.status !== QuoteStatus.DRAFT) throw new ApiError(409, "已正式导出的报价不能修改，请创建新一轮");
  const totals = quoteTotals(data.items, data.shippingFee);

  return db.$transaction(async (tx) => {
    await tx.quoteItem.deleteMany({ where: { revisionId: id } });
    const revision = await tx.quoteRevision.update({
      where: { id },
      data: {
        recipientName: nullable(data.recipientName),
        customerCompanyName: nullable(data.customerCompanyName),
        telephone: nullable(data.telephone),
        email: nullable(data.email),
        taxId: nullable(data.taxId),
        shipTo: nullable(data.shipTo),
        deliveryTerms: nullable(data.deliveryTerms),
        paymentTerms: nullable(data.paymentTerms),
        productionTime: nullable(data.productionTime),
        shippingFee: new Prisma.Decimal(data.shippingFee),
        subtotal: new Prisma.Decimal(totals.subtotal.toFixed(2)),
        total: new Prisma.Decimal(totals.total.toFixed(2)),
        items: {
          create: data.items.map((item, index) => ({
            position: index + 1,
            productId: item.productId,
            pnSnapshot: item.pnSnapshot,
            variantLabelSnapshot: nullable(item.variantLabelSnapshot),
            nameSnapshot: nullable(item.nameSnapshot),
            descriptionSnapshot: item.descriptionSnapshot,
            unitSnapshot: item.unitSnapshot,
            imagePathSnapshot: nullable(item.imagePathSnapshot),
            quantity: new Prisma.Decimal(item.quantity),
            unitPrice: new Prisma.Decimal(item.unitPrice),
            amount: new Prisma.Decimal(lineAmount(item.quantity, item.unitPrice).toFixed(2)),
          })),
        },
      },
      include: { items: { orderBy: { position: "asc" } }, series: true, exportJob: true },
    });
    await tx.auditLog.create({ data: { actorId: user.id, action: "QUOTE_SAVED", entityType: "QuoteRevision", entityId: id } });
    return revision;
  });
}

export async function deleteDraftRevision(id: string, user: SessionUser) {
  const current = await getQuoteRevision(id, user);
  const result = await db.$transaction(async (tx) => {
    const revisionCount = await tx.quoteRevision.count({ where: { seriesId: current.seriesId } });
    const deleted = await tx.quoteRevision.deleteMany({ where: { id } });
    if (!deleted.count) throw new ApiError(409, "报价状态已改变，请刷新后重试");
    if (revisionCount === 1) await tx.quoteSeries.delete({ where: { id: current.seriesId } });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
      action: current.status === QuoteStatus.FINALIZED ? "QUOTE_FINALIZED_DELETED" : "QUOTE_DRAFT_DELETED",
        entityType: "QuoteRevision",
        entityId: id,
        details: { displayPiNumber: current.displayPiNumber, deletedSeries: revisionCount === 1 },
      },
    });
    return { deletedSeries: revisionCount === 1, paths: [current.exportJob?.pngNoBankPath, current.exportJob?.pngWithBankPath, current.exportJob?.pdfNoBankPath, current.exportJob?.pdfWithBankPath].filter((path): path is string => Boolean(path)) };
  });
  await Promise.allSettled(result.paths.map((path) => storage.remove(path)));
  return { deletedSeries: result.deletedSeries };
}

export async function finalizeQuote(id: string, user: SessionUser) {
  const current = await getQuoteRevision(id, user);
  if (current.status === QuoteStatus.FINALIZED) return current;
  if (!current.items.length) throw new ApiError(400, "请至少添加一个产品");
  const totals = quoteTotals(current.items.map((item) => ({ quantity: item.quantity.toString(), unitPrice: item.unitPrice.toString() })), current.shippingFee.toString());

  await db.$transaction(async (tx) => {
    await tx.quoteRevision.update({
      where: { id },
      data: { status: QuoteStatus.FINALIZED, subtotal: totals.subtotal.toFixed(2), total: totals.total.toFixed(2) },
    });
    await tx.exportJob.upsert({
      where: { revisionId: id },
      update: { status: "PENDING", error: null, pngNoBankPath: null, pngWithBankPath: null, pdfNoBankPath: null, pdfWithBankPath: null, startedAt: null, finishedAt: null },
      create: { revisionId: id },
    });
    await tx.auditLog.create({ data: { actorId: user.id, action: "QUOTE_FINALIZED", entityType: "QuoteRevision", entityId: id } });
  });
  return getQuoteRevision(id, user);
}

export async function retryQuoteExport(id: string, user: SessionUser) {
  const current = await getQuoteRevision(id, user);
  if (current.status !== QuoteStatus.FINALIZED) throw new ApiError(409, "草稿尚未正式导出");
  if (!current.exportJob || current.exportJob.status !== "FAILED") throw new ApiError(409, "只有失败的导出任务可以重试");
  await db.$transaction([
    db.exportJob.update({
      where: { id: current.exportJob.id },
      data: { status: "PENDING", error: null, pngNoBankPath: null, pngWithBankPath: null, pdfNoBankPath: null, pdfWithBankPath: null, startedAt: null, finishedAt: null },
    }),
    db.auditLog.create({ data: { actorId: user.id, action: "QUOTE_EXPORT_RETRIED", entityType: "QuoteRevision", entityId: id } }),
  ]);
  return getQuoteRevision(id, user);
}

export async function createRevision(id: string, user: SessionUser) {
  const current = await getQuoteRevision(id, user);
  if (current.status !== QuoteStatus.FINALIZED) throw new ApiError(409, "草稿无需创建新一轮");
  const { databaseDate } = shanghaiDateParts();
  return db.$transaction(async (tx) => {
    // A per-series advisory lock prevents two clicks from allocating the same R number.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${current.seriesId}))`;
    const series = await tx.quoteSeries.update({
      where: { id: current.seriesId },
      data: { nextRevisionNumber: { increment: 1 } },
      select: { basePiNumber: true, nextRevisionNumber: true },
    });
    const nextNumber = series.nextRevisionNumber - 1;
    const displayPiNumber = `${series.basePiNumber}-R${String(nextNumber).padStart(2, "0")}`;
    const revision = await tx.quoteRevision.create({
      data: {
        seriesId: current.seriesId,
        revisionNumber: nextNumber,
        displayPiNumber,
        revisionDate: databaseDate,
        recipientName: current.recipientName,
        customerCompanyName: current.customerCompanyName,
        telephone: current.telephone,
        email: current.email,
        taxId: current.taxId,
        shipTo: current.shipTo,
        companySnapshot: current.companySnapshot as Prisma.InputJsonValue,
        salespersonSnapshot: current.salespersonSnapshot as Prisma.InputJsonValue,
        deliveryTerms: current.deliveryTerms,
        paymentTerms: current.paymentTerms,
        productionTime: current.productionTime,
        shippingFee: current.shippingFee,
        subtotal: current.subtotal,
        total: current.total,
        items: {
          create: current.items.map((item) => ({
            position: item.position,
            productId: item.productId,
            pnSnapshot: item.pnSnapshot,
            variantLabelSnapshot: item.variantLabelSnapshot,
            nameSnapshot: item.nameSnapshot,
            descriptionSnapshot: item.descriptionSnapshot,
            unitSnapshot: item.unitSnapshot,
            imagePathSnapshot: item.imagePathSnapshot,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
          })),
        },
      },
    });
    await tx.auditLog.create({ data: { actorId: user.id, action: "QUOTE_REVISION_CREATED", entityType: "QuoteRevision", entityId: revision.id, details: { sourceRevisionId: id } } });
    return revision;
  });
}

export function serializeRevision<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) => item instanceof Prisma.Decimal || item instanceof Decimal ? item.toString() : item));
}
