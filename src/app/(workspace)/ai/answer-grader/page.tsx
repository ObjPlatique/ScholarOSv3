"use client";

import { useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, Sparkles, Target, X } from "lucide-react";
import MarkdownRenderer from "../../../../components/markdown-renderer";
import { auth } from "../../../../lib/firebase";
import { createUserDocument } from "../../../../lib/firestore";

type ImageAttachment = { data: string; mimeType: string; name: string };
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_IMAGES_PER_GROUP = 8;

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
  const [questionImages, setQuestionImages] = useState<ImageAttachment[]>([]);
  const [answerImages, setAnswerImages] = useState<ImageAttachment[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function gradeAnswer() {
    if ((!question.trim() && questionImages.length === 0) || (!studentAnswer.trim() && answerImages.length === 0)) {
      setError("Vui lòng nhập câu hỏi/câu trả lời hoặc thêm ảnh tương ứng.");
      return;
    }
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/ai/answer-grader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, question, expectedAnswer, rubric, studentAnswer, questionImages: questionImages.length ? questionImages.map(({ data, mimeType }) => ({ data, mimeType })) : undefined, answerImages: answerImages.length ? answerImages.map(({ data, mimeType }) => ({ data, mimeType })) : undefined }),
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
              <div className="block text-sm font-medium">
                <div className="flex items-center justify-between gap-2">
                  <span>Câu hỏi *</span>
                  <ImageUploadButton images={questionImages} setImages={setQuestionImages} loading={loading} setError={setError} label="Thêm ảnh câu hỏi" />
                </div>
                <textarea value={question} onChange={e=>setQuestion(e.target.value)} rows={4} placeholder="Nhập đề bài hoặc thêm ảnh chứa câu hỏi..." className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white"/>
                {questionImages.length > 0 && <ImagePreview images={questionImages} setImages={setQuestionImages} loading={loading} />}
              </div>
              <label className="block text-sm font-medium">Đáp án tham khảo
                <textarea value={expectedAnswer} onChange={e=>setExpectedAnswer(e.target.value)} rows={4} placeholder="Có thể để trống để AI tự đánh giá..." className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white"/>
              </label>
              <label className="block text-sm font-medium">Tiêu chí chấm
                <textarea value={rubric} onChange={e=>setRubric(e.target.value)} rows={3} placeholder="Ví dụ: đúng ý 4đ, lập luận 3đ, trình bày 3đ..." className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white"/>
              </label>
              <div className="block text-sm font-medium">
                <div className="flex items-center justify-between gap-2">
                  <span>Câu trả lời *</span>
                  <ImageUploadButton images={answerImages} setImages={setAnswerImages} loading={loading} setError={setError} label="Thêm ảnh câu trả lời" />
                </div>
                <textarea value={studentAnswer} onChange={e=>setStudentAnswer(e.target.value)} rows={7} placeholder="Dán câu trả lời hoặc thêm ảnh chứa câu trả lời..." className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white"/>
                {answerImages.length > 0 && <ImagePreview images={answerImages} setImages={setAnswerImages} loading={loading} />}
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

function ImageUploadButton({ images, setImages, loading, setError, label }: {
  images: ImageAttachment[];
  setImages: (images: ImageAttachment[]) => void;
  loading: boolean;
  setError: (error: string) => void;
  label: string;
}) {
  return <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-gray-600 dark:bg-[#333333] dark:text-indigo-300 dark:hover:bg-indigo-500/10">
    <ImagePlus size={15} /> {images.length ? `Thêm ảnh (${images.length})` : "Thêm ảnh"}
    <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" disabled={loading} aria-label={label} onChange={async (event) => {
      const files = Array.from(event.target.files || []);
      event.target.value = "";
      if (!files.length) return;
      try {
        setError("");
        if (images.length + files.length > MAX_IMAGES_PER_GROUP) {
          throw new Error(`Mỗi phần chỉ có thể thêm tối đa ${MAX_IMAGES_PER_GROUP} ảnh.`);
        }
        const nextImages = [...images];
        for (const file of files) nextImages.push(await readImage(file));
        setImages(nextImages);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Không thể đọc ảnh.");
      }
    }} />
  </label>;
}

function ImagePreview({ images, setImages, loading }: {
  images: ImageAttachment[];
  setImages: (images: ImageAttachment[]) => void;
  loading: boolean;
}) {
  return <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 p-2 dark:border-indigo-500/30 dark:bg-indigo-500/10">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {images.map((image, index) => (
        <div key={`${image.name}-${index}`} className="relative overflow-hidden rounded-md border border-indigo-200 bg-white dark:border-indigo-500/30 dark:bg-[#333333]">
          <img src={`data:${image.mimeType};base64,${image.data}`} alt={image.name} className="h-20 w-full object-cover" />
          <button type="button" onClick={() => setImages(images.filter((_, imageIndex) => imageIndex !== index))} disabled={loading} aria-label={`Xóa ảnh ${index + 1}`} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"><X size={14} /></button>
        </div>
      ))}
    </div>
    <p className="mt-2 text-xs text-gray-500 dark:text-gray-300">{images.length}/{MAX_IMAGES_PER_GROUP} ảnh</p>
  </div>;
}
function ResultList({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#404040]">
    <h3 className="font-semibold">{title}</h3>
    {items.length ? <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{items.map((item,index)=><li key={index}><MarkdownRenderer text={item} inline/></li>)}</ul> : <p className="mt-3 text-sm text-gray-500 dark:text-gray-300">Không có.</p>}
  </div>;
}
