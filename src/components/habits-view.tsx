"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createUserDocument, deleteUserDocument, listUserDocuments, updateUserDocument } from "@/lib/firestore";

type Habit = {
  id: string;
  name?: string;
  description?: string;
  frequency?: "daily" | "weekly";
  targetDays?: number[];
  completedDates?: string[];
  active?: boolean;
};

const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function HabitsView() {
  const [user, setUser] = useState<User | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<Habit["frequency"]>("daily");
  const [targetDays, setTargetDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayKey = dateKey(today);
  const weekStart = useMemo(() => startOfWeek(today), [today]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; }), [weekStart]);
  const monthDays = useMemo(() => {
    const first = startOfMonth(today);
    const firstDay = (first.getDay() + 6) % 7;
    const count = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return Array.from({ length: firstDay + count }, (_, i) => i < firstDay ? null : new Date(today.getFullYear(), today.getMonth(), i - firstDay + 1));
  }, [today]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    listUserDocuments<Habit>(user.uid, "habits")
      .then((items) => setHabits(items.map((item) => ({ ...item, completedDates: item.completedDates || [], active: item.active !== false, targetDays: item.targetDays || [0,1,2,3,4,5,6] }))))
      .catch(() => setError("Không thể tải danh sách thói quen."))
      .finally(() => setLoading(false));
  }, [user]);

  function resetForm() {
    setName(""); setDescription(""); setFrequency("daily"); setTargetDays([0,1,2,3,4,5,6]); setEditingId(null);
  }

  async function submitHabit(event: FormEvent) {
    event.preventDefault();
    if (!user || !name.trim()) return;
    if (frequency === "weekly" && targetDays.length === 0) { setError("Hãy chọn ít nhất một ngày trong tuần."); return; }
    setSaving(true); setError("");
    try {
      const data = { name: name.trim(), description: description.trim(), frequency: frequency || "daily", targetDays: frequency === "daily" ? [0,1,2,3,4,5,6] : targetDays, completedDates: editingId ? (habits.find((h) => h.id === editingId)?.completedDates || []) : [], active: true };
      if (editingId) {
        await updateUserDocument(user.uid, "habits", editingId, data);
        setHabits((current) => current.map((habit) => habit.id === editingId ? { ...habit, ...data } : habit));
      } else {
        const ref = await createUserDocument(user.uid, "habits", data);
        setHabits((current) => [...current, { ...data, id: ref.id }]);
      }
      resetForm();
    } catch { setError("Không thể lưu thói quen. Hãy thử lại."); }
    finally { setSaving(false); }
  }

  function startEdit(habit: Habit) {
    setEditingId(habit.id); setName(habit.name || ""); setDescription(habit.description || ""); setFrequency(habit.frequency || "daily"); setTargetDays(habit.targetDays || [0,1,2,3,4,5,6]); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleToday(habit: Habit, date: Date = today) {
    if (!user) return;
    const key = dateKey(date);
    const current = habit.completedDates || [];
    const completedDates = current.includes(key) ? current.filter((item) => item !== key) : [...current, key].sort();
    try {
      await updateUserDocument(user.uid, "habits", habit.id, { completedDates });
      setHabits((items) => items.map((item) => item.id === habit.id ? { ...item, completedDates } : item));
    } catch { setError("Không thể cập nhật tiến độ thói quen."); }
  }

  async function removeHabit(habit: Habit) {
    if (!user || !window.confirm(`Xóa thói quen "${habit.name || "này"}"?`)) return;
    try { await deleteUserDocument(user.uid, "habits", habit.id); setHabits((items) => items.filter((item) => item.id !== habit.id)); }
    catch { setError("Không thể xóa thói quen."); }
  }

  async function toggleActive(habit: Habit) {
    if (!user) return;
    const active = habit.active === false;
    try {
      await updateUserDocument(user.uid, "habits", habit.id, { active });
      setHabits((items) => items.map((item) => item.id === habit.id ? { ...item, active } : item));
    } catch { setError("Không thể thay đổi trạng thái thói quen."); }
  }

  function toggleDay(day: number) { setTargetDays((days) => days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort()); }

  const activeHabits = habits.filter((h) => h.active !== false);
  const inactiveHabits = habits.filter((h) => h.active === false);
  const filteredHabits = useMemo(() => {
    const source = showInactive ? inactiveHabits : activeHabits;
    const q = query.trim().toLowerCase();
    return source.filter((h) => !q || `${h.name || ""} ${h.description || ""}`.toLowerCase().includes(q));
  }, [habits, query, showInactive]);
  const scheduledToday = activeHabits.filter((h) => h.frequency === "daily" || (h.targetDays || []).includes((today.getDay() + 6) % 7));
  const completedToday = scheduledToday.filter((h) => (h.completedDates || []).includes(todayKey)).length;
  const totalCompletions = activeHabits.reduce((sum, h) => sum + (h.completedDates || []).length, 0);
  const bestStreak = (habit: Habit) => {
    const dates = new Set(habit.completedDates || []); let best = 0; let current = 0;
    const cursor = new Date(today); cursor.setDate(cursor.getDate() - 365);
    for (let i = 0; i <= 365; i++) { if (dates.has(dateKey(cursor))) { current++; best = Math.max(best, current); } else current = 0; cursor.setDate(cursor.getDate() + 1); }
    return best;
  };
  const streak = (habit: Habit) => {
    const dates = new Set(habit.completedDates || []); let count = 0; const cursor = new Date(today);
    while (dates.has(dateKey(cursor))) { count++; cursor.setDate(cursor.getDate() - 1); }
    return count;
  };

  return <main className="min-h-screen bg-[#f7f8fc] dark:bg-[#333333] dark:text-white"><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
    <div className="mb-8"><div className="text-sm font-bold uppercase tracking-wider text-indigo-600">Tools</div><h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-4xl">Habits</h1><p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">Theo dõi những thói quen học tập và sinh hoạt bạn muốn duy trì.</p></div>
    <section className="mb-6 grid gap-4 sm:grid-cols-4"><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040]"><p className="text-sm text-gray-500 dark:text-gray-300">Thói quen</p><p className="mt-1 text-3xl font-bold text-gray-950 dark:text-white">{activeHabits.length}</p></div><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040]"><p className="text-sm text-gray-500 dark:text-gray-300">Hôm nay</p><p className="mt-1 text-3xl font-bold text-emerald-600">{completedToday}/{scheduledToday.length}</p></div><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040]"><p className="text-sm text-gray-500 dark:text-gray-300">Tỷ lệ hôm nay</p><p className="mt-1 text-3xl font-bold text-indigo-600">{scheduledToday.length ? Math.round(completedToday / scheduledToday.length * 100) : 0}%</p></div><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040]"><p className="text-sm text-gray-500 dark:text-gray-300">Lần hoàn thành</p><p className="mt-1 text-3xl font-bold text-amber-600">{totalCompletions}</p></div></section>
    <form onSubmit={submitHabit} className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040] sm:p-6"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-gray-950 dark:text-white">{editingId ? "Chỉnh sửa thói quen" : "Thêm thói quen"}</h2>{editingId && <button type="button" onClick={resetForm} className="text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-300">Hủy</button>}</div><div className="grid gap-4 md:grid-cols-2"><label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">Tên thói quen *</span><input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ví dụ: Đọc sách 20 phút" className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-600 dark:bg-[#333333] dark:text-white" /></label><label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">Mô tả</span><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mục tiêu hoặc ghi chú..." className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-600 dark:bg-[#333333] dark:text-white" /></label><label><span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">Tần suất</span><select value={frequency} onChange={(e) => setFrequency(e.target.value as Habit["frequency"])} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-gray-600 dark:bg-[#333333] dark:text-white"><option value="daily">Hằng ngày</option><option value="weekly">Theo ngày trong tuần</option></select></label></div>{frequency === "weekly" && <div className="mt-4"><span className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">Ngày thực hiện</span><div className="flex flex-wrap gap-2">{weekdays.map((day, index) => <button type="button" key={day} onClick={() => toggleDay(index)} className={`rounded-xl px-4 py-2 text-sm font-bold ${targetDays.includes(index) ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500 dark:bg-[#333333] dark:text-gray-300"}`}>{day}</button>)}</div></div>}<button disabled={saving} className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60">{saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "+ Thêm thói quen"}</button></form>
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040] sm:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold text-gray-950 dark:text-white">Theo dõi</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-300">{today.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</p></div><div className="flex flex-col gap-2 sm:flex-row"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm thói quen..." className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white" /><button type="button" onClick={() => setShowInactive((v) => !v)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200">{showInactive ? "Đang hoạt động" : "Đã tạm dừng"}</button></div></div>{error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{loading ? <p className="py-10 text-center text-gray-500">Đang tải thói quen...</p> : filteredHabits.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center dark:border-gray-600"><p className="text-lg font-semibold text-gray-800 dark:text-gray-200">{showInactive ? "Không có thói quen tạm dừng" : "Chưa có thói quen"}</p><p className="mt-1 text-gray-500 dark:text-gray-400">{showInactive ? "Các thói quen tạm dừng sẽ xuất hiện ở đây." : "Tạo thói quen đầu tiên ở biểu mẫu phía trên."}</p></div> : <div className="space-y-3">{filteredHabits.map((habit) => { const done = (habit.completedDates || []).includes(todayKey); return <article key={habit.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-600 dark:bg-[#333333]"><div className="flex items-start gap-3"><button type="button" disabled={habit.active === false} onClick={() => toggleToday(habit)} className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 dark:border-gray-500"}`}>{done ? "✓" : ""}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className={`font-bold ${done ? "text-gray-400 line-through" : "text-gray-950 dark:text-white"}`}>{habit.name}</h3><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">🔥 {streak(habit)} ngày</span><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-200">🏆 {bestStreak(habit)} tốt nhất</span></div>{habit.description && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{habit.description}</p>}<div className="mt-4 grid grid-cols-7 gap-1.5">{weekDates.map((date, index) => { const key = dateKey(date); const scheduled = habit.frequency === "daily" || (habit.targetDays || []).includes(index); const doneOnDate = (habit.completedDates || []).includes(key); return <button key={key} type="button" disabled={!scheduled || habit.active === false} onClick={() => toggleToday(habit, date)} className={`rounded-lg px-1 py-2 text-center text-xs font-bold ${!scheduled ? "bg-gray-50 text-gray-300 dark:bg-[#2d2d2d] dark:text-gray-600" : doneOnDate ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-gray-100 text-gray-500 dark:bg-[#404040] dark:text-gray-300"}`}><span className="block">{weekdays[index]}</span><span className="mt-0.5 block">{date.getDate()}</span></button>; })}</div><div className="mt-3 flex items-center gap-2"><span className="text-xs text-gray-500 dark:text-gray-400">Tần suất: {habit.frequency === "weekly" ? "Theo ngày chọn" : "Hằng ngày"}</span><span className="text-xs text-gray-400">•</span><span className="text-xs text-gray-500 dark:text-gray-400">{(habit.completedDates || []).length} lần</span></div></div><div className="flex shrink-0 flex-wrap justify-end gap-1"><button type="button" onClick={() => startEdit(habit)} className="rounded-lg px-2.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-[#404040]">Sửa</button><button type="button" onClick={() => toggleActive(habit)} className="rounded-lg px-2.5 py-2 text-sm font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-[#404040]">{habit.active === false ? "Bật lại" : "Tạm dừng"}</button><button type="button" onClick={() => removeHabit(habit)} className="rounded-lg px-2.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-[#404040]">Xóa</button></div></div></article>; })}</div>}</section>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040] sm:p-6"><div className="mb-4"><h2 className="text-xl font-bold text-gray-950 dark:text-white">Lịch sử tháng</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-300">Màu xanh đánh dấu ngày có ít nhất một lần hoàn thành thói quen.</p></div><div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500 dark:text-gray-400">{weekdays.map((d) => <span key={d}>{d}</span>)}</div><div className="grid grid-cols-7 gap-1">{monthDays.map((date, i) => date ? <div key={i} className={`min-h-10 rounded-lg p-1.5 text-center text-xs font-semibold ${dateKey(date) === todayKey ? "ring-2 ring-indigo-500" : ""} ${(activeHabits.some((h) => (h.completedDates || []).includes(dateKey(date)))) ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-gray-100 text-gray-500 dark:bg-[#333333] dark:text-gray-400"}`}>{date.getDate()}</div> : <div key={i} />)}</div></section>
  </div></main>;
}
