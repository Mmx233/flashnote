import { AnimatePresence, motion } from 'motion/react';
import { SnippetsOutlined, PictureOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { Clip, ImageClip } from '@/types';
import TextClipCard from './TextClipCard';
import ImageClipCard from './ImageClipCard';

function EmptyState() {
  const isMac = /mac/i.test(navigator.userAgent);
  const keys = isMac ? ['⌘', 'V'] : ['Ctrl', 'V'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mt-24 flex flex-col items-center text-center select-none"
    >
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center">
          <SnippetsOutlined className="text-3xl text-blue-500 dark:text-blue-400" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-green-500/10 dark:bg-green-400/10 flex items-center justify-center">
          <PictureOutlined className="text-sm text-green-500 dark:text-green-400" />
        </div>
      </div>

      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-2">
        No clips yet
      </h3>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-10 max-w-xs">
        Paste text or images from your clipboard, and they'll show up here across all your devices.
      </p>

      <div className="flex gap-8 text-xs text-gray-400 dark:text-gray-500">
        <div className="flex flex-col items-center gap-2">
          <div className="h-10 px-3 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <span className="text-xs font-mono font-medium text-gray-500 dark:text-gray-400 flex items-center gap-0.5">{keys[0]}<span className="text-[12px]">+</span>{keys[1]}</span>
          </div>
          <span>Paste</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <PictureOutlined className="text-base text-gray-500 dark:text-gray-400" />
          </div>
          <span>Upload</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <ClockCircleOutlined className="text-base text-gray-500 dark:text-gray-400" />
          </div>
          <span>Auto-expire</span>
        </div>
      </div>
    </motion.div>
  );
}

interface ClipListProps {
  clips: Clip[];
  onDelete: (id: string) => void;
  onCopy: (clip: Clip) => void;
  onDownload: (clip: ImageClip) => void;
  onShare: (clip: ImageClip) => void;
  disabled: boolean;
}

export default function ClipList({
  clips,
  onDelete,
  onCopy,
  onDownload,
  onShare,
  disabled,
}: ClipListProps) {
  if (!clips.length) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <AnimatePresence>
        {clips.map((clip, i) => (
          <motion.div
            key={clip.id}
            layout
            initial={{ opacity: 0.75, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              layout: { duration: 0.15 },
              duration: 0.2,
              delay: i * 0.03,
            }}
          >
            {clip.type === 'text' ? (
              <TextClipCard
                clip={clip}
                onCopy={() => onCopy(clip)}
                onDelete={() => onDelete(clip.id)}
                disabled={disabled}
              />
            ) : (
              <ImageClipCard
                clip={clip}
                onCopy={() => onCopy(clip)}
                onDownload={() => onDownload(clip)}
                onShare={() => onShare(clip)}
                onDelete={() => onDelete(clip.id)}
                disabled={disabled}
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
