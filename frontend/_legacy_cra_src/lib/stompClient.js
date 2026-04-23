import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import { BACKEND_URL } from "@/api/service";

/**
 * @param {string} [baseUrl] defaults to same origin as REST ({@link BACKEND_URL})
 * @returns {string}
 */
export function buildStompWsUrl(baseUrl) {
  const base = (baseUrl || BACKEND_URL || "https://localhost:8000").replace(/\/$/, "");
  return `${base}/ws`;
}

/**
 * @param {{
 *   token: string,
 *   wsUrl?: string,
 *   onConnect: (client: import("@stomp/stompjs").Client) => void,
 *   onConnectionLost?: () => void,
 * }} opts
 */
export function createStompSockJsClient({ token, wsUrl, onConnect, onConnectionLost }) {
  const url = wsUrl || buildStompWsUrl();
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
    webSocketFactory: () => new SockJS(url),
    connectHeaders: {
      Authorization: `Bearer ${token}`,
    },
    reconnectDelay: 8000,
    heartbeatIncoming: 15000,
    heartbeatOutgoing: 15000,
    connectionTimeout: 20000,
  });

  client.onConnect = () => {
    clearIssueTimer();
    failCount = 0;
    onConnect(client);
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

  /** One physical disconnect often fires close + error; debounce so we do not double-count or spam UI. */
  const scheduleIssue = () => {
    if (tearDownRef.current) return;
    if (issueTimer) return;
    issueTimer = setTimeout(() => {
      issueTimer = null;
      if (tearDownRef.current) return;
      notifyLost();
      bumpFailure();
    }, 350);
  };

  client.onStompError = () => scheduleIssue();
  client.onWebSocketClose = () => scheduleIssue();
  client.onWebSocketError = () => scheduleIssue();

  return {
    client,
    tearDownRef,
    deactivate: () => {
      tearDownRef.current = true;
      clearIssueTimer();
      try {
        client.deactivate();
      } catch {
        /* ignore */
      }
    },
  };
}
