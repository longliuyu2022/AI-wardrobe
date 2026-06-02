import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { BottomNav } from "@/components/bottom-nav";
import { ToastProvider } from "@/components/toast";
import { AuthGate } from "@/lib/auth-gate";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wardrobe — 智能电子衣柜",
  description: "一张全身照，自动入柜 5 件衣服",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen pb-16 text-brand-900 antialiased md:pb-0">
        <ToastProvider>
          <Nav />
          <main className="mx-auto max-w-5xl px-4 py-6">
            <AuthGate>{children}</AuthGate>
          </main>
          <BottomNav />
        </ToastProvider>
      </body>
    </html>
  );
}
