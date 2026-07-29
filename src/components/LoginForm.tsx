"use client";

import { Button, Field, Input } from "@fluentui/react-components";
import { LockClosed24Regular, Mail24Regular } from "@fluentui/react-icons";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/client-api";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("mandy@quoteflow.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); try { await fetchJson("/api/auth/login", { method:"POST", body:JSON.stringify({email,password}) }); router.replace("/quotes"); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "登录失败"); } finally { setLoading(false); } }
  return <form onSubmit={submit} style={{display:"grid",gap:18}}><Field label="邮箱"><Input size="large" value={email} onChange={(_,d)=>setEmail(d.value)} contentBefore={<Mail24Regular />} autoComplete="email" /></Field><Field label="密码"><Input size="large" type="password" value={password} onChange={(_,d)=>setPassword(d.value)} contentBefore={<LockClosed24Regular />} autoComplete="current-password" /></Field>{error?<div className="error-banner" role="alert">{error}</div>:null}<Button type="submit" appearance="primary" size="large" disabled={loading}>{loading?"正在登录":"登录"}</Button></form>;
}
