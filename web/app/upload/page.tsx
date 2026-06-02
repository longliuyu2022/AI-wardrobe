"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { uploadFullBody, uploadSingleItem, type FullBodyResult, type Garment } from "@/lib/api";
import { CATEGORY_ZH, zhCategory, zhColor, zhMaterial, zhSeason, zhStyle } from "@/lib/i18n";
import { Badge } from "@/components/badge";
import { useToast } from "@/components/toast";

type Mode = "full-body" | "single" | "batch" | "batch-full-body";

type BatchItem = {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  result?: Garment;
  error?: string;
};

type BatchFullBodyItem = {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  result?: FullBodyResult;
  error?: string;
};

export default function UploadPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("single");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [single, setSingle] = useState<Garment | null>(null);
  const [fullBody, setFullBody] = useState<FullBodyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // batch mode state
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const batchAborted = useRef(false);

  // batch full-body mode state
  const [batchFBItems, setBatchFBItems] = useState<BatchFullBodyItem[]>([]);

  const handleBatchFBFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const items: BatchFullBodyItem[] = Array.from(files).map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
      status: "pending" as const,
    }));
    setBatchFBItems(items);
    setError(null);
  }, []);

  const handleBatchFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const items: BatchItem[] = Array.from(files).map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
      status: "pending" as const,
    }));
    setBatchItems(items);
    setError(null);
  }, []);

  async function handleBatchUpload() {
    if (batchItems.length === 0) return;
    setBusy(true);
    setError(null);
    batchAborted.current = false;

    // Reset all to pending
    setBatchItems((prev) =>
      prev.map((item) => ({ ...item, status: "pending" as const, error: undefined, result: undefined })),
    );

    let completed = 0;
    for (let i = 0; i < batchItems.length; i++) {
      if (batchAborted.current) break;
      const item = batchItems[i];

      // Mark as uploading
      setBatchItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: "uploading" as const } : it)),
      );

      try {
        const data = await uploadSingleItem(item.file);
        completed++;
        setBatchItems((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: "done" as const, result: data } : it)),
        );
        toast(`(${completed}/${batchItems.length}) ${data.sub_category || data.category} 已入柜`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setBatchItems((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: "error" as const, error: msg } : it)),
        );
      }
    }

    setBusy(false);
    if (completed > 0) {
      toast(`批量上传完成: ${completed}/${batchItems.length} 件成功`);
    }
  }

  function handleRetrySingle(index: number) {
    const item = batchItems[index];
    if (!item || item.status !== "error") return;

    setBatchItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, status: "uploading" as const, error: undefined } : it)),
    );

    uploadSingleItem(item.file)
      .then((data) => {
        setBatchItems((prev) =>
          prev.map((it, idx) => (idx === index ? { ...it, status: "done" as const, result: data } : it)),
        );
        toast(`${data.sub_category || data.category} 已入柜`);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        setBatchItems((prev) =>
          prev.map((it, idx) => (idx === index ? { ...it, status: "error" as const, error: msg } : it)),
        );
      });
  }

  function handleRemoveBatchItem(index: number) {
    setBatchItems((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  }

  function handleClearBatch() {
    batchItems.forEach((item) => URL.revokeObjectURL(item.preview));
    setBatchItems([]);
    setError(null);
  }

  async function handleBatchFullBodyUpload() {
    if (batchFBItems.length === 0) return;
    setBusy(true);
    setError(null);

    setBatchFBItems((prev) =>
      prev.map((item) => ({ ...item, status: "pending" as const, error: undefined, result: undefined })),
    );

    let completed = 0;
    let totalGarments = 0;
    for (let i = 0; i < batchFBItems.length; i++) {
      const item = batchFBItems[i];

      setBatchFBItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: "uploading" as const } : it)),
      );

      try {
        const data = await uploadFullBody(item.file);
        completed++;
        totalGarments += data.items.length;
        setBatchFBItems((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: "done" as const, result: data } : it)),
        );
        toast(`(${completed}/${batchFBItems.length}) 拆出 ${data.items.length} 件单品`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setBatchFBItems((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: "error" as const, error: msg } : it)),
        );
      }
    }

    setBusy(false);
    if (completed > 0) {
      toast(`批量处理完成: ${completed}/${batchFBItems.length} 张成功, 共 ${totalGarments} 件单品`);
    }
  }

  function handleRetryFBItem(index: number) {
    const item = batchFBItems[index];
    if (!item || item.status !== "error") return;

    setBatchFBItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, status: "uploading" as const, error: undefined } : it)),
    );

    uploadFullBody(item.file)
      .then((data) => {
        setBatchFBItems((prev) =>
          prev.map((it, idx) => (idx === index ? { ...it, status: "done" as const, result: data } : it)),
        );
        toast(`拆出 ${data.items.length} 件单品`);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        setBatchFBItems((prev) =>
          prev.map((it, idx) => (idx === index ? { ...it, status: "error" as const, error: msg } : it)),
        );
      });
  }

  function handleRemoveFBItem(index: number) {
    setBatchFBItems((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  }

  function handleClearBatchFB() {
    batchFBItems.forEach((item) => URL.revokeObjectURL(item.preview));
    setBatchFBItems([]);
    setError(null);
  }

  function handleModeChange(m: Mode) {
    setMode(m);
    // Clear state when switching modes
    setFile(null);
    setSingle(null);
    setFullBody(null);
    setError(null);
    if (m !== "batch") {
      handleClearBatch();
    }
    if (m !== "batch-full-body") {
      handleClearBatchFB();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "batch") {
      handleBatchUpload();
      return;
    }
    if (mode === "batch-full-body") {
      handleBatchFullBodyUpload();
      return;
    }
    if (!file) return;
    setBusy(true);
    setSingle(null);
    setFullBody(null);
    setError(null);
    try {
      if (mode === "full-body") {
        const data = await uploadFullBody(file);
        setFullBody(data);
        toast(`已拆出 ${data.items.length} 件单品`);
      } else {
        const data = await uploadSingleItem(file);
        setSingle(data);
        toast("已入衣橱");
        // Auto-redirect after 2s
        setTimeout(() => router.push("/wardrobe"), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const doneCount = batchItems.filter((it) => it.status === "done").length;
  const errorCount = batchItems.filter((it) => it.status === "error").length;
  const fbDoneCount = batchFBItems.filter((it) => it.status === "done").length;
  const fbErrorCount = batchFBItems.filter((it) => it.status === "error").length;
  const fbTotalGarments = batchFBItems.reduce((sum, it) => sum + (it.result?.items.length ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">上传衣物</h1>

      <div className="flex flex-wrap gap-2">
        <ModeButton current={mode} value="single" onSelect={handleModeChange}>
          单件衣物
        </ModeButton>
        <ModeButton current={mode} value="batch" onSelect={handleModeChange}>
          批量单件
        </ModeButton>
        <ModeButton current={mode} value="full-body" onSelect={handleModeChange}>
          全身照分部位
        </ModeButton>
        <ModeButton current={mode} value="batch-full-body" onSelect={handleModeChange}>
          批量全身照
        </ModeButton>
      </div>

      <p className="text-sm text-brand-700">
        {mode === "full-body"
          ? "上传一张穿搭照, AI 自动拆出上衣 / 外套 / 裤 / 鞋 / 包等单品, 一键入柜。配饰 (项链/手表等) 跳过。原图不存储。"
          : mode === "batch"
            ? "一次选择多张衣物图片, AI 逐个识别属性并入库。大图会自动压缩, 无需手动调小。"
            : mode === "batch-full-body"
              ? "一次选择多张穿搭照, AI 逐个拆分出单品并入库。每张照片可拆出多件衣物。"
              : "上传一件衣物的图, AI 识别类目和属性。大图会先在浏览器压缩, 无需手动调小。"}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "batch" ? (
          <>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer rounded-full border border-brand-300 px-4 py-2 text-sm transition hover:bg-brand-100">
                选择文件
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleBatchFiles(e.target.files)}
                />
              </label>
              {batchItems.length > 0 && (
                <span className="text-sm text-brand-600">
                  {batchItems.length} 张已选
                  {busy && ` · ${doneCount}/${batchItems.length} 已完成`}
                  {errorCount > 0 && ` · ${errorCount} 张失败`}
                </span>
              )}
            </div>

            {batchItems.length > 0 && (
              <div className="space-y-2">
                {batchItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-brand-200 bg-white p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.preview}
                      alt={item.file.name}
                      className="h-12 w-12 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{item.file.name}</p>
                      {item.error && (
                        <p className="truncate text-xs text-red-600">{item.error}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === "pending" && (
                        <span className="text-xs text-brand-400">待上传</span>
                      )}
                      {item.status === "uploading" && (
                        <span className="text-xs text-blue-600">上传中…</span>
                      )}
                      {item.status === "done" && (
                        <span className="text-xs text-green-600">✓ 完成</span>
                      )}
                      {item.status === "error" && (
                        <button
                          type="button"
                          onClick={() => handleRetrySingle(i)}
                          className="text-xs text-orange-600 underline"
                        >
                          重试
                        </button>
                      )}
                      {!busy && item.status !== "uploading" && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBatchItem(i)}
                          className="text-xs text-brand-400 hover:text-red-500"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {batchItems.length > 0 && !busy && (
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700"
                >
                  批量上传 ({batchItems.filter((it) => it.status !== "done").length} 张)
                </button>
                <button
                  type="button"
                  onClick={handleClearBatch}
                  className="rounded-full border border-brand-300 px-4 py-2.5 text-sm transition hover:bg-brand-100"
                >
                  清空
                </button>
              </div>
            )}
          </>
        ) : mode === "batch-full-body" ? (
          <>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer rounded-full border border-brand-300 px-4 py-2 text-sm transition hover:bg-brand-100">
                选择文件
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleBatchFBFiles(e.target.files)}
                />
              </label>
              {batchFBItems.length > 0 && (
                <span className="text-sm text-brand-600">
                  {batchFBItems.length} 张已选
                  {busy && ` · ${fbDoneCount}/${batchFBItems.length} 已完成`}
                  {fbErrorCount > 0 && ` · ${fbErrorCount} 张失败`}
                  {fbTotalGarments > 0 && ` · 共拆出 ${fbTotalGarments} 件`}
                </span>
              )}
            </div>

            {batchFBItems.length > 0 && (
              <div className="space-y-2">
                {batchFBItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-brand-200 bg-white p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.preview}
                      alt={item.file.name}
                      className="h-12 w-12 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{item.file.name}</p>
                      {item.error && (
                        <p className="truncate text-xs text-red-600">{item.error}</p>
                      )}
                      {item.result && item.result.items.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.result.items.map((g) => (
                            <span key={g.id} className="rounded bg-brand-100 px-1.5 py-0.5 text-xs text-brand-700">
                              {g.sub_category || g.category}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === "pending" && (
                        <span className="text-xs text-brand-400">待处理</span>
                      )}
                      {item.status === "uploading" && (
                        <span className="text-xs text-blue-600">识别中…</span>
                      )}
                      {item.status === "done" && (
                        <span className="text-xs text-green-600">✓ {item.result?.items.length} 件</span>
                      )}
                      {item.status === "error" && (
                        <button
                          type="button"
                          onClick={() => handleRetryFBItem(i)}
                          className="text-xs text-orange-600 underline"
                        >
                          重试
                        </button>
                      )}
                      {!busy && item.status !== "uploading" && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFBItem(i)}
                          className="text-xs text-brand-400 hover:text-red-500"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {batchFBItems.length > 0 && !busy && (
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700"
                >
                  批量处理 ({batchFBItems.filter((it) => it.status !== "done").length} 张)
                </button>
                <button
                  type="button"
                  onClick={handleClearBatchFB}
                  className="rounded-full border border-brand-300 px-4 py-2.5 text-sm transition hover:bg-brand-100"
                >
                  清空
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <input
              type="file"
              accept="image/*"
              capture={mode === "single" ? "environment" : undefined}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setSingle(null);
                setFullBody(null);
                setError(null);
              }}
              className="block w-full text-sm"
            />
            <button
              type="submit"
              disabled={!file || busy}
              className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? "处理中..." : "上传"}
            </button>
          </>
        )}
      </form>

      {busy && mode !== "batch" && mode !== "batch-full-body" && (
        <p className="text-sm text-brand-700">
          压缩 + AI 识别需要 5-15 秒，请耐心等待。如果网络断了，本页会自动等 90 秒去找结果。
        </p>
      )}

      {busy && mode === "batch" && (
        <p className="text-sm text-brand-700">
          正在逐个识别, 每张约 5-15 秒。已完成 {doneCount}/{batchItems.length} 张。
        </p>
      )}

      {busy && mode === "batch-full-body" && (
        <p className="text-sm text-brand-700">
          正在逐个拆分识别, 每张约 15-30 秒。已完成 {fbDoneCount}/{batchFBItems.length} 张, 共拆出 {fbTotalGarments} 件。
        </p>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {single && <GarmentResultCard g={single} />}

      {fullBody && <FullBodyResultPanel result={fullBody} />}

      {((mode === "batch" && doneCount > 0) || (mode === "batch-full-body" && fbDoneCount > 0)) && !busy && (
        <Link
          href="/wardrobe"
          className="inline-block rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700"
        >
          查看衣橱
        </Link>
      )}
    </div>
  );
}

function GarmentResultCard({ g }: { g: Garment }) {
  return (
    <div className="space-y-3 rounded-xl border border-brand-200 bg-white p-4">
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={g.image_url} alt={g.sub_category ?? g.category}
             className="h-32 w-32 rounded-lg object-cover" />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-medium">{g.sub_category || g.category}</span>
            <Badge>{zhCategory(g.category)}</Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            {(g.colors ?? []).map((c) => (
              <Badge key={c} dot>{zhColor(c)}</Badge>
            ))}
            {(g.season ?? []).map((s) => (
              <Badge key={s}>{zhSeason(s)}</Badge>
            ))}
            {g.material && <Badge>{zhMaterial(g.material)}</Badge>}
            {g.style && <Badge>{zhStyle(g.style)}</Badge>}
          </div>
          <p className="text-sm text-brand-600">2 秒后自动跳转到衣橱…</p>
        </div>
      </div>
    </div>
  );
}

function FullBodyResultPanel({ result }: { result: FullBodyResult }) {
  const { items, warnings } = result;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-brand-200 bg-white p-4">
        <h3 className="text-base font-medium">
          已拆出 {items.length} 件单品
        </h3>
      </div>

      {warnings.length > 0 && (
        <div className="rounded bg-yellow-50 p-3 text-sm text-yellow-900">
          <p className="font-medium">提示</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {warnings.map((w, i) => (<li key={i}>{w}</li>))}
          </ul>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {items.map((g) => (
            <div key={g.id} className="rounded-lg border border-brand-200 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={g.image_url}
                alt={g.sub_category ?? g.category}
                className="aspect-square w-full rounded object-cover"
              />
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-sm font-medium">
                  {g.sub_category || g.category}
                </span>
                <Badge>{CATEGORY_ZH[g.category] ?? g.category}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {(g.colors ?? []).map((c) => (
                  <Badge key={c} dot>{zhColor(c)}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/wardrobe"
        className="inline-block rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700"
      >
        查看衣橱
      </Link>
    </div>
  );
}

function ModeButton({
  current,
  value,
  onSelect,
  children,
}: {
  current: Mode;
  value: Mode;
  onSelect: (m: Mode) => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={
        "rounded-full border px-4 py-2 text-sm transition " +
        (active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-brand-300 hover:bg-brand-100")
      }
    >
      {children}
    </button>
  );
}
