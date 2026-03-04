import { useCallback, useEffect, useRef, useState } from 'react';

import useAppStore from '@/stores/useAppStore';

import useInterval from '@/hooks/useInterval';
import useTimeout from '@/hooks/useTimeout';

import type { Clip, ServerLimits, WSMessage } from '@/types';

// Heartbeat message sent to server to keep connection alive
const PING = JSON.stringify({ type: 'ping' });

/**
 * WebSocket hook with:
 * - Heartbeat interval driven by server config (via useInterval)
 * - Reconnect after 3s on unexpected close (via useTimeout)
 * - Blur disconnect after server-configured timeout (via useTimeout)
 * - Focus/blur lifecycle via visibilitychange
 */
export default function useWs(onReconnect: () => void) {
  const connected = useAppStore((s) => s.connected);
  const heartbeatInterval = useAppStore((s) => s.limits?.heartbeatInterval ?? 30);
  const blurDisconnectTimeout = useAppStore((s) => s.limits?.blurDisconnectTimeout ?? 300);

  const wsRef = useRef<WebSocket | null>(null);
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  // null = timer inactive, number = timer ticking
  const [reconnectDelay, setReconnectDelay] = useState<number | null>(null);
  const [blurDelay, setBlurDelay] = useState<number | null>(null);

  const connect = useCallback(() => {
    // cancel pending reconnect
    setReconnectDelay(null);

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => useAppStore.setState({ connected: true });

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        switch (msg.type) {
          case 'config': {
            const cfg = msg.data as ServerLimits;
            useAppStore.setState({ limits: cfg, ttl: cfg.defaultTTL });
            break;
          }
          case 'clip:created':
            useAppStore.getState().prependClip(msg.data as Clip);
            break;
          case 'clip:expired':
            useAppStore.getState().removeClip((msg.data as { id: string }).id);
            break;
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      useAppStore.setState({ connected: false });
      // schedule reconnect if page is visible
      if (document.visibilityState === 'visible') {
        setReconnectDelay(3000);
      }
    };
  }, []);

  // --- heartbeat ---
  useInterval(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(PING);
    }
  }, connected ? heartbeatInterval * 1000 : null);

  // --- reconnect timer ---
  useTimeout(() => {
    setReconnectDelay(null);
    connect();
    onReconnectRef.current();
  }, reconnectDelay);

  // --- blur disconnect timer ---
  useTimeout(() => {
    setBlurDelay(null);
    wsRef.current?.close();
    wsRef.current = null;
  }, blurDelay);

  // --- visibility lifecycle ---
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        setBlurDelay(null);
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connect();
          onReconnectRef.current();
        }
      } else {
        setBlurDelay(blurDisconnectTimeout * 1000);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [connect, blurDisconnectTimeout]);

  // --- initial connect ---
  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);
}
