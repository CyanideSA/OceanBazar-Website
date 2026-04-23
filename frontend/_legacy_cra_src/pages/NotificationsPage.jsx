import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { notificationAPI } from "@/api/service";
import { getApiErrorMessage } from "@/utils/apiError";
import AccountLayout from "@/components/AccountLayout";
import { useTheme } from "@/context/ThemeContext";
import { useCustomerInbox } from "@/context/CustomerInboxContext";

export default function NotificationsPage() {
  const { theme } = useTheme();
  const { incoming, clearIncoming, refreshUnread, inboxRefreshTick } = useCustomerInbox();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const isDark = theme === "dark";

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await notificationAPI.list();
      setNotifications(Array.isArray(res.data) ? res.data : []);
      await refreshUnread();
    } catch (e) {
      const detail = getApiErrorMessage(e, "Try again later.");
      setLoadError(detail);
      toast({
        title: "Could not load notifications",
        description: detail,
        variant: "destructive",
      });
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [refreshUnread]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!inboxRefreshTick) return;
    void load();
  }, [inboxRefreshTick, load]);

  useEffect(() => {
    if (!incoming?.id) return;
    setNotifications((prev) => {
      if (prev.some((n) => String(n.id) === String(incoming.id))) return prev;
      return [incoming, ...prev];
    });
    clearIncoming();
  }, [incoming, clearIncoming]);

  const markRead = async (id) => {
    try {
      await notificationAPI.markRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          String(n.id) === String(id) ? { ...n, read: true, readStatus: true } : n
        )
      );
      await refreshUnread();
    } catch (e) {
      toast({
        title: "Update failed",
        description: getApiErrorMessage(e, "Could not mark as read."),
        variant: "destructive",
      });
    }
  };

  const typeIcon = (kind) => {
    const icons = {
      order: "📦",
      payment: "💳",
      account: "👤",
      system: "🔔",
      promotion: "💰",
      review: "⭐",
      return: "↩️",
      broadcast: "📣",
    };
    return icons[kind] || "🔔";
  };

  /** Deep link for inbox rows (orders, payments, account, returns, reviews). */
  const notificationAction = (n) => {
    const kind = String(n.kind || n.type || "").toLowerCase();
    const oid = n.entityId;
    const id = oid != null && String(oid).trim() !== "" ? String(oid).trim() : "";
    if (!id) return null;
    if (kind === "order" || kind === "payment") {
      return { path: `/account/orders/${encodeURIComponent(id)}`, label: "View order" };
    }
    if (kind === "account") {
      return { path: "/account/settings", label: "Account settings" };
    }
    if (kind === "return" || kind === "rma") {
      return { path: `/account/returns/${encodeURIComponent(id)}`, label: "View return" };
    }
    if (kind === "review") {
      return { path: `/product/${encodeURIComponent(id)}/reviews`, label: "View reviews" };
    }
    return null;
  };

  const notificationRead = (n) => Boolean(n.readStatus ?? n.read);
  const unreadLocal = notifications.filter((n) => !notificationRead(n)).length;

  if (loading) {
    return (
      <AccountLayout>
        <div
          className={`flex items-center justify-center py-16 ${isDark ? "text-gray-400" : "text-gray-500"}`}
        >
          Loading…
        </div>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout>
      <div className="pb-2">
        <div className="max-w-3xl mx-auto px-0 sm:px-1">
          <div className="flex items-center justify-between mb-6">
            <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Notifications</h1>
            <span className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              {unreadLocal} unread
            </span>
          </div>

          {loadError ? (
            <div
              className={`text-center py-14 px-4 rounded-xl border ${
                isDark ? "border-red-900/50 bg-red-950/30 text-red-200" : "border-red-200 bg-red-50 text-red-900"
              }`}
              role="alert"
            >
              <p className="font-medium mb-1">We couldn’t load your notifications</p>
              <p className={`text-sm mb-4 ${isDark ? "text-red-300/90" : "text-red-800/90"}`}>{loadError}</p>
              <button
                type="button"
                onClick={() => load()}
                className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition ${
                  isDark
                    ? "bg-red-900/60 text-white hover:bg-red-900"
                    : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                Retry
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div
              className={`text-center py-16 rounded-xl border ${isDark ? "border-gray-700 text-gray-400 bg-gray-800/40" : "border-gray-100 text-gray-500 bg-white/60"}`}
            >
              <p className="text-4xl mb-2" aria-hidden>
                🔔
              </p>
              <p>No notifications yet</p>
            </div>
          ) : (
          <div className="space-y-3">
            {notifications.map((n) => {
              const action = notificationAction(n);
              const kind = n.kind || n.type || "system";
              const read = notificationRead(n);
              return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => !read && markRead(n.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!read) markRead(n.id);
                    }
                  }}
                  className={`rounded-xl shadow-sm p-4 transition hover:shadow-md border ${
                    isDark
                      ? "bg-gray-800/90 border-gray-700 hover:border-gray-600"
                      : "bg-white border-gray-100 hover:border-gray-200"
                  } ${!read ? "border-l-4 border-l-[#5BA3D0]" : ""} ${!read ? "cursor-pointer" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0" aria-hidden>
                      {typeIcon(kind)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          className={`font-medium ${!read ? (isDark ? "text-white" : "text-gray-900") : isDark ? "text-gray-300" : "text-gray-600"}`}
                        >
                          {n.title || "Notification"}
                        </h3>
                        <span className={`text-xs shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                          {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
                        </span>
                      </div>
                      <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        {n.message || ""}
                      </p>
                      {n.image ? (
                        <img
                          src={n.image}
                          alt=""
                          className="mt-2 max-h-40 w-full max-w-md rounded-lg object-cover border border-black/5 dark:border-white/10"
                          loading="lazy"
                        />
                      ) : null}
                      {action ? (
                        <Link
                          to={action.path}
                          onClick={(e) => e.stopPropagation()}
                          className={`inline-block mt-2 text-sm font-medium underline-offset-2 hover:underline ${
                            isDark ? "text-[#7BB8DC]" : "text-[#5BA3D0]"
                          }`}
                        >
                          {action.label}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      </div>
    </AccountLayout>
  );
}
