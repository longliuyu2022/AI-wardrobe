"use client";

import { useEffect, useState } from "react";

import {
  adminLogin,
  adminGetStats,
  adminGetUsers,
  adminGetUserDetail,
  type AdminStats,
  type AdminUser,
  type AdminUserDetail,
} from "@/lib/api";
import { zhCategory, zhColor, zhSeason, zhMaterial, zhStyle } from "@/lib/i18n";

type View = "login" | "dashboard" | "user-detail";

export default function AdminPage() {
  const [view, setView] = useState<View>("login");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dashboard state
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);

  // User detail state
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await adminLogin(password.trim());
      await loadDashboard();
      setView("dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function loadDashboard() {
    try {
      const [s, u] = await Promise.all([adminGetStats(), adminGetUsers()]);
      setStats(s);
      setUsers(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadUserDetail(username: string) {
    try {
      setError(null);
      const d = await adminGetUserDetail(username);
      setUserDetail(d);
      setSelectedUser(username);
      setView("user-detail");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // Try auto-login on mount
  useEffect(() => {
    adminGetStats()
      .then((s) => {
        setStats(s);
        adminGetUsers().then(setUsers);
        setView("dashboard");
      })
      .catch(() => {}); // Not logged in, show login form
  }, []);

  if (view === "login") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 rounded-2xl bg-white/85 p-6 shadow-soft ring-1 ring-brand-100">
          <h1 className="text-xl font-semibold text-brand-900">管理员后台</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="管理员密码"
            className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            autoFocus
          />
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          <button
            type="submit"
            disabled={busy || !password.trim()}
            className="w-full rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "验证中…" : "登录"}
          </button>
        </form>
      </div>
    );
  }

  if (view === "user-detail" && userDetail) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => { setView("dashboard"); setUserDetail(null); setSelectedUser(null); }}
          className="text-sm text-brand-600 underline"
        >
          ← 返回用户列表
        </button>

        <div className="rounded-2xl bg-white/85 p-5 ring-1 ring-brand-100 shadow-card">
          <h2 className="text-xl font-semibold">{userDetail.user.username}</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-brand-700 md:grid-cols-4">
            <p>昵称: {userDetail.user.nickname || "-"}</p>
            <p>衣物: {userDetail.garments.length} 件</p>
            <p>注册: {userDetail.user.created_at ? new Date(userDetail.user.created_at).toLocaleString("zh-CN") : "-"}</p>
            <p>最后登录: {userDetail.user.last_login_at ? new Date(userDetail.user.last_login_at).toLocaleString("zh-CN") : "-"}</p>
          </div>
          <p className="mt-1 text-xs text-brand-500">图片占用: {userDetail.total_size_mb} MB · ID: {userDetail.user.id.slice(0, 12)}…</p>
        </div>

        {userDetail.garments.length === 0 ? (
          <p className="text-center text-brand-500">该用户暂无衣物数据</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {userDetail.garments.map((g) => (
              <div key={g.id} className="overflow-hidden rounded-2xl bg-white/85 ring-1 ring-brand-100 shadow-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.image_url}
                  alt={g.sub_category ?? g.category}
                  className="aspect-square w-full object-cover"
                />
                <div className="space-y-1 p-3">
                  <p className="text-sm font-medium">{g.sub_category || zhCategory(g.category)}</p>
                  <p className="text-xs text-brand-500">
                    {zhCategory(g.category)} · {g.file_size_kb} KB
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(g.colors ?? []).map((c) => (
                      <span key={c} className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] text-brand-600">{zhColor(c)}</span>
                    ))}
                    {(g.season ?? []).map((s) => (
                      <span key={s} className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] text-brand-600">{zhSeason(s)}</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-brand-400">
                    {g.created_at ? new Date(g.created_at).toLocaleString("zh-CN") : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Dashboard
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">管理后台</h1>
        <button
          onClick={loadDashboard}
          className="rounded-full px-3 py-1 text-sm text-brand-700 hover:bg-brand-100/70"
        >
          刷新
        </button>
      </div>

      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="注册用户" value={stats.user_count} />
          <StatCard label="衣物总数" value={stats.garment_count} />
          <StatCard label="图片文件" value={stats.upload_files} />
          <StatCard label="图片占用" value={`${stats.upload_size_mb} MB`} />
        </div>
      )}

      {stats && Object.keys(stats.categories).length > 0 && (
        <div className="rounded-2xl bg-white/85 p-5 ring-1 ring-brand-100">
          <h2 className="mb-3 text-sm font-semibold text-brand-700">分类分布</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.categories).map(([cat, cnt]) => (
              <span key={cat} className="rounded-full bg-brand-100 px-3 py-1 text-xs text-brand-700">
                {zhCategory(cat)} ({cnt})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white/85 ring-1 ring-brand-100">
        <div className="border-b border-brand-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-brand-700">用户列表</h2>
        </div>
        {users.length === 0 ? (
          <p className="p-5 text-center text-sm text-brand-500">暂无用户</p>
        ) : (
          <div className="divide-y divide-brand-50">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => loadUserDetail(u.username)}
                className="flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-brand-50/50"
              >
                <div>
                  <p className="text-sm font-medium text-brand-900">{u.username}</p>
                  <p className="text-xs text-brand-500">
                    {u.nickname && u.nickname !== u.username ? `${u.nickname} · ` : ""}
                    注册: {u.created_at ? new Date(u.created_at).toLocaleDateString("zh-CN") : "-"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-brand-700">{u.garment_count} 件</p>
                  <p className="text-xs text-brand-400">
                    {u.last_login_at ? `登录: ${new Date(u.last_login_at).toLocaleDateString("zh-CN")}` : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white/85 p-4 ring-1 ring-brand-100 shadow-card">
      <p className="text-2xl font-semibold text-brand-900">{value}</p>
      <p className="text-xs text-brand-600">{label}</p>
    </div>
  );
}
