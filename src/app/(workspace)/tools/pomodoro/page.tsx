"use client";

import { useEffect, useMemo, useState } from "react";

const MODES = {
  focus: { label: "Tập trung", minutes: 25 },
  shortBreak: { label: "Nghỉ ngắn", minutes: 5 },
  longBreak: { label: "Nghỉ dài", minutes: 15 },
} as const;

type Mode = keyof typeof MODES;

export default function PomodoroPage() {
  const [mode, setMode] = useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(MODES.focus.minutes * 60);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);

  const totalSeconds = MODES[mode].minutes * 60;
  const progress = Math.min(100, Math.max(0, ((totalSeconds - secondsLeft) / totalSeconds) * 100));

  useEffect(() => {
    if (!running) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setRunning(false);
          if (mode === "focus") setCompleted((value) => value + 1);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [running, mode]);

  const time = useMemo(() => {
    const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const seconds = (secondsLeft % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [secondsLeft]);

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setRunning(false);
    setSecondsLeft(MODES[nextMode].minutes * 60);
  };

  const reset = () => {
    setRunning(false);
    setSecondsLeft(MODES[mode].minutes * 60);
  };

  return (
    <main className="min-h-screen bg-[#f7f8fc]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wider text-indigo-600">Tools</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Pomodoro</h1>
          <p className="mt-2 max-w-2xl text-gray-600">Đồng hồ Pomodoro giúp bạn tập trung theo từng phiên học và nghỉ.</p>
        </div>

        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap justify-center gap-2" role="tablist" aria-label="Chế độ Pomodoro">
            {(Object.keys(MODES) as Mode[]).map((key) => (
              <button
                key={key}
                onClick={() => changeMode(key)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  mode === key ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {MODES[key].label}
              </button>
            ))}
          </div>

          <div className="mx-auto mt-8 flex max-w-md flex-col items-center">
            <div
              className="relative grid aspect-square w-full max-w-[330px] place-items-center rounded-full"
              style={{ background: `conic-gradient(#4f46e5 ${progress}%, #e5e7eb ${progress}% 100%)` }}
            >
              <div className="absolute inset-[10px] rounded-full bg-white sm:inset-[12px]" />
              <div className="relative z-10 text-center">
                <div className="text-6xl font-bold tabular-nums tracking-tight text-gray-950 sm:text-7xl">{time}</div>
                <div className="mt-2 text-sm font-medium text-gray-500">{MODES[mode].label}</div>
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
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-base font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Đặt lại
              </button>
            </div>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-gray-50 p-4 text-center">
              <div className="text-2xl font-bold text-gray-950">{completed}</div>
              <div className="mt-1 text-sm text-gray-500">Phiên tập trung hoàn thành</div>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 text-center">
              <div className="text-2xl font-bold text-gray-950">{MODES.focus.minutes} phút</div>
              <div className="mt-1 text-sm text-gray-500">Thời gian tập trung</div>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 text-center">
              <div className="text-2xl font-bold text-gray-950">{Math.round(progress)}%</div>
              <div className="mt-1 text-sm text-gray-500">Tiến trình phiên hiện tại</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
