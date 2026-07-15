import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { adminApi } from "../lib/api";
import { getAdminRealtimeToken, clearAdminRealtimeTokenCache } from "../lib/realtimeAuth";
import { createConnectionFsm, CONN_EVENT, CONN_STATE } from "../lib/connectionFsm";

const POLL_MS = 15000;
const ES_BASE_DELAY_MS = 2000;
const ES_MAX_DELAY_MS = 60_000;

export default function useAdminLive(enabled = true) {
  const [snapshot, setSnapshot] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [connMeta, setConnMeta] = useState({ state: CONN_STATE.IDLE, retries: 0, totalConnections: 0 });
  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const esAttemptRef = useRef(0);
  const fsmRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    let mounted = true;
    let pollTimer = null;

    const fsm = createConnectionFsm({
      label: 'sse-live',
      maxRetries: 8,
      onStateChange: (_prev, next, ctx) => {
        if (!mounted) return;
        setConnected(next === CONN_STATE.CONNECTED);
        setConnMeta({ state: next, retries: ctx.retries, totalConnections: ctx.totalConnections });
      },
    });
    fsmRef.current = fsm;
    fsm.send(CONN_EVENT.CONNECT_START);

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

      // Advance FSM to RECONNECTING so retries are counted
      fsm.send(CONN_EVENT.RETRY);

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!mounted) return;
        // Advance FSM to CONNECTING before the next open attempt
        fsm.send(CONN_EVENT.CONNECT_START);
        openEventSource(true);
      }, delay);
      esAttemptRef.current = attempt + 1;
    };

    const openEventSource = async (forceRefresh = false) => {
      const token = await getAdminRealtimeToken(forceRefresh);
      if (!mounted) return;
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
          fsm.send(CONN_EVENT.CONNECT_OK);
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
          clearAdminRealtimeTokenCache();
          fsm.send(CONN_EVENT.CONNECTION_LOST);
          closeEventSource();
          startPolling();
          scheduleEventSourceReconnect();
        };
      } catch {
        if (!mounted) return;
        fsm.send(CONN_EVENT.CONNECT_FAIL);
        startPolling();
        scheduleEventSourceReconnect();
      }
    };

    void openEventSource();
    void pollSnapshot();

    return () => {
      mounted = false;
      stopPolling();
      clearReconnectTimer();
      closeEventSource();
    };
  }, [enabled]);

  const counters = useMemo(() => ({
    orders:    snapshot?.totalOrders ?? 0,
    customers: snapshot?.totalUsers ?? 0,
    chats:     snapshot?.activeChats ?? 0,
    messages:  snapshot?.activeChats ?? 0,
    tickets:   snapshot?.openTickets ?? 0,
    returns:   snapshot?.pendingReturns ?? 0,
    revenue:   snapshot?.totalRevenue ?? 0,
  }), [snapshot]);

  return {
    snapshot,
    counters,
    connected,
    lastUpdatedAt,
    connMeta,
  };
}
