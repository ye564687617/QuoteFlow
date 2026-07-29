import { z } from "zod";

export const productSchema = z.object({
  pn: z.string().trim().min(1, "P/N 不能为空").max(120),
  name: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().min(1, "Description 不能为空").max(5000),
  unit: z.string().trim().min(1, "Unit 不能为空").max(40),
  regularPriceUsd: z.coerce.number().min(0, "常规单价不能为负数").max(999999999),
  attributes: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const customerSchema = z.object({
  internalLabel: z.string().trim().min(1, "客户内部名称不能为空").max(200),
  recipientName: z.string().trim().max(200).optional().nullable(),
  companyName: z.string().trim().max(200).optional().nullable(),
  telephone: z.string().trim().max(100).optional().nullable(),
  email: z.union([z.string().trim().email("邮箱格式不正确"), z.literal("")]).optional().nullable(),
  taxId: z.string().trim().max(120).optional().nullable(),
  shipTo: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const quoteItemSchema = z.object({
  productId: z.string().optional().nullable(),
  pnSnapshot: z.string().trim().min(1).max(120),
  variantLabelSnapshot: z.string().trim().max(120).optional().nullable(),
  nameSnapshot: z.string().trim().max(200).optional().nullable(),
  descriptionSnapshot: z.string().trim().min(1).max(5000),
  unitSnapshot: z.string().trim().min(1).max(40),
  imagePathSnapshot: z.string().optional().nullable(),
  quantity: z.coerce.number().positive("数量必须大于 0").max(999999999),
  unitPrice: z.coerce.number().min(0, "单价不能为负数").max(999999999),
});

export const quoteDraftSchema = z.object({
  recipientName: z.string().trim().max(200).optional().nullable(),
  customerCompanyName: z.string().trim().max(200).optional().nullable(),
  telephone: z.string().trim().max(100).optional().nullable(),
  email: z.union([z.string().trim().email(), z.literal("")]).optional().nullable(),
  taxId: z.string().trim().max(120).optional().nullable(),
  shipTo: z.string().trim().max(1000).optional().nullable(),
  deliveryTerms: z.string().trim().max(1000).optional().nullable(),
  paymentTerms: z.string().trim().max(1000).optional().nullable(),
  productionTime: z.string().trim().max(1000).optional().nullable(),
  shippingFee: z.coerce.number().min(0).max(999999999),
  items: z.array(quoteItemSchema).max(80),
}).superRefine((quote, context) => {
  const seen = new Set<string>();
  quote.items.forEach((item, index) => {
    const key = item.productId ? `id:${item.productId}` : `pn:${normalizePn(item.pnSnapshot)}`;
    if (seen.has(key)) {
      context.addIssue({
        code: "custom",
        message: "同一产品不能重复添加",
        path: ["items", index, "productId"],
      });
    }
    seen.add(key);
  });
});

export function nullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizePn(pn: string) {
  return pn.trim().replace(/\s+/g, " ").toUpperCase();
}
