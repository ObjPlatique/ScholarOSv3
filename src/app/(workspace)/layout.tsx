import type { ReactNode } from "react";
import Sidebar from "@/components/sidebar";
import AuthGate from "@/components/auth-gate";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <div className="w-full overflow-x-hidden">
        <Sidebar />
        <div className="min-w-0 max-w-full overflow-x-hidden transition-[margin-left] duration-200 md:ml-[var(--scholar-sidebar-width,288px)]">
          {children}
        </div>
      </div>
    </AuthGate>
  );
}
