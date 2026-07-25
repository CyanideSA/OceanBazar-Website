import { io, type Socket } from 'socket.io-client';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BASE_URL, {
      withCredentials: true,
      autoConnect: false,
      // Polling first: old iOS Safari / flaky mobile networks often stall on WS upgrade.
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
    });

    socket.on('disconnect', (reason) => {
      console.error('Socket disconnected:', reason);
    });
  }
  return socket;
}

type SocketAuth = { token?: string; visitorId?: string };

/** Connect (or reconnect) with auth. Always refresh auth so guest visitorId is not dropped. */
export function connectSocket(auth?: SocketAuth): Socket {
  const s = getSocket();
  if (auth) {
    const prev = JSON.stringify(s.auth || {});
    const merged: SocketAuth = {
      ...((typeof s.auth === 'object' && s.auth ? s.auth : {}) as SocketAuth),
      ...auth,
    };
    s.auth = merged;
    const next = JSON.stringify(merged);
    if (s.connected && prev !== next) {
      s.disconnect();
      s.connect();
      return s;
    }
  }
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}
