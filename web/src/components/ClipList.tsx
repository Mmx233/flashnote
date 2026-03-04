import { Empty } from 'antd';
import { AnimatePresence, motion } from 'motion/react';
import type { Clip, ImageClip } from '@/types';
import TextClipCard from './TextClipCard';
import ImageClipCard from './ImageClipCard';

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
    return <Empty description="No clips yet" className="mt-12" />;
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
