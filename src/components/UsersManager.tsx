"use client";

import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input, Select, Switch } from "@fluentui/react-components";
import { Add24Regular, Edit24Regular } from "@fluentui/react-icons";
import { FormEvent, useState } from "react";
import { fetchJson } from "@/lib/client-api";

type User = { id: string; email: string; displayName: string; piPrefix: string; role: "ADMIN" | "SALESPERSON"; active: boolean };
type UserForm = { email: string; displayName: string; piPrefix: string; role: "ADMIN" | "SALESPERSON"; active: boolean; password: string };

const blank: UserForm = { email: "", displayName: "", piPrefix: "", role: "SALESPERSON", active: true, password: "" };

export function UsersManager({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  const [form, setForm] = useState<UserForm>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function open(user?: User) {
    setEditing(user ?? null);
    setForm(user ? { email: user.email, displayName: user.displayName, piPrefix: user.piPrefix, role: user.role, active: user.active, password: "" } : blank);
    setError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.displayName.trim()) return setError("请填写姓名");
    if (!form.email.trim()) return setError("请填写邮箱");
    if (!/^[A-Za-z0-9]+$/.test(form.piPrefix.trim())) return setError("PI 前缀只能使用英文字母和数字");
    if ((!editing || form.password) && form.password.length < 10) return setError(editing ? "新密码至少 10 位，留空表示不修改" : "初始密码至少 10 位");

    setBusy(true);
    try {
      const result = await fetchJson<{ user: User }>(editing ? `/api/users/${editing.id}` : "/api/users", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      setUsers((current) => editing ? current.map((user) => user.id === result.user.id ? result.user : user) : [...current, result.user]);
      setEditing(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <header className="page-header"><div><h1>账号管理</h1><p>PI 前缀用于生成业务员当天的报价流水号</p></div><Button appearance="primary" icon={<Add24Regular />} onClick={() => open()}>新增账号</Button></header>
    <section className="panel"><div className="table-scroll"><table className="data-table mobile-cards">
      <thead><tr><th>姓名</th><th>邮箱</th><th style={{ width: 130 }}>PI 前缀</th><th style={{ width: 110 }}>角色</th><th style={{ width: 90 }}>状态</th><th style={{ width: 80 }}>操作</th></tr></thead>
      <tbody>{users.map((user) => <tr key={user.id}><td data-label="姓名"><strong>{user.displayName}</strong></td><td data-label="邮箱">{user.email}</td><td data-label="PI 前缀">{user.piPrefix}</td><td data-label="角色">{user.role === "ADMIN" ? "管理员" : "业务员"}</td><td data-label="状态"><span className={`status ${user.active ? "status-final" : "status-failed"}`}>{user.active ? "启用" : "停用"}</span></td><td data-label="操作"><Button appearance="subtle" icon={<Edit24Regular />} aria-label="编辑" onClick={() => open(user)} /></td></tr>)}</tbody>
    </table></div></section>
    <Dialog open={editing !== undefined} onOpenChange={(_, data) => !data.open && setEditing(undefined)}>
      <DialogSurface><form noValidate onSubmit={save}><DialogBody><DialogTitle>{editing ? "编辑账号" : "新增账号"}</DialogTitle><DialogContent>
        <div className="form-grid">
          <Field label="姓名" required><Input required value={form.displayName} onChange={(_, data) => setForm({ ...form, displayName: data.value })} /></Field>
          <Field label="邮箱" required><Input required type="email" value={form.email} onChange={(_, data) => setForm({ ...form, email: data.value })} /></Field>
          <Field label="PI 前缀" hint="只使用英文字母和数字" required><Input required pattern="[A-Za-z0-9]+" value={form.piPrefix} onChange={(_, data) => setForm({ ...form, piPrefix: data.value })} /></Field>
          <Field label="角色"><Select value={form.role} onChange={(_, data) => setForm({ ...form, role: data.value as UserForm["role"] })}><option value="SALESPERSON">业务员</option><option value="ADMIN">管理员</option></Select></Field>
          <Field label={editing ? "新密码" : "初始密码"} hint={editing ? "留空表示不修改，至少 10 位" : "至少 10 位"} required={!editing} className="form-span-2"><Input required={!editing} minLength={form.password ? 10 : undefined} autoComplete="new-password" type="password" value={form.password} onChange={(_, data) => setForm({ ...form, password: data.value })} /></Field>
          {editing ? <Field label="账号状态" className="form-span-2"><Switch checked={form.active} onChange={(_, data) => setForm({ ...form, active: data.checked })} label={form.active ? "启用" : "停用"} /></Field> : null}
        </div>
        {error ? <div className="error-banner" style={{ marginTop: 14 }}>{error}</div> : null}
      </DialogContent><DialogActions><Button onClick={() => setEditing(undefined)}>取消</Button><Button appearance="primary" type="submit" disabled={busy}>{busy ? "保存中" : "保存"}</Button></DialogActions></DialogBody></form></DialogSurface>
    </Dialog>
  </>;
}
