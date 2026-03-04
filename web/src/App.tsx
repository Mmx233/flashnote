import { useState, useCallback } from 'react';
import { ConfigProvider, theme, App as AntApp, Skeleton } from 'antd';

import useAppStore from '@/stores/useAppStore';
import useDarkMode from '@/hooks/useDarkMode';
import useEventListener from '@/hooks/useEventListener';
import useWs from '@/hooks/useWs';
import api from '@/api';

import ActionBar from '@/components/ActionBar';
import ClipList from '@/components/ClipList';
import type { Clip, ImageClip } from '@/types';

function checkTextDuplicate(text: string): boolean {
  return useAppStore.getState().clips.some(
    (c) => c.type === 'text' && c.content === text,
  );
}

function checkImageDuplicate(file: Blob): boolean {
  if (!(file instanceof File)) return false;
  const name = file.name;
  return useAppStore.getState().clips.some(
    (c) => c.type === 'image' && c.fileSize === file.size && c.fileName === name,
  );
}

function AppContent() {
  const { message, modal } = AntApp.useApp();

  const confirmDuplicate = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      modal.confirm({
        title: 'Duplicate detected',
        content: 'A similar clip already exists. Send anyway?',
        okText: 'Send',
        cancelText: 'Cancel',
        maskClosable: true,
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, [modal]);

  const connected = useAppStore((s) => s.connected);
  const reconnecting = useAppStore((s) => s.reconnecting);
  const limits = useAppStore((s) => s.limits);
  const clips = useAppStore((s) => s.clips);
  const clipsReady = useAppStore((s) => s.clipsReady);
  const ttl = useAppStore((s) => s.ttl);
  const setTTL = useAppStore((s) => s.setTTL);

  const [loading, setLoading] = useState(false);

  const uploadImage = useCallback(
    async (file: Blob) => {
      if (checkImageDuplicate(file) && !(await confirmDuplicate())) return;
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
    [ttl, message],
  );

  useWs();

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
    if (!text) {
      message.info('Clipboard is empty');
      return;
    }
    if (checkTextDuplicate(text) && !(await confirmDuplicate())) return;
    setLoading(true);
    try {
      await api.post('/clips', { type: 'text', content: text, ttl });
      message.success('Text saved');
    } catch {
      message.error('Save failed');
    } finally {
      setLoading(false);
    }
  });

  const handlePaste = useCallback(async () => {
    if (loading || !connected) return;
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          await uploadImage(blob);
          return;
        }
      }
      const text = await navigator.clipboard.readText();
      if (!text) {
        message.info('Clipboard is empty');
        return;
      }
      if (checkTextDuplicate(text) && !(await confirmDuplicate())) return;
      setLoading(true);
      await api.post('/clips', { type: 'text', content: text, ttl });
      message.success('Text saved');
    } catch {
      message.error('Paste failed');
    } finally {
      setLoading(false);
    }
  }, [ttl, loading, connected, message, uploadImage, confirmDuplicate]);

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
  }, [message]);

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
  }, [message]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await api.delete(`/clips/${id}`);
    } catch {
      message.error('Delete failed');
    }
  }, [message]);

  const disabled = !connected;

  return (
    <div className="max-w-3xl mx-auto p-4">
      {!connected && limits && (
        <div className="mb-4 p-3 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-lg text-center text-sm">
          Connection lost. Reconnecting…
        </div>
      )}

      <div className={`mb-4 text-center text-sm pointer-events-none transition-opacity duration-500 ${reconnecting && connected ? 'opacity-100 animate-pulse text-gray-400 dark:text-gray-500' : 'opacity-0'}`}>
        Reconnecting…
      </div>

      {!limits ? (
        <Skeleton.Button active block style={{ height: 40, marginBottom: 16 }} />
      ) : (
        <ActionBar
          ttl={ttl}
          ttlOptions={limits.ttlOptions}
          onTTLChange={setTTL}
          onPasteText={handlePaste}
          onSelectImage={handleSelectImage}
          loading={loading}
          disabled={disabled}
        />
      )}

      {!clipsReady ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <ClipList
          clips={clips}
          onDelete={handleDelete}
          onCopy={handleCopy}
          onDownload={handleDownload}
          onShare={handleShare}
          disabled={disabled}
        />
      )}
    </div>
  );
}

export default function App() {
  const isDark = useDarkMode();

  return (
    <ConfigProvider
      theme={{ algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm }}
    >
      <AntApp>
        <AppContent />
      </AntApp>
    </ConfigProvider>
  );
}
