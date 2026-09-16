"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  Database,
  Info,
  Moon,
  Palette,
  RotateCcw,
  Settings2,
  Shield,
  Sun,
} from "lucide-react";

const THEME_KEY = "scholaros-theme";
const SETTINGS_KEY = "scholaros-settings";

type Preferences = {
  compactMode: boolean;
  showCompletedTasks: boolean;
  confirmDelete: boolean;
};

const defaultPreferences: Preferences = {
  compactMode: false,
  showCompletedTasks: true,
  confirmDelete: true,
};

export default function SettingsPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    const nextTheme = savedTheme === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");

    try {
      const stored = window.localStorage.getItem(SETTINGS_KEY);
      if (stored) setPreferences({ ...defaultPreferences, ...JSON.parse(stored) });
    } catch {
      setPreferences(defaultPreferences);
    }
  }, []);

  const changeTheme = (nextTheme: "light" | "dark") => {
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem(THEME_KEY, nextTheme);
  };

  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultPreferences));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const browserInfo = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.innerWidth}px · ${window.innerHeight}px`;
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-gray-950 dark:bg-[#333333] dark:text-white">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wider text-indigo-600">User Settings</div>
          <div className="mt-2 flex items-center gap-3">
            <Settings2 className="text-indigo-600" size={30} />
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Cài đặt</h1>
          </div>
          <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">
            Quản lý giao diện, trải nghiệm và các tùy chọn cá nhân của ScholarOS.
          </p>
        </div>

        <div className="space-y-5">
          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[#4b4b4b] dark:bg-[#404040] sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50">
                <Palette size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Giao diện</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">Chọn chế độ sáng hoặc tối cho ScholarOS.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {(["light", "dark"] as const).map((value) => {
                const active = theme === value;
                const isLight = value === "light";
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => changeTheme(value)}
                    className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-[#555] dark:bg-[#333] dark:text-gray-200 dark:hover:bg-[#383838]"
                    }`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-[#4a4a4a]">
                      {isLight ? <Sun size={22} /> : <Moon size={22} />}
                    </span>
                    <span>
                      <span className="block font-bold">{isLight ? "Sáng" : "Tối"}</span>
                      <span className="mt-1 block text-sm opacity-80">{isLight ? "Giao diện sáng, rõ ràng" : "Nền xám, chữ trắng, phù hợp ban đêm"}</span>
                    </span>
                    {active && <Check className="ml-auto" size={20} />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[#4b4b4b] dark:bg-[#404040] sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50">
                <Settings2 size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Trải nghiệm</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">Các tùy chọn được lưu ngay trên thiết bị này.</p>
              </div>
            </div>

            <div className="mt-5 divide-y divide-gray-100 dark:divide-[#555]">
              <SettingToggle label="Hiển thị Tasks đã hoàn thành" description="Giữ các nhiệm vụ đã hoàn thành trong danh sách." checked={preferences.showCompletedTasks} onChange={(value) => updatePreference("showCompletedTasks", value)} />
              <SettingToggle label="Chế độ hiển thị gọn" description="Giảm khoảng cách giữa các thành phần để xem được nhiều nội dung hơn." checked={preferences.compactMode} onChange={(value) => updatePreference("compactMode", value)} />
              <SettingToggle label="Xác nhận trước khi xóa" description="Hiện bước xác nhận trước các thao tác xóa dữ liệu." checked={preferences.confirmDelete} onChange={(value) => updatePreference("confirmDelete", value)} />
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button type="button" onClick={resetPreferences} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-[#555] dark:text-gray-200 dark:hover:bg-[#383838]">
                <RotateCcw size={17} /> Đặt lại tùy chọn
              </button>
              {saved && <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600"><Check size={16} /> Đã lưu</span>}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[#4b4b4b] dark:bg-[#404040] sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50">
                <Bell size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Thông báo</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">Quản lý thông báo trong ứng dụng.</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-[#555] dark:bg-[#333]">
              <div className="flex gap-3">
                <Info className="mt-0.5 shrink-0 text-indigo-600" size={19} />
                <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">Notification center hiện vẫn hoạt động độc lập. Phần push notification khi đóng Web App (FCM + Scheduler) đang được tạm ngưng.</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[#4b4b4b] dark:bg-[#404040] sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50">
                <Database size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Dữ liệu & bảo mật</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">Thông tin về cách ScholarOS đang lưu dữ liệu.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoCard icon={<Shield size={18} />} title="Tài khoản" text="Xác thực và tài khoản được quản lý bằng Firebase Authentication." />
              <InfoCard icon={<Database size={18} />} title="Dữ liệu học tập" text="Tasks, Schedule, Habits và Notes được lưu theo tài khoản trong Firestore." />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-500 shadow-sm dark:border-[#4b4b4b] dark:bg-[#404040] dark:text-gray-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>ScholarOS Settings</span>
              <span>{browserInfo ? `Thiết bị hiện tại: ${browserInfo}` : ""}</span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function SettingToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-5 py-5 first:pt-0 last:pb-0">
      <span className="min-w-0">
        <span className="block font-bold">{label}</span>
        <span className="mt-1 block text-sm leading-5 text-gray-500 dark:text-gray-300">{description}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 shrink-0 accent-indigo-600" />
    </label>
  );
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-[#555] dark:bg-[#333]">
      <div className="flex items-center gap-2 font-bold">{icon}{title}</div>
      <p className="mt-2 text-sm leading-5 text-gray-600 dark:text-gray-300">{text}</p>
    </div>
  );
}
