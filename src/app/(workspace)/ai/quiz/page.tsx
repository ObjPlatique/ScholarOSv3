"use client";

import { useState } from "react";
import { BookOpen, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import MarkdownRenderer from "../../../../components/markdown-renderer";
import { auth } from "../../../../lib/firebase";
import { createUserDocument, listUserDocuments } from "../../../../lib/firestore";

type Question = { question: string; options: string[]; answer: number; explanation: string };
type Quiz = { title: string; questions: Question[] };
type StoredQuiz = { id: string; type: "quiz"; title: string; subject: string; topic: string; difficulty: string; questionCount: number; questions: Question[]; score?: number; completed?: boolean; completedAt?: unknown; };

export default function QuizPage() {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("Trung bình");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quizId, setQuizId] = useState("");


  async function generateQuiz() {
    setLoading(true); setError(""); setQuiz(null); setAnswers({}); setSubmitted(false);
    try {
      const response = await fetch("/api/ai/quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, topic, count, difficulty }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể tạo quiz.");
      setQuiz(data.quiz);
      setQuizId("");
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể tạo quiz."); }
    finally { setLoading(false); }
  }

  const score = quiz ? quiz.questions.reduce((sum, q, i) => sum + (answers[i] === q.answer ? 1 : 0), 0) : 0;

  async function saveQuizResult() {
    const user = auth.currentUser;
    if (!user || !quiz || quizId) return;
    try {
      const created = await createUserDocument(user.uid, "aiQuizzes", {
        type: "quiz", title: quiz.title, subject, topic, difficulty,
        questionCount: quiz.questions.length, questions: quiz.questions,
        score, completed: true,
      });
      setQuizId(created.id);
    } catch { setError("Quiz đã chấm nhưng chưa thể lưu kết quả."); }
  }

  return <main className="min-h-screen bg-[#f7f8fc] dark:bg-[#333333] dark:text-white">
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-indigo-600"><Sparkles size={16}/> AI</div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Quiz Generator</h1>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">Tạo bộ câu hỏi trắc nghiệm theo môn, chủ đề và độ khó.</p>
      </div>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040] sm:p-6">
        <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-indigo-100 p-2 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"><BookOpen size={20}/></div><div><h2 className="font-bold">Tạo quiz mới</h2><p className="text-sm text-gray-500 dark:text-gray-300">Chủ đề có thể để trống để AI chọn kiến thức cốt lõi.</p></div></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label><span className="mb-1 block text-sm font-semibold">Môn học *</span><input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Ví dụ: Toán, Vật lý, Tiếng Anh..." className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white"/></label>
          <label><span className="mb-1 block text-sm font-semibold">Chủ đề</span><input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Ví dụ: Hàm số, Dao động..." className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white"/></label>
          <label><span className="mb-1 block text-sm font-semibold">Số câu</span><select value={count} onChange={e=>setCount(Number(e.target.value))} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-gray-600 dark:bg-[#333333] dark:text-white"><option value={5}>5 câu</option><option value={10}>10 câu</option><option value={15}>15 câu</option></select></label>
          <label><span className="mb-1 block text-sm font-semibold">Độ khó</span><select value={difficulty} onChange={e=>setDifficulty(e.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-gray-600 dark:bg-[#333333] dark:text-white"><option>Dễ</option><option>Trung bình</option><option>Khó</option></select></label>
        </div>
        <button onClick={generateQuiz} disabled={loading || !subject.trim()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">{loading ? <><Loader2 size={18} className="animate-spin"/> Đang tạo...</> : <><Sparkles size={18}/> Tạo Quiz</>}</button>
      </section>

      {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</div>}

      {quiz && <section className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-indigo-600">Bộ câu hỏi</p><h2 className="text-2xl font-bold">{quiz.title}</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-300">{quiz.questions.length} câu • {difficulty}</p></div>{submitted && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Kết quả: {score}/{quiz.questions.length} ({Math.round(score / quiz.questions.length * 100)}%)</div>}</div>
        </div>
        {quiz.questions.map((q,i)=><article key={i} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040] sm:p-6">
          <div className="font-bold leading-7"><span className="mr-2 text-indigo-600">Câu {i+1}.</span><MarkdownRenderer text={q.question} inline /></div>
          <div className="mt-4 grid gap-2">{q.options.map((option,j)=>{const selected=answers[i]===j; const correct=submitted&&j===q.answer; const wrong=submitted&&selected&&!correct; return <button key={j} type="button" onClick={()=>!submitted&&setAnswers(a=>({...a,[i]:j}))} className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left ${correct?"border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30":wrong?"border-red-500 bg-red-50 dark:bg-red-950/30":selected?"border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30":"border-gray-200 hover:border-indigo-300 dark:border-gray-600"}`}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold">{String.fromCharCode(65+j)}</span><span className="leading-6"><MarkdownRenderer text={option} inline /></span></button>})}</div>
          {submitted&&<div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm leading-6 dark:bg-[#333333]"><strong>Giải thích:</strong><MarkdownRenderer text={q.explanation} /></div>}
        </article>)}
        <div className="sticky bottom-3 flex justify-end rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-gray-600 dark:bg-[#404040]/95">{!submitted?<button onClick={()=>{setSubmitted(true); void saveQuizResult();}} disabled={Object.keys(answers).length!==quiz.questions.length} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50"><CheckCircle2 size={18}/> Nộp bài</button>:<button onClick={generateQuiz} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white"><RefreshCw size={18}/> Tạo bộ khác</button>}</div>
      </section>}
    </div>
  </main>;
}
