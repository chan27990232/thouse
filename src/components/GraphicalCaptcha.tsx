import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomText(length = 5) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return out;
}

interface GraphicalCaptchaProps {
  value: string;
  onChange: (value: string) => void;
  onAnswerChange: (answer: string) => void;
}

export function GraphicalCaptcha({ value, onChange, onAnswerChange }: GraphicalCaptchaProps) {
  const [answer, setAnswer] = useState(() => randomText());

  const refresh = useCallback(() => {
    const next = randomText();
    setAnswer(next);
    onAnswerChange(next);
    onChange('');
  }, [onAnswerChange, onChange]);

  useEffect(() => {
    onAnswerChange(answer);
  }, [answer, onAnswerChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div
          className="flex h-12 min-w-[8.5rem] select-none items-center justify-center rounded-lg border border-gray-300 bg-gradient-to-br from-gray-100 to-gray-200 px-3 tracking-[0.35em] text-lg font-bold text-gray-800"
          aria-hidden
          style={{
            letterSpacing: '0.2em',
            textShadow: '1px 1px 0 #fff, -1px 1px 0 #999',
            transform: 'skewX(-6deg)',
          }}
        >
          {answer.split('').map((ch, i) => (
            <span
              key={`${answer}-${i}`}
              style={{
                display: 'inline-block',
                transform: `rotate(${((i % 3) - 1) * 8}deg) translateY(${((i % 2) * 2 - 1) * 2}px)`,
                color: i % 2 === 0 ? '#1f2937' : '#374151',
              }}
            >
              {ch}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={refresh}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
          aria-label="換一組驗證碼"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        placeholder="請輸入上方驗證碼"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="flex h-12 w-full rounded-md border border-input bg-input-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
      />
    </div>
  );
}
