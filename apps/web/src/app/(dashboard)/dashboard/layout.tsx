"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../../components/sidebar";
import { ThemeToggle } from "../../../components/theme-toggle";
import { NotificationBell } from "../../../components/notification-bell";
import { useAuth } from "../../../lib/auth-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-navy-400">Loading…</div>;
  }

  return (
    <div className="flex min-h-screen bg-paper dark:bg-navy-900">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-navy-100 bg-white px-6 py-3 dark:border-navy-600 dark:bg-navy-900">
          <p className="text-sm text-navy-400 dark:text-navy-100">
            Signed in as <span className="font-medium text-navy dark:text-paper">{user.fullName}</span>
          </p>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <ThemeToggle />
            <button
              onClick={() => logout().then(() => router.replace("/login"))}
              className="text-sm text-navy-400 hover:text-crimson dark:text-navy-100"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
