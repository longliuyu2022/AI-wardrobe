"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { listGarments, exportData, type Garment } from "@/lib/api";
import { zhCategory, zhColor, CATEGORY_ZH } from "@/lib/i18n";
import { Badge } from "@/components/badge";
import { SkeletonCard } from "@/components/skeleton";

const CATEGORY_EMOJI: Record<string, string> = {
  top: "👕",
  outerwear: "🧥",
  bottom: "👖",
  dress: "👗",
  shoes: "👟",
  bag: "👜",
  accessory: "💍",
  other: "📦",
};

export default function Home() {
  const [garments, setGarments] = useState<Garment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listGarments()
      .then(setGarments)
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setGarments([]);
      });
  }, []);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of garments ?? []) {
      m[g.category] = (m[g.category] ?? 0) + 1;
    }
    return m;
  }, [garments]);

  const recent = useMemo(() => (garments ?? []).slice(0, 6), [garments]);

  if (garments === null) {
    return (
      <div className="space-y-8 py-6">
        <div className="h-10 w-48 animate-pulse rounded bg-brand-100/60" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-brand-100/60" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-6">
      {/* Hero */}
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          {garments.length > 0 ? "我的衣橱" : "一张全身照，自动入柜 5 件衣服"}
        </h1>
        <p className="mt-1 text-sm text-brand-700">
          {garments.length > 0
            ? `共 ${garments.length} 件衣物`
            : "AI 帮你拆出上衣、外套、裤子、鞋、包，无需一件件拍。"}
        </p>
      </section>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {/* Stats cards */}
      {garments.length > 0 ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries(CATEGORY_ZH)
            .filter(([key]) => counts[key])
            .map(([key, label]) => (
              <Link
                key={key}
                href={`/wardrobe?filter=${key}`}
                className="flex items-center gap-3 rounded-2xl bg-white/85 p-4 ring-1 ring-brand-100 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <span className="text-2xl">{CATEGORY_EMOJI[key] ?? "📦"}</span>
                <div>
                  <p className="text-lg font-semibold text-brand-900">{counts[key]}</p>
                  <p className="text-xs text-brand-600">{label}</p>
                </div>
              </Link>
            ))}
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-3">
          <Feature title="AI 自动识别" desc="上传衣物，自动识别类目、颜色、季节、材质、风格" />
          <Feature title="全身照分部位" desc="拍一张穿搭照，AI 拆出上衣/裤/鞋/包，一次入库多件" />
          <Feature title="数据归你所有" desc="任何时候可一键导出 ZIP，免费 tier 永远可用" />
        </section>
      )}

      {/* Quick actions */}
      <section className="flex flex-wrap gap-3">
        <Link
          href="/upload"
          className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700"
        >
          + 上传衣物
        </Link>
        <Link
          href="/wardrobe"
          className="rounded-full border border-brand-300 px-5 py-2.5 text-sm font-medium text-brand-700 transition hover:bg-brand-100/70"
        >
          浏览衣橱
        </Link>
        {garments.length >= 2 && (
          <Link
            href="/wardrobe#outfit"
            className="rounded-full border border-accent-300 px-5 py-2.5 text-sm font-medium text-accent-600 transition hover:bg-accent-50"
          >
            AI 搭配推荐
          </Link>
        )}
        {garments.length > 0 && (
          <button
            onClick={exportData}
            className="rounded-full border border-brand-300 px-5 py-2.5 text-sm font-medium text-brand-700 transition hover:bg-brand-100/70"
          >
            导出数据
          </button>
        )}
      </section>

      {/* Recent items */}
      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-brand-800">最近添加</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {recent.map((g) => (
              <Link
                key={g.id}
                href={`/wardrobe/${g.id}`}
                className="w-32 flex-none"
              >
                <div className="overflow-hidden rounded-xl bg-white/85 ring-1 ring-brand-100 shadow-card transition hover:shadow-card-hover">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.thumbnail_url ?? g.image_url}
                    alt={g.sub_category ?? g.category}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="p-2">
                    <p className="truncate text-xs font-medium text-brand-900">
                      {g.sub_category || zhCategory(g.category)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {(g.colors ?? []).slice(0, 2).map((c) => (
                        <Badge key={c} dot>{zhColor(c)}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-brand-200 bg-white p-5">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-2 text-sm text-brand-700">{desc}</p>
    </div>
  );
}
