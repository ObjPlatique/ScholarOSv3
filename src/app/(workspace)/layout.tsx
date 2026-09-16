import type { ReactNode } from "react";
import Sidebar from "@/components/sidebar";
import AuthGate from "@/components/auth-gate";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen w-full overflow-x-hidden md:flex">
        <Sidebar />
        <div className="min-w-0 max-w-full flex-1 overflow-x-hidden">{children}</div>
      </div>
    </AuthGate>
  );
}
