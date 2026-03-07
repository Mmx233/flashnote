import { useCallback, useEffect, useRef, useState } from 'react';

import useAppStore from '@/stores/useAppStore';

import useInterval from '@/hooks/useInterval';
import useTimeout from '@/hooks/useTimeout';
import useEventListener from '@/hooks/useEventListener';
import type { Clip, ServerLimits, WSMessage } from '@/types';

// Heartbeat message sent to server to keep connection alive
const PING = JSON.stringify({ type: 'ping' });

/**
 * WebSocket hook with:
 * - Heartbeat interval driven by server config (via useInterval)
 * - Reconnect after 3s on unexpected close (via useTimeout)
 * - Blur disconnect after server-configured timeout (via useTimeout)
 * - Focus/blur lifecycle via window focus/blur events
 */
export default function useWs() {
  const connected = useAppStore((s) => s.connected);
  const heartbeatInterval = useAppStore((s) => s.limits?.heartbeatInterval ?? 30);
  const blurDisconnectTimeout = useAppStore((s) => s.limits?.blurDisconnectTimeout ?? 300);

  const wsRef = useRef<WebSocket | null>(null);

  const [reconnectDelay, setReconnectDelay] = useState<number | null>(null);
  const [blurDelay, setBlurDelay] = useState<number | null>(null);

  const connect = useCallback(() => {
    setReconnectDelay(null);

    // Close any existing connection before opening a new one
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      useAppStore.getState().resetClips();
      useAppStore.setState({ connected: true, reconnecting: false, sleeping: false });
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        const state = useAppStore.getState();
        switch (msg.type) {
          case 'config': {
            const cfg = msg.data as ServerLimits;
            const saved = localStorage.getItem('ttl');
            let ttl: string;
            if (saved && cfg.ttlOptions.includes(saved)) {
              ttl = saved;
            } else {
              ttl = cfg.defaultTTL;
              localStorage.removeItem('ttl');
            }
            useAppStore.setState({ limits: cfg, ttl });
            ws.send(PING);
            break;
          }
          case 'clip:created': {
            const clip = msg.data as Clip;
            if (state.clipsReady) {
              if (!state.clips.some((c) => c.id === clip.id)) {
                state.prependClip(clip);
              }
            } else {
              state.bufferClip(clip);
            }
            break;
          }
          case 'clip:list':
            state.flushPending(msg.data as Clip[]);
            break;
          case 'clip:expired':
            state.removeClip((msg.data as { id: string }).id);
            break;
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      useAppStore.setState({ connected: false });
      if (document.hasFocus()) {
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
  }, reconnectDelay);

  // --- blur disconnect timer ---
  useTimeout(() => {
    setBlurDelay(null);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    useAppStore.setState({ sleeping: true });
  }, blurDelay);

  const handleFocus = useCallback(() => {
    setBlurDelay(null);
    setReconnectDelay(null);
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      useAppStore.setState({ reconnecting: true });
      connect();
    }
  }, [connect]);

  const handleBlur = useCallback(() => {
    setReconnectDelay(null);
    setBlurDelay(blurDisconnectTimeout * 1000);
  }, [blurDisconnectTimeout]);

  useEventListener('focus', handleFocus, 'window');
  useEventListener('blur', handleBlur, 'window');

  // --- initial connect ---
  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);
}
