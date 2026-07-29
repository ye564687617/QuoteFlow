/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { getQuoteRevision, CompanySnapshot } from "@/lib/quotes";
import { storage, mimeFromPath } from "@/lib/storage";
import styles from "./quote.module.css";

async function imageDataUrl(key: string | null) {
  if (!key) return null;
  try {
    const bytes = await storage.read(key);
    return `data:${mimeFromPath(key)};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

function money(value: unknown) {
  return `$${Number(value).toFixed(2)}`;
}

function quantity(value: unknown) {
  return Number(value).toFixed(3).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export default async function QuoteRenderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (query.token !== env().EXPORT_RENDER_TOKEN) notFound();
  const revision = await getQuoteRevision(id);
  const company = revision.companySnapshot as unknown as CompanySnapshot;
  const salesperson = revision.salespersonSnapshot as unknown as { displayName: string };
  const itemImages = await Promise.all(revision.items.map((item) => imageDataUrl(item.imagePathSnapshot)));
  const logo = await imageDataUrl(company.logoPath);
  const date = revision.revisionDate.toISOString().slice(0, 10).replaceAll("-", "");

  return (
    <main className={styles.canvas}>
      <article className={`${styles.document} quote-document`} data-quote-ready="true">
        <header className={styles.companyHeader}>
          <div className={styles.brandRow}>
            <div className={styles.logoCell}>{logo ? <img src={logo} className={styles.logo} alt="Company logo" /> : null}</div>
            <div className={styles.companyName}>{company.legalName}</div>
          </div>
          <div className={styles.contactGrid}>
            <strong>Plant Add:</strong><span className={styles.plantAddress}>{company.plantAddress}</span>
            <strong>Tel:</strong><span>{company.telephone}</span><strong>Fax:</strong><span>{company.fax}</span>
            <strong>mobile&nbsp; :</strong><span>{company.mobile}</span><strong>Skype:</strong><span>{company.skype}</span>
            <strong>Website:</strong><span>{company.website}</span><strong>Email:</strong><span>{company.email}</span>
          </div>
        </header>

        <section className={styles.titleBlock}>
          <h1>PROFORMA&nbsp;&nbsp; INVOICE</h1>
          <div><strong>Date:</strong> {date}</div>
        </section>

        <section className={styles.metaGrid}>
          <div><strong>From:</strong> {salesperson.displayName}</div>
          <div><strong>PI Number:</strong> {revision.displayPiNumber}</div>
          <div><strong>Delivery Date:</strong> {revision.deliveryTerms}</div>
          <div><strong>Payment:</strong> {revision.paymentTerms}</div>
        </section>

        <section className={styles.customerGrid}>
          <div className={styles.customerRows}>
            <div><strong>To:</strong><span>{revision.recipientName}</span></div>
            <div><strong>Tel:</strong><span>{revision.telephone}</span></div>
            <div><strong>email:</strong><span>{revision.email}</span></div>
          </div>
          <strong className={styles.shipLabel}>Ship to</strong>
          <span className={styles.shipValue}>{revision.shipTo}</span>
        </section>

        <table className={styles.items}>
          <colgroup>
            <col className={styles.itemColumn} /><col className={styles.photoColumn} /><col className={styles.pnColumn} />
            <col className={styles.descriptionColumn} /><col className={styles.unitColumn} /><col className={styles.qtyColumn} />
            <col className={styles.priceColumn} /><col className={styles.amountColumn} />
          </colgroup>
          <thead><tr><th>Item</th><th>Photo</th><th>P/N</th><th>Description</th><th>Unit</th><th>QTY</th><th>Unit Price<br />(USD )</th><th>Amount<br />(USD )</th></tr></thead>
          <tbody>
            {revision.items.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{itemImages[index] ? <img src={itemImages[index]!} alt={item.pnSnapshot} /> : null}</td>
                <td>{item.pnSnapshot}</td>
                <td className={styles.description}>{item.descriptionSnapshot}</td>
                <td>{item.unitSnapshot}</td>
                <td>{quantity(item.quantity)}</td>
                <td>{money(item.unitPrice)}</td>
                <td>{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className={styles.summary}>
          <colgroup>
            <col className={styles.itemColumn} /><col className={styles.photoColumn} /><col className={styles.pnColumn} />
            <col className={styles.descriptionColumn} /><col className={styles.unitColumn} /><col className={styles.qtyColumn} />
            <col className={styles.priceColumn} /><col className={styles.amountColumn} />
          </colgroup>
          <tbody>
            <tr><td></td><td>REMARK</td><td>Shipping fee</td><td colSpan={4}>{revision.shippingNote}</td><td>{money(revision.shippingFee)}</td></tr>
            <tr><td colSpan={2}></td><td colSpan={4}>Production time: {revision.productionTime}</td><td>Total</td><td className={styles.total}>{money(revision.total)}</td></tr>
          </tbody>
        </table>

        <footer className={styles.signature}>
          <div className={styles.signatureCompany}>{company.legalName}</div>
          <div>{salesperson.displayName}</div>
        </footer>
      </article>
    </main>
  );
}
