'use client';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Single shared Socket.IO connection. The session cookie authenticates it. */
export function getSocket(): Socket {
  if (!socket) {
    const configured = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (configured === 'same-origin') {
      // Behind the web app's own proxy (single-container deploys): start on long-polling, which any
      // HTTP proxy carries, and upgrade to a WebSocket where the proxy allows it.
      socket = io({ withCredentials: true, transports: ['polling', 'websocket'] });
    } else {
      const url = configured ?? `${window.location.protocol}//${window.location.hostname}:4000`;
      socket = io(url, { withCredentials: true, transports: ['websocket', 'polling'] });
    }
  }
  return socket;
}

export function closeSocket() {
  socket?.close();
  socket = null;
}
