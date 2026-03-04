import useCountdown from '@/hooks/useCountdown';

interface CountdownProps {
  expiresAt: string;
  createdAt: string;
  className?: string;
}

export default function Countdown({ expiresAt, createdAt, className }: CountdownProps) {
  const { text, progress, urgent } = useCountdown(expiresAt, createdAt);

  return (
    <span className={`flex flex-col items-center gap-0.5 text-xs tabular-nums shrink-0 ${urgent ? 'text-yellow-500' : 'text-gray-400'} ${className ?? ''}`}>
      {text}
      <span className="block w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <span
          className={`block h-full rounded-full transition-all duration-1000 ${urgent ? 'bg-yellow-400 dark:bg-yellow-500' : 'bg-blue-400 dark:bg-blue-500'}`}
          style={{ width: `${progress * 100}%` }}
        />
      </span>
    </span>
  );
}
