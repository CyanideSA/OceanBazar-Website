/* Legacy raw WebSocket helper. Prefer CustomerInboxContext + STOMP/SockJS /ws on the storefront. */
import { useEffect, useRef, useCallback, useState } from "react";
import { BACKEND_URL } from "@/api/service";

const WS_URL = BACKEND_URL.replace(/^http/, "ws") + "/ws";
const BASE_DELAY_MS = 5000;
const MAX_DELAY_MS = 60_000;
const MAX_ATTEMPTS = 20;

export default function useRealtime(enabled = true) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const attemptRef = useRef(0);
  const stoppedRef = useRef(false);
  const listeners = useRef(new Map());

  const clearReconnect = () => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  };

  const connect = useCallback(() => {
    if (!enabled || stoppedRef.current) return;
    if (attemptRef.current >= MAX_ATTEMPTS) return;
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        attemptRef.current = 0;
        clearReconnect();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent(data);
          const type = data?.type || data?.eventType;
          if (type && listeners.current.has(type)) {
            listeners.current.get(type).forEach((fn) => fn(data));
          }
          if (listeners.current.has("*")) {
            listeners.current.get("*").forEach((fn) => fn(data));
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!enabled || stoppedRef.current) return;
        attemptRef.current += 1;
        if (attemptRef.current >= MAX_ATTEMPTS) return;
        const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.min(attemptRef.current - 1, 8));
        clearReconnect();
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    } catch {
      setConnected(false);
      wsRef.current = null;
      if (!enabled || stoppedRef.current) return;
      attemptRef.current += 1;
      if (attemptRef.current >= MAX_ATTEMPTS) return;
      const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.min(attemptRef.current - 1, 8));
      clearReconnect();
      reconnectTimer.current = setTimeout(connect, delay);
    }
  }, [enabled]);

  useEffect(() => {
    stoppedRef.current = false;
    attemptRef.current = 0;
    if (enabled) connect();
    return () => {
      stoppedRef.current = true;
      clearReconnect();
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      }
    };
  }, [connect, enabled]);

  const subscribe = useCallback((eventType, callback) => {
    if (!listeners.current.has(eventType)) {
      listeners.current.set(eventType, new Set());
    }
    listeners.current.get(eventType).add(callback);
    return () => {
      listeners.current.get(eventType)?.delete(callback);
    };
  }, []);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { connected, lastEvent, subscribe, send };
}
