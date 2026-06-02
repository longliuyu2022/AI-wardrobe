"use client";

import Link from "next/link";

export function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description?: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-brand-300 bg-white/60 px-6 py-16 text-center">
      {/* SVG empty wardrobe illustration */}
      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
        className="mb-4 text-brand-300"
      >
        <rect x="16" y="8" width="48" height="64" rx="6" stroke="currentColor" strokeWidth="2" />
        <line x1="40" y1="8" x2="40" y2="72" stroke="currentColor" strokeWidth="2" />
        <circle cx="37" cy="40" r="2" fill="currentColor" />
        <circle cx="43" cy="40" r="2" fill="currentColor" />
        <line x1="22" y1="20" x2="34" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="22" y1="26" x2="30" y2="26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="46" y1="20" x2="58" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="46" y1="26" x2="54" y2="26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p className="text-base font-medium text-brand-800">{title}</p>
      {description && <p className="mt-1 text-sm text-brand-600">{description}</p>}
      {href && action && (
        <Link
          href={href}
          className="mt-4 rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700"
        >
          {action}
        </Link>
      )}
    </div>
  );
}
