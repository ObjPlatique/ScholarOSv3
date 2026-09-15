"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  createUserDocument,
  deleteUserDocument,
  listUserDocuments,
  updateUserDocument,
} from "@/lib/firestore";

type Task = {
  id: string;
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  completed?: boolean;
};

const priorityLabel = { low: "Thấp", medium: "Trung bình", high: "Cao" } as const;

export default function TasksView() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    listUserDocuments<Task>(user.uid, "tasks")
      .then(setTasks)
      .catch(() => setError("Không thể tải danh sách nhiệm vụ."))
      .finally(() => setLoading(false));
  }, [user]);

  const visibleTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
    });
    if (filter === "active") return sorted.filter((task) => !task.completed);
    if (filter === "completed") return sorted.filter((task) => task.completed);
    return sorted;
  }, [tasks, filter]);

  const activeCount = tasks.filter((task) => !task.completed).length;
  const completedCount = tasks.filter((task) => task.completed).length;

  function resetForm() {
    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("medium");
    setEditingId(null);
  }

  async function submitTask(event: FormEvent) {
    event.preventDefault();
    if (!user || !title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const data = {
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate || "",
        priority: priority || "medium",
        completed: false,
      };
      if (editingId) {
        await updateUserDocument(user.uid, "tasks", editingId, data);
        setTasks((current) => current.map((task) => task.id === editingId ? { ...task, ...data } : task));
      } else {
        const ref = await createUserDocument(user.uid, "tasks", data);
        setTasks((current) => [...current, { ...data, id: ref.id }]);
      }
      resetForm();
    } catch {
      setError("Không thể lưu nhiệm vụ. Hãy thử lại.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setTitle(task.title || "");
    setDescription(task.description || "");
    setDueDate(task.dueDate || "");
    setPriority(task.priority || "medium");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleTask(task: Task) {
    if (!user) return;
    setError("");
    try {
      const completed = !task.completed;
      await updateUserDocument(user.uid, "tasks", task.id, { completed });
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed } : item));
    } catch {
      setError("Không thể cập nhật nhiệm vụ.");
    }
  }

  async function removeTask(task: Task) {
    if (!user || !window.confirm(`Xóa nhiệm vụ "${task.title || "này"}"?`)) return;
    try {
      await deleteUserDocument(user.uid, "tasks", task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch {
      setError("Không thể xóa nhiệm vụ.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wider text-indigo-600">Tools</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Tasks</h1>
          <p className="mt-2 max-w-2xl text-gray-600">Quản lý bài tập, công việc và những việc cần hoàn thành.</p>
        </div>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Tổng nhiệm vụ</p><p className="mt-1 text-3xl font-bold text-gray-950">{tasks.length}</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Đang làm</p><p className="mt-1 text-3xl font-bold text-indigo-600">{activeCount}</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Đã hoàn thành</p><p className="mt-1 text-3xl font-bold text-emerald-600">{completedCount}</p></div>
        </section>

        <form onSubmit={submitTask} className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-gray-950">{editingId ? "Chỉnh sửa nhiệm vụ" : "Thêm nhiệm vụ"}</h2>
            {editingId && <button type="button" onClick={resetForm} className="text-sm font-semibold text-gray-500 hover:text-gray-900">Hủy chỉnh sửa</button>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold text-gray-700">Tên nhiệm vụ *</span><input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ví dụ: Làm bài Toán HSA" className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
            <label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold text-gray-700">Mô tả</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Ghi chú ngắn..." className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
            <label><span className="mb-1 block text-sm font-semibold text-gray-700">Hạn hoàn thành</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
            <label><span className="mb-1 block text-sm font-semibold text-gray-700">Ưu tiên</span><select value={priority} onChange={(e) => setPriority(e.target.value as Task["priority"])} className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option></select></label>
          </div>
          <button disabled={saving} className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "+ Thêm nhiệm vụ"}</button>
        </form>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h2 className="text-xl font-bold text-gray-950">Danh sách nhiệm vụ</h2>
            <div className="flex rounded-xl bg-gray-100 p-1 text-sm font-semibold">
              {([['all', 'Tất cả'], ['active', 'Đang làm'], ['completed', 'Hoàn thành']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 ${filter === value ? "bg-white text-gray-950 shadow-sm" : "text-gray-500"}`}>{label}</button>)}
            </div>
          </div>
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {loading ? <p className="py-10 text-center text-gray-500">Đang tải nhiệm vụ...</p> : visibleTasks.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center"><p className="text-lg font-semibold text-gray-800">Chưa có nhiệm vụ</p><p className="mt-1 text-gray-500">Thêm nhiệm vụ đầu tiên ở biểu mẫu phía trên.</p></div> : <div className="space-y-3">{visibleTasks.map((task) => <article key={task.id} className={`rounded-xl border p-4 transition ${task.completed ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white"}`}><div className="flex items-start gap-3"><button type="button" onClick={() => toggleTask(task)} aria-label={task.completed ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"} className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${task.completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300"}`}>{task.completed ? "✓" : ""}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className={`font-bold ${task.completed ? "text-gray-400 line-through" : "text-gray-950"}`}>{task.title}</h3>{task.priority && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${task.priority === "high" ? "bg-red-50 text-red-700" : task.priority === "low" ? "bg-gray-100 text-gray-600" : "bg-amber-50 text-amber-700"}`}>{priorityLabel[task.priority]}</span>}</div>{task.description && <p className="mt-1 text-sm text-gray-600">{task.description}</p>}<div className="mt-2 text-xs font-medium text-gray-500">{task.dueDate ? `Hạn: ${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${task.dueDate}T00:00:00`))}` : "Không đặt hạn"}</div></div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => startEdit(task)} className="rounded-lg px-2.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Sửa</button><button type="button" onClick={() => removeTask(task)} className="rounded-lg px-2.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Xóa</button></div></div></article>)}</div>}
        </section>
      </div>
    </main>
  );
}
