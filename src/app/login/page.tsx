import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import styles from "./login.module.css";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/quotes");
  return <main className={styles.page}><section className={styles.panel}><div className={styles.brand}><span>QF</span><div><h1>QuoteFlow</h1><p>外贸报价工作台</p></div></div><LoginForm /><p className={styles.hint}>首次使用请登录种子账号，并尽快修改默认密码。</p></section><aside className={styles.context}><h2>产品、客户、报价<br />集中在一个工作台</h2><p>保存每一轮报价快照，自动计算金额并导出可直接发送的 PI 长图。</p></aside></main>;
}
