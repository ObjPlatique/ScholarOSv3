"use client";

import Link from "next/link";
import { Bell, CalendarDays, CheckCircle2, Clock3, Flame, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { listUserDocuments } from "@/lib/firestore";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  href: string;
  icon: typeof Bell;
  priority: "high" | "normal";
};

type Doc = Record<string, unknown> & { id: string };

const dateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const todayLabel = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date());

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    try {
      setReadIds(JSON.parse(window.localStorage.getItem("scholaros-read-notifications") || "[]"));
    } catch {
      setReadIds([]);
    }
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [tasks, schedule, habits] = await Promise.all([
          listUserDocuments<Doc>(user.uid, "tasks"),
          listUserDocuments<Doc>(user.uid, "schedule"),
          listUserDocuments<Doc>(user.uid, "habits"),
        ]);
        if (cancelled) return;
        const today = dateKey();
        const result: NotificationItem[] = [];
        const text = (value: unknown) => String(value ?? "");

        tasks.forEach((task) => {
          const dueDate = text(task.dueDate || task.date);
          const completed = Boolean(task.completed || task.status === "completed" || task.status === "done");
          const title = text(task.title) || "Task";
          if (!completed && dueDate && dueDate < today) {
            result.push({ id: `overdue-${task.id}`, title: "Task quá hạn", message: `${title} đã quá hạn.`, href: "/tools/tasks", icon: Clock3, priority: "high" });
          } else if (!completed && dueDate === today) {
            result.push({ id: `today-${task.id}`, title: "Task đến hạn hôm nay", message: `${title} · ${todayLabel}`, href: "/tools/tasks", icon: CheckCircle2, priority: "high" });
          }
        });

        const day = new Date().getDay();
        schedule.filter((entry) => Number(entry.day) === day).forEach((entry) => {
          const title = text(entry.title) || text(entry.subject) || "Buổi học";
          const start = text(entry.startTime);
          result.push({ id: `schedule-${entry.id}`, title: "Lịch học hôm nay", message: `${title}${start ? ` · ${start}` : ""}`, href: "/tools/schedule", icon: CalendarDays, priority: "normal" });
        });

        habits.forEach((habit) => {
          const title = text(habit.title) || text(habit.name) || "Habit";
          const completedDates = Array.isArray(habit.completedDates) ? habit.completedDates.map(String) : [];
          if (!completedDates.includes(today) && habit.paused !== true) {
            result.push({ id: `habit-${habit.id}-${today}`, title: "Habit chưa hoàn thành", message: `${title} · hôm nay`, href: "/tools/habits", icon: Flame, priority: "normal" });
          }
        });

        result.sort((a, b) => Number(b.priority === "high") - Number(a.priority === "high"));
        setItems(result.slice(0, 30));
      } catch {
        setItems([]);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user]);

  const unread = useMemo(() => items.filter((item) => !readIds.includes(item.id)), [items, readIds]);

  const markRead = (id: string) => {
    setReadIds((current) => {
      const next = current.includes(id) ? current : [...current, id].slice(-200);
      window.localStorage.setItem("scholaros-read-notifications", JSON.stringify(next));
      return next;
    });
  };

  const markAllRead = () => {
    const next = Array.from(new Set([...readIds, ...items.map((item) => item.id)])).slice(-200);
    setReadIds(next);
    window.localStorage.setItem("scholaros-read-notifications", JSON.stringify(next));
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Notifications" aria-expanded={open} className="relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-700 transition hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-[#555555]">
        <Bell size={19} />
        {unread.length > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{unread.length > 9 ? "9+" : unread.length}</span>}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close notifications" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-[#404040]">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-slate-600">
              <div><h3 className="font-bold text-gray-950 dark:text-white">Notifications</h3><p className="text-xs text-gray-500 dark:text-gray-300">{unread.length} chưa đọc</p></div>
              <div className="flex items-center gap-1">
                {items.length > 0 && <button type="button" onClick={markAllRead} className="rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-[#555555]">Đọc tất cả</button>}
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-[#555555]"><X size={17} /></button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {items.length === 0 && <div className="px-4 py-10 text-center"><Bell className="mx-auto mb-3 text-gray-300" size={30} /><p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Không có thông báo</p><p className="mt-1 text-xs text-gray-400">ScholarOS sẽ hiển thị thông báo liên quan đến việc học của bạn.</p></div>}
              {items.map((item) => {
                const Icon = item.icon;
                const isUnread = !readIds.includes(item.id);
                return <Link key={item.id} href={item.href} onClick={() => { markRead(item.id); setOpen(false); }} className={`flex gap-3 rounded-xl p-3 transition hover:bg-gray-100 dark:hover:bg-[#555555] ${isUnread ? "bg-indigo-50/70 dark:bg-indigo-950/30" : ""}`}>
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.priority === "high" ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300" : "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"}`}><Icon size={18} /></span>
                  <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{item.title}</span>{isUnread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" />}</span><span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-300">{item.message}</span></span>
                </Link>;
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
