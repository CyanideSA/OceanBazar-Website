import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getToken } from "../lib/auth";
import { resolveAdminApiBase } from "../lib/api";

const LS_SOUND = "oceanbazar_admin_sound_enabled";

function getBffUrl() {
  return resolveAdminApiBase();
}

function playAlertSound() {
  if (typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
  osc.onended = () => ctx.close();
}

/**
 * Sole admin realtime transport — BFF Socket.IO (STOMP removed).
 */
export default function useAdminBffSocket(
  enabled = true,
  { onOrderEvent, onChatMessage, onReturnEvent, onUserEvent, onPaymentEvent, onNotification } = {},
  chatInboundRef = null,
  returnsInboundRef = null
) {
  const inboundRefs = useRef({ chat: chatInboundRef, returns: returnsInboundRef });
  useEffect(() => {
    inboundRefs.current = { chat: chatInboundRef, returns: returnsInboundRef };
  }, [chatInboundRef, returnsInboundRef]);

  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState(null);
  const [eventTicks, setEventTicks] = useState({
    orders: 0,
    chats: 0,
    users: 0,
    payments: 0,
    returns: 0,
    notifications: 0,
  });
  const [lastEventType, setLastEventType] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem(LS_SOUND) !== "0");
  const soundEnabledRef = useRef(soundEnabled);
  const socketRef = useRef(null);

  const callbacksRef = useRef({
    onOrderEvent,
    onChatMessage,
    onReturnEvent,
    onUserEvent,
    onPaymentEvent,
    onNotification,
  });
  useEffect(() => {
    callbacksRef.current = {
      onOrderEvent,
      onChatMessage,
      onReturnEvent,
      onUserEvent,
      onPaymentEvent,
      onNotification,
    };
  });

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(LS_SOUND, next ? "1" : "0");
      return next;
    });
  }, []);

  const bump = useCallback((key) => {
    setLastEventAt(new Date());
    setLastEventType(key);
    setEventTicks((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
    if (soundEnabledRef.current) playAlertSound();
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const token = getToken();
    if (!token) {
      setConnected(false);
      return undefined;
    }

    const socket = io(getBffUrl(), {
      auth: { token: token || "" },
      transports: ["websocket", "polling"],
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: 20,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join", "admin:crm");
      socket.emit("join", "admin:chat");
      socket.emit("join", "admin:orders");
      socket.emit("join", "admin:returns");
    });

    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    socket.on("admin:order:new", (d) => {
      bump("orders");
      callbacksRef.current.onOrderEvent?.(d);
    });
    socket.on("admin:order:updated", (d) => {
      bump("orders");
      callbacksRef.current.onOrderEvent?.(d);
    });
    socket.on("admin:chat:new", (d) => {
      bump("chats");
      callbacksRef.current.onChatMessage?.(d);
      try {
        inboundRefs.current.chat?.current?.();
      } catch {
        /* ignore */
      }
    });
    socket.on("chat:message", (d) => {
      bump("chats");
      callbacksRef.current.onChatMessage?.(d);
      try {
        inboundRefs.current.chat?.current?.();
      } catch {
        /* ignore */
      }
    });
    socket.on("admin:return:new", (d) => {
      bump("returns");
      callbacksRef.current.onReturnEvent?.(d);
      try {
        inboundRefs.current.returns?.current?.();
      } catch {
        /* ignore */
      }
    });
    socket.on("admin:user:new", (d) => {
      bump("users");
      callbacksRef.current.onUserEvent?.(d);
    });
    socket.on("admin:payment", (d) => {
      bump("payments");
      callbacksRef.current.onPaymentEvent?.(d);
    });
    socket.on("notification:new", (d) => {
      bump("notifications");
      callbacksRef.current.onNotification?.(d);
    });
    socket.on("admin:alert", (d) => {
      bump("notifications");
      callbacksRef.current.onNotification?.(d);
    });

    return () => {
      socket.off();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled, bump]);

  return useMemo(
    () => ({
      connected,
      disconnect,
      lastEventAt,
      eventTicks,
      lastEventType,
      soundEnabled,
      toggleSound,
    }),
    [connected, disconnect, lastEventAt, eventTicks, lastEventType, soundEnabled, toggleSound]
  );
}
