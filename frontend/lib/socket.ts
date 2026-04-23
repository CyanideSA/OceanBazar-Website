import { io, type Socket } from 'socket.io-client';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BASE_URL, {
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5
    });

    // Add disconnection handler for error logging or callbacks if needed in components
    socket.on('disconnect', (reason) => {
      console.error('Socket disconnected:', reason);
      // Optionally, integrate with a global error handler or toast notification
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}
