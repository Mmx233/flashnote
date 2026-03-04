import { Button, Card, Image } from 'antd';
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
    <Card
      size="small"
      className="mb-3"
      actions={[
        <Button key="copy" type="text" size="small" icon={<CopyOutlined />} onClick={onCopy} disabled={disabled} />,
        <Button key="download" type="text" size="small" icon={<DownloadOutlined />} onClick={onDownload} disabled={disabled} />,
        <Button key="share" type="text" size="small" icon={<ShareAltOutlined />} onClick={onShare} disabled={disabled} />,
        <Button key="delete" type="text" size="small" danger icon={<DeleteOutlined />} onClick={onDelete} disabled={disabled} />,
      ]}
    >
      <Image
        src={fileUrl}
        alt={clip.fileName}
        className="max-h-48 object-contain"
        preview={{ src: fileUrl }}
      />
    </Card>
  );
}
