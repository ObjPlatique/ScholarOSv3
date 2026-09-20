"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Search, Trash2 } from "lucide-react";
import { auth } from "../../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { deleteUserDocument, listUserDocuments, updateUserDocument } from "../../../../lib/firestore";

type ErrorLog = {
  id: string; type?: string; source?: string; subject?: string; question?: string;
  studentAnswer?: string; score?: number; mistakes?: string[]; suggestions?: string[];
  feedback?: string; resolved?: boolean; createdAt?: unknown;
};

export default function ErrorLogsPage() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(uid: string) {
    try {
      const items = await listUserDocuments<ErrorLog>(uid, "errorLogs");
      setLogs(items);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) { setLogs([]); setLoading(false); return; }
      void load(user.uid);
    });
  }, []);

  const filtered = logs.filter((log) => {
    const haystack = [log.subject, log.question, log.source, ...(log.mistakes || [])].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  async function toggle(log: ErrorLog) {
    const user = auth.currentUser; if (!user) return;
    const next = !log.resolved;
    await updateUserDocument(user.uid, "errorLogs", log.id, { resolved: next });
    setLogs((items) => items.map((x) => x.id === log.id ? { ...x, resolved: next } : x));
  }

  async function remove(log: ErrorLog) {
    const user = auth.currentUser; if (!user) return;
    await deleteUserDocument(user.uid, "errorLogs", log.id);
    setLogs((items) => items.filter((x) => x.id !== log.id));
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-gray-900 dark:bg-[#333333] dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header><div className="mb-2 flex items-center gap-2 text-red-600 dark:text-red-400"><AlertCircle size={20}/><span className="text-sm font-semibold">ERROR LOGS</span></div>
          <h1 className="text-3xl font-bold">Error Logs</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">Tập hợp những lỗi học tập được phát hiện từ Answer Grader.</p>
        </header>
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-[#404040]">
          <Search size={18} className="text-gray-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm lỗi..." className="min-w-0 flex-1 bg-transparent outline-none"/>
          <span className="text-sm text-gray-500">{filtered.length}</span>
        </div>
        {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin"/></div> :
          !filtered.length ? <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-600"><CheckCircle2 className="mx-auto mb-3 text-emerald-500"/><p>Chưa có Error Log.</p></div> :
          <div className="space-y-4">{filtered.map(log => <article key={log.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#404040]">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">{log.subject || "Không xác định"} · {log.source || "AI"}</div><h2 className="mt-1 font-bold">{log.question || "Lỗi học tập"}</h2></div>
              <div className="flex gap-2"><button onClick={()=>void toggle(log)} className="rounded-lg border px-3 py-2 text-sm">{log.resolved ? "Chưa sửa" : "Đã sửa"}</button><button onClick={()=>void remove(log)} className="rounded-lg border p-2 text-red-600" aria-label="Xóa"><Trash2 size={16}/></button></div></div>
            <div className="mt-4 grid gap-4 md:grid-cols-2"><div><h3 className="font-semibold">Lỗi</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{(log.mistakes||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div><div><h3 className="font-semibold">Cách cải thiện</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{(log.suggestions||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div></div>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">{log.feedback}</p>
          </article>)}</div>}
      </div>
    </main>
  );
}
