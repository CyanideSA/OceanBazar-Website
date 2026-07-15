/**
 * Admin event bridge — avoids circular imports between app.ts and route modules.
 * app.ts registers the Socket.IO server here; route modules emit through this module.
 */
import { Server as SocketIOServer } from 'socket.io';

let _io: SocketIOServer | null = null;

export function registerIo(io: SocketIOServer) {
  _io = io;
}

export function emitAdminEvent(event: string, data: unknown) {
  if (!_io) return;
  try {
    _io.to('admin:crm').emit(event, data);
    _io.to('admin:chat').emit(event, data);
  } catch {
    /* non-fatal */
  }
}

export function emitToRoom(room: string, event: string, data: unknown) {
  if (!_io) return;
  try { _io.to(room).emit(event, data); } catch { /* non-fatal */ }
}

export function emitToUser(userId: string, event: string, data: unknown) {
  emitToRoom(`user:${userId}`, event, data);
}

export function emitBroadcast(event: string, data: unknown) {
  if (!_io) return;
  try { _io.emit(event, data); } catch { /* non-fatal */ }
}
