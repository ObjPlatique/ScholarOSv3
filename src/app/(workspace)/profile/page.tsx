"use client";

import { useEffect, useState } from "react";
import { Mail, UserCircle } from "lucide-react";
import type { User } from "firebase/auth";
import { subscribeToAuth } from "@/lib/firebase-auth";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f8fc]">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wider text-indigo-600">Profile</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Hồ sơ</h1>
          <p className="mt-2 max-w-2xl text-gray-600">Thông tin tài khoản đang đăng nhập vào ScholarOS.</p>
        </div>

        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <UserCircle size={48} strokeWidth={1.8} />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-gray-950">Tài khoản của bạn</h2>
          </div>

          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                <Mail size={22} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-500">Email đăng nhập</div>
                <div className="mt-1 break-all text-base font-bold text-gray-950">
                  {loading ? "Đang tải..." : user?.email ?? "Không tìm thấy tài khoản đăng nhập"}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
