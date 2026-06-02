// Backend API client。
// TODO: 用 openapi-typescript 从 ../openapi/wardrobe.openapi.yaml 生成类型，
// 当前手写最小定义以让骨架编译通过。

const BASE = "/api/backend";

export type GarmentCategory =
  | "top"
  | "outerwear"
  | "bottom"
  | "dress"
  | "shoes"
  | "bag"
  | "accessory"
  | "other";

export interface Garment {
  id: string;
  category: GarmentCategory;
  sub_category?: string;
  colors?: string[];
  season?: string[];
  material?: string;
  style?: string;
  image_url: string;
  thumbnail_url?: string;
  wear_count: number;
  purchase_price?: number;
  purchase_link?: string;
  note?: string;
  created_at: string;
}

export interface FullBodyResult {
  items: Garment[];
  warnings: string[];
}

export interface OutfitSuggestion {
  name: string;
  reason: string;
  garment_ids: string[];
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

/**
 * 浏览器端压缩上传图,降低跨境上传时长 + 减小 AI 服务接收的图大小。
 * - 长边 maxDim 默认 1024px (足够识别衣物属性)
 * - JPEG quality 0.8 → 多数原图 → ~150-400 KB
 * - 原图本来就小 (< 200KB 或 < maxDim) → 原样返回,避免无谓重压
 */
export async function compressImage(file: File, maxDim = 1024, quality = 0.8): Promise<File> {
  if (file.size < 200 * 1024) return file;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      resolve(im);
    };
    im.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取图片: " + String(e)));
    };
    im.src = url;
  });

  const longSide = Math.max(img.width, img.height);
  if (longSide <= maxDim) return file;

  const scale = maxDim / longSide;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob 返回 null"))),
      "image/jpeg",
      quality,
    );
  });
  return new File([blob], (file.name.replace(/\.[^.]+$/, "") || "upload") + ".jpg", {
    type: "image/jpeg",
  });
}

/** 取最近的衣物列表 - 用于上传失败时探活 (server 可能已经识别完了) */
export async function listGarmentsSnapshot(): Promise<Set<string>> {
  try {
    const items = await listGarments();
    return new Set(items.map((g) => g.id));
  } catch {
    return new Set();
  }
}

/** 上传若失败 (网络断流 / 5xx 代理错 / 客户端超时),先直接重试 N 次,再退化到轮询列表 */
async function uploadWithRecovery<T extends { id: string }>(
  uploadFn: () => Promise<T>,
  beforeIds: Set<string>,
  pollIntervalMs = 5000,
  deadlineMs = 90000,
  maxRetries = 1,
): Promise<T | null> {
  // 第 1 次 + 重试 maxRetries 次直接上传
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await uploadFn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 这些都算"可能后端已经成功了, 只是前端没拿到响应"的错误:
      // - TypeError: Failed to fetch (移动网络中途断)
      // - AbortError (我们自己 abort 或浏览器 idle 切)
      // - 5xx (Next.js proxy 报 socket hang up / ECONNRESET 时返 500;
      //   但 backend 可能已落库 → 后面 polling 能捞到)
      const isTransient =
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("ECONNRESET") ||
        msg.includes("socket hang up") ||
        msg.includes("failed: 500") ||
        msg.includes("failed: 502") ||
        msg.includes("failed: 503") ||
        msg.includes("failed: 504") ||
        (err instanceof DOMException && err.name === "AbortError");
      if (!isTransient) throw err; // 业务错误 (401/400/413/422) 直接抛
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      // 用尽重试 → 进恢复轮询
    }
  }
  // 轮询找新增 garment (后端可能已经处理完, Next/Caddy 那段失联)
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    const items = await listGarments().catch(() => []);
    const fresh = items.find((g) => !beforeIds.has(g.id));
    if (fresh) return fresh as unknown as T;
  }
  return null;
}

export async function listGarments(): Promise<Garment[]> {
  return getJson<Garment[]>("/garments");
}

export async function uploadSingleItem(file: File): Promise<Garment> {
  const compressed = await compressImage(file);
  const beforeIds = await listGarmentsSnapshot();
  const recovered = await uploadWithRecovery<Garment>(
    async () => {
      const form = new FormData();
      form.append("file", compressed);
      return postForm<Garment>("/garments", form);
    },
    beforeIds,
    5000,
    90000,
    2,  // 直接重试 2 次再退化到轮询
  );
  if (!recovered) throw new Error("网络中断且 90 秒内未在服务器找到新条目,请稍后再试或刷新衣柜查看");
  return recovered;
}

export async function getGarment(id: string): Promise<Garment> {
  const res = await fetch(`${BASE}/garments/${id}`, { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET garment failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<Garment>;
}

export interface GarmentUpdate {
  category?: string;
  sub_category?: string | null;
  colors?: string[] | null;
  season?: string[] | null;
  material?: string | null;
  style?: string | null;
  wear_count?: number;
  purchase_price?: number | null;
  purchase_link?: string | null;
  note?: string | null;
}

export async function updateGarment(id: string, patch: GarmentUpdate): Promise<Garment> {
  const res = await fetch(`${BASE}/garments/${id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PATCH garment failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<Garment>;
}

export async function deleteGarment(id: string): Promise<void> {
  const res = await fetch(`${BASE}/garments/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`DELETE garment failed: ${res.status} ${text}`);
  }
}

export async function uploadFullBody(file: File): Promise<FullBodyResult> {
  const compressed = await compressImage(file);
  const beforeIds = await listGarmentsSnapshot();
  const form = new FormData();
  form.append("file", compressed);
  // Retry transient failures, then poll for new garments
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      return await postForm<FullBodyResult>("/garments/from-full-body", form);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("ECONNRESET") ||
        msg.includes("socket hang up") ||
        msg.includes("failed: 5") ||
        (err instanceof DOMException && err.name === "AbortError");
      if (!isTransient || attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  // Poll: backend may have processed but response was lost
  const start = Date.now();
  while (Date.now() - start < 120000) {
    await new Promise((r) => setTimeout(r, 5000));
    const items = await listGarments().catch(() => []);
    const newItems = items.filter((g) => !beforeIds.has(g.id));
    if (newItems.length > 0) {
      return { items: newItems, warnings: ["网络中断但服务端已处理完成，已自动恢复"] };
    }
  }
  throw new Error("网络中断且 120 秒内未在服务器找到新条目，请刷新衣柜查看");
}

export async function suggestOutfits(count = 3): Promise<OutfitSuggestion[]> {
  const res = await fetch(`${BASE}/outfits/suggest?count=${count}`, {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST /outfits/suggest failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<OutfitSuggestion[]>;
}

/* ---------- auth ---------- */

export interface Me {
  ok: boolean;
  user_id: string;
  username: string;
  nickname?: string | null;
  created_at?: string | null;
}

export async function checkAuth(): Promise<Me | null> {
  try {
    const res = await fetch(`${BASE}/auth/me`, { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Me;
  } catch {
    return null;
  }
}

async function postJson(path: string, body: object): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text;
    try {
      detail = JSON.parse(text).detail ?? text;
    } catch {}
    throw new Error(detail || `${path} 失败 (${res.status})`);
  }
  return res.json();
}

export async function login(username: string, password: string): Promise<void> {
  await postJson("/auth/login", { username, password });
}

export async function register(invite_code: string, username: string, password: string): Promise<void> {
  await postJson("/auth/register", { invite_code, username, password });
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, {
    method: "POST",
    credentials: "same-origin",
  });
}

/* ---------- export ---------- */

export function exportData(): void {
  // 直接触发浏览器下载，不需要 fetch 解析
  window.location.href = `${BASE}/export`;
}

/* ---------- admin ---------- */

export interface AdminUser {
  id: string;
  username: string;
  nickname?: string | null;
  created_at?: string | null;
  last_login_at?: string | null;
  garment_count: number;
}

export interface AdminStats {
  user_count: number;
  garment_count: number;
  categories: Record<string, number>;
  upload_files: number;
  upload_size_mb: number;
}

export interface AdminGarmentDetail {
  id: string;
  category: string;
  sub_category?: string | null;
  colors?: string[] | null;
  season?: string[] | null;
  material?: string | null;
  style?: string | null;
  image_url: string;
  wear_count: number;
  purchase_price?: number | null;
  created_at?: string | null;
  file_size_kb: number;
}

export interface AdminUserDetail {
  user: AdminUser;
  garments: AdminGarmentDetail[];
  total_size_mb: number;
}

export async function adminLogin(password: string): Promise<void> {
  const res = await fetch(`${BASE}/admin/login`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `管理员登录失败 (${res.status})`);
  }
}

export async function adminGetStats(): Promise<AdminStats> {
  const res = await fetch(`${BASE}/admin/stats`, { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error(`获取统计失败: ${res.status}`);
  return res.json();
}

export async function adminGetUsers(): Promise<AdminUser[]> {
  const res = await fetch(`${BASE}/admin/users`, { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error(`获取用户列表失败: ${res.status}`);
  const data = await res.json();
  return data.users;
}

export async function adminGetUserDetail(username: string): Promise<AdminUserDetail> {
  const res = await fetch(`${BASE}/admin/users/${encodeURIComponent(username)}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`获取用户详情失败: ${res.status}`);
  return res.json();
}

/* ---------- wear log ---------- */

export interface WearLogMonth {
  month: string;
  days: Record<string, string[]>; // "2026-05-28" → ["garment_id1", "id2"]
}

export interface WearStats {
  top: { id: string; sub_category: string | null; category: string; image_url: string; wear_count: number }[];
  week: Record<string, number>; // "2026-05-28" → count
  total_wears: number;
}

export async function recordWear(garmentIds: string[], date?: string): Promise<{ ok: boolean; added: number; date: string }> {
  const res = await fetch(`${BASE}/wearlog`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ garment_ids: garmentIds, date }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`记录穿搭失败: ${res.status} ${text}`);
  }
  return res.json();
}

export async function getWearLog(month?: string): Promise<WearLogMonth> {
  const qs = month ? `?month=${month}` : "";
  const res = await fetch(`${BASE}/wearlog${qs}`, { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error(`获取穿搭记录失败: ${res.status}`);
  return res.json();
}

export async function getWearStats(): Promise<WearStats> {
  const res = await fetch(`${BASE}/wearlog/stats`, { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error(`获取穿搭统计失败: ${res.status}`);
  return res.json();
}
