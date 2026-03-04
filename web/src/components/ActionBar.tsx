import { useRef } from 'react';
import { Button, Space } from 'antd';
import { SnippetsOutlined, PictureOutlined } from '@ant-design/icons';

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
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <Space.Compact>
        <Button
          type="primary"
          icon={<SnippetsOutlined />}
          loading={loading}
          disabled={disabled}
          onClick={onPasteText}
        >
          Paste
        </Button>
        <Button
          icon={<PictureOutlined />}
          loading={loading}
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
        />
      </Space.Compact>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <Space.Compact>
        {ttlOptions.map((opt) => (
          <Button
            key={opt}
            type={ttl === opt ? 'primary' : 'default'}
            size="small"
            disabled={disabled}
            onClick={() => onTTLChange(opt)}
          >
            {opt}
          </Button>
        ))}
      </Space.Compact>
    </div>
  );
}
