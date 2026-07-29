"use client";

import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input, Select } from "@fluentui/react-components";
import { Add24Regular, ArrowDownload24Regular, Delete24Regular, Edit24Regular, Search24Regular } from "@fluentui/react-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { Customer } from "@/types";

type Row = {
  id: string;
  displayPiNumber: string;
  revisionDate: string;
  status: "DRAFT" | "FINALIZED";
  recipientName: string | null;
  customerCompanyName: string | null;
  total: string;
  series: { salesperson: { displayName: string }; customer: { internalLabel: string } | null };
  exportJob: { status: string } | null;
  _count: { items: number };
};

type Props = {
  initialRevisions: Row[];
  customers: Customer[];
  warmMessage?: string | null;
};

export function QuotesManager({ initialRevisions, customers, warmMessage }: Props) {
  const router = useRouter();
  const [revisions, setRevisions] = useState(initialRevisions);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");

  const visible = useMemo(() => {
    const query = search.toLowerCase().trim();
    return query
      ? revisions.filter((revision) => [revision.displayPiNumber, revision.recipientName, revision.customerCompanyName, revision.series.customer?.internalLabel].some((value) => value?.toLowerCase().includes(query)))
      : revisions;
  }, [revisions, search]);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const result = await fetchJson<{ revisionId: string }>("/api/quotes", { method: "POST", body: JSON.stringify({ customerId: customerId || null }) });
      router.push(`/quotes/${result.revisionId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建失败");
      setBusy(false);
    }
  }

  async function removeDraft(revision: Row) {
    if (!window.confirm(`确定删除报价 ${revision.displayPiNumber} 吗？此操作无法撤销。`)) return;
    setDeletingId(revision.id);
    setError("");
    try {
      await fetchJson<{ ok: true }>(`/api/quotes/${revision.id}`, { method: "DELETE" });
      setRevisions((current) => current.filter((item) => item.id !== revision.id));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除草稿失败");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <>
      <header className={`page-header ${warmMessage ? "quote-page-header" : ""}`}>
        <div>
          <h1>报价记录</h1>
          <p>草稿可编辑，正式导出后创建新一轮</p>
        </div>
        {warmMessage ? <div className="mandy-warm-message"><span>{warmMessage}</span><small>— 阿龙</small></div> : null}
        <Button appearance="primary" icon={<Add24Regular />} onClick={() => setOpen(true)}>新建报价</Button>
      </header>

      {error ? <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div> : null}
      <section className="panel">
        <div className="panel-toolbar">
          <Input value={search} onChange={(_, data) => setSearch(data.value)} contentBefore={<Search24Regular />} placeholder="搜索 PI 编号或客户" style={{ minWidth: 320 }} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{visible.length} 条记录</span>
        </div>
        <div className="table-scroll">
          {visible.length ? (
            <table className="data-table mobile-cards">
              <thead><tr><th style={{ width: 190 }}>PI Number</th><th style={{ width: 110 }}>日期</th><th>客户</th><th style={{ width: 110 }}>业务员</th><th style={{ width: 70 }}>产品</th><th style={{ width: 120 }}>总计 USD</th><th style={{ width: 90 }}>状态</th><th style={{ width: 210 }}>操作</th></tr></thead>
              <tbody>{visible.map((revision) => (
                <tr key={revision.id}>
                  <td data-label="PI Number"><Link href={`/quotes/${revision.id}`} style={{ color: "var(--accent)", fontWeight: 650 }}>{revision.displayPiNumber}</Link></td>
                  <td data-label="日期">{revision.revisionDate.slice(0, 10)}</td>
                  <td data-label="客户">{revision.series.customer?.internalLabel || revision.customerCompanyName || revision.recipientName || "未填写客户"}</td>
                  <td data-label="业务员">{revision.series.salesperson.displayName}</td>
                  <td data-label="产品" className="numeric">{revision._count.items}</td>
                  <td data-label="总计 USD" className="numeric">${Number(revision.total).toFixed(2)}</td>
                  <td data-label="状态"><span className={`status ${revision.status === "DRAFT" ? "status-draft" : "status-final"}`}>{revision.status === "DRAFT" ? "草稿" : "已锁定"}</span></td>
                  <td data-label="操作"><div className="table-actions">
                    <Button as="a" href={`/quotes/${revision.id}`} appearance="subtle" icon={<Edit24Regular />}>{revision.status === "DRAFT" ? "编辑" : "查看"}</Button>
                    <Button appearance="subtle" icon={<Delete24Regular />} disabled={deletingId === revision.id} onClick={() => removeDraft(revision)} style={{ color: "var(--danger)" }}>{deletingId === revision.id ? "删除中" : "删除"}</Button>
                    {revision.status === "FINALIZED" && revision.exportJob?.status === "READY" ? <Button as="a" href={`/api/quotes/${revision.id}/download?format=png&bank=0`} appearance="subtle" icon={<ArrowDownload24Regular />} aria-label="下载无银行 PNG" /> : null}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          ) : (
            <div className="empty-state"><div><strong>{search ? "没有匹配的报价" : "还没有报价"}</strong><p>{search ? "换一个 PI 编号或客户名称试试。" : "创建第一张报价，选择客户后再添加产品。"}</p>{!search ? <Button appearance="primary" onClick={() => setOpen(true)}>新建报价</Button> : null}</div></div>
          )}
        </div>
      </section>

      <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DialogSurface><DialogBody><DialogTitle>新建报价</DialogTitle><DialogContent>
          <Field label="客户" hint="可以不选择，进入报价后再手工填写客户信息"><Select value={customerId} onChange={(_, data) => setCustomerId(data.value)}><option value="">不选择客户</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.internalLabel}</option>)}</Select></Field>
          {error ? <div className="error-banner" style={{ marginTop: 14 }}>{error}</div> : null}
        </DialogContent><DialogActions><Button onClick={() => setOpen(false)}>取消</Button><Button appearance="primary" disabled={busy} onClick={create}>{busy ? "创建中" : "创建报价"}</Button></DialogActions></DialogBody></DialogSurface>
      </Dialog>
    </>
  );
}
