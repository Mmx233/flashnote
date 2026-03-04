import { useState, useEffect, useRef } from 'react';
import useAppStore from '@/stores/useAppStore';

function format(ms: number): string {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);

  if (d > 365) return `${Math.floor(d / 365)}y ${d % 365}d`;
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export default function useCountdown(expiresAt: string, createdAt: string): { text: string; progress: number; urgent: boolean } {
  const [now, setNow] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const sleeping = useAppStore((s) => s.sleeping);

  useEffect(() => {
    if (sleeping) {
      clearInterval(timerRef.current);
      return;
    }

    const refresh = () => setNow(Date.now());
    refresh();
    timerRef.current = setInterval(refresh, 1000);

    // Refresh immediately on focus (tab back)
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timerRef.current);
      window.removeEventListener('focus', refresh);
    };
  }, [sleeping]);

  const remaining = new Date(expiresAt).getTime() - now;
  const total = new Date(expiresAt).getTime() - new Date(createdAt).getTime();
  const progress = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  if (remaining <= 0) return { text: '—', progress: 0, urgent: true };
  return { text: format(remaining), progress, urgent: remaining < 60_000 };
}

