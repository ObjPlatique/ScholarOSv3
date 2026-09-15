"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { subscribeToAuth, signInWithGoogle } from "@/lib/firebase-auth";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToAuth((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  async function handleSignIn() {
    setError(null);
    setSigningIn(true);

    try {
      await signInWithGoogle();
    } catch (signInError) {
      console.error(signInError);
      setError("Không thể đăng nhập bằng Google. Vui lòng thử lại.");
    } finally {
      setSigningIn(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] px-4">
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5 text-sm font-semibold text-gray-600 shadow-sm">
          Đang kiểm tra phiên đăng nhập…
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] px-4 py-10">
        <section className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white">
            S
          </div>
          <div className="mt-6 text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-indigo-600">ScholarOS</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950">Đăng nhập để tiếp tục</h1>
            <p className="mt-3 text-gray-600">
              Dữ liệu học tập của bạn sẽ được lưu riêng theo tài khoản Firebase.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignIn}
            disabled={signingIn}
            className="mt-7 flex w-full items-center justify-center rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingIn ? "Đang đăng nhập…" : "Tiếp tục với Google"}
          </button>

          {error && <p className="mt-4 text-center text-sm font-semibold text-red-600">{error}</p>}
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
