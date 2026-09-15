"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

type ProgressItem = {
  label: string;
  value: number;
};

const toolLinks = [
  { href: "/tools/schedule", label: "Lịch học", icon: "▣", note: "Xem lịch của bạn" },
  { href: "/tools/tasks", label: "Nhiệm vụ", icon: "✓", note: "Theo dõi việc cần làm" },
  { href: "/tools/habits", label: "Thói quen", icon: "↗", note: "Giữ nhịp học tập" },
  { href: "/tools/notes", label: "Ghi chú", icon: "▤", note: "Lưu ý tưởng và kiến thức" },
  { href: "/tools/pomodoro", label: "Pomodoro", icon: "◷", note: "Bắt đầu một phiên học" },
];

const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function getProgress(now: Date): ProgressItem[] {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day - 1)).getTime();
  const endOfWeek = startOfWeek + 7 * 24 * 60 * 60 * 1000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const quarter = Math.floor(now.getMonth() / 3);
  const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1).getTime();
  const endOfQuarter = new Date(now.getFullYear(), quarter * 3 + 3, 1).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
  const endOfYear = new Date(now.getFullYear() + 1, 0, 1).getTime();
  const percent = (start: number, end: number) => Math.min(100, Math.max(0, ((now.getTime() - start) / (end - start)) * 100));

  return [
    { label: "Ngày", value: percent(startOfDay, endOfDay) },
    { label: "Tuần", value: percent(startOfWeek, endOfWeek) },
    { label: "Tháng", value: percent(startOfMonth, endOfMonth) },
    { label: "Quý", value: percent(startOfQuarter, endOfQuarter) },
    { label: "Năm", value: percent(startOfYear, endOfYear) },
  ];
}

function Calendar({ now }: { now: Date }) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Lịch tháng</h2>
          <p className="mt-1 text-sm text-slate-500">
            {now.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}
          </p>
        </div>
        <span className="rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">Hôm nay</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400">
        {weekdays.map((weekday) => <div key={weekday} className="py-2">{weekday}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => (
          <div key={`${day}-${index}`} className="flex aspect-square items-center justify-center">
            {day ? (
              <span className={day === today ? "flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white" : "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-slate-700 hover:bg-slate-100"}>
                {day}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardView() {
  const [now, setNow] = useState(() => new Date());
  const [user, setUser] = useState<User | null>(auth.currentUser);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => {
      window.clearInterval(timer);
      unsubscribe();
    };
  }, []);

  const progress = useMemo(() => getProgress(now), [now]);
  const greetingName = user?.displayName?.split(" ")[0] || "bạn";
  const dateText = now.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeText = now.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <main className="min-h-screen bg-[#f7f8fc]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-indigo-600">Tools · Dashboard</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Chào {greetingName} 👋
              </h1>
              <p className="mt-2 text-base text-slate-600">{dateText}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4 text-left lg:min-w-64 lg:text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Thời gian hiện tại</p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-950">{timeText}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {progress.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-700">{item.label}</span>
                <span className="text-sm font-bold text-indigo-600">{Math.round(item.value)}%</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-500 transition-[width] duration-500" style={{ width: `${item.value}%` }} />
              </div>
            </div>
          ))}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_1.4fr]">
          <Calendar now={now} />

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Truy cập nhanh</h2>
                <p className="mt-1 text-sm text-slate-500">Đi thẳng đến công cụ bạn cần.</p>
              </div>
              <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">TOOLS</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {toolLinks.map((tool) => (
                <Link key={tool.href} href={tool.href} className="group rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50/40">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-lg font-bold text-indigo-600">{tool.icon}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 group-hover:text-indigo-700">{tool.label}</p>
                      <p className="mt-1 text-sm text-slate-500">{tool.note}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-indigo-600">Today's Focus</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">Chưa có nhiệm vụ hôm nay</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">Tasks và Schedule sẽ cung cấp dữ liệu cho khu vực này khi các module đó được xây dựng.</p>
            </div>
            <Link href="/tools/tasks" className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700">
              Mở Tasks
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
