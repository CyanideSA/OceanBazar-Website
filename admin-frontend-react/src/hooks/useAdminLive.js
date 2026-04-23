import { useEffect, useMemo, useRef, useState } from "react";
import { adminApi } from "../lib/api";
import { getToken } from "../lib/auth";

const POLL_MS = 15000;
const ES_BASE_DELAY_MS = 2000;
const ES_MAX_DELAY_MS = 60_000;

export default function useAdminLive(enabled = true) {
  const [snapshot, setSnapshot] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const esAttemptRef = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;

    let mounted = true;
    let pollTimer = null;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const closeEventSource = () => {
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {
          /* ignore */
        }
        eventSourceRef.current = null;
      }
    };

    const pollSnapshot = async () => {
      try {
        const data = await adminApi.liveSnapshot();
        if (!mounted) return;
        setSnapshot(data || null);
        setLastUpdatedAt(new Date());
      } catch {
        /* retry on next tick */
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(pollSnapshot, POLL_MS);
    };

    const stopPolling = () => {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = null;
    };

    const scheduleEventSourceReconnect = () => {
      clearReconnectTimer();
      const attempt = esAttemptRef.current;
      const delay = Math.min(ES_MAX_DELAY_MS, ES_BASE_DELAY_MS * 2 ** Math.min(attempt, 8));
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!mounted) return;
        openEventSource();
      }, delay);
      esAttemptRef.current = attempt + 1;
    };

    const openEventSource = () => {
      const token = getToken();
      if (!token) {
        startPolling();
        void pollSnapshot();
        return;
      }

      closeEventSource();
      clearReconnectTimer();

      try {
        const streamUrl = adminApi.liveStreamUrl(token);
        const es = new EventSource(streamUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (!mounted) return;
          esAttemptRef.current = 0;
          setConnected(true);
          stopPolling();
        };

        es.addEventListener("live_update", (evt) => {
          if (!mounted) return;
          try {
            const parsed = JSON.parse(evt.data);
            setSnapshot(parsed || null);
            setLastUpdatedAt(new Date());
          } catch {
            /* ignore malformed payload */
          }
        });

        /**
         * Browser EventSource auto-retries rapidly on errors, which spams the network and logs.
         * Close explicitly and reopen on our own backoff; keep HTTP polling as fallback.
         */
        es.onerror = () => {
          if (!mounted) return;
          setConnected(false);
          closeEventSource();
          startPolling();
          scheduleEventSourceReconnect();
        };
      } catch {
        if (!mounted) return;
        setConnected(false);
        startPolling();
        scheduleEventSourceReconnect();
      }
    };

    const token = getToken();
    if (!token) {
      startPolling();
      void pollSnapshot();
      return () => {
        mounted = false;
        stopPolling();
        clearReconnectTimer();
        closeEventSource();
      };
    }

    openEventSource();
    void pollSnapshot();

    return () => {
      mounted = false;
      stopPolling();
      clearReconnectTimer();
      closeEventSource();
    };
  }, [enabled]);

  const counters = useMemo(() => snapshot?.counters || {}, [snapshot]);

  return {
    snapshot,
    counters,
    connected,
    lastUpdatedAt
  };
}
