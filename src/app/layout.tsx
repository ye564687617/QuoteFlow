import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "QuoteFlow 外贸报价",
  description: "外贸产品和 PI 报价管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
