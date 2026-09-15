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
  Timer,
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
  { icon: FileText, name: "Notes", description: "Ghi chú" },
  { icon: FileText, name: "Files", description: "Tài liệu" },
  { icon: Timer, name: "Pomodoro", description: "Tập trung theo phiên" },
];

const sidebarGroups = [
  { title: "AI", icon: Brain, items: aiModules },
  { title: "Tools", icon: Wrench, items: tools },
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

function Sidebar({ onClose }: { onClose?: () => void }) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-5">
        <a href="#dashboard" onClick={onClose} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Sparkles size={21} strokeWidth={2.4} />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-gray-950">ScholarOS</div>
            <div className="text-xs text-gray-500">Your study workspace</div>
          </div>
        </a>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Sidebar navigation">
        {sidebarGroups.map((group) => {
          const GroupIcon = group.icon;
          return (
            <div key={group.title} className="mb-6">
              <div className="mb-2 flex items-center gap-2 px-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                <GroupIcon size={15} />
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.name}
                      href={`#${item.name.toLowerCase().replaceAll(" ", "-").replace("&", "and")}`}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      <Icon size={19} />
                      <span>{item.name}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-gray-100 p-3">
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100">
          <Settings size={19} />
          Settings
        </button>
        <button className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100">
          <UserCircle size={19} />
          Profile
        </button>
      </div>
    </aside>
  );
}

export default function Home() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#f7f8fc]">
      <div className="hidden min-h-screen md:flex">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
        <div className="min-w-0 flex-1">
          <div className="border-b border-gray-200/80 bg-white/95 px-4 py-3 backdrop-blur md:hidden" />
          <DashboardContent />
        </div>
      </div>

      <div className="md:hidden">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur">
          <a href="#dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Sparkles size={19} />
            </div>
            <span className="text-lg font-bold text-gray-950">ScholarOS</span>
          </a>
          <button
            aria-label={mobileSidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileSidebarOpen}
            onClick={() => setMobileSidebarOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-100"
          >
            {mobileSidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </header>

        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="h-full" onClick={() => setMobileSidebarOpen(false)} />
            <div className="h-full w-[min(88vw,320px)] shadow-xl">
              <Sidebar onClose={() => setMobileSidebarOpen(false)} />
            </div>
          </div>
        )}
        <DashboardContent />
      </div>
    </main>
  );
}

function DashboardContent() {
  return (
    <div id="dashboard" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <section className="mb-10 rounded-3xl border border-indigo-100 bg-indigo-50/70 p-6 sm:p-8">
        <div className="flex items-center gap-3 text-indigo-700">
          <Sparkles size={22} />
          <span className="font-semibold">Welcome to ScholarOS</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Học tập. Tổ chức. Tiến bộ.</h1>
        <p className="mt-3 max-w-2xl text-gray-600">Một không gian duy nhất để quản lý việc học, thói quen, tài liệu và các công cụ AI.</p>
      </section>

      <section id="study-assistant" className="scroll-mt-24">
        <div className="mb-5"><h2 className="text-2xl font-bold">AI</h2><p className="text-sm text-gray-500">Các công cụ hỗ trợ học tập bằng AI</p></div>
        <div className="grid gap-4 md:grid-cols-3">{aiModules.map((item) => <ModuleCard key={item.name} {...item} />)}</div>
      </section>

      <section id="tools" className="mt-10 scroll-mt-24">
        <div className="mb-5"><h2 className="text-2xl font-bold">Tools</h2><p className="text-sm text-gray-500">Các công cụ tổ chức và quản lý việc học</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{tools.map((item) => <ModuleCard key={item.name} {...item} />)}</div>
      </section>
    </div>
  );
}
