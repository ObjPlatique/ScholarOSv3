"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createUserDocument, deleteUserDocument, listUserDocuments, updateUserDocument } from "@/lib/firestore";

type ScheduleItem = { id: string; title: string; subject: string; day: number; startTime: string; endTime: string; location: string; note: string };

const days = [
  { value: 1, label: "Thứ 2" }, { value: 2, label: "Thứ 3" }, { value: 3, label: "Thứ 4" },
  { value: 4, label: "Thứ 5" }, { value: 5, label: "Thứ 6" }, { value: 6, label: "Thứ 7" }, { value: 0, label: "Chủ nhật" },
];

const emptyForm = { title: "", subject: "", day: 1, startTime: "08:00", endTime: "09:30", location: "", note: "" };
const dayLabel = (day: number) => days.find((d) => d.value === day)?.label ?? "";
const todayDay = () => new Date().getDay();
const minutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };

export default function ScheduleView() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState(todayDay());
  const [query, setQuery] = useState("");

  const load = async (uid: string) => {
    setLoading(true); setError("");
    try {
      const data = await listUserDocuments<ScheduleItem>(uid, "schedule");
      setItems(data.filter((item) => typeof item.day === "number").sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime)));
    } catch { setError("Không thể tải thời khóa biểu. Hãy kiểm tra Firestore Rules và thử lại."); }
    finally { setLoading(false); }
  };

  useEffect(() => onAuthStateChanged(auth, (user) => { setUserId(user?.uid ?? null); if (user) void load(user.uid); else setLoading(false); }), []);

  const filtered = useMemo(() => items.filter((item) => {
    const text = `${item.title} ${item.subject} ${item.location} ${item.note}`.toLowerCase();
    return !query.trim() || text.includes(query.toLowerCase().trim());
  }), [items, query]);

  const grouped = useMemo(() => days.map((day) => ({ ...day, items: filtered.filter((item) => item.day === day.value) })), [filtered]);
  const todayItems = useMemo(() => items.filter((item) => item.day === todayDay()).sort((a, b) => a.startTime.localeCompare(b.startTime)), [items]);
  const totalMinutes = items.reduce((sum, item) => sum + Math.max(0, minutes(item.endTime) - minutes(item.startTime)), 0);
  const selectedItems = grouped.find((day) => day.value === selectedDay)?.items ?? [];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId || !form.title.trim() || form.startTime >= form.endTime) return;
    setSaving(true); setError("");
    const payload = { title: form.title.trim(), subject: form.subject.trim(), day: Number(form.day), startTime: form.startTime, endTime: form.endTime, location: form.location.trim(), note: form.note.trim() };
    try {
      if (editingId) await updateUserDocument(userId, "schedule", editingId, payload); else await createUserDocument(userId, "schedule", payload);
      await load(userId); setForm(emptyForm); setEditingId(null); setSelectedDay(payload.day);
    } catch { setError("Không thể lưu lịch. Vui lòng thử lại."); }
    finally { setSaving(false); }
  };

  const edit = (item: ScheduleItem) => {
    setEditingId(item.id); setForm({ title: item.title, subject: item.subject, day: item.day, startTime: item.startTime, endTime: item.endTime, location: item.location, note: item.note });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id: string) => {
    if (!userId || !window.confirm("Xóa buổi học này khỏi thời khóa biểu?")) return;
    try { await deleteUserDocument(userId, "schedule", id); setItems((current) => current.filter((item) => item.id !== id)); if (editingId === id) { setEditingId(null); setForm(emptyForm); } }
    catch { setError("Không thể xóa lịch. Vui lòng thử lại."); }
  };

  const duplicate = async (item: ScheduleItem) => {
    if (!userId) return;
    try { await createUserDocument(userId, "schedule", { title: item.title, subject: item.subject, day: item.day, startTime: item.startTime, endTime: item.endTime, location: item.location, note: item.note }); await load(userId); }
    catch { setError("Không thể sao chép buổi học."); }
  };

  return (
    <main className="min-h-screen bg-[#f7f8fc] dark:bg-[#333333] dark:text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wider text-indigo-600">Tools</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-4xl">Thời khóa biểu</h1>
          <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">Quản lý lịch học theo tuần, tìm kiếm nhanh và theo dõi khối lượng học tập.</p>
        </div>

        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</div>}

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040]"><div className="text-sm text-gray-500 dark:text-gray-300">Tổng số buổi</div><div className="mt-1 text-3xl font-bold text-gray-950 dark:text-white">{items.length}</div></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040]"><div className="text-sm text-gray-500 dark:text-gray-300">Hôm nay</div><div className="mt-1 text-3xl font-bold text-gray-950 dark:text-white">{todayItems.length}</div></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040]"><div className="text-sm text-gray-500 dark:text-gray-300">Thời lượng / tuần</div><div className="mt-1 text-3xl font-bold text-gray-950 dark:text-white">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</div></div>
        </section>

        <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold text-gray-950 dark:text-white">{editingId ? "Chỉnh sửa buổi học" : "Thêm buổi học"}</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-300">Thiết lập thời gian, môn học và thông tin bổ sung.</p></div>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600">Hủy sửa</button>}</div>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[["Tên buổi học *", "title", "Ví dụ: Toán THPTQG"], ["Môn", "subject", "Toán"], ["Địa điểm", "location", "Phòng học / Online"], ["Ghi chú", "note", "Nội dung cần nhớ"]].map(([label, key, placeholder]) => <label key={key} className={key === "title" ? "lg:col-span-2" : ""}><span className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</span><input required={key === "title"} value={form[key as keyof typeof form] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-500 dark:bg-[#333333] dark:text-white" /></label>)}
            <label><span className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">Ngày</span><select value={form.day} onChange={(e) => setForm({ ...form, day: Number(e.target.value) })} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-500 dark:bg-[#333333] dark:text-white">{days.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
            <label><span className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">Bắt đầu</span><input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-500 dark:bg-[#333333] dark:text-white" /></label>
            <label><span className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">Kết thúc</span><input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-500 dark:bg-[#333333] dark:text-white" /></label>
            <div className="flex items-end lg:col-span-2"><button disabled={saving || !userId || form.startTime >= form.endTime} className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Đang lưu..." : editingId ? "💾 Lưu thay đổi" : "＋ Thêm vào lịch"}</button></div>
          </form>
          {form.startTime >= form.endTime && <p className="mt-2 text-sm text-red-600">Giờ kết thúc phải sau giờ bắt đầu.</p>}
        </section>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-600 dark:bg-[#404040]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="font-bold text-gray-950 dark:text-white">Tìm kiếm lịch</div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm môn, buổi học, địa điểm..." className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-indigo-500 sm:max-w-sm dark:border-gray-500 dark:bg-[#333333] dark:text-white" /></div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{days.map((day) => <button key={day.value} onClick={() => setSelectedDay(day.value)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold ${selectedDay === day.value ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#333333] dark:text-gray-200 dark:hover:bg-gray-600"}`}>{day.label}{day.value === todayDay() ? " · Hôm nay" : ""}</button>)}</div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-gray-950 dark:text-white">{dayLabel(selectedDay)}</h2><span className="text-sm text-gray-500 dark:text-gray-300">{selectedItems.length} buổi</span></div>
          {loading ? <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-gray-600 dark:bg-[#404040] dark:text-gray-300">Đang tải thời khóa biểu...</div> : selectedItems.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-600 dark:bg-[#404040]"><div className="text-4xl">📅</div><h3 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">Không có buổi học</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-300">Thêm lịch mới hoặc chọn ngày khác.</p></div> : <div className="space-y-3">{selectedItems.map((item) => <article key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-600 dark:bg-[#404040]"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-lg font-bold text-gray-900 dark:text-white">{item.title}</div>{item.subject && <div className="mt-0.5 text-sm text-indigo-600">{item.subject}</div>}</div><span className="w-fit rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200">{item.startTime}–{item.endTime}</span></div>{item.location && <div className="mt-3 text-sm text-gray-500 dark:text-gray-300">📍 {item.location}</div>}{item.note && <div className="mt-1 text-sm text-gray-500 dark:text-gray-300">📝 {item.note}</div>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => edit(item)} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 dark:bg-[#333333] dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-600">Sửa</button><button type="button" onClick={() => void duplicate(item)} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 dark:bg-[#333333] dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-600">Sao chép</button><button type="button" onClick={() => void remove(item.id)} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-600 ring-1 ring-gray-200 hover:bg-red-50 dark:bg-[#333333] dark:ring-gray-600 dark:hover:bg-red-950/40">Xóa</button></div></article>)}</div>}
        </section>
      </div>
    </main>
  );
}
