"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getWearLog, getWearStats, listGarments, type Garment, type WearLogMonth, type WearStats } from "@/lib/api";
import { zhCategory } from "@/lib/i18n";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export default function CalendarPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [wearLog, setWearLog] = useState<WearLogMonth | null>(null);
  const [stats, setStats] = useState<WearStats | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getWearLog(month), getWearStats(), listGarments()])
      .then(([log, s, g]) => {
        setWearLog(log);
        setStats(s);
        setGarments(g);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [month]);

  const garmentMap = useMemo(() => {
    const m: Record<string, Garment> = {};
    for (const g of garments) m[g.id] = g;
    return m;
  }, [garments]);

  const days = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0);
    const daysInMonth = lastDay.getDate();
    // Monday=0, Sunday=6
    let startWeekday = firstDay.getDay() - 1;
    if (startWeekday < 0) startWeekday = 6;

    const cells: { date: string; day: number; isCurrentMonth: boolean }[] = [];
    // Previous month padding
    const prevLast = new Date(y, m - 1, 0);
    for (let i = startWeekday - 1; i >= 0; i--) {
      cells.push({ date: "", day: prevLast.getDate() - i, isCurrentMonth: false });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        day: d,
        isCurrentMonth: true,
      });
    }
    // Next month padding
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        cells.push({ date: "", day: d, isCurrentMonth: false });
      }
    }
    return cells;
  }, [month]);

  function prevMonth() {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function nextMonth() {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const [year, mon] = month.split("-").map(Number);
  const monthLabel = `${year} 年 ${mon} 月`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">穿搭日历</h1>
      </div>

      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {/* 使用说明 */}
      <div className="rounded-2xl bg-brand-50/60 p-4 text-sm text-brand-700 ring-1 ring-brand-100">
        <p className="mb-1 font-medium text-brand-800">使用方法</p>
        <ul className="space-y-1 text-xs">
          <li>👔 在<Link href="/wardrobe" className="text-brand-600 underline">衣橱</Link>页面，鼠标悬停卡片右上角，点击 👔 记录今天穿了这件</li>
          <li>📅 本页日历会显示每天穿过的衣物缩略图</li>
          <li>📊 下方统计展示最常穿 Top 10 和最近 7 天穿次</li>
          <li>🔄 切换月份查看历史穿搭记录</li>
        </ul>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="rounded-full p-2 text-brand-600 hover:bg-brand-100/70">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="13 4 7 10 13 16" /></svg>
        </button>
        <span className="text-base font-medium text-brand-800">{monthLabel}</span>
        <button onClick={nextMonth} className="rounded-full p-2 text-brand-600 hover:bg-brand-100/70">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="7 4 13 10 7 16" /></svg>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl bg-white/85 p-4 ring-1 ring-brand-100 shadow-card">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-xs font-medium text-brand-500">{w}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((cell, i) => {
            const wornIds = cell.date ? (wearLog?.days[cell.date] ?? []) : [];
            const isToday = cell.date === today;
            return (
              <div
                key={i}
                className={`min-h-[60px] rounded-lg p-1 text-xs transition ${
                  !cell.isCurrentMonth
                    ? "text-brand-300"
                    : isToday
                    ? "bg-brand-100 ring-1 ring-brand-400"
                    : "text-brand-700"
                }`}
              >
                <span className={`block text-right text-[10px] ${isToday ? "font-bold text-brand-600" : ""}`}>
                  {cell.day}
                </span>
                {wornIds.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-0.5">
                    {wornIds.slice(0, 3).map((gid) => {
                      const g = garmentMap[gid];
                      return g ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={gid}
                          src={g.thumbnail_url ?? g.image_url}
                          alt={g.sub_category ?? g.category}
                          className="h-6 w-6 rounded object-cover"
                          title={g.sub_category || zhCategory(g.category)}
                        />
                      ) : null;
                    })}
                    {wornIds.length > 3 && (
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-brand-200 text-[9px] text-brand-600">
                        +{wornIds.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Total */}
          <div className="rounded-2xl bg-white/85 p-5 ring-1 ring-brand-100 shadow-card">
            <h2 className="mb-3 text-sm font-semibold text-brand-700">总穿次</h2>
            <p className="text-3xl font-bold text-brand-900">{stats.total_wears}</p>
          </div>

          {/* Week chart */}
          <div className="rounded-2xl bg-white/85 p-5 ring-1 ring-brand-100 shadow-card">
            <h2 className="mb-3 text-sm font-semibold text-brand-700">最近 7 天</h2>
            <div className="flex items-end gap-1" style={{ height: 60 }}>
              {Array.from({ length: 7 }).map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - 6 + i);
                const key = d.toISOString().slice(0, 10);
                const cnt = stats.week[key] ?? 0;
                const maxCnt = Math.max(...Object.values(stats.week), 1);
                const h = Math.max(4, (cnt / maxCnt) * 50);
                return (
                  <div key={key} className="flex flex-1 flex-col items-center gap-0.5">
                    <span className="text-[9px] text-brand-500">{cnt || ""}</span>
                    <div
                      className="w-full rounded-t bg-brand-400 transition-all"
                      style={{ height: h }}
                    />
                    <span className="text-[9px] text-brand-400">{key.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top worn */}
          {stats.top.length > 0 && (
            <div className="rounded-2xl bg-white/85 p-5 ring-1 ring-brand-100 shadow-card md:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-brand-700">最常穿 Top 10</h2>
              <div className="space-y-2">
                {stats.top.map((g, i) => {
                  const maxWear = stats.top[0]?.wear_count ?? 1;
                  const pct = Math.round((g.wear_count / maxWear) * 100);
                  return (
                    <Link key={g.id} href={`/wardrobe/${g.id}`} className="flex items-center gap-3 group">
                      <span className="w-5 text-right text-xs text-brand-400">{i + 1}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm text-brand-800 group-hover:text-brand-600">
                          {g.sub_category || zhCategory(g.category)}
                        </p>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-brand-100">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-sm font-medium text-brand-600">{g.wear_count} 次</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
