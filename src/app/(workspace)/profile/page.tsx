"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Edit3,
  LogOut,
  Mail,
  Save,
  UserCircle,
  X,
} from "lucide-react";
import { updateProfile, type User } from "firebase/auth";
import { subscribeToAuth, signOutUser } from "@/lib/firebase-auth";
import { listUserDocuments } from "@/lib/firestore";

type ProfileStats = {
  tasks: number;
  completedTasks: number;
  habits: number;
  notes: number;
  schedule: number;
};

const emptyStats: ProfileStats = {
  tasks: 0,
  completedTasks: 0,
  habits: 0,
  notes: 0,
  schedule: 0,
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProfileStats>(emptyStats);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (currentUser) => {
      setUser(currentUser);
      setDisplayName(currentUser?.displayName ?? "");
      setLoading(false);

      if (!currentUser) {
        setStats(emptyStats);
        return;
      }

      try {
        const [tasks, habits, notes, schedule] = await Promise.all([
          listUserDocuments<{ completed?: boolean }>(currentUser.uid, "tasks"),
          listUserDocuments(currentUser.uid, "habits"),
          listUserDocuments(currentUser.uid, "notes"),
          listUserDocuments(currentUser.uid, "schedule"),
        ]);

        setStats({
          tasks: tasks.length,
          completedTasks: tasks.filter((task) => task.completed === true).length,
          habits: habits.length,
          notes: notes.length,
          schedule: schedule.length,
        });
      } catch {
        setStats(emptyStats);
      }
    });

    return unsubscribe;
  }, []);

  const initials = useMemo(() => {
    const name = user?.displayName?.trim();
    if (name) {
      return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() ?? "S";
  }, [user]);

  const createdAt = user?.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

  const provider = user?.providerData[0]?.providerId === "google.com" ? "Google" : "Firebase";

  const saveProfile = async () => {
    if (!user) return;
    const nextName = displayName.trim();
    if (nextName.length > 60) {
      setError("Tên hiển thị tối đa 60 ký tự.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateProfile(user, { displayName: nextName || null });
      setUser({ ...user });
      setDisplayName(nextName);
      setEditing(false);
    } catch {
      setError("Không thể cập nhật hồ sơ. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-gray-950 dark:bg-[#333333] dark:text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Profile</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Hồ sơ</h1>
          <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">Quản lý thông tin tài khoản và xem nhanh hoạt động học tập của bạn.</p>
        </div>

        {loading ? (
          <section className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-[#404040]">
            <p className="text-gray-500 dark:text-gray-300">Đang tải hồ sơ...</p>
          </section>
        ) : !user ? (
          <section className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-[#404040]">
            <UserCircle className="mx-auto text-gray-400" size={48} />
            <p className="mt-3 font-semibold">Chưa có tài khoản đăng nhập.</p>
          </section>
        ) : (
          <div className="space-y-6">
            <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-[#404040]">
              <div className="h-28 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600" />
              <div className="px-5 pb-6 sm:px-8">
                <div className="-mt-12 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex items-end gap-4">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Ảnh đại diện" className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-md dark:border-[#404040]" />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-indigo-50 text-2xl font-bold text-indigo-600 shadow-md dark:border-[#404040] dark:bg-indigo-950/50 dark:text-indigo-300">
                        {initials}
                      </div>
                    )}
                    <div className="pb-1">
                      <h2 className="text-2xl font-bold">{user.displayName || "ScholarOS User"}</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-300">{user.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setEditing((value) => !value); setError(""); }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    {editing ? <X size={17} /> : <Edit3 size={17} />}
                    {editing ? "Hủy chỉnh sửa" : "Chỉnh sửa"}
                  </button>
                </div>

                {editing && (
                  <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30">
                    <label className="text-sm font-semibold">Tên hiển thị</label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        maxLength={60}
                        placeholder="Nhập tên của bạn"
                        className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-[#333333] dark:text-white"
                      />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={saveProfile}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Save size={17} />
                        {saving ? "Đang lưu..." : "Lưu"}
                      </button>
                    </div>
                    {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<CheckCircle2 size={20} />} label="Tasks hoàn thành" value={stats.completedTasks} />
              <StatCard icon={<BookOpen size={20} />} label="Tasks" value={stats.tasks} />
              <StatCard icon={<CalendarDays size={20} />} label="Buổi học" value={stats.schedule} />
              <StatCard icon={<UserCircle size={20} />} label="Habits" value={stats.habits} />
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#404040] sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <UserCircle size={21} />
                </div>
                <div>
                  <h3 className="font-bold">Thông tin tài khoản</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-300">Thông tin được lấy từ tài khoản Firebase hiện tại.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <InfoRow icon={<Mail size={19} />} label="Email" value={user.email ?? "—"} />
                <InfoRow icon={<UserCircle size={19} />} label="Phương thức đăng nhập" value={provider} />
                <InfoRow icon={<CalendarDays size={19} />} label="Ngày tạo tài khoản" value={createdAt} />
                <InfoRow icon={<BookOpen size={19} />} label="Notes" value={`${stats.notes} ghi chú`} />
              </div>
            </section>

            <section className="flex flex-col gap-4 rounded-3xl border border-red-100 bg-white p-5 shadow-sm dark:border-red-900/40 dark:bg-[#404040] sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div>
                <h3 className="font-bold">Đăng xuất</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">Kết thúc phiên đăng nhập hiện tại trên ScholarOS.</p>
              </div>
              <button
                type="button"
                onClick={() => signOutUser()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <LogOut size={18} />
                Đăng xuất
              </button>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#404040]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-300">{label}</p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#333333]">
      <div className="text-indigo-600 dark:text-indigo-300">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-1 truncate font-semibold">{value}</p>
      </div>
    </div>
  );
}
