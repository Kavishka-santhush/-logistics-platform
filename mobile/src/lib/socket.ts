import { io, Socket } from 'socket.io-client';
import { config } from './config';

/**
 * Socket.io singleton used for live GPS ingest, dispatch messages and push
 * notifications. The server authenticates the handshake with the Clerk token
 * passed through `auth.token`.
 */

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(config.socketUrl, {
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(token?: string | null) {
  const s = getSocket();
  if (token) (s as any).auth = { token };
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}

/** Send a GPS fix to the server (also mirrored over REST as a fallback). */
export function emitLocation(vehicleId: string, point: { latitude: number; longitude: number; speedKmh?: number; heading?: number }) {
  getSocket().emit('vehicle:location:update', { vehicleId, ...point });
}

export function onSocket(event: string, handler: (payload: any) => void) {
  const s = getSocket();
  s.on(event, handler);
  return () => {
    s.off(event, handler);
  };
}
