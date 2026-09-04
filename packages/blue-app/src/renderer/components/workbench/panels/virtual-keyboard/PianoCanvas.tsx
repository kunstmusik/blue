import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from 'react';

const KEY_OFFSET = 21;
const TOTAL_KEYS = 88;
const WHITE_KEY_COUNT = 52;

const WHITE_KEY_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

function isWhiteKey(keyIndex: number): boolean {
  if (keyIndex < 3) {
    return keyIndex % 2 === 0;
  }
  const adjusted = (keyIndex - 3) % 12;
  return WHITE_KEY_SEMITONES.includes(adjusted);
}

function midiValForWhiteKey(whiteKeyNum: number): number {
  if (whiteKeyNum < 2) {
    return whiteKeyNum * 2;
  }
  const adjusted = whiteKeyNum - 2;
  const oct = Math.floor(adjusted / 7);
  const key = adjusted % 7;
  return 3 + oct * 12 + WHITE_KEY_SEMITONES[key];
}

function getMidiKeyFromPosition(x: number, y: number, width: number, height: number): number {
  if (x >= width) return 87;
  if (x < 0) return 0;

  const blackKeyHeight = Math.floor(height * 0.625);
  const whiteKeyWidth = width / WHITE_KEY_COUNT;
  const blackKeyWidth = whiteKeyWidth * 0.8333333;
  const leftKeyBound = blackKeyWidth / 2;
  const rightKeyBound = whiteKeyWidth - leftKeyBound;

  const whiteKey = Math.floor(x / whiteKeyWidth);
  const extra = x - whiteKey * whiteKeyWidth;

  if (whiteKey < 2) {
    if (whiteKey === 0) {
      if (y > blackKeyHeight) return whiteKey;
      if (extra > rightKeyBound) return whiteKey + 1;
      return whiteKey;
    }
    if (y > blackKeyHeight) return midiValForWhiteKey(whiteKey);
    if (extra < leftKeyBound) return midiValForWhiteKey(whiteKey) - 1;
    return midiValForWhiteKey(whiteKey);
  }

  const adjustedKey = (whiteKey - 2) % 7;

  if (adjustedKey === 0 || adjustedKey === 3) {
    if (y > blackKeyHeight) return midiValForWhiteKey(whiteKey);
    if (extra > rightKeyBound) return midiValForWhiteKey(whiteKey) + 1;
    return midiValForWhiteKey(whiteKey);
  }

  if (adjustedKey === 2 || adjustedKey === 6) {
    if (y > blackKeyHeight) return midiValForWhiteKey(whiteKey);
    if (extra < leftKeyBound) return midiValForWhiteKey(whiteKey) - 1;
    return midiValForWhiteKey(whiteKey);
  }

  if (y > blackKeyHeight) return midiValForWhiteKey(whiteKey);
  if (extra < leftKeyBound) return midiValForWhiteKey(whiteKey) - 1;
  if (extra > rightKeyBound) return midiValForWhiteKey(whiteKey) + 1;
  return midiValForWhiteKey(whiteKey);
}

function drawKeyboard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pressedKeys: ReadonlySet<number>,
): void {
  const whiteKeyHeight = height;
  const blackKeyHeight = Math.floor(whiteKeyHeight * 0.625);
  const whiteKeyWidth = width / WHITE_KEY_COUNT;
  const blackKeyWidth = Math.floor(whiteKeyWidth * 0.8333333);
  const blackKeyOffset = Math.floor(blackKeyWidth / 2);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  const lineHeight = whiteKeyHeight - 1;
  let runningX = 0;

  for (let i = 0; i < TOTAL_KEYS; i++) {
    if (!isWhiteKey(i)) continue;
    const newX = Math.round(runningX + 0.5);
    if (pressedKeys.has(i)) {
      const newW = Math.round(runningX + whiteKeyWidth + 0.5) - newX;
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(newX, 0, newW, whiteKeyHeight - 1);
    }
    runningX += whiteKeyWidth;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(newX, 0);
    ctx.lineTo(newX, lineHeight);
    ctx.stroke();
  }

  runningX = 0;

  for (let i = 0; i < TOTAL_KEYS; i++) {
    if (isWhiteKey(i)) {
      runningX += whiteKeyWidth;
    } else {
      const bx = Math.round(runningX - blackKeyOffset);
      if (pressedKeys.has(i)) {
        ctx.fillStyle = '#2563eb';
      } else {
        ctx.fillStyle = '#1a1a2e';
      }
      ctx.fillRect(bx, 0, blackKeyWidth, blackKeyHeight);
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(bx, 0, blackKeyWidth, blackKeyHeight);
    }
  }
}

export interface PianoCanvasProps {
  pressedKeys: ReadonlySet<number>;
  onNoteOn: (keyIndex: number) => void;
  onNoteOff: (keyIndex: number) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLCanvasElement>) => void;
  onKeyUp: (event: ReactKeyboardEvent<HTMLCanvasElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
  focused: boolean;
}

export function PianoCanvas({
  pressedKeys,
  onNoteOn,
  onNoteOff,
  onKeyDown,
  onKeyUp,
  onFocus,
  onBlur,
  focused,
}: PianoCanvasProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMidiKeyRef = useRef(-1);
  const mouseDownRef = useRef(false);
  const pressedKeysRef = useRef(pressedKeys);
  pressedKeysRef.current = pressedKeys;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
          drawKeyboard(ctx, width, height, pressedKeysRef.current);
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawKeyboard(ctx, w, h, pressedKeys);
    ctx.restore();
  }, [pressedKeys]);

  const getKeyIndex = useCallback((e: MouseEvent): number => {
    const canvas = canvasRef.current;
    if (!canvas) return -1;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    return getMidiKeyFromPosition(x, y, w, h);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      mouseDownRef.current = true;
      const key = getKeyIndex(e);
      if (key < 0) return;
      lastMidiKeyRef.current = key;
      onNoteOn(key);
      canvas.focus();
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!mouseDownRef.current) return;
      const key = Math.min(getKeyIndex(e), 87);
      mouseDownRef.current = false;
      onNoteOff(key);
      if (lastMidiKeyRef.current >= 0) {
        onNoteOff(lastMidiKeyRef.current);
      }
      lastMidiKeyRef.current = -1;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseDownRef.current) return;
      const key = Math.min(getKeyIndex(e), 87);
      if (key !== lastMidiKeyRef.current) {
        if (lastMidiKeyRef.current >= 0) {
          onNoteOff(lastMidiKeyRef.current);
        }
        onNoteOn(key);
        lastMidiKeyRef.current = key;
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [getKeyIndex, onNoteOn, onNoteOff]);

  return (
    <div ref={containerRef} className="flex-1 min-h-0 min-w-0" style={{ minHeight: 100 }}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-pointer"
        style={{ outline: 'none' }}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </div>
  );
}

export { KEY_OFFSET, TOTAL_KEYS, isWhiteKey };
