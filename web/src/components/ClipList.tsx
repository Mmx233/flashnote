import { Empty } from 'antd';
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
      {clips.map((clip) =>
        clip.type === 'text' ? (
          <TextClipCard
            key={clip.id}
            clip={clip}
            onCopy={() => onCopy(clip)}
            onDelete={() => onDelete(clip.id)}
            disabled={disabled}
          />
        ) : (
          <ImageClipCard
            key={clip.id}
            clip={clip}
            onCopy={() => onCopy(clip)}
            onDownload={() => onDownload(clip)}
            onShare={() => onShare(clip)}
            onDelete={() => onDelete(clip.id)}
            disabled={disabled}
          />
        ),
      )}
    </div>
  );
}
