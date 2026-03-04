import { useEffect, useRef } from 'react';

/**
 * Declarative event listener hook.
 * Attaches to `document` by default, or `window` if specified.
 * The callback ref is always fresh so the effect never re-registers.
 */
export default function useEventListener<K extends keyof WindowEventMap>(
  type: K,
  callback: (event: WindowEventMap[K]) => void,
  target: 'window' | 'document' = 'document',
) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    const el = target === 'window' ? window : document;
    const handler = (e: Event) => savedCallback.current(e as WindowEventMap[K]);
    el.addEventListener(type, handler);
    return () => el.removeEventListener(type, handler);
  }, [type, target]);
}
