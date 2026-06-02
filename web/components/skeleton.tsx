"use client";

export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white/85 ring-1 ring-brand-100 shadow-card">
      <div className="aspect-square w-full animate-pulse bg-brand-100/60" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-2/3 animate-pulse rounded bg-brand-100/60" />
        <div className="flex gap-1">
          <div className="h-4 w-12 animate-pulse rounded-full bg-brand-100/60" />
          <div className="h-4 w-10 animate-pulse rounded-full bg-brand-100/60" />
          <div className="h-4 w-14 animate-pulse rounded-full bg-brand-100/60" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonLine({ width = "w-full" }: { width?: string }) {
  return <div className={`h-4 animate-pulse rounded bg-brand-100/60 ${width}`} />;
}
