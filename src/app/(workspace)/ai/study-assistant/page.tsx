"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, BookOpen, Calculator, ImagePlus, Lightbulb, MessageSquare, Plus, Send, Sparkles, Trash2, User, X } from "lucide-react";
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

type Message = { role: "user" | "model"; text: string; images?: Array<{ data?: string; url?: string; mimeType: string; name?: string }> };
type ImageAttachment = { data: string; mimeType: string; name: string };

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const IMAGE_DB_NAME = "scholaros-image-drafts";
const IMAGE_STORE_NAME = "drafts";
const IMAGE_DRAFT_KEY = "study-assistant-pending-images";
const MAX_IMAGES = 8;
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
    const request = indexedDB.open(IMAGE_DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        db.createObjectStore(IMAGE_STORE_NAME);
      }
      if (!db.objectStoreNames.contains("sent-images")) {
        db.createObjectStore("sent-images");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveImageDraft(images: ImageAttachment[]) {
  const db = await openImageDraftDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, "readwrite");
    tx.objectStore(IMAGE_STORE_NAME).put(images, IMAGE_DRAFT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadImageDraft(): Promise<ImageAttachment[]> {
  const db = await openImageDraftDb();
  const value = await new Promise<ImageAttachment[]>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, "readonly");
    const request = tx.objectStore(IMAGE_STORE_NAME).get(IMAGE_DRAFT_KEY);
    request.onsuccess = () => {
      const result = request.result;
      if (Array.isArray(result)) resolve(result as ImageAttachment[]);
      else if (result) resolve([result as ImageAttachment]);
      else resolve([]);
    };
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}

// Spark-safe image persistence:
// Firebase Storage is intentionally NOT used. Sent images are kept in IndexedDB
// on the same browser/device, while Firestore stores only a small mime-type marker.
async function saveSentImages(messageId: string, images: ImageAttachment[]) {
  const db = await openImageDraftDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("sent-images", "readwrite");
    tx.objectStore("sent-images").put(images, messageId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadSentImages(messageId: string): Promise<ImageAttachment[]> {
  const db = await openImageDraftDb();
  const value = await new Promise<ImageAttachment[]>((resolve, reject) => {
    const tx = db.transaction("sent-images", "readonly");
    const request = tx.objectStore("sent-images").get(messageId);
    request.onsuccess = () => resolve((request.result as ImageAttachment[] | undefined) ?? []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}

async function deleteSentImages(messageIds: string[]) {
  if (messageIds.length === 0) return;
  const db = await openImageDraftDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("sent-images", "readwrite");
    const store = tx.objectStore("sent-images");
    messageIds.forEach((id) => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function hydrateMessages(
  stored: Array<{ id: string; role: "user" | "model"; text: string; imageMimeType?: string; imageMimeTypes?: string[] }>,
): Promise<Message[]> {
  return Promise.all(
    stored.map(async (item) => {
      const mimeTypes = item.imageMimeTypes?.length
        ? item.imageMimeTypes
        : item.imageMimeType
          ? [item.imageMimeType]
          : [];
      if (mimeTypes.length === 0) {
        return { role: item.role, text: item.text };
      }
      const localImages = await loadSentImages(item.id).catch(() => []);
      return {
        role: item.role,
        text: item.text,
        images: mimeTypes.map((mimeType, index) =>
          localImages[index]
            ? { data: localImages[index].data, mimeType: localImages[index].mimeType, name: localImages[index].name }
            : { mimeType },
        ),
      };
    }),
  );
}

export default function StudyAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; createdAt?: unknown; updatedAt?: unknown }>>([]);
  const requestControllerRef = useRef<AbortController | null>(null);
  const hasMessages = messages.length > 0;
  const canSend = useMemo(() => (input.trim().length > 0 || images.length > 0) && !loading, [input, images, loading]);

  useEffect(() => {
    void loadImageDraft().then(setImages).catch(() => undefined);
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
          setMessages(await hydrateMessages(stored));
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
    if (!user || id === conversationId) return;
    requestControllerRef.current?.abort();
    setLoading(true);
    setError("");
    try {
      const stored = await listAIMessages(user.uid, id);
      setConversationId(id);
      setMessages(await hydrateMessages(stored));
      setInput("");
    } catch {
      setError("Không thể mở cuộc trò chuyện.");
    } finally {
      setLoading(false);
    }
  }

  function startNewConversation() {
    requestControllerRef.current?.abort();
    setConversationId("");
    setMessages([]);
    setInput("");
    setError("");
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const message = input.trim();
    if ((!message && images.length === 0) || loading) return;

    const attachments = images;
    const previousMessages = messages;
    const displayMessage = message || "Hãy phân tích các ảnh này và giúp mình.";
    const user = auth.currentUser;
    if (!user) {
      setError("Vui lòng đăng nhập để lưu hội thoại.");
      return;
    }

    setInput("");
    setImages([]);
    void saveImageDraft([]).catch(() => undefined);
    setError("");
    setLoading(true);

    try {
      // Save the conversation and user message BEFORE calling Gemini.
      // Therefore a stalled/failed AI request cannot prevent saving the chat.
      let activeConversationId = conversationId;
      if (!activeConversationId) {
        const created = await createAIConversation(user.uid, {
          type: "study-assistant",
          title: displayMessage.slice(0, 80) || "Cuộc trò chuyện mới",
        });
        activeConversationId = created.id;
        setConversationId(activeConversationId);
        setConversations((current) => [
          { id: activeConversationId!, title: displayMessage.slice(0, 80) || "Cuộc trò chuyện mới" },
          ...current.filter((item) => item.id !== activeConversationId),
        ]);
      }

      // Start the AI request as soon as the conversation ID is known.
      // Firestore persistence and IndexedDB image persistence run alongside it,
      // so database writes no longer add a full round-trip before Gemini starts.
      const userMessagePromise = addAIMessage(user.uid, activeConversationId, {
        role: "user",
        text: displayMessage,
        ...(attachments.length ? { imageMimeTypes: attachments.map((item) => item.mimeType) } : {}),
      });

      if (attachments.length) {
        // Persist all images locally without delaying the Gemini request.
        void userMessagePromise
          .then((savedUserMessage) => saveSentImages(savedUserMessage.id, attachments))
          .catch(() => undefined);
      }

      setMessages((current) => [
        ...current,
        {
          role: "user",
          text: displayMessage,
          ...(attachments.length ? { images: attachments } : {}),
        },
      ]);

      const controller = new AbortController();
      requestControllerRef.current = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), 45000);

      let response: Response;
      try {
        response = await fetch("/api/ai/study-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            message,
            // Do not resend old image base64 data. Gemini only needs the text history;
            // the current image is sent separately below.
            history: previousMessages.map(({ role, text }) => ({ role, text })),
            images: attachments.length
              ? attachments.map((item) => ({ data: item.data, mimeType: item.mimeType }))
              : undefined,
          }),
        });
      } finally {
        window.clearTimeout(timeoutId);
      }

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
          const dataLine = event.split(/\r?\n/).find((line) => line.startsWith("data:"));
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
            // Ignore incomplete SSE frames.
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

      // Ensure the user message is persisted before the assistant message is saved.
      await userMessagePromise.catch(() => undefined);

      await addAIMessage(user.uid, activeConversationId, {
        role: "model",
        text: assistantText,
      });
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
    } catch (requestError) {
      const aborted = requestError instanceof DOMException && requestError.name === "AbortError";
      if (aborted) {
        setError("Yêu cầu AI đã được dừng. Tin nhắn của bạn vẫn được lưu.");
      } else {
        setError(requestError instanceof Error ? requestError.message : "Không thể nhận phản hồi từ Study Assistant.");
      }
      // Never roll back the user message: it was already persisted.
    } finally {
      requestControllerRef.current = null;
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
      const stored = await listAIMessages(user.uid, conversationId);
      await deleteAIConversation(user.uid, conversationId);
      await deleteSentImages(stored.map((item) => item.id)).catch(() => undefined);
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
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm sm:max-w-[78%] ${message.role === "user" ? "whitespace-pre-wrap leading-7 bg-indigo-600 text-white" : "bg-gray-100 leading-7 text-gray-800 dark:bg-[#333333] dark:text-gray-100"}`}>{message.role === "model" ? <MarkdownRenderer text={message.text} /> : <>{message.images?.length ? <div className="mb-3 grid grid-cols-2 gap-2">{message.images.map((image, imageIndex) => image.data || image.url ? <img key={imageIndex} src={image.url || `data:${image.mimeType};base64,${image.data || ""}`} alt={image.name || `Ảnh đính kèm ${imageIndex + 1}`} className="max-h-72 w-full rounded-xl object-contain" /> : <div key={imageIndex} className="rounded-xl border border-white/30 px-3 py-2 text-xs opacity-80">Ảnh đã gửi trước đó · chỉ lưu trên thiết bị này</div>)}</div> : null}<span>{message.text}</span></>}</div>
                  {message.role === "user" && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-100"><User size={18} /></div>}
                </div>)}
                {loading && <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"><Bot size={18} /></div><div className="rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-500 dark:bg-[#333333] dark:text-gray-300">Đang suy nghĩ…</div></div>}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 p-3 dark:border-gray-600 sm:p-4">
            {error && <div className="mx-auto mb-3 max-w-3xl rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
            <form onSubmit={sendMessage} className="mx-auto max-w-3xl">
              {images.length > 0 && (
                <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50 p-2 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {images.map((image, index) => (
                      <div key={`${image.name}-${index}`} className="relative overflow-hidden rounded-lg border border-indigo-200 bg-white dark:border-indigo-500/30 dark:bg-[#333333]">
                        <img src={`data:${image.mimeType};base64,${image.data}`} alt={image.name} className="h-24 w-full object-cover" />
                        <button type="button" onClick={() => { const next = images.filter((_, imageIndex) => imageIndex !== index); setImages(next); void saveImageDraft(next).catch(() => undefined); }} disabled={loading} aria-label={`Xóa ảnh ${index + 1}`} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"><X size={15} /></button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-300">{images.length}/{MAX_IMAGES} ảnh · sẽ được gửi cùng một yêu cầu.</p>
                </div>
              )}
              <div className="flex items-end gap-2">
                <label className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-gray-300 bg-white text-indigo-600 transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-gray-600 dark:bg-[#333333] dark:text-indigo-300 dark:hover:bg-indigo-500/10" title="Thêm ảnh">
                  <ImagePlus size={20} />
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" disabled={loading || loadingHistory} onChange={async (event) => {
                    const files = Array.from(event.target.files || []);
                    event.target.value = "";
                    if (!files.length) return;
                    try {
                      setError("");
                      if (images.length + files.length > MAX_IMAGES) {
                        throw new Error(`Bạn chỉ có thể thêm tối đa ${MAX_IMAGES} ảnh cho mỗi tin nhắn.`);
                      }
                      const nextImages = [...images];
                      for (const file of files) nextImages.push(await readImage(file));
                      setImages(nextImages);
                      void saveImageDraft(nextImages).catch(() => undefined);
                    } catch (error) {
                      setError(error instanceof Error ? error.message : "Không thể đọc ảnh.");
                    }
                  }} />
                </label>
                <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Nhập câu hỏi hoặc thêm ảnh…" rows={1} className="max-h-36 min-h-12 flex-1 resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-[#333333] dark:text-white dark:placeholder:text-gray-400" disabled={loading || loadingHistory} />
                <button type="submit" disabled={!canSend || loadingHistory} aria-label="Gửi câu hỏi" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Send size={19} /></button>
              </div>
            </form>
            <p className="mx-auto mt-2 flex max-w-3xl items-center justify-center gap-1 text-xs text-gray-400"><ImagePlus size={12} /> JPG, PNG, WebP · tối đa 6 MB/ảnh · tối đa 8 ảnh · ảnh đã gửi lưu cục bộ trên thiết bị này</p>
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}
