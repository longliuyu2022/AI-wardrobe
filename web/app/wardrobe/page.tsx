"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { deleteGarment, listGarments, recordWear, suggestOutfits, type Garment, type OutfitSuggestion } from "@/lib/api";
import { zhCategory, zhColor, zhSeason, zhStyle, zhMaterial, CATEGORY_ZH } from "@/lib/i18n";
import { Badge } from "@/components/badge";
import { SkeletonGrid } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/components/toast";

const FILTERS: { value: string; label: string; emoji: string }[] = [
  { value: "all", label: "全部", emoji: "✨" },
  { value: "top", label: "上衣", emoji: "👕" },
  { value: "outerwear", label: "外套", emoji: "🧥" },
  { value: "bottom", label: "下装", emoji: "👖" },
  { value: "dress", label: "连衣裙", emoji: "👗" },
  { value: "shoes", label: "鞋", emoji: "👟" },
  { value: "bag", label: "包", emoji: "👜" },
  { value: "accessory", label: "配饰", emoji: "💍" },
];

export default function WardrobePage() {
  return (
    <Suspense fallback={<div className="py-6"><SkeletonGrid /></div>}>
      <WardrobeContent />
    </Suspense>
  );
}

function WardrobeContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [garments, setGarments] = useState<Garment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>(searchParams.get("filter") ?? "all");
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const [suggesting, setSuggesting] = useState(false);
  const [outfits, setOutfits] = useState<OutfitSuggestion[] | null>(null);
  const [outfitError, setOutfitError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      const items = await listGarments();
      setGarments(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setGarments([]);
    }
  }

  async function handleBatchDelete() {
    if (selected.size === 0) return;
    const names = [...selected]
      .map((id) => garments?.find((g) => g.id === id))
      .filter(Boolean)
      .map((g) => g!.sub_category || zhCategory(g!.category))
      .join("、");
    if (!confirm(`确定删除选中的 ${selected.size} 件衣物?\n${names}`)) return;
    setDeleting(true);
    try {
      await Promise.all([...selected].map((id) => deleteGarment(id)));
      setGarments((prev) => (prev ?? []).filter((g) => !selected.has(g.id)));
      setSelected(new Set());
      toast(`已删除 ${selected.size} 件衣物`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitEditMode() {
    setEditMode(false);
    setSelected(new Set());
  }

  async function handleWear(g: Garment) {
    try {
      await recordWear([g.id]);
      toast(`已记录今天穿了 ${g.sub_category || zhCategory(g.category)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSuggest() {
    setSuggesting(true);
    setOutfitError(null);
    setOutfits(null);
    try {
      const r = await suggestOutfits();
      setOutfits(r);
    } catch (e) {
      setOutfitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSuggesting(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    if (!garments) return [];
    if (filter === "all") return garments;
    return garments.filter((g) => g.category === filter);
  }, [garments, filter]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: garments?.length ?? 0 };
    for (const g of garments ?? []) {
      m[g.category] = (m[g.category] ?? 0) + 1;
    }
    return m;
  }, [garments]);

  const byId = useMemo(() => {
    const m: Record<string, Garment> = {};
    for (const g of garments ?? []) m[g.id] = g;
    return m;
  }, [garments]);

  if (garments === null) {
    return (
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="h-8 w-32 animate-pulse rounded bg-brand-100/60" />
            <div className="mt-1 h-4 w-20 animate-pulse rounded bg-brand-100/60" />
          </div>
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-16 animate-pulse rounded-full bg-brand-100/60" />
          ))}
        </div>
        <SkeletonGrid />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">我的衣橱</h1>
          <p className="mt-0.5 text-sm text-brand-700/80">共 {garments.length} 件</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={refresh}
            className="rounded-full px-3 py-1 text-brand-700 hover:bg-brand-100/70"
            disabled={editMode}
          >
            刷新
          </button>
          <button
            onClick={editMode ? exitEditMode : () => setEditMode(true)}
            className={
              "rounded-full px-3 py-1 transition " +
              (editMode
                ? "bg-accent-500 text-white"
                : "border border-brand-300 text-brand-700 hover:bg-brand-100/70")
            }
          >
            {editMode ? "完成" : "编辑"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {/* AI 搭配 */}
      <section id="outfit" className="rounded-2xl border border-brand-100/70 bg-white/85 p-5 shadow-card backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">AI 搭配</h2>
            <p className="mt-0.5 text-xs text-brand-700/80">从衣橱里挑 3 套适合的搭配</p>
          </div>
          <button
            onClick={handleSuggest}
            disabled={suggesting || garments.length < 2}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-50"
          >
            {suggesting ? "生成中…" : "生成 3 套"}
          </button>
        </div>

        {outfitError && (
          <div className="mt-3 rounded bg-red-50 p-2 text-xs text-red-800">{outfitError}</div>
        )}
        {outfits && outfits.length > 0 && (
          <div className="mt-4 space-y-4">
            {outfits.map((o, i) => (
              <OutfitRow key={i} outfit={o} byId={byId} />
            ))}
          </div>
        )}
        {outfits && outfits.length === 0 && (
          <p className="mt-3 text-sm text-brand-700">没有匹配的搭配，试试再上传几件衣物。</p>
        )}
      </section>

      {/* 分类筛选 */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const n = counts[f.value] ?? 0;
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={
                "rounded-full px-3 py-1.5 text-xs font-medium transition " +
                (active
                  ? "bg-brand-600 text-white shadow-sm shadow-brand-600/20"
                  : "bg-white/70 text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100/70")
              }
            >
              <span className="mr-0.5">{f.emoji}</span> {f.label}
              {n > 0 && <span className="ml-1 opacity-70">({n})</span>}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        garments.length === 0 ? (
          <EmptyState
            title="衣橱还是空的"
            description="上传第一件衣物，让 AI 帮你打理衣橱"
            href="/upload"
            action="去上传"
          />
        ) : (
          <EmptyState title="这个分类下还没有衣物" />
        )
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {filtered.map((g) => (
            <GarmentCard
              key={g.id}
              g={g}
              editMode={editMode}
              selected={selected.has(g.id)}
              onSelect={() => toggleSelect(g.id)}
              onWear={() => handleWear(g)}
            />
          ))}
        </div>
      )}

      {/* Batch delete bar */}
      {editMode && selected.size > 0 && (
        <div className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white/95 px-5 py-3 shadow-soft ring-1 ring-brand-200 backdrop-blur-md md:bottom-6">
          <span className="text-sm text-brand-700">已选 {selected.size} 件</span>
          <button
            onClick={handleBatchDelete}
            disabled={deleting}
            className="rounded-full bg-red-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
          >
            {deleting ? "删除中…" : "删除"}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded-full px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-100/70"
          >
            取消选择
          </button>
        </div>
      )}
    </div>
  );
}

function GarmentCard({
  g,
  editMode,
  selected,
  onSelect,
  onWear,
}: {
  g: Garment;
  editMode: boolean;
  selected: boolean;
  onSelect: () => void;
  onWear: () => void;
}) {
  const baseCls =
    "group relative block overflow-hidden rounded-2xl bg-white/85 ring-1 ring-brand-100 shadow-card transition-all duration-200";
  const cls = editMode
    ? baseCls + (selected ? " ring-2 ring-brand-500" : " cursor-pointer")
    : baseCls + " hover:-translate-y-0.5 hover:shadow-card-hover hover:ring-brand-300";

  const inner = (
    <>
      {editMode ? (
        <div
          className={
            "absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 transition " +
            (selected
              ? "border-brand-500 bg-brand-500 text-white"
              : "border-brand-300 bg-white/80 text-transparent")
          }
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="2 6 5 9 10 3" />
          </svg>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onWear();
          }}
          title="今天穿了"
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-sm opacity-0 shadow-sm transition hover:bg-brand-100 group-hover:opacity-100"
        >
          👔
        </button>
      )}
      <div className="overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={g.thumbnail_url ?? g.image_url}
          alt={g.sub_category ?? g.category}
          className="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      </div>
      <div className="space-y-1.5 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-brand-900">
            {g.sub_category || CATEGORY_ZH[g.category] || g.category}
          </span>
          <span className="shrink-0 text-[11px] text-brand-700/70">{zhCategory(g.category)}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {(g.colors ?? []).slice(0, 2).map((c) => (
            <Badge key={c} dot>{zhColor(c)}</Badge>
          ))}
          {(g.season ?? []).slice(0, 2).map((s) => (
            <Badge key={s}>{zhSeason(s)}</Badge>
          ))}
          {g.material && <Badge>{zhMaterial(g.material)}</Badge>}
          {g.style && <Badge>{zhStyle(g.style)}</Badge>}
        </div>
      </div>
    </>
  );

  if (editMode) {
    return (
      <div className={cls} onClick={onSelect}>
        {inner}
      </div>
    );
  }
  return (
    <Link href={`/wardrobe/${g.id}`} className={cls}>
      {inner}
    </Link>
  );
}

function OutfitRow({ outfit, byId }: { outfit: OutfitSuggestion; byId: Record<string, Garment> }) {
  const items = outfit.garment_ids.map((id) => byId[id]).filter(Boolean);
  return (
    <div className="rounded-xl bg-brand-50/80 p-3 ring-1 ring-brand-100">
      <p className="mb-2 text-sm font-medium text-brand-900">
        <span className="mr-2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] text-white align-middle">
          {outfit.name || "搭配"}
        </span>
        <span className="text-brand-700/90">{outfit.reason}</span>
      </p>
      <div className="flex gap-3 overflow-x-auto">
        {items.map((g) => (
          <Link key={g.id} href={`/wardrobe/${g.id}`} className="flex-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={g.thumbnail_url ?? g.image_url}
              alt={g.sub_category ?? g.category}
              className="h-24 w-24 rounded-xl object-cover ring-1 ring-brand-100"
            />
            <p className="mt-1 text-center text-xs text-brand-700">
              {g.sub_category || zhCategory(g.category)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
