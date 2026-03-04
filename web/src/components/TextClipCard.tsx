import { Button, Card, Typography } from 'antd';
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import type { TextClip } from '@/types';

interface TextClipCardProps {
  clip: TextClip;
  onCopy: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

export default function TextClipCard({ clip, onCopy, onDelete, disabled }: TextClipCardProps) {
  return (
    <Card
      size="small"
      className="mb-3"
      actions={[
        <Button
          key="copy"
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={onCopy}
          disabled={disabled}
        />,
        <Button
          key="delete"
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={onDelete}
          disabled={disabled}
        />,
      ]}
    >
      <Typography.Paragraph
        ellipsis={{ rows: 6, expandable: 'collapsible' }}
        className="!mb-0 whitespace-pre-wrap break-all"
      >
        {clip.content}
      </Typography.Paragraph>
    </Card>
  );
}
