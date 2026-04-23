import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

/** Default matches Spring Boot (Java API on port 8000) */
const DEFAULT_WS_BASE = "http://127.0.0.1:8000";

/**
 * @param {string} apiBase e.g. https://localhost:8000 (no trailing slash)
 * @returns {string}
 */
export function buildStompWsUrl(apiBase) {
  const base = (apiBase || DEFAULT_WS_BASE).replace(/\/$/, "");
  return `${base}/ws`;
}

/**
 * SockJS + STOMP client with JWT on CONNECT, exponential backoff, capped auto-reconnect.
 *
 * @param {{
 *   wsUrl: string,
 *   token: string,
 *   onConnect: (client: import("@stomp/stompjs").Client) => void,
 *   onConnectionLost?: () => void,
 *   onBeforeDeactivate?: () => void,
 * }} opts
 */
export function createStompSockJsClient({ wsUrl, token, onConnect, onConnectionLost, onBeforeDeactivate }) {
  const tearDownRef = { current: false };
  let failCount = 0;
  const maxFailuresBeforeStop = 8;
  let issueTimer = null;

  const clearIssueTimer = () => {
    if (issueTimer) {
      clearTimeout(issueTimer);
      issueTimer = null;
    }
  };

  const client = new Client({
    debug: () => {},
    webSocketFactory: () => new SockJS(wsUrl),
    connectHeaders: {
      Authorization: `Bearer ${token}`,
    },
    reconnectDelay: 1000,  // Start with 1 second delay for exponential backoff
    maxReconnectAttempts: 10,
    heartbeatIncoming: 15000,
    heartbeatOutgoing: 15000,
    connectionTimeout: 20000,
  });

  client.onConnect = () => {
    failCount = 0;
    onConnect(client);
    console.log('STOMP connected');
  };

  client.onStompError = (frame) => {
    console.error('STOMP error:', frame);
    scheduleIssue();
  };

  client.onWebSocketClose = (event) => {
    console.error('WebSocket closed:', event.code, event.reason);
    scheduleIssue();
    onConnectionLost?.();
  };

  client.onWebSocketError = (event) => {
    console.error('WebSocket error:', event);
    scheduleIssue();
  };

  const scheduleIssue = () => {
    clearIssueTimer();
    issueTimer = setTimeout(() => {
      failCount++;
      if (failCount >= maxFailuresBeforeStop) {
        client.deactivate();
      } else {
        onConnectionLost?.();
      }
    }, 1000 * Math.min(Math.pow(2, failCount), 30));
  };

  const bumpFailure = () => {
    if (tearDownRef.current) return;
    failCount += 1;
    if (failCount >= maxFailuresBeforeStop) {
      client.reconnectDelay = 0;
      try {
        client.deactivate();
      } catch {
        /* ignore */
      }
    }
  };

  const notifyLost = () => {
    if (tearDownRef.current) return;
    onConnectionLost?.();
  };

  return {
    client,
    tearDownRef,
    deactivate: () => {
      tearDownRef.current = true;
      clearIssueTimer();
      onBeforeDeactivate?.();
      try {
        client.deactivate();
      } catch {
        /* ignore */
      }
    },
  };
}

export { DEFAULT_WS_BASE };
