"use client";

import { FormEvent, useMemo, useState } from "react";
import { Bot, BookOpen, Calculator, Lightbulb, Send, Sparkles, User } from "lucide-react";
import MarkdownRenderer from "../../../../components/markdown-renderer";

type Message = { role: "user" | "model"; text: string };
const quickPrompts = [
  { label: "Giải thích bài học", icon: BookOpen, text: "Giải thích cho mình một khái niệm khó theo cách dễ hiểu, kèm ví dụ." },
  { label: "Giải bài tập", icon: Calculator, text: "Giúp mình giải bài tập này từng bước và giải thích vì sao làm như vậy: " },
  { label: "Gợi ý cách học", icon: Lightbulb, text: "Gợi ý cách học hiệu quả cho một chủ đề mình đang gặp khó khăn: " },
];
function formatAiText(text: string) { return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(); }

export default function StudyAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hasMessages = messages.length > 0;
  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault(); const message = input.trim(); if (!message || loading) return;
    const previousMessages = messages; setInput(""); setError(""); setMessages((current) => [...current, { role: "user", text: message }]); setLoading(true);
    try { const response = await fetch("/api/ai/study-assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history: previousMessages }) }); const data = (await response.json()) as { text?: string; error?: string }; if (!response.ok || !data.text) throw new Error(data.error || "Study Assistant gặp lỗi."); setMessages((current) => [...current, { role: "model", text: formatAiText(data.text!) }]); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Không thể nhận phản hồi từ AI."); setMessages(previousMessages); }
    finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-[#f7f8fc] dark:bg-[#333333]"><div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col px-3 py-4 sm:px-6 sm:py-8">
    <header className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-600 dark:bg-[#3b3b3b] sm:p-6"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"><Sparkles size={22} /></div><div className="min-w-0"><div className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">AI · Study Assistant</div><h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-3xl">Học cùng ScholarOS</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-300 sm:text-base">Hỏi bài, yêu cầu giải thích hoặc nhờ AI hướng dẫn cách học.</p></div></div></header>
    <section className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-[#3b3b3b]"><div className="flex-1 overflow-y-auto p-3 sm:p-6">
      {!hasMessages ? <div className="flex min-h-[390px] flex-col items-center justify-center text-center"><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"><Bot size={32} /></div><h2 className="text-xl font-bold text-gray-900 dark:text-white">Mình có thể giúp gì?</h2><p className="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-300">Đặt câu hỏi về bài học, gửi đề bài hoặc yêu cầu giải thích một khái niệm.</p><div className="mt-6 grid w-full max-w-2xl gap-3 sm:grid-cols-3">{quickPrompts.map(({ label, icon: Icon, text }) => <button key={label} type="button" onClick={() => setInput(text)} className="flex min-h-12 items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-left text-sm font-semibold text-gray-700 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-gray-600 dark:bg-[#333333] dark:text-gray-100 dark:hover:border-indigo-400 dark:hover:bg-indigo-500/10"><Icon className="shrink-0 text-indigo-500" size={19} /><span>{label}</span></button>)}</div></div> : <div className="mx-auto max-w-3xl space-y-5">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>{message.role === "model" && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"><Bot size={18} /></div>}<div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm sm:max-w-[78%] ${message.role === "user" ? "whitespace-pre-wrap leading-7 bg-indigo-600 text-white" : "bg-gray-100 leading-7 text-gray-800 dark:bg-[#333333] dark:text-gray-100"}`}>{message.role === "model" ? <MarkdownRenderer text={message.text} /> : message.text}</div>{message.role === "user" && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-100"><User size={18} /></div>}</div>)}{loading && <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"><Bot size={18} /></div><div className="rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-500 dark:bg-[#333333] dark:text-gray-300">Đang suy nghĩ…</div></div>}</div>}
    </div><div className="border-t border-gray-200 p-3 dark:border-gray-600 sm:p-4">{error && <div className="mx-auto mb-3 max-w-3xl rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>}<form onSubmit={sendMessage} className="mx-auto flex max-w-3xl items-end gap-2"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Nhập câu hỏi của bạn…" rows={1} className="max-h-36 min-h-12 flex-1 resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-[#333333] dark:text-white dark:placeholder:text-gray-400" disabled={loading} /><button type="submit" disabled={!canSend} aria-label="Gửi câu hỏi" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Send size={19} /></button></form><p className="mx-auto mt-2 max-w-3xl text-center text-xs text-gray-400">Enter để gửi · Shift + Enter để xuống dòng</p></div></section>
  </div></main>;
}
