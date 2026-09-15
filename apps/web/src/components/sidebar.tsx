"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard, Users, FileText, Wallet, Receipt,
  FolderOpen, BarChart3, ShieldCheck, History, Settings, DatabaseBackup, Sparkles,
} from "lucide-react";
import { useAuth } from "../lib/auth-context";

// Sidebar visibility follows permissions, never a hard-coded role check
// (Section 33: "Menu visibility must depend on permissions").
interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: string;
}

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Members", href: "/dashboard/members", icon: Users, permission: "members.view" },
  { label: "Applications", href: "/dashboard/applications", icon: FileText, permission: "applications.view" },
  { label: "Payments", href: "/dashboard/payments", icon: Wallet, permission: "payments.view" },
  { label: "Billing", href: "/dashboard/billing", icon: Receipt, permission: "payments.view" },
  { label: "Finance", href: "/dashboard/finance", icon: Wallet, permission: "finance.income" },
  { label: "Documents", href: "/dashboard/documents", icon: FolderOpen, permission: "documents.cards" },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3, permission: "reports.view" },
  { label: "Users & Roles", href: "/dashboard/users", icon: ShieldCheck, permission: "users.view" },
  { label: "Audit Logs", href: "/dashboard/audit-logs", icon: History, permission: "audit_logs.view" },
  { label: "Backups", href: "/dashboard/backups", icon: DatabaseBackup, permission: "backups.manage" },
  { label: "AI Assistant", href: "/dashboard/ai-assistant", icon: Sparkles, permission: "ai_assistant.use" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, permission: "settings.manage" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { can } = useAuth();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-navy-100 bg-white px-4 py-6 dark:border-navy-600 dark:bg-navy-900 md:flex">
      <div className="mb-8 px-2">
        <p className="font-display text-xl leading-tight text-navy dark:text-paper">Lifeline</p>
        <p className="font-display text-xl leading-tight text-crimson">Achham</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.filter((item) => !item.permission || can(item.permission)).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-navy-50 font-medium text-navy dark:bg-navy-600 dark:text-paper"
                  : "text-navy-400 hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-600",
              )}
            >
              <Icon size={18} strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
