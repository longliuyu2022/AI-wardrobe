"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/wardrobe", label: "衣橱" },
  { href: "/upload", label: "上传" },
  { href: "/calendar", label: "日历" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 hidden border-b border-brand-100/70 bg-white/70 backdrop-blur-md md:block">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2 text-brand-900">
          <span className="text-lg font-semibold tracking-tight">Wardrobe</span>
          <span className="text-xs text-brand-500/70">智能衣橱</span>
        </Link>
        <nav className="flex gap-1 text-sm">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={
                  "rounded-full px-3 py-1 transition " +
                  (active
                    ? "bg-brand-600 text-white"
                    : "text-brand-700 hover:bg-brand-100/70")
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
