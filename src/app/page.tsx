"use client";

import { useState } from "react";
import {
  Brain,
  CalendarDays,
  CheckSquare,
  FileText,
  Flame,
  LayoutDashboard,
  Menu,
  Settings,
  Sparkles,
  UserCircle,
  Wrench,
  X,
} from "lucide-react";

const aiModules = [
  { icon: Brain, name: "Study Assistant", description: "Hỏi đáp và hỗ trợ học tập" },
  { icon: Sparkles, name: "AI Planner", description: "Lập kế hoạch học tập thông minh" },
  { icon: CheckSquare, name: "Quiz & Grader", description: "Tạo quiz và chấm bài" },
];

const tools = [
  { icon: LayoutDashboard, name: "Dashboard", description: "Tổng quan việc học" },
  { icon: CalendarDays, name: "Schedule", description: "Thời khóa biểu" },
  { icon: CheckSquare, name: "Tasks", description: "Công việc cần làm" },
  { icon: Flame, name: "Habits", description: "Theo dõi thói quen" },
  { icon: FileText, name: "Notes & Files", description: "Ghi chú và tài liệu" },
];

function ModuleCard({ icon: Icon, name, description }: { icon: typeof Brain; name: string; description: string }) {
  return (
    <button className="group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <Icon size={22} />
      </div>
      <div className="text-lg font-semibold">{name}</div>
      <div className="mt-1 text-sm text-gray-500">{description}</div>
    </button>
  );
}

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <a href="#dashboard" onClick={closeMobileMenu} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Sparkles size={21} strokeWidth={2.4} />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight text-gray-950">ScholarOS</div>
              <div className="hidden text-xs text-gray-500 sm:block">Your study workspace</div>
            </div>
          </a>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            <a href="#ai" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700">
              <Brain size={18} />
              AI
            </a>
            <a href="#tools" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700">
              <Wrench size={18} />
              Tools
            </a>
          </nav>

          <div className="hidden items-center gap-1 md:flex">
            <button aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 hover:text-gray-950">
              <Settings size={19} />
            </button>
            <button aria-label="Profile" className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 hover:text-gray-950">
              <UserCircle size={21} />
            </button>
          </div>

          <button
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-100 md:hidden"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-gray-200 bg-white px-4 pb-4 pt-2 md:hidden">
            <nav className="grid gap-1" aria-label="Mobile navigation">
              <a href="#ai" onClick={closeMobileMenu} className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700">
                <Brain size={20} />
                AI
              </a>
              <a href="#tools" onClick={closeMobileMenu} className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700">
                <Wrench size={20} />
                Tools
              </a>
              <div className="my-1 border-t border-gray-100" />
              <button className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-gray-700 hover:bg-gray-100">
                <Settings size={20} />
                Settings
              </button>
              <button className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-gray-700 hover:bg-gray-100">
                <UserCircle size={20} />
                Profile
              </button>
            </nav>
          </div>
        )}
      </header>

      <div id="dashboard" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="mb-10 rounded-3xl border border-indigo-100 bg-indigo-50/70 p-6 sm:p-8">
          <div className="flex items-center gap-3 text-indigo-700">
            <Sparkles size={22} />
            <span className="font-semibold">Welcome to ScholarOS</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Học tập. Tổ chức. Tiến bộ.</h1>
          <p className="mt-3 max-w-2xl text-gray-600">Một không gian duy nhất để quản lý việc học, thói quen, tài liệu và các công cụ AI.</p>
        </section>

        <section id="ai" className="scroll-mt-24">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold">AI</h2>
              <p className="text-sm text-gray-500">Các công cụ hỗ trợ học tập bằng AI</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">{aiModules.map((item) => <ModuleCard key={item.name} {...item} />)}</div>
        </section>

        <section id="tools" className="mt-10 scroll-mt-24">
          <div className="mb-5">
            <h2 className="text-2xl font-bold">Tools</h2>
            <p className="text-sm text-gray-500">Các công cụ tổ chức và quản lý việc học</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{tools.map((item) => <ModuleCard key={item.name} {...item} />)}</div>
        </section>
      </div>
    </main>
  );
}
