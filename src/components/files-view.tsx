"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createUserDocument, deleteUserDocument, listUserDocuments } from "@/lib/firestore";
import { deleteUserFile, uploadUserFile } from "@/lib/firebase-storage";

type ScholarFile = {
  id: string;
  name?: string;
  path?: string;
  size?: number;
  contentType?: string;
  downloadURL?: string;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif,.txt";

function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewable(file: ScholarFile) {
  return file.contentType?.startsWith("image/") || file.contentType === "application/pdf";
}

function fileKind(file: ScholarFile) {
  const type = file.contentType || "";
  if (type.startsWith("image/")) return "Hình ảnh";
  if (type === "application/pdf") return "PDF";
  if (type.includes("word") || /\.docx?$/i.test(file.name || "")) return "Word";
  if (type.startsWith("text/")) return "TXT";
  return "Tệp";
}

export default function FilesView() {
  const [user, setUser] = useState<User | null>(null);
  const [files, setFiles] = useState<ScholarFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<ScholarFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setFiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    listUserDocuments<ScholarFile>(user.uid, "files")
      .then((items) => setFiles(items))
      .catch(() => setError("Không thể tải danh sách tệp. Hãy kiểm tra Firestore Rules."))
      .finally(() => setLoading(false));
  }, [user]);

  const visibleFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return files.filter((file) => !q || `${file.name || ""} ${file.contentType || ""}`.toLowerCase().includes(q));
  }, [files, search]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!user || !selected.length) return;

    setUploading(true);
    setError("");
    try {
      for (const file of selected) {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`Tệp "${file.name}" vượt quá giới hạn 20 MB.`);
        }
        const uploaded = await uploadUserFile(user.uid, file);
        const docRef = await createUserDocument(user.uid, "files", uploaded);
        setFiles((current) => [...current, { ...uploaded, id: docRef.id }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải tệp lên. Hãy thử lại.");
    } finally {
      setUploading(false);
    }
  }

  async function removeFile(file: ScholarFile) {
    if (!user || !file.path) return;
    if (!window.confirm(`Xóa tệp "${file.name || "này"}"?`)) return;
    setError("");
    try {
      await deleteUserFile(file.path);
      await deleteUserDocument(user.uid, "files", file.id);
      setFiles((current) => current.filter((item) => item.id !== file.id));
      if (preview?.id === file.id) setPreview(null);
    } catch {
      setError("Không thể xóa tệp. Tệp có thể đã được xóa khỏi Storage trước đó.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wider text-indigo-600">Tools</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Files</h1>
          <p className="mt-2 max-w-2xl text-gray-600">Lưu trữ tài liệu học tập bằng Firebase Storage và quản lý metadata theo tài khoản.</p>
        </div>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-950">Tải tài liệu lên</h2>
              <p className="mt-1 text-sm text-gray-500">PDF, Word, hình ảnh và TXT · tối đa 20 MB mỗi tệp.</p>
            </div>
            <div>
              <input ref={inputRef} type="file" multiple accept={ACCEPT} onChange={handleUpload} className="hidden" />
              <button type="button" disabled={!user || uploading} onClick={() => inputRef.current?.click()} className="rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                {uploading ? "Đang tải lên..." : "+ Chọn tệp"}
              </button>
            </div>
          </div>
          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-950">Tài liệu của bạn</h2>
              <p className="mt-1 text-sm text-gray-500">{files.length} tệp</p>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔎 Tìm tệp..." className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-indigo-500 md:max-w-sm" />
          </div>

          {loading ? <p className="py-10 text-center text-gray-500">Đang tải tệp...</p> : visibleFiles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center">
              <p className="text-lg font-semibold text-gray-800">{files.length ? "Không tìm thấy tệp" : "Chưa có tài liệu"}</p>
              <p className="mt-1 text-gray-500">{files.length ? "Thử thay đổi từ khóa." : "Tải tệp đầu tiên lên để bắt đầu."}</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visibleFiles.map((file) => (
                <article key={file.id} className="rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-black text-indigo-700">{fileKind(file)}</div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-gray-950" title={file.name}>{file.name || "Tệp không tên"}</h3>
                      <p className="mt-1 text-sm text-gray-500">{formatSize(file.size)} · {fileKind(file)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                    {file.downloadURL && isPreviewable(file) && <button type="button" onClick={() => setPreview(file)} className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">Xem trước</button>}
                    {file.downloadURL && <a href={file.downloadURL} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">Mở / tải xuống</a>}
                    <button type="button" onClick={() => removeFile(file)} className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Xóa</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {preview && preview.downloadURL && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={`Xem trước ${preview.name || "tệp"}`} onClick={() => setPreview(null)}>
            <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
                <h2 className="truncate font-bold text-gray-950">{preview.name}</h2>
                <button type="button" onClick={() => setPreview(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Đóng</button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-4">
                {preview.contentType?.startsWith("image/") ? <img src={preview.downloadURL} alt={preview.name || "Xem trước"} className="mx-auto max-h-[75vh] max-w-full object-contain" /> : <iframe src={preview.downloadURL} title={preview.name || "PDF preview"} className="h-[75vh] w-full rounded-lg bg-white" />}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
