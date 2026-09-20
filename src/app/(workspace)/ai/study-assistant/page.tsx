"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bot, BookOpen, Calculator, Lightbulb, MessageSquare, Plus, Send, Sparkles, Trash2, User } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import MarkdownRenderer from "../../../../components/markdown-renderer";
import { auth } from "../../../../lib/firebase";
import {
  addAIMessage,
  createAIConversation,
  deleteAIConversation,
  listAIMessages,
  listAIConversations,
  updateUserDocument,
} from "../../../../lib/firestore";

type Message = { role: "user" | "model"; text: string };
const quickPrompts = [
  { label: "Giải thích bài học", icon: BookOpen, text: "Giải thích cho mình một khái niệm khó theo cách dễ hiểu, kèm ví dụ." },
  { label: "Giải bài tập", icon: Calculator, text: "Giúp mình giải bài tập này từng bước và giải thích vì sao làm như vậy: " },
  { label: "Gợi ý cách học", icon: Lightbulb, text: "Gợi ý cách học hiệu quả cho một chủ đề mình đang gặp khó khăn: " },
];

function formatAiText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export default function StudyAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; createdAt?: unknown; updatedAt?: unknown }>>([]);
  const hasMessages = messages.length > 0;
  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoadingHistory(false);
        return;
      }
      try {
        const items = await listAIConversations(user.uid, "study-assistant");
        const getTime = (value: unknown) =>
          typeof (value as { toMillis?: () => number } | undefined)?.toMillis === "function"
            ? (value as { toMillis: () => number }).toMillis()
            : 0;
        const sorted = [...items].sort(
          (a, b) => getTime(b.updatedAt ?? b.createdAt) - getTime(a.updatedAt ?? a.createdAt),
        );
        setConversations(sorted.map(({ id, title, createdAt, updatedAt }) => ({ id, title, createdAt, updatedAt })));
        const latest = sorted[0];
        if (latest) {
          const stored = await listAIMessages(user.uid, latest.id);
          setConversationId(latest.id);
          setMessages(stored.map((item) => ({ role: item.role, text: item.text })));
        }
      } catch {
        setError("Không thể tải lịch sử hội thoại.");
      } finally {
        setLoadingHistory(false);
      }
    });
  }, []);

  async function openConversation(id: string) {
    const user = auth.currentUser;
    if (!user || loading || id === conversationId) return;
    setLoading(true);
    setError("");
    try {
      const stored = await listAIMessages(user.uid, id);
      setConversationId(id);
      setMessages(stored.map((item) => ({ role: item.role, text: item.text })));
      setInput("");
    } catch {
      setError("Không thể mở cuộc trò chuyện.");
    } finally {
      setLoading(false);
    }
  }

  function startNewConversation() {
    if (loading) return;
    setConversationId("");
    setMessages([]);
    setInput("");
    setError("");
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    const previousMessages = messages;
    setInput("");
    setError("");
    setMessages((current) => [...current, { role: "user", text: message }]);
    setLoading(true);

    try {
      const response = await fetch("/api/ai/study-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: previousMessages }),
      });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !data.text) throw new Error(data.error || "Study Assistant gặp lỗi.");

      const assistantText = formatAiText(data.text);
      const user = auth.currentUser;
      if (user) {
        let activeConversationId = conversationId;
        if (!activeConversationId) {
          const created = await createAIConversation(user.uid, {
            type: "study-assistant",
            title: message.slice(0, 80) || "Cuộc trò chuyện mới",
          });
          activeConversationId = created.id;
          setConversationId(activeConversationId);
          setConversations((current) => [{ id: activeConversationId, title: message.slice(0, 80) || "Cuộc trò chuyện mới" }, ...current.filter((item) => item.id !== activeConversationId)]);
        }

        await addAIMessage(user.uid, activeConversationId, { role: "user", text: message });
        await addAIMessage(user.uid, activeConversationId, { role: "model", text: assistantText });
        await updateUserDocument(user.uid, "aiConversations", activeConversationId, {
          title: message.slice(0, 80) || "Cuộc trò chuyện mới",
        });
        setConversations((current) => current.map((item) => item.id === activeConversationId ? { ...item, title: message.slice(0, 80) || "Cuộc trò chuyện mới" } : item));
      }

      setMessages((current) => [...current, { role: "model", text: assistantText }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể nhận phản hồi từ AI.");
      setMessages(previousMessages);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteConversation() {
    const user = auth.currentUser;
    if (!user || !conversationId || loading) return;
    if (!window.confirm("Xóa toàn bộ cuộc trò chuyện này?")) return;

    setLoading(true);
    setError("");
    try {
      await deleteAIConversation(user.uid, conversationId);
      setConversationId("");
      setMessages([]);
      setConversations((current) => current.filter((item) => item.id !== conversationId));
    } catch {
      setError("Không thể xóa cuộc trò chuyện. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] dark:bg-[#333333]">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col px-3 py-4 sm:px-6 sm:py-8">
        <header className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-600 dark:bg-[#3b3b3b] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"><Sparkles size={22} /></div>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">AI · Study Assistant</div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-3xl">Học cùng ScholarOS</h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 sm:text-base">Hỏi bài, yêu cầu giải thích hoặc nhờ AI hướng dẫn cách học.</p>
              </div>
            </div>
            {conversationId && (
              <button type="button" onClick={() => void handleDeleteConversation()} disabled={loading} title="Xóa cuộc trò chuyện" className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-500/10">
                <Trash2 size={17} /><span className="hidden sm:inline">Xóa hội thoại</span>
              </button>
            )}
          </div>
        </header>

        <div className="grid min-h-[520px] flex-1 gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-[#3b3b3b] lg:flex lg:flex-col">
            <div className="border-b border-gray-200 p-3 dark:border-gray-600">
              <button type="button" onClick={startNewConversation} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50">
                <Plus size={17} /> Cuộc trò chuyện mới
              </button>
            </div>
            <div className="px-3 pt-3 text-xs font-bold uppercase tracking-wider text-gray-400">Lịch sử hội thoại</div>
            <div className="flex-1 overflow-y-auto p-2">
              {conversations.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-gray-400">Chưa có hội thoại nào.</p>
              ) : conversations.map((item) => (
                <button key={item.id} type="button" onClick={() => void openConversation(item.id)} disabled={loading} className={`mb-1 w-full truncate rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${item.id === conversationId ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-[#555555]"}`}>
                  {item.title || "Cuộc trò chuyện"}
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-[#3b3b3b]">
          <div className="border-b border-gray-200 p-2 dark:border-gray-600 lg:hidden">
            <div className="flex gap-2 overflow-x-auto">
              <button type="button" onClick={startNewConversation} disabled={loading} className="flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} /> Mới</button>
              {conversations.map((item) => <button key={item.id} type="button" onClick={() => void openConversation(item.id)} disabled={loading} className={`max-w-48 shrink-0 truncate rounded-xl border px-3 py-2 text-sm font-medium ${item.id === conversationId ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" : "border-gray-200 text-gray-700 dark:border-gray-600 dark:text-gray-200"}`}>{item.title || "Cuộc trò chuyện"}</button>)}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 sm:p-6">
            {loadingHistory ? (
              <div className="flex min-h-[390px] items-center justify-center text-sm text-gray-500 dark:text-gray-300">Đang tải hội thoại…</div>
            ) : !hasMessages ? (
              <div className="flex min-h-[390px] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"><Bot size={32} /></div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Mình có thể giúp gì?</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-300">Đặt câu hỏi về bài học, gửi đề bài hoặc yêu cầu giải thích một khái niệm.</p>
                <div className="mt-6 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
                  {quickPrompts.map(({ label, icon: Icon, text }) => <button key={label} type="button" onClick={() => setInput(text)} className="flex min-h-12 items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-left text-sm font-semibold text-gray-700 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-gray-600 dark:bg-[#333333] dark:text-gray-100 dark:hover:border-indigo-400 dark:hover:bg-indigo-500/10"><Icon className="shrink-0 text-indigo-500" size={19} /><span>{label}</span></button>)}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-5">
                {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "model" && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"><Bot size={18} /></div>}
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm sm:max-w-[78%] ${message.role === "user" ? "whitespace-pre-wrap leading-7 bg-indigo-600 text-white" : "bg-gray-100 leading-7 text-gray-800 dark:bg-[#333333] dark:text-gray-100"}`}>{message.role === "model" ? <MarkdownRenderer text={message.text} /> : message.text}</div>
                  {message.role === "user" && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-100"><User size={18} /></div>}
                </div>)}
                {loading && <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"><Bot size={18} /></div><div className="rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-500 dark:bg-[#333333] dark:text-gray-300">Đang suy nghĩ…</div></div>}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 p-3 dark:border-gray-600 sm:p-4">
            {error && <div className="mx-auto mb-3 max-w-3xl rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
            <form onSubmit={sendMessage} className="mx-auto flex max-w-3xl items-end gap-2">
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Nhập câu hỏi của bạn…" rows={1} className="max-h-36 min-h-12 flex-1 resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-[#333333] dark:text-white dark:placeholder:text-gray-400" disabled={loading || loadingHistory} />
              <button type="submit" disabled={!canSend || loadingHistory} aria-label="Gửi câu hỏi" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Send size={19} /></button>
            </form>
            <p className="mx-auto mt-2 flex max-w-3xl items-center justify-center gap-1 text-xs text-gray-400"><MessageSquare size={12} /> Enter để gửi · Shift + Enter để xuống dòng</p>
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}
