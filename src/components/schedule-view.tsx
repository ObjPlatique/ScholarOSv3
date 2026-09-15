"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  createUserDocument,
  deleteUserDocument,
  listUserDocuments,
  updateUserDocument,
} from "@/lib/firestore";

type ScheduleItem = {
  id: string;
  title: string;
  subject: string;
  day: number;
  startTime: string;
  endTime: string;
  location: string;
  note: string;
};

const days = [
  { value: 1, label: "Thứ 2" },
  { value: 2, label: "Thứ 3" },
  { value: 3, label: "Thứ 4" },
  { value: 4, label: "Thứ 5" },
  { value: 5, label: "Thứ 6" },
  { value: 6, label: "Thứ 7" },
  { value: 0, label: "Chủ nhật" },
];

const emptyForm = {
  title: "",
  subject: "",
  day: 1,
  startTime: "08:00",
  endTime: "09:30",
  location: "",
  note: "",
};

export default function ScheduleView() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async (uid: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await listUserDocuments<ScheduleItem>(uid, "schedule");
      setItems(
        data
          .filter((item) => typeof item.day === "number")
          .sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime)),
      );
    } catch {
      setError("Không thể tải thời khóa biểu. Hãy kiểm tra Firestore Rules và thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
      if (user) void load(user.uid);
      else setLoading(false);
    });
  }, []);

  const grouped = useMemo(
    () => days.map((day) => ({ ...day, items: items.filter((item) => item.day === day.value) })),
    [items],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId || !form.title.trim() || form.startTime >= form.endTime) return;

    setSaving(true);
    setError("");
    const payload = {
      title: form.title.trim(),
      subject: form.subject.trim(),
      day: Number(form.day),
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location.trim(),
      note: form.note.trim(),
    };

    try {
      if (editingId) await updateUserDocument(userId, "schedule", editingId, payload);
      else await createUserDocument(userId, "schedule", payload);
      await load(userId);
      setForm(emptyForm);
      setEditingId(null);
    } catch {
      setError("Không thể lưu lịch. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const edit = (item: ScheduleItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      subject: item.subject,
      day: item.day,
      startTime: item.startTime,
      endTime: item.endTime,
      location: item.location,
      note: item.note,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id: string) => {
    if (!userId || !window.confirm("Xóa buổi học này khỏi thời khóa biểu?")) return;
    try {
      await deleteUserDocument(userId, "schedule", id);
      setItems((current) => current.filter((item) => item.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
    } catch {
      setError("Không thể xóa lịch. Vui lòng thử lại.");
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f8fc]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wider text-indigo-600">Tools</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Thời khóa biểu</h1>
          <p className="mt-2 max-w-2xl text-gray-600">Tạo và quản lý lịch học cá nhân. Dữ liệu được lưu riêng theo tài khoản Firebase của bạn.</p>
        </div>

        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-950">{editingId ? "Chỉnh sửa buổi học" : "Thêm buổi học"}</h2>
              <p className="mt-1 text-sm text-gray-500">Điền các thông tin cần thiết, sau đó lưu lại.</p>
            </div>
            {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Hủy sửa</button>}
          </div>

          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="lg:col-span-2"><span className="mb-1.5 block text-sm font-semibold text-gray-700">Tên buổi học *</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ví dụ: Toán THPTQG" className="w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500" /></label>
            <label><span className="mb-1.5 block text-sm font-semibold text-gray-700">Môn</span><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Toán" className="w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500" /></label>
            <label><span className="mb-1.5 block text-sm font-semibold text-gray-700">Ngày</span><select value={form.day} onChange={(e) => setForm({ ...form, day: Number(e.target.value) })} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500">{days.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
            <label><span className="mb-1.5 block text-sm font-semibold text-gray-700">Bắt đầu</span><input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500" /></label>
            <label><span className="mb-1.5 block text-sm font-semibold text-gray-700">Kết thúc</span><input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500" /></label>
            <label><span className="mb-1.5 block text-sm font-semibold text-gray-700">Địa điểm</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Phòng học / Online" className="w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500" /></label>
            <label><span className="mb-1.5 block text-sm font-semibold text-gray-700">Ghi chú</span><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Nội dung cần nhớ" className="w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500" /></label>
            <div className="flex items-end"><button disabled={saving || !userId || form.startTime >= form.endTime} className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Đang lưu..." : editingId ? "💾 Lưu thay đổi" : "＋ Thêm vào lịch"}</button></div>
          </form>
          {form.startTime >= form.endTime && <p className="mt-2 text-sm text-red-600">Giờ kết thúc phải sau giờ bắt đầu.</p>}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-gray-950">Lịch trong tuần</h2><span className="text-sm text-gray-500">{items.length} buổi</span></div>
          {loading ? <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">Đang tải thời khóa biểu...</div> : items.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center"><div className="text-4xl">📅</div><h3 className="mt-3 text-lg font-bold text-gray-900">Chưa có lịch học</h3><p className="mt-1 text-sm text-gray-500">Thêm buổi học đầu tiên ở biểu mẫu phía trên.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{grouped.map((day) => <div key={day.value} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><h3 className="mb-3 border-b border-gray-100 pb-3 font-bold text-gray-900">{day.label}</h3>{day.items.length === 0 ? <p className="py-4 text-sm text-gray-400">Trống</p> : <div className="space-y-3">{day.items.map((item) => <article key={item.id} className="rounded-xl bg-gray-50 p-3"><div className="flex items-start justify-between gap-2"><div><div className="font-bold text-gray-900">{item.title}</div>{item.subject && <div className="mt-0.5 text-sm text-indigo-600">{item.subject}</div>}</div><span className="whitespace-nowrap text-xs font-bold text-gray-600">{item.startTime}–{item.endTime}</span></div>{item.location && <div className="mt-2 text-xs text-gray-500">📍 {item.location}</div>}{item.note && <div className="mt-1 text-xs text-gray-500">📝 {item.note}</div>}<div className="mt-3 flex gap-2"><button type="button" onClick={() => edit(item)} className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100">Sửa</button><button type="button" onClick={() => void remove(item.id)} className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-gray-200 hover:bg-red-50">Xóa</button></div></article>)}</div>}</div>)}</div>}
        </section>
      </div>
    </main>
  );
}
