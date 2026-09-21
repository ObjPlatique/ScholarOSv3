"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bot, BookOpen, Calculator, ImagePlus, Lightbulb, MessageSquare, Plus, Send, Sparkles, Trash2, User, X } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import MarkdownRenderer from "../../../../components/markdown-renderer";
import { auth, storage } from "../../../../lib/firebase";
import {
  addAIMessage,
  createAIConversation,
  deleteAIConversation,
  listAIMessages,
  listAIConversations,
  updateUserDocument,
} from "../../../../lib/firestore";

type Message = { role: "user" | "model"; text: string; image?: { data?: string; url?: string; mimeType: string } };
type ImageAttachment = { data: string; mimeType: string; name: string };

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const IMAGE_DB_NAME = "scholaros-image-drafts";
const IMAGE_STORE_NAME = "drafts";
const IMAGE_DRAFT_KEY = "study-assistant-pending-image";
const quickPrompts = [
  { label: "Giải thích bài học", icon: BookOpen, text: "Giải thích cho mình một khái niệm khó theo cách dễ hiểu, kèm ví dụ." },
  { label: "Giải bài tập", icon: Calculator, text: "Giúp mình giải bài tập này từng bước và giải thích vì sao làm như vậy: " },
  { label: "Gợi ý cách học", icon: Lightbulb, text: "Gợi ý cách học hiệu quả cho một chủ đề mình đang gặp khó khăn: " },
];

function formatAiText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function readImage(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      reject(new Error("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP."));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error("Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn 6 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = result.indexOf(",");
      if (commaIndex < 0) {
        reject(new Error("Không thể đọc ảnh."));
        return;
      }
      resolve({ data: result.slice(commaIndex + 1), mimeType: file.type, name: file.name });
    };
    reader.onerror = () => reject(new Error("Không thể đọc ảnh."));
    reader.readAsDataURL(file);
  });
}


function openImageDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(IMAGE_STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveImageDraft(image: ImageAttachment | null) {
  const db = await openImageDraftDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, "readwrite");
    tx.objectStore(IMAGE_STORE_NAME).put(image, IMAGE_DRAFT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadImageDraft(): Promise<ImageAttachment | null> {
  const db = await openImageDraftDb();
  const value = await new Promise<ImageAttachment | null>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, "readonly");
    const request = tx.objectStore(IMAGE_STORE_NAME).get(IMAGE_DRAFT_KEY);
    request.onsuccess = () => resolve((request.result as ImageAttachment | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}


async function uploadStudyImage(uid: string, conversationId: string, image: ImageAttachment) {
  const binary = Uint8Array.from(atob(image.data), (char) => char.charCodeAt(0));
  const blob = new Blob([binary], { type: image.mimeType });
  const imageRef = storageRef(storage, `users/${uid}/aiConversations/${conversationId}/${crypto.randomUUID()}-${image.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
  await uploadBytes(imageRef, blob, { contentType: image.mimeType });
  return getDownloadURL(imageRef);
}

export default function StudyAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<ImageAttachment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; createdAt?: unknown; updatedAt?: unknown }>>([]);
  const hasMessages = messages.length > 0;
  const canSend = useMemo(() => (input.trim().length > 0 || !!image) && !loading, [input, image, loading]);

  useEffect(() => {
    void loadImageDraft().then(setImage).catch(() => undefined);
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
          setMessages(stored.map((item) => ({ role: item.role, text: item.text, ...(item.imageUrl ? { image: { url: item.imageUrl, mimeType: item.imageMimeType || "image/jpeg" } } : {}) })));
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
      setMessages(stored.map((item) => ({ role: item.role, text: item.text, ...(item.imageUrl ? { image: { url: item.imageUrl, mimeType: item.imageMimeType || "image/jpeg" } } : {}) })));
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
    if ((!message && !image) || loading) return;

    const attachment = image;
    const previousMessages = messages;
    const displayMessage = message || "Hãy phân tích ảnh này và giúp mình.";
    setInput("");
    setImage(null);
    setError("");
    setMessages((current) => [
      ...current,
      { role: "user", text: displayMessage, ...(attachment ? { image: attachment } : {}) },
    ]);
    setLoading(true);

    try {
      const response = await fetch("/api/ai/study-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: previousMessages, image: attachment ? { data: attachment.data, mimeType: attachment.mimeType } : undefined }),
      });

      if (!response.ok || !response.body) {
        let errorMessage = "Study Assistant gặp lỗi.";
        try {
          const data = (await response.json()) as { error?: string };
          errorMessage = data.error || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let streamError = "";

      const appendEvents = (chunk: string) => {
        buffer += chunk;
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || "";

        for (const event of events) {
          const dataLine = event
            .split(/\r?\n/)
            .find((line) => line.startsWith("data:"));
          if (!dataLine) continue;

          const raw = dataLine.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;

          try {
            const payload = JSON.parse(raw) as {
              event_type?: string;
              error?: { message?: string };
              delta?: { type?: string; text?: string };
            };

            if (payload.event_type === "error") {
              streamError = payload.error?.message || "Study Assistant gặp lỗi.";
              continue;
            }

            if (payload.event_type === "step.delta" && payload.delta?.type === "text") {
              assistantText += payload.delta.text || "";
              setMessages((current) => [
                ...current.filter((item, index) => !(item.role === "model" && index === current.length - 1)),
                { role: "model", text: formatAiText(assistantText) },
              ]);
            }
          } catch {
            // Ignore incomplete SSE frames; the next chunk completes them.
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        appendEvents(decoder.decode(value, { stream: true }));
      }
      appendEvents(decoder.decode());

      if (streamError) throw new Error(streamError);
      assistantText = formatAiText(assistantText);
      if (!assistantText) throw new Error("AI không trả về nội dung.");

      const user = auth.currentUser;
      if (user) {
        let activeConversationId = conversationId;
        if (!activeConversationId) {
          const created = await createAIConversation(user.uid, {
            type: "study-assistant",
            title: displayMessage.slice(0, 80) || "Cuộc trò chuyện mới",
          });
          activeConversationId = created.id;
          setConversationId(activeConversationId);
          setConversations((current) => [
            { id: activeConversationId, title: displayMessage.slice(0, 80) || "Cuộc trò chuyện mới" },
            ...current.filter((item) => item.id !== activeConversationId),
          ]);
        }

        let imageUrl: string | undefined;
        if (attachment) {
          imageUrl = await uploadStudyImage(user.uid, activeConversationId, attachment);
        }
        await addAIMessage(user.uid, activeConversationId, {
          role: "user",
          text: displayMessage,
          ...(imageUrl ? { imageUrl, imageMimeType: attachment?.mimeType } : {}),
        });
        await addAIMessage(user.uid, activeConversationId, { role: "model", text: assistantText });
        await updateUserDocument(user.uid, "aiConversations", activeConversationId, {
          title: displayMessage.slice(0, 80) || "Cuộc trò chuyện mới",
        });
        setConversations((current) =>
          current.map((item) =>
            item.id === activeConversationId
              ? { ...item, title: displayMessage.slice(0, 80) || "Cuộc trò chuyện mới" }
              : item,
          ),
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể nhận phản hồi từ Study Assistant.",
      );
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
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm sm:max-w-[78%] ${message.role === "user" ? "whitespace-pre-wrap leading-7 bg-indigo-600 text-white" : "bg-gray-100 leading-7 text-gray-800 dark:bg-[#333333] dark:text-gray-100"}`}>{message.role === "model" ? <MarkdownRenderer text={message.text} /> : <>{message.image && <img src={message.image.url || `data:${message.image.mimeType};base64,${message.image.data || ""}`} alt="Ảnh đính kèm" className="mb-3 max-h-72 max-w-full rounded-xl object-contain" />}<span>{message.text}</span></>}</div>
                  {message.role === "user" && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-100"><User size={18} /></div>}
                </div>)}
                {loading && <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"><Bot size={18} /></div><div className="rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-500 dark:bg-[#333333] dark:text-gray-300">Đang suy nghĩ…</div></div>}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 p-3 dark:border-gray-600 sm:p-4">
            {error && <div className="mx-auto mb-3 max-w-3xl rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
            <form onSubmit={sendMessage} className="mx-auto max-w-3xl">
              {image && (
                <div className="mb-3 flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-2 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                  <img src={`data:${image.mimeType};base64,${image.data}`} alt="Ảnh chuẩn bị gửi" className="h-16 w-16 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{image.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-300">Ảnh sẽ được gửi cho AI để phân tích.</p>
                  </div>
                  <button type="button" onClick={() => { setImage(null); void saveImageDraft(null).catch(() => undefined); }} disabled={loading} aria-label="Xóa ảnh" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-white dark:hover:bg-[#333333]"><X size={17} /></button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <label className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-gray-300 bg-white text-indigo-600 transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-gray-600 dark:bg-[#333333] dark:text-indigo-300 dark:hover:bg-indigo-500/10" title="Thêm ảnh">
                  <ImagePlus size={20} />
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={loading || loadingHistory} onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    try {
                      setError("");
                      const nextImage = await readImage(file);
                      setImage(nextImage);
                      void saveImageDraft(nextImage).catch(() => undefined);
                    } catch (error) {
                      setError(error instanceof Error ? error.message : "Không thể đọc ảnh.");
                    }
                  }} />
                </label>
                <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Nhập câu hỏi hoặc thêm ảnh…" rows={1} className="max-h-36 min-h-12 flex-1 resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-[#333333] dark:text-white dark:placeholder:text-gray-400" disabled={loading || loadingHistory} />
                <button type="submit" disabled={!canSend || loadingHistory} aria-label="Gửi câu hỏi" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Send size={19} /></button>
              </div>
            </form>
            <p className="mx-auto mt-2 flex max-w-3xl items-center justify-center gap-1 text-xs text-gray-400"><ImagePlus size={12} /> JPG, PNG, WebP · tối đa 6 MB · Enter để gửi</p>
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}
