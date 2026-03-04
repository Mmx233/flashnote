import { Image } from 'antd';
import {
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import type { ImageClip } from '@/types';
import Countdown from './Countdown';

interface ImageClipCardProps {
  clip: ImageClip;
  onCopy: () => void;
  onDownload: () => void;
  onShare: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

export default function ImageClipCard({
  clip,
  onCopy,
  onDownload,
  onShare,
  onDelete,
  disabled,
}: ImageClipCardProps) {
  const fileUrl = `/api/clips/${clip.id}/file`;

  return (
    <div className="flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="flex-1 p-3 flex justify-center bg-gray-50 dark:bg-gray-800/50 select-none">
        <Image
          src={fileUrl}
          alt={clip.fileName}
          className="max-h-52 rounded-md object-contain"
          placeholder={
            <div className="flex items-center justify-center h-52 w-full text-gray-400 text-xs animate-pulse">
              Loading…
            </div>
          }
          preview={{
            src: fileUrl,
            toolbarRender: (originalNode) => (
              <div className="flex flex-col items-center gap-2">
                <div className="text-white/80 text-sm">{clip.fileName}</div>
                {originalNode}
              </div>
            ),
          }}
        />
      </div>
      <div className="flex items-center justify-end gap-1 px-3 py-1.5 border-t border-gray-100 dark:border-gray-800">
        <Countdown expiresAt={clip.expiresAt} createdAt={clip.createdAt} className="mr-auto" />
        <button onClick={onCopy} disabled={disabled} className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-30 transition-colors text-xs">
          <CopyOutlined />
        </button>
        <button onClick={onDownload} disabled={disabled} className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-30 transition-colors text-xs">
          <DownloadOutlined />
        </button>
        <button onClick={onShare} disabled={disabled} className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-30 transition-colors text-xs">
          <ShareAltOutlined />
        </button>
        <button onClick={onDelete} disabled={disabled} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-30 transition-colors text-xs">
          <DeleteOutlined />
        </button>
      </div>
    </div>
  );
}
