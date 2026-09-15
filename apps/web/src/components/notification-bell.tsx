"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { apiFetch } from "../lib/api-client";
import type { NotificationDto } from "@lifeline/types";

// Section 25: in-app notifications, polled rather than pushed (no
// websocket/SSE infra in this phase - a reasonable next increment, not a
// silent gap since polling every 30s is a fine default for this scale).
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  function refresh() {
    apiFetch<number>("/notifications/unread-count").then(setUnreadCount).catch(() => {});
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const data = await apiFetch<NotificationDto[]>("/notifications");
      setItems(data);
    }
  }

  async function markAllRead() {
    await apiFetch("/notifications/read-all", { method: "PATCH", body: JSON.stringify({}) });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  async function openNotification(n: NotificationDto) {
    if (!n.isRead) {
      await apiFetch(`/notifications/${n.id}/read`, { method: "PATCH", body: JSON.stringify({}) });
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, isRead: true } : i)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative rounded p-2 text-navy-400 hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-600" aria-label="Notifications">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-crimson px-1 text-[10px] text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded border border-navy-100 bg-white shadow-lg dark:border-navy-600 dark:bg-navy-900">
          <div className="flex items-center justify-between border-b border-navy-100 px-4 py-2 dark:border-navy-600">
            <p className="text-sm font-medium text-navy dark:text-paper">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-navy underline hover:text-crimson dark:text-paper">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-navy-400 dark:text-navy-100">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={n.link ?? "#"}
                  onClick={() => openNotification(n)}
                  className={`block border-b border-navy-100 px-4 py-3 text-sm last:border-0 hover:bg-navy-50 dark:border-navy-600 dark:hover:bg-navy-600 ${!n.isRead ? "bg-navy-50/60 dark:bg-navy-600/40" : ""}`}
                >
                  <p className="font-medium text-navy dark:text-paper">{n.title}</p>
                  <p className="text-navy-400 dark:text-navy-100">{n.message}</p>
                  <p className="mt-1 text-xs text-navy-400 dark:text-navy-100">{new Date(n.createdAt).toLocaleString()}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
