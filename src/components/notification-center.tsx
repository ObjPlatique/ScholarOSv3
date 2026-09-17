"use client";

import Link from "next/link";
import { Bell, CalendarDays, Check, Clock3, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { listUserDocuments } from "@/lib/firestore";

type Doc = Record<string, unknown> & { id: string };
type Notice = { id: string; title: string; message: string; href: string; kind: "deadline" | "schedule"; at: number };
type Settings = { deadline: boolean; schedule: boolean; browser: boolean };

const SETTINGS_KEY = "scholaros-notification-settings";
const READ_KEY = "scholaros-read-notifications";
const DEFAULTS: Settings = { deadline: true, schedule: true, browser: false };
const text = (v: unknown) => String(v ?? "");

function parseDate(v: unknown) { const n = new Date(text(v)).getTime(); return Number.isFinite(n) ? n : null; }
function nextClass(day: number, startTime: string, now = new Date()) {
  if (!/^\d{1,2}:\d{2}$/.test(startTime)) return null;
  const [h, m] = startTime.split(":").map(Number);
  const d = new Date(now);
  d.setDate(now.getDate() + ((day - now.getDay() + 7) % 7));
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
  return d.getTime();
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [items, setItems] = useState<Notice[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    try { setSettings({ ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") }); } catch {}
    try { setRead(JSON.parse(localStorage.getItem(READ_KEY) || "[]")); } catch {}
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const now = Date.now();
      try {
        const [tasks, schedule] = await Promise.all([
          listUserDocuments<Doc>(user.uid, "tasks"),
          listUserDocuments<Doc>(user.uid, "schedule"),
        ]);
        const result: Notice[] = [];
        if (settings.deadline) {
          const limit = now + 24 * 60 * 60 * 1000;
          tasks.forEach((task) => {
            if (task.completed === true || task.status === "completed" || task.status === "done") return;
            const due = parseDate(task.dueDate) ?? parseDate(task.deadline) ?? parseDate(task.date);
            if (due !== null && due >= now && due <= limit) {
              const title = text(task.title) || "Task";
              result.push({ id: `deadline-${task.id}-${Math.floor(due / 60000)}`, title: "Deadline trong 24 giờ", message: `${title} · ${new Date(due).toLocaleString("vi-VN")}`, href: "/tools/tasks", kind: "deadline", at: due });
            }
          });
        }
        if (settings.schedule) {
          const limit = now + 60 * 60 * 1000;
          schedule.forEach((entry) => {
            const at = nextClass(Number(entry.day), text(entry.startTime), new Date(now));
            if (at !== null && at > now && at <= limit) {
              const title = text(entry.title) || text(entry.subject) || "Buổi học";
              result.push({ id: `schedule-${entry.id}-${Math.floor(at / 60000)}`, title: "Lịch học trong 1 giờ", message: `${title} · ${text(entry.startTime)}${text(entry.location) ? ` · ${text(entry.location)}` : ""}`, href: "/tools/schedule", kind: "schedule", at });
            }
          });
        }
        result.sort((a, b) => a.at - b.at);
        if (!cancelled) setItems(result.slice(0, 30));
      } catch { if (!cancelled) setItems([]); }
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [user, settings.deadline, settings.schedule]);

  const unread = useMemo(() => items.filter((item) => !read.includes(item.id)), [items, read]);
  const save = (next: Settings) => { setSettings(next); localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); };
  const markRead = (id: string) => { const next = Array.from(new Set([...read, id])).slice(-200); setRead(next); localStorage.setItem(READ_KEY, JSON.stringify(next)); };
  const markAll = () => { const next = Array.from(new Set([...read, ...items.map((i) => i.id)])).slice(-200); setRead(next); localStorage.setItem(READ_KEY, JSON.stringify(next)); };

  const enableBrowser = async () => {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    save({ ...settings, browser: permission === "granted" });
  };

  useEffect(() => {
    if (!settings.browser || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const now = Date.now();
    unread.filter((n) => n.at > now && n.at - now <= 60 * 60 * 1000).slice(0, 3).forEach((n) => {
      const sentKey = `scholaros-sent-${n.id}`;
      if (localStorage.getItem(sentKey)) return;
      new Notification(n.title, { body: n.message, tag: n.id });
      localStorage.setItem(sentKey, "1");
    });
  }, [settings.browser, unread]);

  return <div className="relative w-full">
    <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Notifications" aria-expanded={open} className="relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-[#555555]">
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center"><Bell size={19} />{unread.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{unread.length > 9 ? "9+" : unread.length}</span>}</span>
      <span className="truncate">Notifications</span>
    </button>
    {open && <><button aria-label="Đóng thông báo" className="fixed inset-0 z-40 cursor-default md:hidden" onClick={() => setOpen(false)} /><div className="fixed left-3 right-3 top-20 z-50 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-[#404040] md:absolute md:bottom-full md:left-0 md:right-auto md:top-auto md:mb-2 md:w-full md:min-w-[260px] md:max-w-[288px]" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-slate-600"><div><h3 className="font-bold text-gray-950 dark:text-white">Notifications</h3><p className="text-xs text-gray-500 dark:text-gray-300">{unread.length} chưa đọc</p></div><div className="flex gap-1"><button type="button" onClick={markAll} title="Đọc tất cả" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-[#555555]"><Check size={17}/></button><button type="button" onClick={() => setSettingsOpen((v) => !v)} title="Cài đặt nhắc nhở" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-[#555555]"><Settings2 size={17}/></button><button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-[#555555]"><X size={17}/></button></div></div>
      {settingsOpen && <div className="border-b border-gray-200 p-3 dark:border-slate-600"><p className="mb-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-300">Tùy chọn nhắc</p><label className="flex items-center justify-between py-2 text-sm text-gray-800 dark:text-white"><span>Deadline trong 24 giờ</span><input type="checkbox" checked={settings.deadline} onChange={(e) => save({ ...settings, deadline: e.target.checked })}/></label><label className="flex items-center justify-between py-2 text-sm text-gray-800 dark:text-white"><span>Lịch học trong 1 giờ</span><input type="checkbox" checked={settings.schedule} onChange={(e) => save({ ...settings, schedule: e.target.checked })}/></label><button type="button" onClick={enableBrowser} className="mt-2 w-full rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">{settings.browser ? "Đã bật thông báo trình duyệt" : "Bật thông báo khi rời trang"}</button><p className="mt-2 text-[11px] text-gray-500 dark:text-gray-300">Cài đặt này xin quyền thông báo của trình duyệt.</p></div>}
      <div className="max-h-[55vh] overflow-y-auto p-2">{items.length === 0 ? <div className="px-4 py-10 text-center"><Bell className="mx-auto mb-3 text-gray-300" size={30}/><p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Không có thông báo</p><p className="mt-1 text-xs text-gray-400">ScholarOS chỉ báo deadline trong 24h và lịch học trong 1h.</p></div> : items.map((item) => { const Icon = item.kind === "deadline" ? Clock3 : CalendarDays; const isUnread = !read.includes(item.id); return <Link key={item.id} href={item.href} onClick={() => { markRead(item.id); setOpen(false); }} className={`flex gap-3 rounded-xl p-3 transition hover:bg-gray-100 dark:hover:bg-[#555555] ${isUnread ? "bg-indigo-50/70 dark:bg-indigo-950/30" : "opacity-60"}`}><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><Icon size={18}/></span><span className="min-w-0"><span className="block text-sm font-semibold text-gray-900 dark:text-white">{item.title}</span><span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-300">{item.message}</span></span></Link>; })}</div>
    </div></>}
  </div>;
}
