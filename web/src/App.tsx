import { useState, useEffect, useCallback } from 'react';
import { ConfigProvider, theme, message, Skeleton } from 'antd';

import useAppStore from '@/stores/useAppStore';
import useDarkMode from '@/hooks/useDarkMode';
import useEventListener from '@/hooks/useEventListener';
import useWs from '@/hooks/useWs';
import api from '@/api';

import ActionBar from '@/components/ActionBar';
import ClipList from '@/components/ClipList';
import type { Clip, ImageClip, ClipListResponse } from '@/types';

function App() {
  const isDark = useDarkMode();

  const connected = useAppStore((s) => s.connected);
  const reconnecting = useAppStore((s) => s.reconnecting);
  const limits = useAppStore((s) => s.limits);
  const clips = useAppStore((s) => s.clips);
  const ttl = useAppStore((s) => s.ttl);
  const setTTL = useAppStore((s) => s.setTTL);
  const setClips = useAppStore((s) => s.setClips);

  const [loading, setLoading] = useState(false);

  const uploadImage = useCallback(
    async (file: Blob) => {
      const form = new FormData();
      form.append('type', 'image');
      form.append('file', file);
      form.append('ttl', ttl);
      setLoading(true);
      try {
        await api.post('/clips', form);
        message.success('Image uploaded');
      } catch {
        message.error('Upload failed');
      } finally {
        setLoading(false);
      }
    },
    [ttl],
  );

  const fetchClips = useCallback(async () => {
    try {
      const res = await api.get<{ code: number; data: ClipListResponse }>('/clips');
      setClips(res.data.data.clips || []);
    } catch {
      // silent
    }
  }, [setClips]);

  useWs(fetchClips);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  useEventListener('paste', async (e) => {
    if (loading || !connected) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (!blob) continue;
        await uploadImage(blob);
        return;
      }
    }

    const text = e.clipboardData?.getData('text/plain');
    if (text) {
      setLoading(true);
      try {
        await api.post('/clips', { type: 'text', content: text, ttl });
        message.success('Text saved');
      } catch {
        message.error('Save failed');
      } finally {
        setLoading(false);
      }
    }
  });

  const handlePasteText = useCallback(async () => {
    if (loading || !connected) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      setLoading(true);
      await api.post('/clips', { type: 'text', content: text, ttl });
      message.success('Text saved');
    } catch {
      message.error('Paste failed');
    } finally {
      setLoading(false);
    }
  }, [ttl, loading, connected]);

  const handleSelectImage = useCallback(
    async (file: File) => {
      if (loading || !connected) return;
      await uploadImage(file);
    },
    [loading, connected, uploadImage],
  );

  const handleCopy = useCallback(async (clip: Clip) => {
    try {
      if (clip.type === 'text') {
        await navigator.clipboard.writeText(clip.content);
      } else {
        const res = await api.get(`/clips/${clip.id}/file`, { responseType: 'blob' });
        const item = new ClipboardItem({ [clip.mimeType]: res.data });
        await navigator.clipboard.write([item]);
      }
      message.success('Copied');
    } catch {
      message.error('Copy failed');
    }
  }, []);

  const handleDownload = useCallback((clip: ImageClip) => {
    const link = document.createElement('a');
    link.href = `/api/clips/${clip.id}/file?download=1`;
    link.download = clip.fileName;
    link.click();
  }, []);

  const handleShare = useCallback(async (clip: ImageClip) => {
    try {
      const res = await api.get(`/clips/${clip.id}/file`, { responseType: 'blob' });
      const file = new File([res.data], clip.fileName, { type: clip.mimeType });
      if (navigator.share) {
        await navigator.share({ files: [file] });
      } else {
        const url = `${location.origin}/api/clips/${clip.id}/file`;
        await navigator.clipboard.writeText(url);
        message.info('Link copied');
      }
    } catch {
      message.error('Share failed');
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await api.delete(`/clips/${id}`);
    } catch {
      message.error('Delete failed');
    }
  }, []);

  const disabled = !connected;

  return (
    <ConfigProvider
      theme={{ algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm }}
    >
      <div className="max-w-2xl mx-auto p-4">
        {!connected && limits && (
          <div className="mb-4 p-3 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-lg text-center text-sm">
            Connection lost. Reconnecting…
          </div>
        )}

        <div className={`mb-4 text-center text-sm pointer-events-none transition-opacity duration-500 ${reconnecting && connected ? 'opacity-100 animate-pulse text-gray-400 dark:text-gray-500' : 'opacity-0'}`}>
          Reconnecting…
        </div>

        {!limits ? (
          <>
            <Skeleton.Button active block style={{ height: 40, marginBottom: 16 }} />
            <Skeleton active paragraph={{ rows: 4 }} />
          </>
        ) : (
          <>
            <ActionBar
              ttl={ttl}
              ttlOptions={limits.ttlOptions}
              onTTLChange={setTTL}
              onPasteText={handlePasteText}
              onSelectImage={handleSelectImage}
              loading={loading}
              disabled={disabled}
            />
            <ClipList
              clips={clips}
              onDelete={handleDelete}
              onCopy={handleCopy}
              onDownload={handleDownload}
              onShare={handleShare}
              disabled={disabled}
            />
          </>
        )}
      </div>
    </ConfigProvider>
  );
}

export default App;
