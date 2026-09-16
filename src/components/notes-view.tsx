"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createUserDocument, deleteUserDocument, listUserDocuments, updateUserDocument } from "@/lib/firestore";

type Note = { id: string; title?: string; content?: string; category?: string; pinned?: boolean; favorite?: boolean; color?: string; createdAt?: string; updatedAt?: string };

const noteColors = [
  { name: "Mặc định", value: "default", className: "bg-white dark:bg-[#333333]" },
  { name: "Xanh", value: "blue", className: "bg-blue-50 dark:bg-blue-950/30" },
  { name: "Vàng", value: "yellow", className: "bg-amber-50 dark:bg-amber-950/30" },
  { name: "Xanh lá", value: "green", className: "bg-emerald-50 dark:bg-emerald-950/30" },
  { name: "Tím", value: "purple", className: "bg-purple-50 dark:bg-purple-950/30" },
];

export default function NotesView() {
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [view, setView] = useState<"all" | "favorites" | "pinned">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [noteCategory, setNoteCategory] = useState("Học tập");
  const [noteColor, setNoteColor] = useState("default");

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    listUserDocuments<Note>(user.uid, "notes")
      .then((items) => setNotes(items.map((n) => ({ ...n, pinned: n.pinned === true, favorite: n.favorite === true, category: n.category || "Học tập", color: n.color || "default" }))))
      .catch(() => setError("Không thể tải ghi chú."))
      .finally(() => setLoading(false));
  }, [user]);

  const categories = useMemo(() => ["Tất cả", ...Array.from(new Set(notes.map((n) => n.category || "Học tập")))], [notes]);
  const visibleNotes = useMemo(() => notes.filter((note) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || `${note.title || ""} ${note.content || ""} ${note.category || ""}`.toLowerCase().includes(q);
    const matchesCategory = category === "Tất cả" || (note.category || "Học tập") === category;
    const matchesView = view === "all" || (view === "favorites" && note.favorite) || (view === "pinned" && note.pinned);
    return matchesSearch && matchesCategory && matchesView;
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.favorite) - Number(a.favorite)), [notes, search, category, view]);

  const stats = useMemo(() => ({ total: notes.length, pinned: notes.filter((n) => n.pinned).length, favorites: notes.filter((n) => n.favorite).length, categories: new Set(notes.map((n) => n.category || "Học tập")).size }), [notes]);

  function resetForm() { setTitle(""); setContent(""); setNoteCategory("Học tập"); setNoteColor("default"); setEditingId(null); }
  function editNote(note: Note) { setEditingId(note.id); setTitle(note.title || ""); setContent(note.content || ""); setNoteCategory(note.category || "Học tập"); setNoteColor(note.color || "default"); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    if (!user || !title.trim()) return;
    setSaving(true); setError("");
    try {
      const data = { title: title.trim(), content: content.trim(), category: noteCategory.trim() || "Học tập", color: noteColor, pinned: editingId ? notes.find((n) => n.id === editingId)?.pinned === true : false, favorite: editingId ? notes.find((n) => n.id === editingId)?.favorite === true : false, updatedAt: new Date().toISOString(), ...(editingId ? {} : { createdAt: new Date().toISOString() }) };
      if (editingId) {
        await updateUserDocument(user.uid, "notes", editingId, data);
        setNotes((current) => current.map((n) => n.id === editingId ? { ...n, ...data } : n));
      } else {
        const ref = await createUserDocument(user.uid, "notes", data);
        setNotes((current) => [...current, { ...data, id: ref.id }]);
      }
      resetForm();
    } catch { setError("Không thể lưu ghi chú. Hãy thử lại."); }
    finally { setSaving(false); }
  }

  async function togglePin(note: Note) {
    if (!user) return;
    try { const pinned = !note.pinned; await updateUserDocument(user.uid, "notes", note.id, { pinned, updatedAt: new Date().toISOString() }); setNotes((items) => items.map((n) => n.id === note.id ? { ...n, pinned } : n)); }
    catch { setError("Không thể cập nhật ghi chú."); }
  }

  async function toggleFavorite(note: Note) {
    if (!user) return;
    try { const favorite = !note.favorite; await updateUserDocument(user.uid, "notes", note.id, { favorite, updatedAt: new Date().toISOString() }); setNotes((items) => items.map((n) => n.id === note.id ? { ...n, favorite } : n)); }
    catch { setError("Không thể cập nhật ghi chú."); }
  }

  async function duplicateNote(note: Note) {
    if (!user) return;
    try {
      const data = { title: `${note.title || "Ghi chú"} (bản sao)`, content: note.content || "", category: note.category || "Học tập", color: note.color || "default", pinned: false, favorite: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const ref = await createUserDocument(user.uid, "notes", data);
      setNotes((items) => [...items, { ...data, id: ref.id }]);
    } catch { setError("Không thể sao chép ghi chú."); }
  }

  async function removeNote(note: Note) {
    if (!user || !window.confirm(`Xóa ghi chú "${note.title || "này"}"?`)) return;
    try { await deleteUserDocument(user.uid, "notes", note.id); setNotes((items) => items.filter((n) => n.id !== note.id)); if (editingId === note.id) resetForm(); }
    catch { setError("Không thể xóa ghi chú."); }
  }

  function noteClass(color?: string) { return noteColors.find((c) => c.value === color)?.className || noteColors[0].className; }

  return <main className="min-h-screen bg-[#f7f8fc] dark:bg-[#333333] dark:text-white"><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
    <div className="mb-8"><div className="text-sm font-bold uppercase tracking-wider text-indigo-600">Tools</div><h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-4xl">Notes</h1><p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">Ghi lại kiến thức, ý tưởng và những điều quan trọng trong quá trình học.</p></div>
    <section className="mb-6 grid gap-4 sm:grid-cols-4"><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040]"><p className="text-sm text-gray-500 dark:text-gray-300">Tổng ghi chú</p><p className="mt-1 text-3xl font-bold text-gray-950 dark:text-white">{stats.total}</p></div><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040]"><p className="text-sm text-gray-500 dark:text-gray-300">Đã ghim</p><p className="mt-1 text-3xl font-bold text-amber-600">{stats.pinned}</p></div><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040]"><p className="text-sm text-gray-500 dark:text-gray-300">Yêu thích</p><p className="mt-1 text-3xl font-bold text-rose-600">{stats.favorites}</p></div><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040]"><p className="text-sm text-gray-500 dark:text-gray-300">Danh mục</p><p className="mt-1 text-3xl font-bold text-indigo-600">{stats.categories}</p></div></section>
    <form onSubmit={saveNote} className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040] sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-bold text-gray-950 dark:text-white">{editingId ? "Chỉnh sửa ghi chú" : "Tạo ghi chú"}</h2>{editingId && <button type="button" onClick={resetForm} className="text-sm font-semibold text-gray-500 dark:text-gray-300">Hủy</button>}</div><div className="grid gap-4 md:grid-cols-3"><label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">Tiêu đề *</span><input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Công thức Toán HSA" className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white" /></label><label><span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">Danh mục</span><input value={noteCategory} onChange={(e) => setNoteCategory(e.target.value)} placeholder="Học tập" className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white" /></label><label className="md:col-span-3"><span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">Nội dung</span><textarea value={content} onChange={(e) => setContent(e.target.value)} rows={7} placeholder="Viết ghi chú của bạn..." className="w-full resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white" /></label><div className="md:col-span-3"><span className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">Màu ghi chú</span><div className="flex flex-wrap gap-2">{noteColors.map((c) => <button type="button" key={c.value} onClick={() => setNoteColor(c.value)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${noteColor === c.value ? "border-indigo-500 ring-2 ring-indigo-100" : "border-gray-300 dark:border-gray-600"}`}>{c.name}</button>)}</div></div></div><button disabled={saving} className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "+ Tạo ghi chú"}</button></form>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040] sm:p-6"><div className="mb-5 flex flex-col gap-3"><div className="flex flex-col gap-3 md:flex-row"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔎 Tìm trong ghi chú..." className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white" /><select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-gray-600 dark:bg-[#333333] dark:text-white">{categories.map((c) => <option key={c}>{c}</option>)}</select></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setView("all")} className={`rounded-xl px-4 py-2 text-sm font-bold ${view === "all" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-[#333333] dark:text-gray-200"}`}>Tất cả</button><button type="button" onClick={() => setView("pinned")} className={`rounded-xl px-4 py-2 text-sm font-bold ${view === "pinned" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-[#333333] dark:text-gray-200"}`}>📌 Đã ghim</button><button type="button" onClick={() => setView("favorites")} className={`rounded-xl px-4 py-2 text-sm font-bold ${view === "favorites" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-[#333333] dark:text-gray-200"}`}>♥ Yêu thích</button></div></div>{error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{loading ? <p className="py-10 text-center text-gray-500">Đang tải ghi chú...</p> : visibleNotes.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center dark:border-gray-600"><p className="text-lg font-semibold text-gray-800 dark:text-gray-200">{notes.length ? "Không tìm thấy ghi chú" : "Chưa có ghi chú"}</p><p className="mt-1 text-gray-500 dark:text-gray-400">{notes.length ? "Thử thay đổi từ khóa, danh mục hoặc bộ lọc." : "Tạo ghi chú đầu tiên ở biểu mẫu phía trên."}</p></div> : <div className="grid gap-4 md:grid-cols-2">{visibleNotes.map((note) => <article key={note.id} className={`rounded-2xl border border-gray-200 p-5 shadow-sm dark:border-gray-600 ${noteClass(note.color)}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-gray-950 dark:text-white">{note.title}</h3>{note.pinned && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-200">📌 Ghim</span>}{note.favorite && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-200">♥ Yêu thích</span>}</div><span className="mt-2 inline-block rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{note.category || "Học tập"}</span></div><div className="flex gap-1"><button type="button" onClick={() => togglePin(note)} className="rounded-lg px-2 py-1 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-[#404040]">{note.pinned ? "Bỏ ghim" : "Ghim"}</button><button type="button" onClick={() => toggleFavorite(note)} className="rounded-lg px-2 py-1 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-[#404040]">{note.favorite ? "Bỏ thích" : "♥"}</button></div></div>{note.content && <p className="mt-4 max-h-52 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-200">{note.content}</p>}<div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-gray-600"><button type="button" onClick={() => editNote(note)} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-[#404040]">Sửa</button><button type="button" onClick={() => duplicateNote(note)} className="rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-[#404040]">Sao chép</button><button type="button" onClick={() => removeNote(note)} className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-[#404040]">Xóa</button></div>{note.updatedAt && <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">Cập nhật: {new Date(note.updatedAt).toLocaleString("vi-VN")}</p>}</article>)}</div>}</section>
  </div></main>;
}
