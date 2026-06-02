"use client";

import { COLOR_ZH } from "@/lib/i18n";

const COLOR_HEX: Record<string, string> = {
  white: "#f5f5f4",
  black: "#1c1917",
  grey: "#78716c",
  gray: "#78716c",
  silver: "#a8a29e",
  red: "#ef4444",
  pink: "#ec4899",
  orange: "#f97316",
  yellow: "#eab308",
  brown: "#92400e",
  beige: "#d6d3d1",
  khaki: "#a16207",
  tan: "#b45309",
  green: "#22c55e",
  olive: "#65a30d",
  mint: "#34d399",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  blue: "#3b82f6",
  navy: "#1e3a5f",
  purple: "#a855f7",
  violet: "#8b5cf6",
  gold: "#ca8a04",
  multicolor: "#78716c",
};

export function Badge({
  children,
  dot,
  className = "",
}: {
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  let hex: string | undefined;
  if (dot && typeof children === "string") {
    // Try to find a color key matching the Chinese text
    const entry = Object.entries(COLOR_ZH).find(([, zh]) => children === zh);
    if (entry) hex = COLOR_HEX[entry[0]];
    // Also try English key directly
    if (!hex) {
      const lower = children.toLowerCase();
      if (COLOR_HEX[lower]) hex = COLOR_HEX[lower];
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-brand-100/70 px-2 py-0.5 text-[10px] text-brand-700 ${className}`}
    >
      {hex && (
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: hex }}
        />
      )}
      {children}
    </span>
  );
}
