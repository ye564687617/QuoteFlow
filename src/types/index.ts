export type ProductAsset = { id: string; storagePath: string; thumbnailPath: string; isPrimary: boolean };
export type Product = { id: string; pn: string; name: string | null; description: string; variantLabel: string; unit: string; regularPriceUsd: string; archivedAt: string | null; assets: ProductAsset[] };
export type Customer = { id: string; internalLabel: string; recipientName: string | null; companyName: string | null; telephone: string | null; email: string | null; taxId: string | null; shipTo: string | null; notes: string | null; owner?: { displayName: string } };
export type QuoteItem = { id?: string; productId: string | null; pnSnapshot: string; variantLabelSnapshot?: string | null; nameSnapshot: string | null; descriptionSnapshot: string; unitSnapshot: string; imagePathSnapshot: string | null; quantity: string; unitPrice: string; amount?: string };
export type QuoteRevision = {
  id: string; displayPiNumber: string; revisionNumber: number; revisionDate: string; status: "DRAFT" | "FINALIZED";
  recipientName: string | null; customerCompanyName: string | null; telephone: string | null; email: string | null; taxId: string | null; shipTo: string | null;
  deliveryTerms: string | null; paymentTerms: string | null; productionTime: string | null; shippingFee: string; subtotal: string; total: string;
  items: QuoteItem[]; exportJob: { id: string; status: "PENDING" | "PROCESSING" | "READY" | "FAILED"; error: string | null; pngNoBankPath?: string | null; pngWithBankPath?: string | null; pdfNoBankPath?: string | null; pdfWithBankPath?: string | null } | null;
  series: { id: string; basePiNumber: string; salespersonId: string; salesperson: { displayName: string }; customer: { internalLabel: string } | null };
};
