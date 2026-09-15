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

  const today = useMemo(() => new Date(), []);
  const todayKey = dateKey(today);
  const weekStart = useMemo(() => startOfWeek(today), [today]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; }), [weekStart]);

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

  function toggleDay(day: number) { setTargetDays((days) => days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort()); }

  const activeHabits = habits.filter((h) => h.active !== false);
  const completedToday = activeHabits.filter((h) => (h.completedDates || []).includes(todayKey)).length;
  const streak = (habit: Habit) => {
    const dates = new Set(habit.completedDates || []); let count = 0; const cursor = new Date(today);
    while (dates.has(dateKey(cursor))) { count++; cursor.setDate(cursor.getDate() - 1); }
    return count;
  };

  return <main className="min-h-screen bg-[#f7f8fc]"><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
    <div className="mb-8"><div className="text-sm font-bold uppercase tracking-wider text-indigo-600">Tools</div><h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Habits</h1><p className="mt-2 max-w-2xl text-gray-600">Theo dõi những thói quen học tập và sinh hoạt bạn muốn duy trì.</p></div>
    <section className="mb-6 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Thói quen</p><p className="mt-1 text-3xl font-bold text-gray-950">{activeHabits.length}</p></div><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Hoàn thành hôm nay</p><p className="mt-1 text-3xl font-bold text-emerald-600">{completedToday}/{activeHabits.length}</p></div><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Tỷ lệ hôm nay</p><p className="mt-1 text-3xl font-bold text-indigo-600">{activeHabits.length ? Math.round(completedToday / activeHabits.length * 100) : 0}%</p></div></section>
    <form onSubmit={submitHabit} className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-gray-950">{editingId ? "Chỉnh sửa thói quen" : "Thêm thói quen"}</h2>{editingId && <button type="button" onClick={resetForm} className="text-sm font-semibold text-gray-500">Hủy</button>}</div><div className="grid gap-4 md:grid-cols-2"><label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold text-gray-700">Tên thói quen *</span><input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ví dụ: Đọc sách 20 phút" className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label><label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold text-gray-700">Mô tả</span><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mục tiêu hoặc ghi chú..." className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label><label><span className="mb-1 block text-sm font-semibold text-gray-700">Tần suất</span><select value={frequency} onChange={(e) => setFrequency(e.target.value as Habit["frequency"])} className="w-full rounded-xl border border-gray-300 px-4 py-3"><option value="daily">Hằng ngày</option><option value="weekly">Theo ngày trong tuần</option></select></label></div>{frequency === "weekly" && <div className="mt-4"><span className="mb-2 block text-sm font-semibold text-gray-700">Ngày thực hiện</span><div className="flex flex-wrap gap-2">{weekdays.map((day, index) => <button type="button" key={day} onClick={() => toggleDay(index)} className={`rounded-xl px-4 py-2 text-sm font-bold ${targetDays.includes(index) ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500"}`}>{day}</button>)}</div></div>}<button disabled={saving} className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white disabled:opacity-60">{saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "+ Thêm thói quen"}</button></form>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5"><h2 className="text-xl font-bold text-gray-950">Hôm nay</h2><p className="mt-1 text-sm text-gray-500">Đánh dấu từng thói quen khi bạn hoàn thành.</p></div>{error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{loading ? <p className="py-10 text-center text-gray-500">Đang tải thói quen...</p> : activeHabits.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center"><p className="text-lg font-semibold text-gray-800">Chưa có thói quen</p><p className="mt-1 text-gray-500">Tạo thói quen đầu tiên ở biểu mẫu phía trên.</p></div> : <div className="space-y-3">{activeHabits.map((habit) => { const done = (habit.completedDates || []).includes(todayKey); return <article key={habit.id} className="rounded-xl border border-gray-200 p-4"><div className="flex items-start gap-3"><button type="button" onClick={() => toggleToday(habit)} className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300"}`}>{done ? "✓" : ""}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className={`font-bold ${done ? "text-gray-400 line-through" : "text-gray-950"}`}>{habit.name}</h3><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">🔥 {streak(habit)} ngày</span></div>{habit.description && <p className="mt-1 text-sm text-gray-600">{habit.description}</p>}<div className="mt-4 grid grid-cols-7 gap-1.5">{weekDates.map((date, index) => { const key = dateKey(date); const scheduled = habit.frequency === "daily" || (habit.targetDays || []).includes(index); const doneOnDate = (habit.completedDates || []).includes(key); return <button key={key} type="button" disabled={!scheduled} onClick={() => toggleToday(habit, date)} className={`rounded-lg px-1 py-2 text-center text-xs font-bold ${!scheduled ? "bg-gray-50 text-gray-300" : doneOnDate ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}><span className="block">{weekdays[index]}</span><span className="mt-0.5 block">{date.getDate()}</span></button>; })}</div></div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => startEdit(habit)} className="rounded-lg px-2.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Sửa</button><button type="button" onClick={() => removeHabit(habit)} className="rounded-lg px-2.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Xóa</button></div></div></article>; })}</div>}</section>
  </div></main>;
}
