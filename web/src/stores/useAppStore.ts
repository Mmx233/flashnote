import { create } from 'zustand';
import type { Clip, ServerLimits } from '@/types';

interface AppState {
  connected: boolean;
  limits: ServerLimits | null;
  clips: Clip[];
  ttl: string;

  setConnected: (v: boolean) => void;
  setLimits: (limits: ServerLimits) => void;
  setClips: (clips: Clip[]) => void;
  prependClip: (clip: Clip) => void;
  removeClip: (id: string) => void;
  setTTL: (ttl: string) => void;
}

const useAppStore = create<AppState>((set) => ({
  connected: false,
  limits: null,
  clips: [],
  ttl: '1h',

  setConnected: (connected) => set({ connected }),
  setLimits: (limits) => set({ limits }),
  setClips: (clips) => set({ clips }),
  prependClip: (clip) => set((s) => ({ clips: [clip, ...s.clips] })),
  removeClip: (id) => set((s) => ({ clips: s.clips.filter((c) => c.id !== id) })),
  setTTL: (ttl) => set({ ttl }),
}));

export default useAppStore;
