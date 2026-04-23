import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getToken } from "../lib/auth";
import { buildStompWsUrl, createStompSockJsClient, DEFAULT_WS_BASE } from "../lib/stompClient";

const LS_SOUND = "oceanbazar_admin_sound_enabled";

function getApiBase() {
  return (
    localStorage.getItem("oceanbazar_admin_ws") ||
    import.meta.env.VITE_WS_URL ||
    DEFAULT_WS_BASE
  );
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

export default function useAdminRealtimeSocket(enabled = true, chatInboundRef = null, returnsInboundRef = null) {
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
    notifications: 0
  });
  const [lastEventType, setLastEventType] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem(LS_SOUND) !== "0");
  const deactivateRef = useRef(null);
  const soundEnabledRef = useRef(soundEnabled);

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

  useEffect(() => {
    if (!enabled) return undefined;

    const token = getToken();
    if (!token) return undefined;

    const wsUrl = buildStompWsUrl(getApiBase());

    const bump = (key) => {
      setLastEventAt(new Date());
      setLastEventType(key);
      setEventTicks((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
      if (soundEnabledRef.current) playAlertSound();
    };

    const { client, deactivate } = createStompSockJsClient({
      wsUrl,
      token,
      onConnect: (c) => {
        setConnected(true);
        c.subscribe("/topic/admin/orders", () => bump("orders"));
        c.subscribe("/topic/admin/chats", () => {
          bump("chats");
          try {
            inboundRefs.current.chat?.current?.();
          } catch {
            /* ignore */
          }
        });
        c.subscribe("/topic/admin/users", () => bump("users"));
        c.subscribe("/topic/admin/payments", () => bump("payments"));
        c.subscribe("/topic/admin/returns", () => {
          bump("returns");
          try {
            inboundRefs.current.returns?.current?.();
          } catch {
            /* ignore */
          }
        });
        c.subscribe("/topic/admin/notifications", () => bump("notifications"));
        c.subscribe("/topic/admin/alerts", () => bump("notifications"));
      },
      onConnectionLost: () => setConnected(false)
    });

    deactivateRef.current = deactivate;
    client.activate();

    return () => {
      setConnected(false);
      deactivateRef.current = null;
      deactivate();
    };
  }, [enabled]);

  return useMemo(
    () => ({
      connected,
      lastEventAt,
      eventTicks,
      lastEventType,
      soundEnabled,
      toggleSound
    }),
    [connected, lastEventAt, eventTicks, lastEventType, soundEnabled, toggleSound]
  );
}
