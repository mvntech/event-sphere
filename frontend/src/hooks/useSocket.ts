import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';

/** socket.io lives at the API origin, one level up from the `/api` base path. */
const SOCKET_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api').replace(/\/api\/?$/, '');

let socket: Socket | null = null;
let refCount = 0;

function acquireSocket(): Socket {
  // a remount within the teardown window keeps the existing connection.
  cancelPendingTeardown();

  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      // the token is optional — guests still receive public floor plan updates.
      auth: { token: useAuthStore.getState().accessToken ?? undefined },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
  }
  refCount += 1;
  return socket;
}

let teardownTimer: ReturnType<typeof setTimeout> | null = null;

function cancelPendingTeardown() {
  if (teardownTimer !== null) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
}

function releaseSocket() {
  refCount -= 1;
  if (refCount > 0 || !socket) return;

  refCount = 0;
  cancelPendingTeardown();

  teardownTimer = setTimeout(() => {
    teardownTimer = null;
    // someone may have re-acquired while we waited.
    if (refCount === 0 && socket) {
      socket.disconnect();
      socket = null;
    }
  }, 100);
}

/** connection state, for the "live" indicator in the UI. */
export function useSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = acquireSocket();
    socketRef.current = s;

    setConnected(s.connected);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      socketRef.current = null;
      releaseSocket();
    };
  }, []);

  return { socket: socketRef.current, connected };
}

/**
 * joins the room for one expo and subscribes to an event within it.
 * rooms are scoped per expo so a booth change never fans out globally.
 */
export function useExpoRoom<T>(expoId: string | undefined, event: string, handler: (payload: T) => void) {
  const { socket: s, connected } = useSocket();

  // kept in a ref so a new handler identity never re-joins the room.
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!s || !expoId) return;

    const join = () => s.emit('expo:join', expoId);
    join();
    // rejoin after a reconnect, or the room membership is lost silently.
    s.on('connect', join);

    const listener = (payload: T) => handlerRef.current(payload);
    s.on(event, listener);

    return () => {
      s.off('connect', join);
      s.off(event, listener);
      s.emit('expo:leave', expoId);
    };
  }, [s, expoId, event]);

  return { connected };
}
