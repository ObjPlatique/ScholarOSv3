"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  CalendarDays,
  CheckSquare,
  FileText,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  Timer,
  UserCircle,
  Wrench,
  X,
} from "lucide-react";
import { useState } from "react";
import { signOutUser } from "@/lib/firebase-auth";

const groups = [
  {
    title: "AI",
    icon: Brain,
    items: [
      ["Study Assistant", "/ai/study-assistant", Brain],
      ["AI Planner", "/ai/planner", Sparkles],
      ["Quiz & Grader", "/ai/quiz", CheckSquare],
    ] as const,
  },
  {
    title: "Tools",
    icon: Wrench,
    items: [
      ["Dashboard", "/dashboard", LayoutDashboard],
      ["Schedule", "/tools/schedule", CalendarDays],
      ["Tasks", "/tools/tasks", CheckSquare],
      ["Habits", "/tools/habits", Flame],
      ["Notes", "/tools/notes", FileText],
      ["Files", "/tools/files", FileText],
      ["Pomodoro", "/tools/pomodoro", Timer],
    ] as const,
  },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="ScholarOS navigation">
      {groups.map((group) => {
        const GroupIcon = group.icon;
        return (
          <div key={group.title} className="mb-6">
            <div className="mb-2 flex items-center gap-2 px-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              <GroupIcon size={15} />
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map(([label, href, Icon]) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      active
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-950"
                    }`}
                  >
                    <Icon size={19} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarPanel({ onNavigate }: { onNavigate?: () => void }) {
  async function handleSignOut() {
    try {
      await signOutUser();
    } catch (error) {
      console.error("Failed to sign out", error);
    }
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-5">
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Sparkles size={21} strokeWidth={2.4} />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-gray-950">ScholarOS</div>
            <div className="text-xs text-gray-500">Your study workspace</div>
          </div>
        </Link>
      </div>

      <Navigation onNavigate={onNavigate} />

      <div className="border-t border-gray-100 p-3">
        <Link
          href="/settings"
          onClick={onNavigate}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
        >
          <Settings size={19} />
          Settings
        </Link>
        <Link
          href="/profile"
          onClick={onNavigate}
          aria-current={usePathname() === "/profile" ? "page" : undefined}
          className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
            usePathname() === "/profile"
              ? "bg-indigo-50 text-indigo-700"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <UserCircle size={19} />
          Profile
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 hover:text-red-600"
        >
          <LogOut size={19} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="hidden min-h-screen md:block">
        <div className="sticky top-0 h-screen">
          <SidebarPanel />
        </div>
      </div>

      <div className="md:hidden">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Sparkles size={19} />
            </div>
            <span className="text-lg font-bold text-gray-950">ScholarOS</span>
          </Link>
          <button
            type="button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-100"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </header>

        {open && (
          <div className="fixed inset-0 z-50 flex">
            <button
              type="button"
              aria-label="Close navigation"
              className="flex-1 bg-gray-950/20"
              onClick={() => setOpen(false)}
            />
            <div className="h-full w-[min(88vw,320px)] shadow-xl">
              <SidebarPanel onNavigate={() => setOpen(false)} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
