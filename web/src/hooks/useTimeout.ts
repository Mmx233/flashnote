import { useEffect, useRef } from 'react';

/**
 * Declarative setTimeout hook.
 * Pass a number to start the timer, `null` to cancel/pause.
 * Fires once per non-null delay change.
 */
export default function useTimeout(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (delay === null) return;
    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}
