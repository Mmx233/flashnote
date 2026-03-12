import { useState, useCallback, useMemo } from 'react';
import { ConfigProvider, theme, App as AntApp, Skeleton } from 'antd';
import { PictureOutlined } from '@ant-design/icons';

import useAppStore from '@/stores/useAppStore';
import useDarkMode from '@/hooks/useDarkMode';
import useEventListener from '@/hooks/useEventListener';
import useWs from '@/hooks/useWs';
import api from '@/api';

import ActionBar from '@/components/ActionBar';
import ClipList from '@/components/ClipList';
import type { Clip, ImageClip } from '@/types';

async function hashBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashText(text: string): Promise<string> {
  return hashBlob(new Blob([text]));
}

function checkDuplicate(hash: string, size?: number): boolean {
  return useAppStore.getState().clips.some(
    (c) => c.hash === hash && (size === undefined || ('fileSize' in c && c.fileSize === size)),
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
  const sleeping = useAppStore((s) => s.sleeping);
  const limits = useAppStore((s) => s.limits);
  const clips = useAppStore((s) => s.clips);
  const clipsReady = useAppStore((s) => s.clipsReady);
  const ttl = useAppStore((s) => s.ttl);
  const setTTL = useAppStore((s) => s.setTTL);

  const statusVisible = sleeping || reconnecting;
  const [statusText, setStatusText] = useState('\u00A0');

  // Update text only when becoming visible, so fade-out keeps the old text
  if (statusVisible) {
    const next = sleeping ? '😴 Paused — will reconnect on focus' : '🔄 Reconnecting…';
    if (next !== statusText) setStatusText(next);
  }

  const [loading, setLoading] = useState(false);

  const uploadImage = useCallback(
    async (file: Blob) => {
      const hash = await hashBlob(file);
      if (checkDuplicate(hash, file.size) && !(await confirmDuplicate())) return;
      const form = new FormData();
      form.append('type', 'image');
      form.append('file', file);
      form.append('ttl', ttl);
      form.append('hash', hash);
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
    [ttl, message, confirmDuplicate],
  );

  const uploadText = useCallback(
    async (text: string) => {
      const hash = await hashText(text);
      if (checkDuplicate(hash) && !(await confirmDuplicate())) return;
      setLoading(true);
      try {
        await api.post('/clips', { type: 'text', content: text, ttl, hash });
        message.success('Text saved');
      } catch {
        message.error('Save failed');
      } finally {
        setLoading(false);
      }
    },
    [ttl, message, confirmDuplicate],
  );

  const [dragging, setDragging] = useState(false);
  const dragCounter = useMemo(() => ({ current: 0 }), []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setDragging(true);
  }, [dragCounter]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, [dragCounter]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    if (loading || !connected) return;
    const files = e.dataTransfer.files;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        await uploadImage(file);
        return;
      }
    }
    message.info('Only image files are supported');
  }, [loading, connected, uploadImage, message, dragCounter]);

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
    await uploadText(text);
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
      await uploadText(text);
    } catch {
      message.error('Paste failed');
    }
  }, [loading, connected, message, uploadImage, uploadText]);

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
    <div
      className="min-h-screen relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-150 ${dragging ? 'bg-black/50 backdrop-blur-sm opacity-100' : 'opacity-0'}`}>
        <div className={`absolute inset-3 rounded-xl border-2 border-dashed transition-colors duration-150 ${dragging ? 'border-blue-400/70' : 'border-transparent'}`} />
        <div className={`flex flex-col items-center gap-2 transition-opacity duration-150 ${dragging ? 'opacity-100' : 'opacity-0'}`}>
          <PictureOutlined className="text-5xl" style={{ color: 'rgba(96,165,250,0.8)' }} />
          <p className="text-base text-white/60">Drop image to upload</p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-[min(5%,2rem)] py-4">
      <div className={`mb-4 text-center text-sm pointer-events-none transition-opacity duration-500 ${statusVisible ? 'opacity-100 text-gray-400 dark:text-gray-500' : 'opacity-0'} ${statusVisible && !sleeping ? 'animate-pulse' : ''}`}>
        {statusText}
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
