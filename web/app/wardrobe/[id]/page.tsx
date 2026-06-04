"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  deleteGarment,
  getGarment,
  listGarments,
  updateGarment,
  type Garment,
  type GarmentUpdate,
} from "@/lib/api";
import {
  CATEGORY_ZH,
  COLOR_ZH,
  MATERIAL_ZH,
  SEASON_ZH,
  STYLE_ZH,
  zhCategory,
  zhColor,
  zhSeason,
} from "@/lib/i18n";
import { useToast } from "@/components/toast";

const CATEGORY_OPTIONS: { id: string; label: string }[] = [
  { id: "top", label: "上衣" },
  { id: "outerwear", label: "外套" },
  { id: "bottom", label: "下装" },
  { id: "dress", label: "连衣裙" },
  { id: "shoes", label: "鞋" },
  { id: "bag", label: "包" },
  { id: "accessory", label: "配饰" },
  { id: "other", label: "其他" },
];

const SEASON_OPTIONS = ["spring", "summer", "autumn", "winter"];

function buildReverseLookup(table: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [en, zh] of Object.entries(table)) {
    out[zh] = en;
    out[en.toLowerCase()] = en;
  }
  return out;
}
const COLOR_REV = buildReverseLookup(COLOR_ZH);
const MATERIAL_REV = buildReverseLookup(MATERIAL_ZH);
const STYLE_REV = buildReverseLookup(STYLE_ZH);

function normalizeTags(raw: string, rev: Record<string, string>): string[] {
  return raw
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((t) => rev[t] ?? rev[t.toLowerCase()] ?? t);
}

function tagsToDisplay(arr: string[] | null | undefined, zh: (s: string) => string): string {
  if (!arr || arr.length === 0) return "";
  return arr.map(zh).join(", ");
}

export default function GarmentEditPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [g, setG] = useState<Garment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Navigation state
  const [allIds, setAllIds] = useState<string[]>([]);
  const currentIndex = allIds.indexOf(params.id);
  const prevId = currentIndex > 0 ? allIds[currentIndex - 1] : null;
  const nextId = currentIndex < allIds.length - 1 ? allIds[currentIndex + 1] : null;

  // form state
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [colorsText, setColorsText] = useState("");
  const [seasons, setSeasons] = useState<Set<string>>(new Set());
  const [material, setMaterial] = useState("");
  const [style, setStyle] = useState("");
  const [wearCount, setWearCount] = useState<number>(0);
  const [purchasePrice, setPurchasePrice] = useState<string>("");
  const [purchaseLink, setPurchaseLink] = useState("");
  const [note, setNote] = useState("");

  const loadGarment = useCallback(async (id: string) => {
    try {
      setError(null);
      const data = await getGarment(id);
      setG(data);
      setCategory(data.category);
      setSubCategory(data.sub_category ?? "");
      setColorsText(tagsToDisplay(data.colors, zhColor));
      setSeasons(new Set(data.season ?? []));
      setMaterial(data.material ?? "");
      setStyle(data.style ?? "");
      setWearCount(data.wear_count ?? 0);
      setPurchasePrice(data.purchase_price?.toString() ?? "");
      setPurchaseLink(data.purchase_link ?? "");
      setNote(data.note ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    loadGarment(params.id);
    // Load all garment IDs for navigation
    listGarments().then((items) => setAllIds(items.map((g) => g.id))).catch(() => {});
  }, [params.id, loadGarment]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft" && prevId) router.push(`/wardrobe/${prevId}`);
      if (e.key === "ArrowRight" && nextId) router.push(`/wardrobe/${nextId}`);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [prevId, nextId, router]);

  function toggleSeason(s: string) {
    setSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  async function handleSave() {
    if (!g) return;
    setSaving(true);
    setError(null);
    try {
      const patch: GarmentUpdate = {
        category,
        sub_category: subCategory.trim() || null,
        colors: normalizeTags(colorsText, COLOR_REV),
        season: Array.from(seasons),
        material: material.trim() ? (MATERIAL_REV[material.trim()] ?? material.trim()) : null,
        style: style.trim() ? (STYLE_REV[style.trim()] ?? style.trim()) : null,
        wear_count: Number.isFinite(wearCount) ? wearCount : 0,
        purchase_price: purchasePrice.trim() === "" ? null : Number(purchasePrice),
        purchase_link: purchaseLink.trim() || null,
        note: note.trim() || null,
      };
      if (!patch.colors?.length) patch.colors = null;
      if (!patch.season?.length) patch.season = null;
      await updateGarment(g.id, patch);
      toast("保存成功");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!g) return;
    if (!confirm(`确定删除这件 "${g.sub_category || g.category}" 吗?`)) return;
    setSaving(true);
    try {
      await deleteGarment(g.id);
      toast("已删除");
      // Navigate to next or prev, or back to list
      const targetId = nextId ?? prevId;
      if (targetId) router.push(`/wardrobe/${targetId}`);
      else router.push("/wardrobe");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  if (error && !g) {
    return (
      <div className="space-y-3">
        <Link href="/wardrobe" className="text-sm text-brand-600 underline">← 返回衣橱</Link>
        <div className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</div>
      </div>
    );
  }

  if (!g) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-20 animate-pulse rounded bg-brand-100/60" />
        <div className="flex gap-4">
          <div className="h-40 w-40 animate-pulse rounded-lg bg-brand-100/60" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 animate-pulse rounded bg-brand-100/60" />
            <div className="h-4 w-24 animate-pulse rounded bg-brand-100/60" />
          </div>
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-brand-100/60" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/wardrobe" className="text-sm text-brand-600 underline">← 返回衣橱</Link>
        <button
          onClick={handleDelete}
          disabled={saving}
          className="text-sm text-red-600 underline hover:text-red-800 disabled:opacity-50"
        >
          删除
        </button>
      </div>

      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={g.image_url} alt={g.sub_category ?? g.category}
             className="h-40 w-40 rounded-lg object-cover" />
        <div className="flex-1 text-sm text-brand-700">
          <p>原识别: {zhCategory(g.category)} · {g.sub_category}</p>
          <p className="mt-1 text-xs text-brand-700/70">
            创建: {new Date(g.created_at).toLocaleString("zh-CN")}
          </p>
          <p className="mt-1 text-xs text-brand-700/70">id: {g.id.slice(0, 8)}…</p>
        </div>
      </div>

      {error && (
        <div className="rounded bg-red-50 p-2 text-xs text-red-800">{error}</div>
      )}

      <div className="space-y-4 rounded-xl border border-brand-200 bg-white p-4">
        <Field label="分类">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded border border-brand-300 px-3 py-2 text-sm"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </Field>

        <Field label="子类 (如: 牛仔衬衫 / 阔腿裤)">
          <input
            value={subCategory}
            onChange={(e) => setSubCategory(e.target.value)}
            className="w-full rounded border border-brand-300 px-3 py-2 text-sm"
            placeholder="例: 牛仔衬衫"
          />
        </Field>

        <Field label="颜色 (中英都行,逗号分隔)">
          <input
            value={colorsText}
            onChange={(e) => setColorsText(e.target.value)}
            className="w-full rounded border border-brand-300 px-3 py-2 text-sm"
            placeholder="例: 白色, 米色"
          />
        </Field>

        <Field label="适合季节">
          <div className="flex gap-2">
            {SEASON_OPTIONS.map((s) => {
              const active = seasons.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSeason(s)}
                  className={
                    "rounded-full border px-3 py-1 text-xs " +
                    (active
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-brand-300 bg-white text-brand-700")
                  }
                >
                  {SEASON_ZH[s]}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="材质">
          <input
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="w-full rounded border border-brand-300 px-3 py-2 text-sm"
            placeholder="例: 棉 / 牛仔 / 真丝"
          />
        </Field>

        <Field label="风格">
          <input
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full rounded border border-brand-300 px-3 py-2 text-sm"
            placeholder="例: 休闲 / 商务 / 街头"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="穿过次数">
            <input
              type="number"
              min={0}
              value={wearCount}
              onChange={(e) => setWearCount(Number(e.target.value))}
              className="w-full rounded border border-brand-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="购入价 (¥)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              className="w-full rounded border border-brand-300 px-3 py-2 text-sm"
              placeholder="可空"
            />
          </Field>
        </div>

        <Field label="购买链接">
          <input
            type="url"
            value={purchaseLink}
            onChange={(e) => setPurchaseLink(e.target.value)}
            className="w-full rounded border border-brand-300 px-3 py-2 text-sm"
            placeholder="可空"
          />
        </Field>

        <Field label="备注">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded border border-brand-300 px-3 py-2 text-sm"
            placeholder="可空"
          />
        </Field>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存"}
        </button>
        <Link
          href="/wardrobe"
          className="rounded-lg border border-brand-300 px-4 py-2 text-sm text-brand-700"
        >
          取消
        </Link>
      </div>

      {/* Prev / Next navigation */}
      {(prevId || nextId) && (
        <div className="flex items-center justify-between border-t border-brand-100 pt-4">
          {prevId ? (
            <Link
              href={`/wardrobe/${prevId}`}
              className="rounded-full px-4 py-2 text-sm text-brand-600 transition hover:bg-brand-100/70"
            >
              ← 上一件
            </Link>
          ) : <div />}
          <span className="text-xs text-brand-400">
            {currentIndex + 1} / {allIds.length}
          </span>
          {nextId ? (
            <Link
              href={`/wardrobe/${nextId}`}
              className="rounded-full px-4 py-2 text-sm text-brand-600 transition hover:bg-brand-100/70"
            >
              下一件 →
            </Link>
          ) : <div />}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-brand-700">{label}</span>
      {children}
    </label>
  );
}
