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
const priorityRank = { high: 0, medium: 1, low: 2 } as const;

function todayString() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export default function TasksView() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "today" | "active" | "completed">("all");
  const [query, setQuery] = useState("");
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
    setError("");
    listUserDocuments<Task>(user.uid, "tasks")
      .then(setTasks)
      .catch(() => setError("Không thể tải danh sách nhiệm vụ."))
      .finally(() => setLoading(false));
  }, [user]);

  const today = todayString();
  const activeCount = tasks.filter((task) => !task.completed).length;
  const completedCount = tasks.filter((task) => task.completed).length;
  const todayCount = tasks.filter((task) => task.dueDate === today).length;
  const overdueCount = tasks.filter((task) => !task.completed && !!task.dueDate && task.dueDate < today).length;
  const completionRate = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = tasks.filter((task) => {
      if (filter === "today" && task.dueDate !== today) return false;
      if (filter === "active" && task.completed) return false;
      if (filter === "completed" && !task.completed) return false;
      if (!normalizedQuery) return true;
      return `${task.title || ""} ${task.description || ""}`.toLowerCase().includes(normalizedQuery);
    });

    return filtered.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const aOverdue = !a.completed && !!a.dueDate && a.dueDate < today;
      const bOverdue = !b.completed && !!b.dueDate && b.dueDate < today;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      const dueCompare = (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
      if (dueCompare !== 0) return dueCompare;
      return priorityRank[a.priority || "medium"] - priorityRank[b.priority || "medium"];
    });
  }, [tasks, filter, query, today]);

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

  async function duplicateTask(task: Task) {
    if (!user) return;
    setError("");
    try {
      const ref = await createUserDocument(user.uid, "tasks", {
        title: `${task.title || "Nhiệm vụ"} (bản sao)`,
        description: task.description || "",
        dueDate: task.dueDate || "",
        priority: task.priority || "medium",
        completed: false,
      });
      setTasks((current) => [...current, { ...task, id: ref.id, title: `${task.title || "Nhiệm vụ"} (bản sao)`, completed: false }]);
    } catch {
      setError("Không thể sao chép nhiệm vụ.");
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

  async function clearCompleted() {
    if (!user || completedCount === 0 || !window.confirm(`Xóa ${completedCount} nhiệm vụ đã hoàn thành?`)) return;
    setError("");
    try {
      await Promise.all(tasks.filter((task) => task.completed).map((task) => deleteUserDocument(user.uid, "tasks", task.id)));
      setTasks((current) => current.filter((task) => !task.completed));
    } catch {
      setError("Không thể xóa các nhiệm vụ đã hoàn thành.");
    }
  }

  const formatDate = (value?: string) => value ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`)) : "Không đặt hạn";

  return (
    <main className="min-h-screen bg-[#f7f8fc] dark:bg-[#333333] dark:text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wider text-indigo-600">Tools</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-4xl">Tasks</h1>
          <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">Quản lý bài tập, công việc và những việc cần hoàn thành.</p>
        </div>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040]"><p className="text-sm text-gray-500 dark:text-gray-300">Tổng nhiệm vụ</p><p className="mt-1 text-3xl font-bold text-gray-950 dark:text-white">{tasks.length}</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040]"><p className="text-sm text-gray-500 dark:text-gray-300">Đang làm</p><p className="mt-1 text-3xl font-bold text-indigo-600">{activeCount}</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040]"><p className="text-sm text-gray-500 dark:text-gray-300">Hôm nay</p><p className="mt-1 text-3xl font-bold text-amber-600">{todayCount}</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040]"><p className="text-sm text-gray-500 dark:text-gray-300">Tiến độ</p><p className="mt-1 text-3xl font-bold text-emerald-600">{completionRate}%</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completionRate}%` }} /></div></div>
        </section>

        {overdueCount > 0 && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">⚠ Bạn có {overdueCount} nhiệm vụ quá hạn chưa hoàn thành.</div>}

        <form onSubmit={submitTask} className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040] sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-gray-950 dark:text-white">{editingId ? "Chỉnh sửa nhiệm vụ" : "Thêm nhiệm vụ"}</h2>
            {editingId && <button type="button" onClick={resetForm} className="text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Hủy chỉnh sửa</button>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">Tên nhiệm vụ *</span><input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ví dụ: Làm bài Toán HSA" className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-600 dark:bg-[#333333] dark:text-white dark:placeholder:text-gray-400" /></label>
            <label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">Mô tả</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Ghi chú ngắn..." className="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-600 dark:bg-[#333333] dark:text-white dark:placeholder:text-gray-400" /></label>
            <label><span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">Hạn hoàn thành</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-600 dark:bg-[#333333] dark:text-white" /></label>
            <label><span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">Ưu tiên</span><select value={priority} onChange={(e) => setPriority(e.target.value as Task["priority"])} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-600 dark:bg-[#333333] dark:text-white"><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option></select></label>
          </div>
          <button disabled={saving} className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "+ Thêm nhiệm vụ"}</button>
        </form>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040] sm:p-6">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-xl font-bold text-gray-950 dark:text-white">Danh sách nhiệm vụ</h2>
            <div className="flex flex-wrap gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm nhiệm vụ..." className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white dark:placeholder:text-gray-400" />
              <div className="flex flex-wrap rounded-xl bg-gray-100 p-1 text-sm font-semibold dark:bg-[#333333]">
                {([['all', 'Tất cả'], ['today', 'Hôm nay'], ['active', 'Đang làm'], ['completed', 'Hoàn thành']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 ${filter === value ? "bg-white text-gray-950 shadow-sm dark:bg-[#505050] dark:text-white" : "text-gray-500 dark:text-gray-300"}`}>{label}</button>)}
              </div>
              {completedCount > 0 && <button type="button" onClick={clearCompleted} className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40">Xóa đã hoàn thành</button>}
            </div>
          </div>
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
          {loading ? <p className="py-10 text-center text-gray-500 dark:text-gray-300">Đang tải nhiệm vụ...</p> : visibleTasks.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center dark:border-gray-600"><p className="text-lg font-semibold text-gray-800 dark:text-white">Chưa có nhiệm vụ phù hợp</p><p className="mt-1 text-gray-500 dark:text-gray-300">Thêm nhiệm vụ mới hoặc thay đổi bộ lọc tìm kiếm.</p></div> : <div className="space-y-3">{visibleTasks.map((task) => {
            const overdue = !task.completed && !!task.dueDate && task.dueDate < today;
            return <article key={task.id} className={`rounded-xl border p-4 transition ${task.completed ? "border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-[#383838]" : overdue ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20" : "border-gray-200 bg-white dark:border-gray-600 dark:bg-[#404040]"}`}>
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => toggleTask(task)} aria-label={task.completed ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"} className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${task.completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 dark:border-gray-500"}`}>{task.completed ? "✓" : ""}</button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className={`font-bold ${task.completed ? "text-gray-400 line-through" : "text-gray-950 dark:text-white"}`}>{task.title}</h3>{task.priority && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${task.priority === "high" ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" : task.priority === "low" ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}`}>{priorityLabel[task.priority]}</span>}{overdue && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300">Quá hạn</span>}</div>
                  {task.description && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{task.description}</p>}
                  <div className={`mt-2 text-xs font-medium ${overdue ? "text-red-600 dark:text-red-300" : "text-gray-500 dark:text-gray-300"}`}>{task.dueDate ? `Hạn: ${formatDate(task.dueDate)}` : "Không đặt hạn"}{task.dueDate === today ? " · Hôm nay" : ""}</div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1"><button type="button" onClick={() => startEdit(task)} className="rounded-lg px-2.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600">Sửa</button><button type="button" onClick={() => duplicateTask(task)} className="rounded-lg px-2.5 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40">Sao chép</button><button type="button" onClick={() => removeTask(task)} className="rounded-lg px-2.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40">Xóa</button></div>
              </div>
            </article>;
          })}</div>}
        </section>
      </div>
    </main>
  );
}
