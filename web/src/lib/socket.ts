'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

/** Get (or lazily create) the shared Socket.io connection. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: false,
      withCredentials: true,
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

/**
 * Subscribe to a socket event for the lifetime of the component.
 * Pass a stable handler (useCallback) to avoid resubscribing.
 */
export function useSocketEvent<T = any>(event: string, handler: (payload: T) => void) {
  const saved = useRef(handler);
  saved.current = handler;
  useEffect(() => {
    const s = getSocket();
    const fn = (payload: T) => saved.current(payload);
    s.on(event, fn);
    return () => {
      s.off(event, fn);
    };
  }, [event]);
}

/** Reactive connection status hook. */
export function useSocketStatus() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const s = getSocket();
    setConnected(s.connected);
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    s.on('connect', on);
    s.on('disconnect', off);
    return () => {
      s.off('connect', on);
      s.off('disconnect', off);
    };
  }, []);
  return connected;
}

/** Emit a one-off event to the server. */
export function emit(event: string, payload?: any) {
  getSocket().emit(event, payload);
}
