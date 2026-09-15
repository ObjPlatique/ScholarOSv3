import { Brain, CalendarDays, CheckSquare, FileText, Flame, LayoutDashboard, Sparkles } from "lucide-react";

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
  return (
    <main className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <div className="text-2xl font-bold tracking-tight">ScholarOS</div>
            <div className="text-sm text-gray-500">Your study workspace</div>
          </div>
          <div className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600">v3 · From Scratch</div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="mb-10 rounded-3xl border border-indigo-100 bg-indigo-50/70 p-8">
          <div className="flex items-center gap-3 text-indigo-700">
            <Sparkles size={22} />
            <span className="font-semibold">Welcome to ScholarOS</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Học tập. Tổ chức. Tiến bộ.</h1>
          <p className="mt-3 max-w-2xl text-gray-600">Một không gian duy nhất để quản lý việc học, thói quen, tài liệu và các công cụ AI.</p>
        </section>

        <section>
          <div className="mb-5 flex items-end justify-between"><div><h2 className="text-2xl font-bold">AI</h2><p className="text-sm text-gray-500">Các công cụ hỗ trợ học tập bằng AI</p></div></div>
          <div className="grid gap-4 md:grid-cols-3">{aiModules.map((item) => <ModuleCard key={item.name} {...item} />)}</div>
        </section>

        <section className="mt-10">
          <div className="mb-5"><h2 className="text-2xl font-bold">Tools</h2><p className="text-sm text-gray-500">Các công cụ tổ chức và quản lý việc học</p></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{tools.map((item) => <ModuleCard key={item.name} {...item} />)}</div>
        </section>
      </div>
    </main>
  );
}
