"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { checkAuth, login, logout, register, type Me } from "@/lib/api";

type Mode = "login" | "register";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = loading
  const [mode, setMode] = useState<Mode>("login");
  const [invite, setInvite] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const m = await checkAuth();
    setMe(m);
  }

  useEffect(() => {
    refresh();
  }, []);

  // 管理后台有自己的鉴权, 不走 AuthGate
  if (pathname.startsWith("/admin")) return <>{children}</>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        if (!invite.trim()) {
          setError("请输入邀请码");
          setBusy(false);
          return;
        }
        await register(invite.trim(), username.trim(), password);
      }
      setPassword("");
      setInvite("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (me === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-brand-700">加载中…</div>
    );
  }

  if (!me) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl bg-white/85 p-6 shadow-soft ring-1 ring-brand-100 backdrop-blur">
          <div className="mb-4 flex gap-1 rounded-full bg-brand-50/70 p-1 text-sm ring-1 ring-brand-100">
            <TabButton active={mode === "login"} onClick={() => { setMode("login"); setError(null); }}>
              登录
            </TabButton>
            <TabButton active={mode === "register"} onClick={() => { setMode("register"); setError(null); }}>
              注册
            </TabButton>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <Field label="邀请码">
                <input
                  type="text"
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  className="w-full rounded-lg border border-brand-200 bg-white/90 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  placeholder="跟管理员要"
                />
              </Field>
            )}

            <Field label="用户名">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full rounded-lg border border-brand-200 bg-white/90 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                placeholder={mode === "register" ? "3-32 位, 字母/数字/中文/_" : "用户名"}
              />
            </Field>

            <Field label="密码">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full rounded-lg border border-brand-200 bg-white/90 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                placeholder={mode === "register" ? "至少 6 位" : "密码"}
              />
            </Field>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy || !username.trim() || !password}
              className="w-full rounded-full bg-brand-600 px-4 py-2 font-medium text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? (mode === "login" ? "登录中…" : "注册中…") : (mode === "login" ? "登录" : "注册")}
            </button>

            <p className="text-center text-xs text-brand-700/70">
              {mode === "login"
                ? "没有账号? 用邀请码 "
                : "已有账号? "}
              <button
                type="button"
                onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
                className="text-brand-700 underline"
              >
                {mode === "login" ? "去注册" : "去登录"}
              </button>
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-end gap-3 text-xs text-brand-700/80">
        <span>
          欢迎, <span className="font-medium text-brand-900">{me.nickname || me.username}</span>
        </span>
        <button
          onClick={async () => {
            await logout();
            await refresh();
          }}
          className="rounded-full px-2 py-0.5 text-brand-700/80 underline hover:text-brand-900"
        >
          退出
        </button>
      </div>
      {children}
    </>
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex-1 rounded-full px-3 py-1.5 transition " +
        (active ? "bg-white text-brand-900 shadow-sm" : "text-brand-700 hover:text-brand-900")
      }
    >
      {children}
    </button>
  );
}
