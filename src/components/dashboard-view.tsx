"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { listUserDocuments } from "@/lib/firestore";

type Task = {
  id: string;
  title?: string;
  dueDate?: string;
  completed?: boolean;
};

type ScheduleItem = {
  id: string;
  title: string;
  subject?: string;
  day: number;
  startTime: string;
  endTime: string;
};

const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const toolLinks = [
  { href: "/tools/schedule", label: "Lịch học", icon: "▣", note: "Xem và chỉnh lịch" },
  { href: "/tools/tasks", label: "Nhiệm vụ", icon: "✓", note: "Quản lý việc cần làm" },
  { href: "/tools/habits", label: "Thói quen", icon: "↗", note: "Theo dõi thói quen" },
  { href: "/tools/notes", label: "Ghi chú", icon: "▤", note: "Lưu kiến thức và ý tưởng" },
  { href: "/tools/pomodoro", label: "Pomodoro", icon: "◷", note: "Bắt đầu phiên tập trung" },
];

function getTimeMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getProgress(now: Date) {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const mondayOffset = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset).getTime();
  const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - mondayOffset)).getTime();
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

function Calendar({ now, schedule }: { now: Date; schedule: ScheduleItem[] }) {
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
  const scheduledDays = new Set(schedule.map((item) => item.day));

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-[#444444] sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Calendar</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Lịch tháng</h2>
          <p className="mt-1 text-sm capitalize text-slate-500 dark:text-slate-300">{now.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</p>
        </div>
        <span className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">Hôm nay</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400">
        {weekdays.map((weekday) => <div key={weekday} className="py-2">{weekday}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          const hasSchedule = day !== null && scheduledDays.has(new Date(year, month, day).getDay());
          return (
            <div key={`${day}-${index}`} className="flex aspect-square items-center justify-center">
              {day ? (
                <div className="relative">
                  <span className={day === today ? "flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white" : "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-600"}>{day}</span>
                  {hasSchedule && day !== today && <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-indigo-500" />}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function DashboardView() {
  const [now, setNow] = useState(() => new Date());
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => { window.clearInterval(timer); unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setSchedule([]);
      setLoading(false);
      return;
    }

    const loadDashboard = async () => {
      setLoading(true);
      setError("");
      try {
        const [taskData, scheduleData] = await Promise.all([
          listUserDocuments<Task>(user.uid, "tasks"),
          listUserDocuments<ScheduleItem>(user.uid, "schedule"),
        ]);
        setTasks(taskData);
        setSchedule(scheduleData.sort((a, b) => a.startTime.localeCompare(b.startTime)));
      } catch {
        setError("Không thể đồng bộ Dashboard với Firebase. Hãy thử tải lại trang.");
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, [user]);

  const todayKey = formatDateKey(now);
  const todayDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayTasks = useMemo(() => tasks.filter((task) => task.dueDate === todayKey && !task.completed), [tasks, todayKey]);
  const completedToday = useMemo(() => tasks.filter((task) => task.dueDate === todayKey && task.completed).length, [tasks, todayKey]);
  const todaySchedule = useMemo(() => schedule.filter((item) => item.day === todayDay).sort((a, b) => a.startTime.localeCompare(b.startTime)), [schedule, todayDay]);
  const nextClass = useMemo(() => todaySchedule.find((item) => getTimeMinutes(item.endTime) > currentMinutes) ?? null, [todaySchedule, currentMinutes]);
  const overdueTasks = useMemo(() => tasks.filter((task) => !task.completed && !!task.dueDate && task.dueDate < todayKey), [tasks, todayKey]);
  const progress = useMemo(() => getProgress(now), [now]);
  const totalToday = todayTasks.length + completedToday;
  const taskCompletion = totalToday ? Math.round((completedToday / totalToday) * 100) : 0;
  const greetingName = user?.displayName?.split(" ")[0] || "bạn";
  const dateText = now.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeText = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <main className="min-h-screen bg-[#f7f8fc] dark:bg-[#333333]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-[#444444]">
          <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-indigo-600">ScholarOS · Dashboard</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Chào {greetingName} 👋</h1>
              <p className="mt-2 text-base capitalize text-slate-600 dark:text-slate-200">{dateText}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4 dark:bg-[#555555] lg:min-w-64 lg:text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Thời gian hiện tại</p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-950 dark:text-white">{timeText}</p>
            </div>
          </div>
        </section>

        {error && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{error}</div>}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Nhiệm vụ hôm nay", value: loading ? "—" : String(todayTasks.length), note: `${completedToday} đã hoàn thành`, href: "/tools/tasks", icon: "✓" },
            { label: "Lịch hôm nay", value: loading ? "—" : String(todaySchedule.length), note: nextClass ? `Tiếp theo ${nextClass.startTime}` : "Không còn buổi học", href: "/tools/schedule", icon: "▣" },
            { label: "Quá hạn", value: loading ? "—" : String(overdueTasks.length), note: overdueTasks.length ? "Cần xử lý" : "Không có việc quá hạn", href: "/tools/tasks", icon: "!" },
            { label: "Tiến độ Tasks", value: `${taskCompletion}%`, note: totalToday ? `${completedToday}/${totalToday} nhiệm vụ` : "Chưa có nhiệm vụ hôm nay", href: "/tools/tasks", icon: "↗" },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 dark:border-slate-700 dark:bg-[#444444] dark:hover:border-indigo-500">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">{stat.label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{stat.value}</p>
                  <p className="mt-1 text-xs text-slate-400">{stat.note}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-lg font-bold text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">{stat.icon}</span>
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {progress.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-[#444444]">
              <div className="flex items-center justify-between gap-3"><span className="font-semibold text-slate-700 dark:text-slate-100">{item.label}</span><span className="text-sm font-bold text-indigo-600">{Math.round(item.value)}%</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-600"><div className="h-full rounded-full bg-indigo-500 transition-[width] duration-500" style={{ width: `${item.value}%` }} /></div>
            </div>
          ))}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_1.4fr]">
          <Calendar now={now} schedule={schedule} />
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-[#444444] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Quick Actions</p><h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Truy cập nhanh</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Các công cụ học tập chính của ScholarOS.</p></div>
              <Link href="/tools/pomodoro" className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">Tập trung</Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {toolLinks.map((tool) => <Link key={tool.href} href={tool.href} className="group rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-600 dark:hover:border-indigo-500 dark:hover:bg-slate-700/40"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-lg font-bold text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">{tool.icon}</span><div className="min-w-0"><p className="font-bold text-slate-900 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-300">{tool.label}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{tool.note}</p></div></div></Link>)}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-[#444444] sm:p-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-wider text-indigo-600">Today's Focus</p><h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Việc cần tập trung hôm nay</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Tổng hợp trực tiếp từ Tasks và Schedule.</p></div><div className="flex gap-2"><Link href="/tools/tasks" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:border-slate-600 dark:text-indigo-300 dark:hover:bg-slate-700">Tasks</Link><Link href="/tools/schedule" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:border-slate-600 dark:text-indigo-300 dark:hover:bg-slate-700">Schedule</Link></div></div>
            {loading ? <div className="rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:bg-[#555555] dark:text-slate-300">Đang đồng bộ dữ liệu...</div> : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-[#555555]"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Tasks</p><p className="mt-1 font-bold text-slate-950 dark:text-white">{todayTasks.length ? `${todayTasks.length} nhiệm vụ chưa hoàn thành` : "Không còn nhiệm vụ hôm nay"}</p></div><span className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-600 dark:bg-[#444444] dark:text-slate-200">{taskCompletion}%</span></div>{todayTasks.length ? <div className="mt-3 space-y-2">{todayTasks.slice(0, 5).map((task) => <div key={task.id} className="rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 dark:bg-[#444444] dark:text-slate-100">{task.title || "Nhiệm vụ chưa đặt tên"}</div>)}{todayTasks.length > 5 && <p className="text-xs text-slate-500 dark:text-slate-300">+ {todayTasks.length - 5} nhiệm vụ khác</p>}</div> : <div className="mt-3 rounded-xl bg-white px-4 py-4 text-sm text-slate-500 dark:bg-[#444444] dark:text-slate-300">Bạn đã hoàn thành hết nhiệm vụ hôm nay. 🎉</div>}</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-[#555555]"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Schedule</p><p className="mt-1 font-bold text-slate-950 dark:text-white">{todaySchedule.length ? `${todaySchedule.length} buổi học hôm nay` : "Không có lịch học hôm nay"}</p></div>{nextClass && <span className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-indigo-600 dark:bg-[#444444] dark:text-indigo-300">Tiếp theo {nextClass.startTime}</span>}</div>{todaySchedule.length ? <div className="mt-3 space-y-2">{todaySchedule.slice(0, 5).map((item) => { const active = getTimeMinutes(item.startTime) <= currentMinutes && getTimeMinutes(item.endTime) > currentMinutes; return <div key={item.id} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm ${active ? "bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-700" : "bg-white dark:bg-[#444444]"}`}><div className="min-w-0"><p className="truncate font-semibold text-slate-700 dark:text-slate-100">{item.title}</p>{item.subject && <p className="mt-0.5 text-xs text-slate-400">{item.subject}</p>}</div><span className="shrink-0 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-300">{item.startTime}–{item.endTime}</span></div>; })}{todaySchedule.length > 5 && <p className="text-xs text-slate-500 dark:text-slate-300">+ {todaySchedule.length - 5} buổi khác</p>}</div> : <div className="mt-3 rounded-xl bg-white px-4 py-4 text-sm text-slate-500 dark:bg-[#444444] dark:text-slate-300">Hôm nay chưa có buổi học nào trong Schedule.</div>}</div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-[#444444]"><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Next up</p><h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Buổi học tiếp theo</h2>{nextClass ? <div className="mt-4 rounded-2xl bg-indigo-50 p-4 dark:bg-indigo-950/40"><p className="font-bold text-indigo-800 dark:text-indigo-200">{nextClass.title}</p>{nextClass.subject && <p className="mt-1 text-sm text-indigo-700/80 dark:text-indigo-300">{nextClass.subject}</p>}<p className="mt-3 font-mono text-lg font-bold text-indigo-700 dark:text-indigo-200">{nextClass.startTime} – {nextClass.endTime}</p></div> : <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-[#555555] dark:text-slate-300">Không còn buổi học nào trong hôm nay.</p>}</div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-[#444444]"><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Daily status</p><h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Tình trạng hôm nay</h2><div className="mt-4 space-y-4"><div><div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-200">Tasks hoàn thành</span><span className="font-bold text-slate-950 dark:text-white">{taskCompletion}%</span></div><div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-600"><div className="h-2 rounded-full bg-indigo-500" style={{ width: `${taskCompletion}%` }} /></div></div><div className="grid grid-cols-2 gap-3 text-center"><div className="rounded-xl bg-slate-50 p-3 dark:bg-[#555555]"><p className="text-xl font-bold text-slate-950 dark:text-white">{todayTasks.length}</p><p className="text-xs text-slate-500 dark:text-slate-300">Còn lại</p></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-[#555555]"><p className="text-xl font-bold text-slate-950 dark:text-white">{completedToday}</p><p className="text-xs text-slate-500 dark:text-slate-300">Đã xong</p></div></div></div></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-[#444444]"><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Motivation</p><h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Lời nhắc hôm nay</h2><p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-200">“Không cần hoàn hảo. Chỉ cần hoàn thành bước tiếp theo.”</p><Link href="/tools/pomodoro" className="mt-5 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Bắt đầu tập trung →</Link></div>
        </section>
      </div>
    </main>
  );
}
