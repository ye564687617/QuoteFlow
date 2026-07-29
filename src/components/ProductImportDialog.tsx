"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Radio,
  RadioGroup,
} from "@fluentui/react-components";
import { ArrowUpload24Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { fetchJson } from "@/lib/client-api";

type ImportStatus = "NEW" | "UPDATE" | "DUPLICATE" | "ERROR";
type Preview = {
  rows: Array<{
    rowNumber: number;
    pn: string;
    description: string;
    unit: string;
    status: ImportStatus;
    hasImage: boolean;
    errors: string[];
  }>;
  summary: { total: number; new: number; update: number; duplicates: number; errors: number; images: number };
};

const statusLabel: Record<ImportStatus, string> = {
  NEW: "新增",
  UPDATE: "更新",
  DUPLICATE: "重复（跳过）",
  ERROR: "错误",
};

export function ProductImportDialog({ onImported }: { onImported: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [workbook, setWorkbook] = useState<File | null>(null);
  const [images, setImages] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mode, setMode] = useState("skip");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  function files() {
    const form = new FormData();
    if (workbook) form.append("workbook", workbook);
    if (images) form.append("images", images);
    return form;
  }

  async function inspect() {
    setBusy("preview");
    setError("");
    try {
      setPreview(await fetchJson<Preview>("/api/imports/products/preview", { method: "POST", body: files() }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "预检失败");
    } finally {
      setBusy("");
    }
  }

  async function commit() {
    setBusy("commit");
    setError("");
    try {
      const form = files();
      form.append("mode", mode);
      await fetchJson("/api/imports/products/commit", { method: "POST", body: form });
      await onImported();
      setOpen(false);
      setPreview(null);
      setWorkbook(null);
      setImages(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导入失败");
    } finally {
      setBusy("");
    }
  }

  return <>
    <Button icon={<ArrowUpload24Regular />} onClick={() => setOpen(true)}>批量导入</Button>
    <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <DialogSurface style={{ maxWidth: 820, width: "calc(100vw - 32px)" }}>
        <DialogBody>
          <DialogTitle>批量导入产品</DialogTitle>
          <DialogContent>
            <div className="form-grid">
              <Field label="产品 Excel" hint="支持 P/N 或 Item Number；可直接读取 Excel 内嵌图片" required>
                <input type="file" accept=".xlsx" onChange={(event) => { setWorkbook(event.target.files?.[0] ?? null); setPreview(null); }} />
              </Field>
              <Field label="产品图片 ZIP" hint="可选；上传后优先按 Image File 或 P/N 匹配">
                <input type="file" accept=".zip" onChange={(event) => { setImages(event.target.files?.[0] ?? null); setPreview(null); }} />
              </Field>
            </div>
            {preview ? <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0 10px" }}>
                <span className="status status-final">新增 {preview.summary.new}</span>
                <span className="status status-draft">更新 {preview.summary.update}</span>
                {preview.summary.duplicates ? <span className="status status-draft">文件内重复 {preview.summary.duplicates}（保留第一条）</span> : null}
                <span className="status">匹配图片 {preview.summary.images}</span>
                {preview.summary.errors ? <span className="status status-failed">错误 {preview.summary.errors}</span> : null}
              </div>
              <RadioGroup value={mode} onChange={(_, data) => setMode(data.value)} layout="horizontal">
                <Radio value="skip" label="跳过已有 P/N" />
                <Radio value="update" label="更新已有产品" />
              </RadioGroup>
              <div className="table-scroll" style={{ maxHeight: 330, marginTop: 12, border: "1px solid var(--line)" }}>
                <table className="data-table mobile-cards">
                  <thead><tr><th style={{ width: 58 }}>行</th><th style={{ width: 190 }}>P/N</th><th>Description</th><th style={{ width: 80 }}>Unit</th><th style={{ width: 80 }}>图片</th><th style={{ width: 100 }}>结果</th></tr></thead>
                  <tbody>{preview.rows.map((row) => <tr key={row.rowNumber}>
                    <td data-label="行">{row.rowNumber}</td>
                    <td data-label="P/N">{row.pn || "-"}</td>
                    <td data-label="Description">{row.errors.length ? row.errors.join("；") : row.description}</td>
                    <td data-label="Unit">{row.unit || "-"}</td>
                    <td data-label="图片">{row.hasImage ? "已匹配" : "无"}</td>
                    <td data-label="结果"><span className={`status ${row.status === "ERROR" ? "status-failed" : row.status === "UPDATE" || row.status === "DUPLICATE" ? "status-draft" : "status-final"}`}>{statusLabel[row.status]}</span></td>
                  </tr>)}</tbody>
                </table>
              </div>
            </> : null}
            {error ? <div className="error-banner" style={{ marginTop: 14 }}>{error}</div> : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>取消</Button>
            {preview
              ? <Button appearance="primary" disabled={busy === "commit" || preview.summary.errors > 0} onClick={commit}>{busy === "commit" ? "导入中" : "确认导入"}</Button>
              : <Button appearance="primary" disabled={!workbook || busy === "preview"} onClick={inspect}>{busy === "preview" ? "检查中" : "预检"}</Button>}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  </>;
}
