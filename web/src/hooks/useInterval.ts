import { useEffect, useRef } from 'react';

/**
 * Declarative setInterval hook.
 * Pass `null` as delay to pause/stop the interval.
 */
export default function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
