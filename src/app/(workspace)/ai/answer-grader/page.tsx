"use client";

import { useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, Sparkles, Target, X } from "lucide-react";
import MarkdownRenderer from "../../../../components/markdown-renderer";
import { auth } from "../../../../lib/firebase";
import { createUserDocument } from "../../../../lib/firestore";

type ImageAttachment = { data: string; mimeType: string; name: string };
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function readImage(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) { reject(new Error("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.")); return; }
    if (file.size > MAX_IMAGE_BYTES) { reject(new Error("Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn 6 MB.")); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = result.indexOf(",");
      if (commaIndex < 0) { reject(new Error("Không thể đọc ảnh.")); return; }
      resolve({ data: result.slice(commaIndex + 1), mimeType: file.type, name: file.name });
    };
    reader.onerror = () => reject(new Error("Không thể đọc ảnh."));
    reader.readAsDataURL(file);
  });
}

type Result = {
  score: number; verdict: string; feedback: string; strengths: string[];
  mistakes: string[]; suggestions: string[]; referenceAnswer: string;
};

export default function AnswerGraderPage() {
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [expectedAnswer, setExpectedAnswer] = useState("");
  const [rubric, setRubric] = useState("");
  const [studentAnswer, setStudentAnswer] = useState("");
  const [image, setImage] = useState<ImageAttachment | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function gradeAnswer() {
    if (!question.trim() || !studentAnswer.trim()) {
      setError("Vui lòng nhập câu hỏi và câu trả lời.");
      return;
    }
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/ai/answer-grader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, question, expectedAnswer, rubric, studentAnswer, image: image ? { data: image.data, mimeType: image.mimeType } : undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể chấm bài.");
      setResult(data.result);

      const user = auth.currentUser;
      if (user) {
        try {
          await createUserDocument(user.uid, "aiAnswerGrades", {
            type: "answer-grade", subject, question, expectedAnswer, rubric, studentAnswer, result: data.result,
          });
        } catch {
          setError("Đã chấm bài nhưng chưa thể lưu kết quả.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể chấm bài.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-gray-900 dark:bg-[#333333] dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <div className="mb-2 flex items-center gap-2 text-indigo-600 dark:text-indigo-400"><Sparkles size={20}/><span className="text-sm font-semibold">AI ANSWER GRADER</span></div>
          <h1 className="text-3xl font-bold">Answer Grader</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">AI chấm câu trả lời, giải thích lỗi và đưa ra hướng cải thiện.</p>
        </header>

        <section className="grid gap-5 lg:grid-cols-[400px_1fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#404040]">
            <div className="mb-5 flex items-center gap-2 font-semibold"><Target size={19}/> Bài cần chấm</div>
            <div className="space-y-4">
              <label className="block text-sm font-medium">Môn học
                <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Ví dụ: Ngữ văn, Toán..." className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white"/>
              </label>
              <label className="block text-sm font-medium">Câu hỏi *
                <textarea value={question} onChange={e=>setQuestion(e.target.value)} rows={4} placeholder="Nhập đề bài..." className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white"/>
              </label>
              <label className="block text-sm font-medium">Đáp án tham khảo
                <textarea value={expectedAnswer} onChange={e=>setExpectedAnswer(e.target.value)} rows={4} placeholder="Có thể để trống để AI tự đánh giá..." className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white"/>
              </label>
              <label className="block text-sm font-medium">Tiêu chí chấm
                <textarea value={rubric} onChange={e=>setRubric(e.target.value)} rows={3} placeholder="Ví dụ: đúng ý 4đ, lập luận 3đ, trình bày 3đ..." className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white"/>
              </label>
              <label className="block text-sm font-medium">Câu trả lời *
                <textarea value={studentAnswer} onChange={e=>setStudentAnswer(e.target.value)} rows={7} placeholder="Dán câu trả lời của bạn..." className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white"/>
              </label>
              <div className="rounded-xl border border-dashed border-gray-300 p-3 dark:border-gray-600">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold"><ImagePlus size={17} /> Ảnh đề / bài làm</div>
                  {image && <button type="button" onClick={() => setImage(null)} disabled={loading} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-[#333333]" aria-label="Xóa ảnh"><X size={16} /></button>}
                </div>
                {image ? (
                  <div className="flex items-center gap-3">
                    <img src={`data:${image.mimeType};base64,${image.data}`} alt="Ảnh bài làm" className="h-20 w-20 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{image.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-300">AI sẽ đọc ảnh khi chấm bài.</p>
                    </div>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-indigo-50 dark:bg-[#333333] dark:text-gray-200 dark:hover:bg-indigo-500/10">
                    <ImagePlus size={18} /> Thêm ảnh
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={loading} onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      try {
                        setError("");
                        setImage(await readImage(file));
                      } catch (error) {
                        setError(error instanceof Error ? error.message : "Không thể đọc ảnh.");
                      }
                    }} />
                  </label>
                )}
                <p className="mt-2 text-xs text-gray-400">JPG, PNG, WebP · tối đa 6 MB · ảnh chỉ dùng cho lần chấm này.</p>
              </div>
              <button onClick={gradeAnswer} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {loading ? <><Loader2 size={18} className="animate-spin"/> Đang chấm...</> : <><Sparkles size={18}/> Chấm bài</>}
              </button>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>
          </div>

          <div className="min-w-0">
            {!result ? (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-600 dark:bg-[#404040]">
                <CheckCircle2 size={42} className="mb-3 text-indigo-500"/>
                <h2 className="text-xl font-semibold">Chưa có kết quả</h2>
                <p className="mt-2 max-w-md text-gray-500 dark:text-gray-300">Nhập bài làm ở bên trái để nhận điểm, nhận xét, lỗi cần sửa và đáp án tham khảo.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-[#404040]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Kết quả</p><h2 className="text-3xl font-bold">{result.score.toFixed(1)}/10</h2></div>
                    <span className="rounded-full bg-indigo-100 px-4 py-2 text-sm font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{result.verdict}</span>
                  </div>
                  <div className="mt-3 text-sm"><MarkdownRenderer text={result.feedback}/></div>
                </div>
                <ResultList title="Điểm mạnh" items={result.strengths}/>
                <ResultList title="Điểm cần sửa" items={result.mistakes}/>
                <ResultList title="Gợi ý cải thiện" items={result.suggestions}/>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#404040]">
                  <h3 className="font-semibold">Đáp án tham khảo</h3>
                  <div className="mt-3 text-sm leading-6"><MarkdownRenderer text={result.referenceAnswer}/></div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#404040]">
    <h3 className="font-semibold">{title}</h3>
    {items.length ? <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{items.map((item,index)=><li key={index}><MarkdownRenderer text={item} inline/></li>)}</ul> : <p className="mt-3 text-sm text-gray-500 dark:text-gray-300">Không có.</p>}
  </div>;
}
