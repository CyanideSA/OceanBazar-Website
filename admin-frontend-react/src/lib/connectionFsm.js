/**
 * Lightweight Finite State Machine for WebSocket / SSE connection lifecycle.
 *
 * States:
 *   IDLE → CONNECTING → CONNECTED
 *                    ↘ DISCONNECTED → RECONNECTING → CONNECTING (loop)
 *                                   ↘ FAILED (max retries hit)
 *
 * Usage:
 *   const fsm = createConnectionFsm({ onStateChange, maxRetries: 8 });
 *   fsm.send('CONNECT_START');
 *   fsm.send('CONNECT_OK');
 *   fsm.send('CONNECTION_LOST');
 */

export const CONN_STATE = {
  IDLE:          'IDLE',
  CONNECTING:    'CONNECTING',
  CONNECTED:     'CONNECTED',
  DISCONNECTED:  'DISCONNECTED',
  RECONNECTING:  'RECONNECTING',
  FAILED:        'FAILED',
};

export const CONN_EVENT = {
  CONNECT_START:    'CONNECT_START',
  CONNECT_OK:       'CONNECT_OK',
  CONNECT_FAIL:     'CONNECT_FAIL',
  CONNECTION_LOST:  'CONNECTION_LOST',
  RETRY:            'RETRY',
  RESET:            'RESET',
  AUTH_REJECTED:    'AUTH_REJECTED',
};

const TRANSITIONS = {
  [CONN_STATE.IDLE]: {
    [CONN_EVENT.CONNECT_START]: CONN_STATE.CONNECTING,
  },
  [CONN_STATE.CONNECTING]: {
    [CONN_EVENT.CONNECT_OK]:      CONN_STATE.CONNECTED,
    [CONN_EVENT.CONNECT_FAIL]:    CONN_STATE.DISCONNECTED,
    [CONN_EVENT.CONNECTION_LOST]: CONN_STATE.DISCONNECTED,
    [CONN_EVENT.AUTH_REJECTED]:   CONN_STATE.FAILED,
  },
  [CONN_STATE.CONNECTED]: {
    [CONN_EVENT.CONNECTION_LOST]: CONN_STATE.DISCONNECTED,
    [CONN_EVENT.RESET]:           CONN_STATE.IDLE,
  },
  [CONN_STATE.DISCONNECTED]: {
    [CONN_EVENT.RETRY]:           CONN_STATE.RECONNECTING,
    [CONN_EVENT.CONNECT_START]:   CONN_STATE.CONNECTING,
    [CONN_EVENT.CONNECT_OK]:      CONN_STATE.CONNECTED,
    [CONN_EVENT.RESET]:           CONN_STATE.IDLE,
    [CONN_EVENT.AUTH_REJECTED]:   CONN_STATE.FAILED,
  },
  [CONN_STATE.RECONNECTING]: {
    [CONN_EVENT.CONNECT_START]:   CONN_STATE.CONNECTING,
    [CONN_EVENT.CONNECT_OK]:      CONN_STATE.CONNECTED,
    [CONN_EVENT.CONNECT_FAIL]:    CONN_STATE.DISCONNECTED,
    [CONN_EVENT.CONNECTION_LOST]: CONN_STATE.DISCONNECTED,
    [CONN_EVENT.RESET]:           CONN_STATE.IDLE,
    [CONN_EVENT.AUTH_REJECTED]:   CONN_STATE.FAILED,
  },
  [CONN_STATE.FAILED]: {
    [CONN_EVENT.RESET]:           CONN_STATE.IDLE,
  },
};

/**
 * @param {{
 *   onStateChange?: (prev: string, next: string, context: object) => void,
 *   maxRetries?: number,
 *   label?: string,
 * }} opts
 */
export function createConnectionFsm({ onStateChange, maxRetries = 8, label = 'conn' } = {}) {
  let state = CONN_STATE.IDLE;
  let retries = 0;
  let connectedAt = null;
  let lastError = null;
  let totalConnections = 0;

  const context = () => ({
    state,
    retries,
    connectedAt,
    lastError,
    totalConnections,
    uptimeMs: connectedAt ? Date.now() - connectedAt : 0,
  });

  const send = (event, payload = {}) => {
    const allowed = TRANSITIONS[state];
    const next = allowed?.[event];
    if (!next) {
      return false; // illegal transition — silently ignore
    }

    const prev = state;
    state = next;

    // Bookkeeping
    if (next === CONN_STATE.CONNECTED) {
      connectedAt = Date.now();
      totalConnections += 1;
      retries = 0;
    } else if (next === CONN_STATE.RECONNECTING) {
      retries += 1;
      if (retries >= maxRetries) {
        state = CONN_STATE.FAILED;
      }
    } else if (next === CONN_STATE.IDLE) {
      connectedAt = null;
      retries = 0;
      lastError = null;
    }

    if (payload.error) lastError = payload.error;

    if (prev !== state) {
      onStateChange?.(prev, state, context());
    }

    return true;
  };

  return {
    get state() { return state; },
    get retries() { return retries; },
    get context() { return context(); },
    send,
    reset: () => send(CONN_EVENT.RESET),
  };
}
