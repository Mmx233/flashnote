import { useSyncExternalStore } from 'react';

const mq = window.matchMedia('(prefers-color-scheme: dark)');

function subscribe(cb: () => void) {
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function getSnapshot() {
  const dark = mq.matches;
  document.documentElement.classList.toggle('dark', dark);
  return dark;
}

export default function useDarkMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
