import type { ReactNode } from "react";
import Sidebar from "@/components/sidebar";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
