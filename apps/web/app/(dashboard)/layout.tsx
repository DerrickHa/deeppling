import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { WorkspaceProvider } from "@/lib/workspace-context";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <MobileNav />
          <main className="flex-1 p-6 lg:p-8 max-w-6xl mx-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
