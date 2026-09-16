"use client";

import { useEffect, useMemo, useState } from "react";

const MODES = {
  focus: { label: "Tập trung", defaultMinutes: 25 },
  shortBreak: { label: "Nghỉ ngắn", defaultMinutes: 5 },
  longBreak: { label: "Nghỉ dài", defaultMinutes: 15 },
} as const;

type Mode = keyof typeof MODES;

const STORAGE_KEY = "scholaros-pomodoro";

export default function PomodoroPage() {
  const [mode, setMode] = useState<Mode>("focus");
  const [minutes, setMinutes] = useState<number>(MODES.focus.defaultMinutes);
  const [secondsLeft, setSecondsLeft] = useState(MODES.focus.defaultMinutes * 60);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [autoNext, setAutoNext] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const totalSeconds = minutes * 60;
  const progress = totalSeconds > 0 ? Math.min(100, Math.max(0, ((totalSeconds - secondsLeft) / totalSeconds) * 100)) : 0;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved) as { completed?: number; autoNext?: boolean };
        if (typeof data.completed === "number") setCompleted(data.completed);
        if (typeof data.autoNext === "boolean") setAutoNext(data.autoNext);
      }
    } catch {
      // Ignore invalid local storage data.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed, autoNext }));
  }, [completed, autoNext, loaded]);

  useEffect(() => {
    if (!running) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setRunning(false);
          if (mode === "focus") {
            setCompleted((value) => value + 1);
          }

          if (autoNext) {
            const nextMode: Mode = mode === "focus" ? (completed + 1) % 4 === 0 ? "longBreak" : "shortBreak" : "focus";
            setMode(nextMode);
            setMinutes(MODES[nextMode].defaultMinutes);
            setSecondsLeft(MODES[nextMode].defaultMinutes * 60);
            window.setTimeout(() => setRunning(true), 100);
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [running, mode, autoNext, completed]);

  const time = useMemo(() => {
    const mins = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const secs = (secondsLeft % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }, [secondsLeft]);

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setRunning(false);
    setMinutes(MODES[nextMode].defaultMinutes);
    setSecondsLeft(MODES[nextMode].defaultMinutes * 60);
  };

  const updateMinutes = (value: number) => {
    const next = Math.min(180, Math.max(1, value || 1));
    setMinutes(next);
    setRunning(false);
    setSecondsLeft(next * 60);
  };

  const reset = () => {
    setRunning(false);
    setSecondsLeft(minutes * 60);
  };

  const resetStats = () => setCompleted(0);

  return (
    <main className="min-h-screen bg-[#f7f8fc] dark:bg-[#333333] dark:text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wider text-indigo-600">Tools</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-4xl">Pomodoro</h1>
          <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">Tùy chỉnh thời gian tập trung, nghỉ và tự động chuyển phiên.</p>
        </div>

        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-[#404040] sm:p-8">
          <div className="flex flex-wrap justify-center gap-2" role="tablist" aria-label="Chế độ Pomodoro">
            {(Object.keys(MODES) as Mode[]).map((key) => (
              <button
                key={key}
                onClick={() => changeMode(key)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  mode === key ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#505050] dark:text-gray-200 dark:hover:bg-[#5b5b5b]"
                }`}
              >
                {MODES[key].label}
              </button>
            ))}
          </div>

          <div className="mx-auto mt-8 flex max-w-md flex-col items-center">
            <div
              className="relative grid aspect-square w-full max-w-[330px] place-items-center rounded-full"
              style={{ background: `conic-gradient(#4f46e5 ${progress}%, #d1d5db ${progress}% 100%)` }}
            >
              <div className="absolute inset-[10px] rounded-full bg-white dark:bg-[#333333] sm:inset-[12px]" />
              <div className="relative z-10 text-center">
                <div className="text-6xl font-bold tabular-nums tracking-tight text-gray-950 dark:text-white sm:text-7xl">{time}</div>
                <div className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-300">{MODES[mode].label}</div>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <button
                onClick={() => setRunning((value) => !value)}
                className="min-w-36 rounded-xl bg-indigo-600 px-6 py-3 text-base font-bold text-white shadow-sm transition hover:bg-indigo-700"
              >
                {running ? "Tạm dừng" : secondsLeft === 0 ? "Bắt đầu lại" : "Bắt đầu"}
              </button>
              <button
                onClick={reset}
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-base font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-500 dark:bg-[#404040] dark:text-gray-100 dark:hover:bg-[#4b4b4b]"
              >
                Đặt lại
              </button>
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-[#333333]">
            <label htmlFor="pomodoro-minutes" className="block text-sm font-semibold text-gray-800 dark:text-white">
              Thời gian {MODES[mode].label.toLowerCase()}
            </label>
            <div className="mt-3 flex items-center gap-3">
              <input
                id="pomodoro-minutes"
                type="number"
                min={1}
                max={180}
                value={minutes}
                onChange={(event) => updateMinutes(Number(event.target.value))}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-lg font-semibold text-gray-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-500 dark:bg-[#404040] dark:text-white"
              />
              <span className="font-medium text-gray-500 dark:text-gray-300">phút</span>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Có thể đặt từ 1 đến 180 phút.</p>
          </div>

          <div className="mx-auto mt-4 flex max-w-md items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-[#333333]">
            <div>
              <div className="font-semibold text-gray-800 dark:text-white">Tự động chuyển phiên</div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Học → nghỉ → học tự động</div>
            </div>
            <button
              type="button"
              onClick={() => setAutoNext((value) => !value)}
              aria-pressed={autoNext}
              className={`relative h-7 w-12 rounded-full transition ${autoNext ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${autoNext ? "left-6" : "left-1"}`} />
            </button>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-gray-50 p-4 text-center dark:bg-[#333333]">
              <div className="text-2xl font-bold text-gray-950 dark:text-white">{completed}</div>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-300">Phiên tập trung hoàn thành</div>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 text-center dark:bg-[#333333]">
              <div className="text-2xl font-bold text-gray-950 dark:text-white">{minutes} phút</div>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-300">Thời lượng hiện tại</div>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 text-center dark:bg-[#333333]">
              <div className="text-2xl font-bold text-gray-950 dark:text-white">{Math.round(progress)}%</div>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-300">Tiến trình phiên hiện tại</div>
            </div>
          </div>

          <div className="mt-5 flex justify-center">
            <button onClick={resetStats} className="text-sm font-semibold text-gray-500 underline-offset-4 hover:underline dark:text-gray-300">
              Xóa số phiên hoàn thành
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
