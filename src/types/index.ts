export type ProductAsset = { id: string; storagePath: string; thumbnailPath: string; isPrimary: boolean };
export type Product = { id: string; pn: string; name: string | null; description: string; unit: string; category: string | null; archivedAt: string | null; assets: ProductAsset[] };
export type Customer = { id: string; internalLabel: string; recipientName: string | null; companyName: string | null; telephone: string | null; email: string | null; taxId: string | null; shipTo: string | null; notes: string | null; owner?: { displayName: string } };
export type QuoteItem = { id?: string; productId: string | null; pnSnapshot: string; nameSnapshot: string | null; descriptionSnapshot: string; unitSnapshot: string; imagePathSnapshot: string | null; quantity: string; unitPrice: string; amount?: string };
export type QuoteRevision = {
  id: string; displayPiNumber: string; revisionNumber: number; revisionDate: string; status: "DRAFT" | "FINALIZED";
  recipientName: string | null; customerCompanyName: string | null; telephone: string | null; email: string | null; taxId: string | null; shipTo: string | null;
  deliveryTerms: string | null; paymentTerms: string | null; productionTime: string | null; shippingNote: string | null; shippingFee: string; subtotal: string; total: string; exportedPath: string | null;
  items: QuoteItem[]; exportJob: { id: string; status: "PENDING" | "PROCESSING" | "READY" | "FAILED"; error: string | null } | null;
  series: { id: string; basePiNumber: string; salespersonId: string; salesperson: { displayName: string }; customer: { internalLabel: string } | null };
};
