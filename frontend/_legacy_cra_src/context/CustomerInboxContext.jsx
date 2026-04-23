import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { notificationAPI } from "@/api/service";
import { useCustomerNotificationSocket } from "@/hooks/useCustomerNotificationSocket";

const CustomerInboxContext = createContext(null);

function normalizeIncoming(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.id != null ? String(raw.id) : "";
  const createdAt =
    raw.createdAt != null
      ? typeof raw.createdAt === "number"
        ? new Date(raw.createdAt).toISOString()
        : raw.createdAt
      : new Date().toISOString();
  const read = Boolean(raw.readStatus ?? raw.read);
  return {
    id,
    title: raw.title || "Notification",
    message: raw.message || "",
    kind: raw.kind || raw.type || "system",
    entityId: raw.entityId != null ? String(raw.entityId) : "",
    read,
    readStatus: read,
    image: typeof raw.image === "string" && raw.image.trim() ? raw.image.trim() : "",
    createdAt,
  };
}

export function CustomerInboxProvider({ children, isLoggedIn }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [incoming, setIncoming] = useState(null);
  const [orderStreamTick, setOrderStreamTick] = useState(0);
  const [returnStreamTick, setReturnStreamTick] = useState(0);
  const [catalogLive, setCatalogLive] = useState({ seq: 0, productId: null, change: null });
  /** Bumped on STOMP {@code inbox_refresh} so pages can refetch the full list. */
  const [inboxRefreshTick, setInboxRefreshTick] = useState(0);
  const seenIdsRef = useRef(new Set());

  const refreshUnread = useCallback(async () => {
    if (!isLoggedIn) {
      setUnreadCount(0);
      return;
    }
    try {
      const r = await notificationAPI.unreadCount();
      const c = r.data?.count;
      setUnreadCount(typeof c === "number" ? c : Number(c) || 0);
    } catch {
      /* keep previous count */
    }
  }, [isLoggedIn]);

  const pushNotification = useCallback(
    (raw) => {
      try {
        const payload = normalizeIncoming(raw);
        if (payload?.id) {
          if (seenIdsRef.current.has(payload.id)) return;
          seenIdsRef.current.add(payload.id);
        }
        setIncoming(payload);
        refreshUnread();
      } catch {
        refreshUnread();
      }
    },
    [refreshUnread]
  );

  const handleStompMessage = useCallback(
    (raw) => {
      if (raw && typeof raw === "object") {
        if (raw._event === "order_update") {
          setOrderStreamTick((t) => t + 1);
          return;
        }
        if (raw._event === "return_update") {
          setReturnStreamTick((t) => t + 1);
          void refreshUnread();
          return;
        }
        if (raw._event === "inbox_refresh") {
          setInboxRefreshTick((t) => t + 1);
          void refreshUnread();
          return;
        }
      }
      pushNotification(raw);
    },
    [pushNotification, refreshUnread]
  );

  const onCatalogLive = useCallback((raw) => {
    if (!raw || typeof raw !== "object" || raw._event !== "catalog_product") return;
    const pid = raw.productId != null ? String(raw.productId) : "";
    if (!pid) return;
    setCatalogLive((prev) => ({
      seq: prev.seq + 1,
      productId: pid,
      change: raw.change || "updated",
    }));
  }, []);

  useCustomerNotificationSocket(isLoggedIn, handleStompMessage, onCatalogLive);

  useEffect(() => {
    if (!isLoggedIn) {
      seenIdsRef.current = new Set();
      setUnreadCount(0);
      setIncoming(null);
      setOrderStreamTick(0);
      setReturnStreamTick(0);
      setCatalogLive({ seq: 0, productId: null, change: null });
      setInboxRefreshTick(0);
      return;
    }
    refreshUnread();
  }, [isLoggedIn, refreshUnread]);

  const clearIncoming = useCallback(() => setIncoming(null), []);

  return (
    <CustomerInboxContext.Provider
      value={{
        unreadCount,
        refreshUnread,
        incoming,
        clearIncoming,
        orderStreamTick,
        returnStreamTick,
        catalogLive,
        inboxRefreshTick,
      }}
    >
      {children}
    </CustomerInboxContext.Provider>
  );
}

export function useCustomerInbox() {
  const ctx = useContext(CustomerInboxContext);
  if (!ctx) throw new Error("useCustomerInbox must be used within CustomerInboxProvider");
  return ctx;
}
