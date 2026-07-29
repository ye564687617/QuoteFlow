"use client";
/* eslint-disable @next/next/no-img-element */

import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input, Textarea, Tooltip } from "@fluentui/react-components";
import { Add24Regular, Archive24Regular, Edit24Regular, Image24Regular, Search24Regular } from "@fluentui/react-icons";
import { FormEvent, useMemo, useState } from "react";
import { ProductImportDialog } from "@/components/ProductImportDialog";
import { fetchJson } from "@/lib/client-api";
import { Product } from "@/types";

const blank = { pn: "", name: "", description: "", unit: "pcs", regularPriceUsd: "0" };

function productLabel(product: Product) {
  return `${product.pn}${product.variantLabel ? `（${product.variantLabel}）` : ""}`;
}

export function ProductsManager({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [form, setForm] = useState(blank);
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? products.filter((product) => [product.pn, product.variantLabel, product.name, product.description].some((value) => value?.toLowerCase().includes(query))) : products;
  }, [products, search]);

  function open(product?: Product) {
    setEditing(product ?? null);
    setForm(product ? { pn: product.pn, name: product.name ?? "", description: product.description, unit: product.unit, regularPriceUsd: product.regularPriceUsd } : blank);
    setImage(null);
    setError("");
  }

  async function refresh() {
    const result = await fetchJson<{ products: Product[] }>("/api/products");
    setProducts(result.products);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const endpoint = editing ? `/api/products/${editing.id}` : "/api/products";
      const result = await fetchJson<{ product: Product }>(endpoint, { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) });
      if (image) {
        const imageForm = new FormData();
        imageForm.append("image", image);
        await fetchJson(`/api/products/${result.product.id}/image`, { method: "POST", body: imageForm });
      }
      await refresh();
      setEditing(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function archive(product: Product) {
    if (!confirm(`归档产品 ${productLabel(product)}？历史报价不会受影响。`)) return;
    try {
      await fetchJson(`/api/products/${product.id}`, { method: "DELETE" });
      setProducts((previous) => previous.filter((item) => item.id !== product.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "归档失败");
    }
  }

  return (
    <>
      <header className="page-header">
        <div><h1>产品资料</h1><p>{products.length} 个在用产品，常规单价会自动带入报价单</p></div>
        <div className="page-actions"><ProductImportDialog onImported={refresh} /><Button appearance="primary" icon={<Add24Regular />} onClick={() => open()}>新增产品</Button></div>
      </header>
      {error && editing === undefined ? <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div> : null}
      <section className="panel">
        <div className="panel-toolbar"><Input value={search} onChange={(_, data) => setSearch(data.value)} contentBefore={<Search24Regular />} placeholder="搜索 P/N、名称或描述" style={{ minWidth: 320 }} /><span style={{ color: "var(--muted)", fontSize: 12 }}>显示 {visible.length} 条</span></div>
        <div className="table-scroll">
          {visible.length ? (
            <table className="data-table mobile-cards">
              <thead><tr><th style={{ width: 52 }}>序号</th><th style={{ width: 76 }}>图片</th><th style={{ width: 230 }}>P/N</th><th style={{ width: 180 }}>名称</th><th>英文描述</th><th style={{ width: 90 }}>单位</th><th style={{ width: 120 }}>常规单价 USD</th><th style={{ width: 92 }}>操作</th></tr></thead>
              <tbody>{visible.map((product, index) => <tr key={product.id}>
                <td data-label="序号" className="numeric">{index + 1}</td>
                <td data-label="图片">{product.assets[0] ? <img src={`/api/files/${product.assets[0].thumbnailPath}`} alt={product.pn} style={{ width: 52, height: 42, objectFit: "contain", border: "1px solid var(--line)", borderRadius: 4, background: "white" }} /> : <span style={{ display: "grid", placeItems: "center", width: 52, height: 42, color: "#8a8f95", background: "#f1f3f5", borderRadius: 4 }}><Image24Regular /></span>}</td>
                <td data-label="P/N"><strong>{productLabel(product)}</strong></td><td data-label="名称">{product.name || "-"}</td><td data-label="英文描述" style={{ whiteSpace: "pre-line", lineHeight: 1.45 }}>{product.description}</td><td data-label="单位">{product.unit}</td><td data-label="常规单价 USD" className="numeric">${Number(product.regularPriceUsd).toFixed(4)}</td>
                <td data-label="操作"><span><Tooltip content="编辑" relationship="label"><Button appearance="subtle" icon={<Edit24Regular />} aria-label="编辑" onClick={() => open(product)} /></Tooltip><Tooltip content="归档" relationship="label"><Button appearance="subtle" icon={<Archive24Regular />} aria-label="归档" onClick={() => archive(product)} /></Tooltip></span></td>
              </tr>)}</tbody>
            </table>
          ) : <div className="empty-state"><div><strong>没有匹配的产品</strong><p>调整搜索条件，或者新增一个产品。</p></div></div>}
        </div>
      </section>

      <Dialog open={editing !== undefined} onOpenChange={(_, data) => !data.open && setEditing(undefined)}>
        <DialogSurface><form onSubmit={save}><DialogBody><DialogTitle>{editing ? "编辑产品" : "新增产品"}</DialogTitle><DialogContent>
          <div className="form-grid">
            <Field label="P/N" required><Input value={form.pn} onChange={(_, data) => setForm({ ...form, pn: data.value })} /></Field>
            <Field label="内部名称"><Input value={form.name} onChange={(_, data) => setForm({ ...form, name: data.value })} /></Field>
            <Field label="英文 Description" required className="form-span-2"><Textarea resize="vertical" rows={6} value={form.description} onChange={(_, data) => setForm({ ...form, description: data.value })} /></Field>
            <Field label="Unit" required><Input value={form.unit} onChange={(_, data) => setForm({ ...form, unit: data.value })} /></Field>
            <Field label="常规单价 (USD)" required><Input type="number" min="0" step="0.0001" value={form.regularPriceUsd} onChange={(_, data) => setForm({ ...form, regularPriceUsd: data.value })} /></Field>
            <Field label="产品主图" hint="JPG、PNG 或 WebP，最大 12MB" className="form-span-2"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] ?? null)} style={{ padding: "8px 0" }} /></Field>
          </div>
          {error ? <div className="error-banner" style={{ marginTop: 14 }}>{error}</div> : null}
        </DialogContent><DialogActions><Button onClick={() => setEditing(undefined)}>取消</Button><Button appearance="primary" type="submit" disabled={busy}>{busy ? "保存中" : "保存"}</Button></DialogActions></DialogBody></form></DialogSurface>
      </Dialog>
    </>
  );
}
