"use client";
/* eslint-disable @next/next/no-img-element */

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Textarea,
  Tooltip,
} from "@fluentui/react-components";
import {
  Add24Regular,
  ArrowDownload24Regular,
  ArrowLeft24Regular,
  ArrowSync24Regular,
  CheckmarkCircle24Regular,
  Delete24Regular,
  Dismiss24Regular,
  Save24Regular,
  Search24Regular,
} from "@fluentui/react-icons";
import Decimal from "decimal.js";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { Product, QuoteItem, QuoteRevision } from "@/types";
import styles from "./QuoteEditor.module.css";

function decimal(value: string | number) {
  try {
    return new Decimal(value || 0);
  } catch {
    return new Decimal(0);
  }
}

function editorFrom(revision: QuoteRevision) {
  return {
    recipientName: revision.recipientName ?? "",
    customerCompanyName: revision.customerCompanyName ?? "",
    telephone: revision.telephone ?? "",
    email: revision.email ?? "",
    taxId: revision.taxId ?? "",
    shipTo: revision.shipTo ?? "",
    deliveryTerms: revision.deliveryTerms ?? "",
    paymentTerms: revision.paymentTerms ?? "",
    productionTime: revision.productionTime ?? "",
    shippingFee: revision.shippingFee,
    items: revision.items.map((item) => ({ ...item, quantity: String(item.quantity), unitPrice: String(item.unitPrice) })),
  };
}

function itemLabel(item: Pick<QuoteItem, "pnSnapshot" | "variantLabelSnapshot">) {
  return `${item.pnSnapshot}${item.variantLabelSnapshot ? `（${item.variantLabelSnapshot}）` : ""}`;
}

function productLabel(product: Product) {
  return `${product.pn}${product.variantLabel ? `（${product.variantLabel}）` : ""}`;
}

export function QuoteEditor({ initialRevision, products, completionMessage }: { initialRevision: QuoteRevision; products: Product[]; completionMessage?: string | null }) {
  const router = useRouter();
  const [revision, setRevision] = useState(initialRevision);
  const [form, setForm] = useState(() => editorFrom(initialRevision));
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [celebration, setCelebration] = useState<{ text: string; tone: number; key: number } | null>(null);
  const celebrationTimer = useRef<number | null>(null);
  const lastCelebrationTone = useRef(-1);
  const editable = revision.status === "DRAFT";
  const selectedProductIds = useMemo(
    () => new Set(form.items.map((item) => item.productId).filter((id): id is string => Boolean(id))),
    [form.items],
  );

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return query
      ? products.filter((product) => [product.pn, product.variantLabel, product.name, product.description].some((value) => value?.toLowerCase().includes(query)))
      : products;
  }, [products, search]);

  const subtotal = useMemo(
    () => form.items.reduce((sum, item) => sum.plus(decimal(item.quantity).mul(decimal(item.unitPrice))), new Decimal(0)),
    [form.items],
  );
  const total = subtotal.plus(decimal(form.shippingFee));

  const showCelebration = useCallback((text: string) => {
    let tone = Math.floor(Math.random() * 6);
    if (tone === lastCelebrationTone.current) tone = (tone + 1) % 6;
    lastCelebrationTone.current = tone;
    if (celebrationTimer.current) window.clearTimeout(celebrationTimer.current);
    setCelebration({ text, tone, key: Date.now() });
    celebrationTimer.current = window.setTimeout(() => setCelebration(null), 2800);
  }, []);

  useEffect(() => () => {
    if (celebrationTimer.current) window.clearTimeout(celebrationTimer.current);
  }, []);

  useEffect(() => {
    const job = revision.exportJob;
    if (!job || !["PENDING", "PROCESSING"].includes(job.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const result = await fetchJson<{ job: { status: string; error: string | null } }>(`/api/exports/${job.id}`);
        if (result.job.status === "READY" || result.job.status === "FAILED") {
          window.clearInterval(timer);
          setRevision((previous) => ({
            ...previous,
            exportJob: { ...previous.exportJob!, status: result.job.status as "READY" | "FAILED", error: result.job.error },
          }));
          if (result.job.status === "READY") {
            if (completionMessage) {
              setMessage("");
              showCelebration(completionMessage);
            } else {
              setMessage("报价文件已经生成，可以下载。");
            }
          }
        }
      } catch {
        // A transient polling failure should not interrupt editing.
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [completionMessage, revision.exportJob, showCelebration]);

  function addProduct(product: Product) {
    if (selectedProductIds.has(product.id)) return;
    const asset = product.assets[0];
    setForm((previous) => ({
      ...previous,
      items: [
        ...previous.items,
        {
          productId: product.id,
          pnSnapshot: product.pn,
          variantLabelSnapshot: product.variantLabel,
          nameSnapshot: product.name,
          descriptionSnapshot: product.description,
          unitSnapshot: product.unit,
          imagePathSnapshot: asset?.storagePath ?? null,
          quantity: "1",
          unitPrice: String(product.regularPriceUsd ?? "0"),
        },
      ],
    }));
    setPicker(false);
    setSearch("");
  }

  function updateItem(index: number, patch: Partial<QuoteItem>) {
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }

  function removeItem(index: number) {
    setForm((previous) => ({ ...previous, items: previous.items.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= form.items.length || from === to) return;
    setForm((previous) => {
      const items = [...previous.items];
      const [item] = items.splice(from, 1);
      items.splice(to, 0, item);
      return { ...previous, items };
    });
  }

  async function save(silent = false) {
    setBusy("save");
    setError("");
    setMessage("");
    try {
      const result = await fetchJson<{ revision: QuoteRevision }>(`/api/quotes/${revision.id}`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setRevision(result.revision);
      setForm(editorFrom(result.revision));
      if (!silent) setMessage("草稿已保存。");
      return result.revision;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败");
      throw caught;
    } finally {
      setBusy("");
    }
  }

  async function finalize() {
    if (!confirm("正式导出后本轮报价将锁定。继续吗？")) return;
    try {
      await save(true);
      setBusy("finalize");
      const result = await fetchJson<{ revision: QuoteRevision }>(`/api/quotes/${revision.id}/finalize`, { method: "POST" });
      setRevision(result.revision);
      setMessage("报价已锁定，正在生成长图。");
    } catch {
      // save() has already surfaced the error.
    } finally {
      setBusy("");
    }
  }

  async function revise() {
    setBusy("revise");
    setError("");
    try {
      const result = await fetchJson<{ revision: QuoteRevision }>(`/api/quotes/${revision.id}/revisions`, { method: "POST" });
      router.push(`/quotes/${result.revision.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建新一轮失败");
      setBusy("");
    }
  }

  async function retryExport() {
    setBusy("retry-export");
    setError("");
    try {
      const result = await fetchJson<{ revision: QuoteRevision }>(`/api/quotes/${revision.id}/retry-export`, { method: "POST" });
      setRevision(result.revision);
      setMessage("导出任务已重新排队。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "重新导出失败");
    } finally {
      setBusy("");
    }
  }

  async function deleteQuote() {
    if (!window.confirm(`确定删除报价 ${revision.displayPiNumber} 吗？此操作无法撤销。`)) return;
    setBusy("delete");
    setError("");
    try {
      await fetchJson<{ ok: true }>(`/api/quotes/${revision.id}`, { method: "DELETE" });
      router.push("/quotes");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除草稿失败");
      setBusy("");
    }
  }

  return (
    <>
      {celebration ? <div key={celebration.key} className="mandy-celebration-toast" data-tone={celebration.tone} role="status" aria-live="polite"><span className="mandy-celebration-icon"><CheckmarkCircle24Regular /></span><span><strong>{celebration.text}</strong><small>报价文件已生成，可以下载啦</small></span></div> : null}
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button as="a" href="/quotes" appearance="subtle" icon={<ArrowLeft24Regular />} aria-label="返回报价列表" />
          <div>
            <h1>{revision.displayPiNumber}</h1>
            <p>{editable ? "草稿可以继续编辑" : "本轮已经锁定，如需修改请创建新一轮"}</p>
          </div>
        </div>
        <div className="page-actions">
          {revision.status === "FINALIZED" ? (
            <>
              <span className="status status-final">已锁定</span>
              {revision.exportJob?.status === "READY" ? (
                <><Button as="a" href={`/api/quotes/${revision.id}/download?format=png&bank=0`} appearance="primary" icon={<ArrowDownload24Regular />}>无银行 PNG</Button><Button as="a" href={`/api/quotes/${revision.id}/download?format=pdf&bank=0`} icon={<ArrowDownload24Regular />}>无银行 PDF</Button><Button as="a" href={`/api/quotes/${revision.id}/download?format=png&bank=1`} icon={<ArrowDownload24Regular />}>有银行 PNG</Button><Button as="a" href={`/api/quotes/${revision.id}/download?format=pdf&bank=1`} icon={<ArrowDownload24Regular />}>有银行 PDF</Button></>
              ) : revision.exportJob?.status === "FAILED" ? (
                <Button icon={<ArrowSync24Regular />} onClick={retryExport} disabled={Boolean(busy)}>重试导出</Button>
              ) : (
                <Button disabled icon={<ArrowSync24Regular />}>正在生成</Button>
              )}
              <Button icon={<ArrowSync24Regular />} onClick={revise} disabled={busy === "revise"}>创建新一轮</Button>
              <Button icon={<Delete24Regular />} onClick={deleteQuote} disabled={Boolean(busy)} style={{ color: "var(--danger)" }}>{busy === "delete" ? "删除中" : "删除"}</Button>
            </>
          ) : (
            <>
              <Button icon={<Delete24Regular />} onClick={deleteQuote} disabled={Boolean(busy)} style={{ color: "var(--danger)" }}>{busy === "delete" ? "删除中" : "删除草稿"}</Button>
              <Button icon={<Save24Regular />} onClick={() => save()} disabled={Boolean(busy)}>{busy === "save" ? "保存中" : "保存草稿"}</Button>
              <Button appearance="primary" icon={<CheckmarkCircle24Regular />} onClick={finalize} disabled={Boolean(busy) || !form.items.length}>{busy === "finalize" ? "提交中" : "正式导出"}</Button>
            </>
          )}
        </div>
      </header>

      {error ? <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div> : null}
      {message ? <div className="success-banner" style={{ marginBottom: 12 }}>{message}</div> : null}
      {revision.exportJob?.status === "FAILED" ? <div className="error-banner" style={{ marginBottom: 12 }}>导出失败：{revision.exportJob.error}</div> : null}

      <div className={styles.grid}>
        <section className="panel">
          <div className={styles.sectionTitle}><h2>客户与条款</h2><span>除 PI 编号和日期外均可留空</span></div>
          <div className={`form-grid ${styles.form}`}>
            <Field label="To"><Input disabled={!editable} value={form.recipientName} onChange={(_, data) => setForm({ ...form, recipientName: data.value })} /></Field>
            <Field label="客户公司"><Input disabled={!editable} value={form.customerCompanyName} onChange={(_, data) => setForm({ ...form, customerCompanyName: data.value })} /></Field>
            <Field label="Tel"><Input disabled={!editable} value={form.telephone} onChange={(_, data) => setForm({ ...form, telephone: data.value })} /></Field>
            <Field label="Email"><Input disabled={!editable} type="email" value={form.email} onChange={(_, data) => setForm({ ...form, email: data.value })} /></Field>
            <Field label="Tax ID"><Input disabled={!editable} value={form.taxId} onChange={(_, data) => setForm({ ...form, taxId: data.value })} /></Field>
            <Field label="Ship to"><Textarea disabled={!editable} resize="vertical" rows={2} value={form.shipTo} onChange={(_, data) => setForm({ ...form, shipTo: data.value })} /></Field>
            <Field label="Delivery Date / 交期" className="form-span-2"><Input disabled={!editable} value={form.deliveryTerms} onChange={(_, data) => setForm({ ...form, deliveryTerms: data.value })} /></Field>
            <Field label="Payment" className="form-span-2"><Input disabled={!editable} value={form.paymentTerms} onChange={(_, data) => setForm({ ...form, paymentTerms: data.value })} /></Field>
          </div>
        </section>

        <aside className={`panel ${styles.summary}`}>
          <div className={styles.sectionTitle}><h2>金额汇总</h2></div>
          <dl>
            <dt>商品小计</dt><dd>${subtotal.toFixed(2)}</dd>
            <dt>Shipping fee</dt><dd>{editable ? <Input className={styles.shippingFeeInput} type="number" min="0" step="0.01" value={form.shippingFee} onChange={(_, data) => setForm({ ...form, shippingFee: data.value })} /> : `$${decimal(form.shippingFee).toFixed(2)}`}</dd>
            <dt className={styles.total}>Total</dt><dd className={styles.total}>${total.toFixed(2)}</dd>
          </dl>
          <div style={{ margin: "10px 0", color: "var(--muted)", fontSize: 13 }}>Shipping: UPS 6-9 working days shipping</div>
          <Field label="生产周期"><Input disabled={!editable} value={form.productionTime} onChange={(_, data) => setForm({ ...form, productionTime: data.value })} /></Field>
        </aside>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className={styles.sectionTitle}>
          <div><h2>报价产品</h2><span>{form.items.length} 项</span></div>
          {editable ? <Button appearance="primary" icon={<Add24Regular />} onClick={() => setPicker(true)}>添加产品</Button> : null}
        </div>
        <div className="table-scroll">
          {form.items.length ? (
            <table className={`${styles.items} data-table mobile-cards`}>
              <thead><tr><th style={{ width: 48 }}>序号</th><th style={{ width: 74 }}>图片</th><th style={{ width: 170 }}>P/N</th><th>Description</th><th style={{ width: 82 }}>Unit</th><th style={{ width: 110 }}>QTY</th><th style={{ width: 130 }}>Unit Price</th><th style={{ width: 120 }}>Amount</th>{editable ? <th style={{ width: 104 }}>操作</th> : null}</tr></thead>
              <tbody>
                {form.items.map((item, index) => (
                  <tr key={`${item.productId}-${index}`} draggable={editable} onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => move(Number(event.dataTransfer.getData("text/plain")), index)}>
                    <td data-label="序号" className="numeric">{index + 1}</td>
                    <td data-label="图片">{item.imagePathSnapshot ? <img src={`/api/files/${item.imagePathSnapshot}`} alt={itemLabel(item)} /> : <span className={styles.noPhoto}>无图</span>}</td>
                    <td data-label="P/N"><strong>{itemLabel(item)}</strong></td>
                    <td data-label="Description">{editable ? <Textarea rows={3} resize="vertical" value={item.descriptionSnapshot} onChange={(_, data) => updateItem(index, { descriptionSnapshot: data.value })} /> : <span style={{ whiteSpace: "pre-line" }}>{item.descriptionSnapshot}</span>}</td>
                    <td data-label="Unit">{item.unitSnapshot}</td>
                    <td data-label="QTY">{editable ? <Input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(_, data) => updateItem(index, { quantity: data.value })} /> : item.quantity}</td>
                    <td data-label="Unit Price">{editable ? <Input type="number" min="0" step="0.0001" value={item.unitPrice} onChange={(_, data) => updateItem(index, { unitPrice: data.value })} /> : `$${decimal(item.unitPrice).toFixed(4)}`}</td>
                    <td data-label="Amount" className={`${styles.amount} numeric`}><strong>${decimal(item.quantity).mul(decimal(item.unitPrice)).toFixed(2)}</strong></td>
                    {editable ? <td data-label="操作"><div className={styles.itemActions}><Tooltip content="上移" relationship="label"><Button appearance="subtle" icon={<ArrowSync24Regular style={{ transform: "rotate(-90deg)" }} />} aria-label="上移" disabled={index === 0} onClick={() => move(index, index - 1)} /></Tooltip><Tooltip content="删除" relationship="label"><Button appearance="subtle" icon={<Delete24Regular />} aria-label="删除" onClick={() => removeItem(index)} /></Tooltip></div></td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state"><div><strong>还没有报价产品</strong><p>从产品库选择产品，然后填写数量和本轮单价。</p>{editable ? <Button appearance="primary" onClick={() => setPicker(true)}>添加产品</Button> : null}</div></div>
          )}
        </div>
      </section>

      <Dialog open={picker} onOpenChange={(_, data) => setPicker(data.open)}>
        <DialogSurface className={styles.picker}>
          <DialogBody>
            <DialogTitle>选择产品</DialogTitle>
            <DialogContent>
              <Input value={search} onChange={(_, data) => setSearch(data.value)} contentBefore={<Search24Regular />} placeholder="搜索 P/N、名称或描述" style={{ width: "100%" }} />
              <div className={styles.productList}>
                {filtered.map((product) => {
                  const selected = selectedProductIds.has(product.id);
                  return (
                  <button type="button" key={product.id} disabled={selected} onClick={() => addProduct(product)}>
                    <span className={styles.productImage}>{product.assets[0] ? <img src={`/api/files/${product.assets[0].thumbnailPath}`} alt={product.pn} /> : <Dismiss24Regular />}</span>
                    <span><strong>{productLabel(product)}</strong><small>{selected ? "已添加到当前报价" : product.name || product.description}</small></span>
                    {selected ? <CheckmarkCircle24Regular /> : <Add24Regular />}
                  </button>
                )})}
              </div>
            </DialogContent>
            <DialogActions><Button onClick={() => setPicker(false)}>关闭</Button></DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
