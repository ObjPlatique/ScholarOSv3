"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock3, Loader2, RefreshCw, Sparkles, Target } from "lucide-react";
import MarkdownRenderer from "../../../../components/markdown-renderer";
import { auth } from "../../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { createUserDocument, listUserDocuments } from "../../../../lib/firestore";

type PlanItem = { date: string; subject: string; tasks: string[]; minutes: number; priority: string };
type Plan = { title: string; summary: string; dailyFocus: string; items: PlanItem[]; tips: string[] };
type StoredPlan = Plan & { id: string; type: "aiPlan"; createdAt?: unknown };

export default function AIPlannerPage() {
  const [goal, setGoal] = useState("");
  const [subjects, setSubjects] = useState("");
  const [examDate, setExamDate] = useState("");
  const [hours, setHours] = useState(3);
  const [level, setLevel] = useState("Trung bình");
  const [constraints, setConstraints] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setRestoring(false);
        return;
      }
      void (async () => {
        try {
          const items = await listUserDocuments<StoredPlan>(user.uid, "aiPlans");
          const latest = [...items].sort((a, b) => {
            const getTime = (value: unknown) =>
              typeof (value as { toMillis?: () => number } | undefined)?.toMillis === "function"
                ? (value as { toMillis: () => number }).toMillis()
                : 0;
            return getTime(b.createdAt) - getTime(a.createdAt);
          })[0];
          if (latest) setPlan(latest);
        } catch {
          // Best-effort restore.
        } finally {
          setRestoring(false);
        }
      })();
    });
    return unsubscribe;
  }, []);

  async function generatePlan() {
    if (!goal.trim()) {
      setError("Vui lòng nhập mục tiêu học tập.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, subjects, examDate, hours, level, constraints }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể tạo kế hoạch.");
      setPlan(data.plan);

      const user = auth.currentUser;
      if (user) {
        try {
          await createUserDocument(user.uid, "aiPlans", {
            type: "aiPlan",
            ...data.plan,
            goal,
            subjects,
            examDate,
            dailyHours: hours,
            level,
            constraints,
          });
        } catch {
          setError("Đã tạo kế hoạch nhưng chưa thể lưu vào Firebase.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo kế hoạch.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-gray-900 dark:bg-[#333333] dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <div className="mb-2 flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Sparkles size={20} />
            <span className="text-sm font-semibold">AI PLANNER</span>
          </div>
          <h1 className="text-3xl font-bold">Lập kế hoạch học tập</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">AI biến mục tiêu, thời gian và môn học của bạn thành kế hoạch học tập thực tế.</p>
        </header>

        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#404040]">
            <div className="mb-5 flex items-center gap-2 font-semibold"><Target size={19} /> Thông tin đầu vào</div>
            <div className="space-y-4">
              <label className="block text-sm font-medium">Mục tiêu
                <textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ví dụ: Đạt 8+ Toán THPTQG" rows={3} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white" />
              </label>
              <label className="block text-sm font-medium">Môn học
                <input value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="Toán, Văn, Lý..." className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white" />
              </label>
              <label className="block text-sm font-medium">Ngày thi / deadline
                <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3 outline-none dark:border-gray-600 dark:bg-[#333333] dark:text-white" />
              </label>
              <label className="block text-sm font-medium">Thời gian học mỗi ngày: {hours} giờ
                <input type="range" min="1" max="12" value={hours} onChange={(e) => setHours(Number(e.target.value))} className="mt-3 w-full" />
              </label>
              <label className="block text-sm font-medium">Mức hiện tại
                <select value={level} onChange={(e) => setLevel(e.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3 dark:border-gray-600 dark:bg-[#333333] dark:text-white">
                  <option>Cơ bản</option><option>Trung bình</option><option>Khá</option><option>Nâng cao</option>
                </select>
              </label>
              <label className="block text-sm font-medium">Ràng buộc / lịch bận
                <textarea value={constraints} onChange={(e) => setConstraints(e.target.value)} placeholder="Ví dụ: bận tối thứ 3, cần nghỉ Chủ nhật..." rows={3} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white" />
              </label>
              <button onClick={generatePlan} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                {loading ? "Đang lập kế hoạch..." : "Tạo kế hoạch"}
              </button>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>
          </div>

          <div className="min-w-0">
            {restoring && !plan ? (
              <div className="flex min-h-64 items-center justify-center rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#404040]"><Loader2 className="animate-spin" /></div>
            ) : !plan ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-600 dark:bg-[#404040]">
                <CalendarDays size={40} className="mb-3 text-indigo-500" />
                <h2 className="text-xl font-semibold">Chưa có kế hoạch</h2>
                <p className="mt-2 max-w-md text-gray-500 dark:text-gray-300">Điền thông tin bên trái để AI tạo kế hoạch theo từng ngày.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-[#404040]">
                  <h2 className="text-xl font-bold">{plan.title}</h2>
                  <div className="mt-2 text-sm text-gray-700 dark:text-gray-200"><MarkdownRenderer text={plan.summary} /></div>
                </div>
                {plan.items.map((item, index) => (
                  <article key={index} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#404040]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold"><CalendarDays size={18} /> {item.date}</div>
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{item.priority}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold">{item.subject}</h3>
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><Clock3 size={16} /> {item.minutes} phút</div>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{item.tasks.map((task, taskIndex) => <li key={taskIndex}><MarkdownRenderer text={task} inline /></li>)}</ul>
                  </article>
                ))}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#404040]">
                  <h3 className="font-semibold">Mẹo thực hiện</h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700 dark:text-gray-200">{plan.tips.map((tip, index) => <li key={index}><MarkdownRenderer text={tip} inline /></li>)}</ul>
                </div>
                <button onClick={generatePlan} disabled={loading} className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 font-medium dark:border-gray-600 dark:bg-[#404040]">
                  <RefreshCw size={17} /> Tạo lại
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
