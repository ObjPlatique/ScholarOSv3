"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createUserDocument, deleteUserDocument, listUserDocuments, updateUserDocument } from "@/lib/firestore";

type Note = { id: string; title?: string; content?: string; category?: string; pinned?: boolean };

export default function NotesView() {
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [noteCategory, setNoteCategory] = useState("Học tập");

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    listUserDocuments<Note>(user.uid, "notes")
      .then((items) => setNotes(items.map((n) => ({ ...n, pinned: n.pinned === true, category: n.category || "Học tập" }))))
      .catch(() => setError("Không thể tải ghi chú."))
      .finally(() => setLoading(false));
  }, [user]);

  const categories = useMemo(() => ["Tất cả", ...Array.from(new Set(notes.map((n) => n.category || "Học tập")))], [notes]);
  const visibleNotes = useMemo(() => notes.filter((note) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || `${note.title || ""} ${note.content || ""} ${note.category || ""}`.toLowerCase().includes(q);
    return matchesSearch && (category === "Tất cả" || (note.category || "Học tập") === category);
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned)), [notes, search, category]);

  function resetForm() { setTitle(""); setContent(""); setNoteCategory("Học tập"); setEditingId(null); }
  function editNote(note: Note) { setEditingId(note.id); setTitle(note.title || ""); setContent(note.content || ""); setNoteCategory(note.category || "Học tập"); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    if (!user || !title.trim()) return;
    setSaving(true); setError("");
    try {
      const data = { title: title.trim(), content: content.trim(), category: noteCategory.trim() || "Học tập", pinned: editingId ? notes.find((n) => n.id === editingId)?.pinned === true : false };
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
    try { const pinned = !note.pinned; await updateUserDocument(user.uid, "notes", note.id, { pinned }); setNotes((items) => items.map((n) => n.id === note.id ? { ...n, pinned } : n)); }
    catch { setError("Không thể cập nhật ghi chú."); }
  }

  async function removeNote(note: Note) {
    if (!user || !window.confirm(`Xóa ghi chú "${note.title || "này"}"?`)) return;
    try { await deleteUserDocument(user.uid, "notes", note.id); setNotes((items) => items.filter((n) => n.id !== note.id)); if (editingId === note.id) resetForm(); }
    catch { setError("Không thể xóa ghi chú."); }
  }

  return <main className="min-h-screen bg-[#f7f8fc]"><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
    <div className="mb-8"><div className="text-sm font-bold uppercase tracking-wider text-indigo-600">Tools</div><h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Notes</h1><p className="mt-2 max-w-2xl text-gray-600">Ghi lại kiến thức, ý tưởng và những điều quan trọng trong quá trình học.</p></div>
    <form onSubmit={saveNote} className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-bold text-gray-950">{editingId ? "Chỉnh sửa ghi chú" : "Tạo ghi chú"}</h2>{editingId && <button type="button" onClick={resetForm} className="text-sm font-semibold text-gray-500">Hủy</button>}</div><div className="grid gap-4 md:grid-cols-3"><label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold text-gray-700">Tiêu đề *</span><input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Công thức Toán HSA" className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label><label><span className="mb-1 block text-sm font-semibold text-gray-700">Danh mục</span><input value={noteCategory} onChange={(e) => setNoteCategory(e.target.value)} placeholder="Học tập" className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label><label className="md:col-span-3"><span className="mb-1 block text-sm font-semibold text-gray-700">Nội dung</span><textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} placeholder="Viết ghi chú của bạn..." className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label></div><button disabled={saving} className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "+ Tạo ghi chú"}</button></form>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex flex-col gap-3 md:flex-row"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔎 Tìm trong ghi chú..." className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-indigo-500" /><select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-gray-300 px-4 py-3">{categories.map((c) => <option key={c}>{c}</option>)}</select></div>{error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{loading ? <p className="py-10 text-center text-gray-500">Đang tải ghi chú...</p> : visibleNotes.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center"><p className="text-lg font-semibold text-gray-800">{notes.length ? "Không tìm thấy ghi chú" : "Chưa có ghi chú"}</p><p className="mt-1 text-gray-500">{notes.length ? "Thử thay đổi từ khóa hoặc danh mục." : "Tạo ghi chú đầu tiên ở biểu mẫu phía trên."}</p></div> : <div className="grid gap-4 md:grid-cols-2">{visibleNotes.map((note) => <article key={note.id} className="rounded-2xl border border-gray-200 p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-gray-950">{note.title}</h3>{note.pinned && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">📌 Ghim</span>}</div><span className="mt-2 inline-block rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{note.category || "Học tập"}</span></div><button type="button" onClick={() => togglePin(note)} className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100">{note.pinned ? "Bỏ ghim" : "Ghim"}</button></div>{note.content && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-600">{note.content}</p>}<div className="mt-5 flex gap-2 border-t border-gray-100 pt-3"><button type="button" onClick={() => editNote(note)} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Sửa</button><button type="button" onClick={() => removeNote(note)} className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Xóa</button></div></article>)}</div>}</section>
  </div></main>;
}
