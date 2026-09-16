"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function SettingsPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("scholaros-theme");
    const nextTheme = saved === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }, []);

  const changeTheme = (nextTheme: "light" | "dark") => {
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem("scholaros-theme", nextTheme);
  };

  return (
    <main className="min-h-screen bg-[#f7f8fc]">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wider text-indigo-600">User Settings</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Cài đặt</h1>
          <p className="mt-2 max-w-2xl text-gray-600">Tùy chỉnh giao diện và trải nghiệm ScholarOS của bạn.</p>
        </div>

        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
          <div>
            <h2 className="text-xl font-bold text-gray-950">Giao diện</h2>
            <p className="mt-1 text-sm text-gray-500">Chọn chế độ sáng hoặc tối cho toàn bộ ScholarOS.</p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={theme === "light"}
              onClick={() => changeTheme("light")}
              className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${
                theme === "light"
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                <Sun size={22} />
              </span>
              <span>
                <span className="block font-bold">Sáng</span>
                <span className="mt-1 block text-sm opacity-80">Giao diện sáng, rõ ràng</span>
              </span>
            </button>

            <button
              type="button"
              aria-pressed={theme === "dark"}
              onClick={() => changeTheme("dark")}
              className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${
                theme === "dark"
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                <Moon size={22} />
              </span>
              <span>
                <span className="block font-bold">Tối</span>
                <span className="mt-1 block text-sm opacity-80">Giao diện tối, dễ dùng ban đêm</span>
              </span>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
