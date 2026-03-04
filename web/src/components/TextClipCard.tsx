import { useRef, useState, useEffect } from 'react';
import { Modal } from 'antd';
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import type { TextClip } from '@/types';
import Countdown from './Countdown';

const MAX_HEIGHT = 128;

interface TextClipCardProps {
  clip: TextClip;
  onCopy: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

export default function TextClipCard({ clip, onCopy, onDelete, disabled }: TextClipCardProps) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const el = preRef.current;
    if (el) setOverflows(el.scrollHeight > MAX_HEIGHT);
  }, [clip.content]);

  return (
    <>
      <div className="flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div
          className={`relative flex-1 ${overflows ? 'cursor-pointer' : ''}`}
          onClick={overflows ? () => setOpen(true) : undefined}
        >
          <pre
            ref={preRef}
            className="px-4 py-3 text-sm whitespace-pre-wrap break-all font-sans !mb-0 overflow-hidden"
            style={{ maxHeight: MAX_HEIGHT }}
          >
            {clip.content}
          </pre>
        </div>
        <div className="relative border-t border-gray-100 dark:border-gray-800">
          {overflows && (
            <button
              onClick={() => setOpen(true)}
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 text-xs font-bold text-gray-400 hover:text-blue-500 bg-white dark:bg-gray-900 transition-colors"
            >
              · · · · · ·
            </button>
          )}
          <div className="flex items-center justify-end gap-1 px-3 py-1.5">
            <Countdown expiresAt={clip.expiresAt} createdAt={clip.createdAt} className="mr-auto" />
            <button onClick={onCopy} disabled={disabled} className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-30 transition-colors text-xs flex items-center gap-1">
              <CopyOutlined /> Copy
            </button>
            <button onClick={onDelete} disabled={disabled} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-30 transition-colors text-xs flex items-center gap-1">
              <DeleteOutlined /> Delete
            </button>
          </div>
        </div>
      </div>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title="Full Text"
        footer={null}
        width="90vw"
        style={{ top: 20, maxWidth: 900, paddingBottom: 20 }}
        styles={{ header: { textAlign: 'center' }, body: { maxHeight: '75vh', overflow: 'auto' } }}
      >
        <pre className="text-sm whitespace-pre-wrap break-all font-sans">
          {clip.content}
        </pre>
      </Modal>
    </>
  );
}
