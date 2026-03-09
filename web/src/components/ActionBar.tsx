import { useRef } from 'react';
import { Button, Divider, Space, Tooltip } from 'antd';
import { SnippetsOutlined, PictureOutlined, ClockCircleOutlined } from '@ant-design/icons';

interface ActionBarProps {
  ttl: string;
  ttlOptions: string[];
  onTTLChange: (ttl: string) => void;
  onPasteText: () => void;
  onSelectImage: (file: File) => void;
  loading: boolean;
  disabled: boolean;
}

export default function ActionBar({
  ttl,
  ttlOptions,
  onTTLChange,
  onPasteText,
  onSelectImage,
  loading,
  disabled,
}: ActionBarProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectImage(file);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col items-start gap-3 mb-4 sm:flex-row sm:items-center sm:gap-3">
      <Space.Compact className="[&_.ant-btn]:rounded-lg">
        <Button
          type="primary"
          icon={<SnippetsOutlined />}
          loading={loading}
          disabled={disabled}
          onClick={onPasteText}
        >
          Paste
        </Button>
        <Tooltip title="Upload image">
          <Button
            icon={<PictureOutlined />}
            loading={loading}
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
          />
        </Tooltip>
      </Space.Compact>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="hidden sm:flex items-center">
        <Divider orientation="vertical" className="h-6 border-gray-300 dark:border-gray-600" />
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden sm:inline-flex text-lg text-gray-400 dark:text-gray-500 mr-1">
          <ClockCircleOutlined />
        </span>
        <Space.Compact className="[&_.ant-btn]:rounded-lg">
          {ttlOptions.map((opt) => (
            <Button
              key={opt}
              type={ttl === opt ? 'primary' : 'default'}
              disabled={disabled}
              className="min-w-[3rem]"
              onClick={() => onTTLChange(opt)}
            >
              {opt}
            </Button>
          ))}
        </Space.Compact>
      </div>
    </div>
  );
}
