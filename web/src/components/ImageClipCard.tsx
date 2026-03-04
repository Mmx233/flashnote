import { Image } from 'antd';
import {
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import type { ImageClip } from '@/types';

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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="p-3 flex justify-center bg-gray-50 dark:bg-gray-800/50 select-none">
        <Image
          src={fileUrl}
          alt={clip.fileName}
          className="max-h-52 rounded-md object-contain"
          preview={{ src: fileUrl }}
        />
      </div>
      <div className="flex items-center justify-end gap-1 px-3 py-1.5 border-t border-gray-100 dark:border-gray-800">
        <span className="mr-auto text-xs text-gray-400 truncate max-w-[50%]">{clip.fileName}</span>
        <button onClick={onCopy} disabled={disabled} className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-30 transition-colors text-xs flex items-center gap-1">
          <CopyOutlined /> Copy
        </button>
        <button onClick={onDownload} disabled={disabled} className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-30 transition-colors text-xs flex items-center gap-1">
          <DownloadOutlined /> Download
        </button>
        <button onClick={onShare} disabled={disabled} className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-30 transition-colors text-xs flex items-center gap-1">
          <ShareAltOutlined /> Share
        </button>
        <button onClick={onDelete} disabled={disabled} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-30 transition-colors text-xs flex items-center gap-1">
          <DeleteOutlined /> Delete
        </button>
      </div>
    </div>
  );
}
