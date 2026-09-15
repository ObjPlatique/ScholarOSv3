import type { ReactNode } from "react";

export default function ModulePage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f7f8fc]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wider text-indigo-600">{eyebrow}</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-gray-600">{description}</p>
        </div>
        {children ?? (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-gray-500">Module này đã có route riêng và sẵn sàng để phát triển.</p>
          </section>
        )}
      </div>
    </main>
  );
}
