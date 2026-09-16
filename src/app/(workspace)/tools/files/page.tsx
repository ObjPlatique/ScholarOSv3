import ModulePage from "@/components/module-page";

export default function FilesPage() {
  return (
    <ModulePage
      eyebrow="Tools"
      title="Files"
      description="Quản lý và truy cập tài liệu học tập của bạn."
    >
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-gray-500">Firebase free plan hiện chưa hỗ trợ tính năng này.</p>
      </section>
    </ModulePage>
  );
}
