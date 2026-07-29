"use client";

import { Button, Tooltip } from "@fluentui/react-components";
import { Box24Regular, Building24Regular, CloudArrowUp24Regular, DocumentTable24Regular, People24Regular, Settings24Regular, SignOut24Regular } from "@fluentui/react-icons";
import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./AppShell.module.css";

type Props = { children: React.ReactNode; user: { displayName: string; email: string; role: "ADMIN" | "SALESPERSON" } };

export function AppShell({ children, user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const links = [
    { href: "/quotes", label: "报价", icon: <DocumentTable24Regular /> },
    { href: "/products", label: "产品", icon: <Box24Regular /> },
    { href: "/customers", label: "客户", icon: <People24Regular /> },
    ...(user.role === "ADMIN" ? [{ href: "/settings/company", label: "公司资料", icon: <Building24Regular /> }, { href: "/settings/users", label: "账号", icon: <Settings24Regular /> }, { href: "/settings/backup", label: "备份", icon: <CloudArrowUp24Regular /> }] : []),
  ];
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}><span className={styles.mark}>QF</span><div><strong>QuoteFlow</strong><small>外贸报价工作台</small></div></div>
        <nav>{links.map((item) => <Link key={item.href} href={item.href} className={clsx(styles.navItem, pathname.startsWith(item.href) && styles.active)}>{item.icon}<span>{item.label}</span></Link>)}</nav>
        <div className={styles.account}><div><strong>{user.displayName}</strong><small>{user.role === "ADMIN" ? "管理员" : "业务员"}</small></div><Tooltip content="退出登录" relationship="label"><Button appearance="subtle" icon={<SignOut24Regular />} aria-label="退出登录" onClick={logout} /></Tooltip></div>
      </aside>
      <div className={styles.workspace}><header className={styles.mobileHeader}><strong>QuoteFlow</strong><div><span>{user.displayName}</span><Button appearance="subtle" icon={<SignOut24Regular />} aria-label="退出登录" onClick={logout} /></div></header><main className={styles.content}>{children}</main></div>
    </div>
  );
}
