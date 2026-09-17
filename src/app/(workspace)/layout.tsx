import type { ReactNode } from "react";
import Sidebar from "@/components/sidebar";
import AuthGate from "@/components/auth-gate";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen w-full overflow-x-hidden md:block">
        <Sidebar />
        <div className="min-h-screen min-w-0 max-w-full overflow-x-hidden md:ml-72">
          {children}
        </div>
      </div>
    </AuthGate>
  );
}
