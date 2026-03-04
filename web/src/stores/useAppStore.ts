import { create } from 'zustand';
import type { Clip, ServerLimits } from '@/types';

interface AppState {
  connected: boolean;
  reconnecting: boolean;
  sleeping: boolean;
  limits: ServerLimits | null;
  clips: Clip[];
  clipsReady: boolean;
  pendingClips: Clip[];
  ttl: string;

  setConnected: (v: boolean) => void;
  setLimits: (limits: ServerLimits) => void;
  setClips: (clips: Clip[]) => void;
  prependClip: (clip: Clip) => void;
  removeClip: (id: string) => void;
  setTTL: (ttl: string) => void;
  bufferClip: (clip: Clip) => void;
  flushPending: (list: Clip[]) => void;
  resetClips: () => void;
}

const useAppStore = create<AppState>((set) => ({
  connected: false,
  reconnecting: false,
  sleeping: false,
  limits: null,
  clips: [],
  clipsReady: false,
  pendingClips: [],
  ttl: '1h',

  setConnected: (connected) => set({ connected }),
  setLimits: (limits) => set({ limits }),
  setClips: (clips) => set({ clips }),
  prependClip: (clip) => set((s) => ({ clips: [clip, ...s.clips] })),
  removeClip: (id) => set((s) => ({ clips: s.clips.filter((c) => c.id !== id) })),
  setTTL: (ttl) => set({ ttl }),
  bufferClip: (clip) => set((s) => ({ pendingClips: [...s.pendingClips, clip] })),
  flushPending: (list) =>
    set((s) => {
      const ids = new Set(list.map((c) => c.id));
      const extra = s.pendingClips.filter((c) => !ids.has(c.id));
      return { clips: [...extra, ...list], clipsReady: true, pendingClips: [] };
    }),
  resetClips: () => set({ clips: [], clipsReady: false, pendingClips: [] }),
}));

export default useAppStore;
