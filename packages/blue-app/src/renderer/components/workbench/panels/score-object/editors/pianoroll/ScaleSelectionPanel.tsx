import React, { useCallback, useRef, useState } from 'react';
import type { ScaleSnapshot } from './types';
import { BLUE_INSPECTOR_INLINE_INPUT_CLASS } from '../../../shared/compactFieldStyles';

interface ScaleSelectionPanelProps {
  scale: ScaleSnapshot;
  onScaleChange: (scale: ScaleSnapshot) => void;
}

function parseScalaFile(text: string, fallbackName: string): ScaleSnapshot | null {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('!') && line.trim().length > 0);

  if (lines.length === 0) return null;

  const scaleName = lines[0]!.trim() || fallbackName;
  const countLine = lines.length > 1 ? lines[1]!.trim() : '';
  const expectedCount = parseInt(countLine, 10);
  const ratioStart = Number.isFinite(expectedCount) ? 2 : 1;
  const ratioLines = lines.slice(ratioStart);

  const ratios: number[] = [];
  for (const line of ratioLines) {
    const trimmed = line.trim().split(/\s/)[0]!;
    if (!trimmed) continue;
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      const num = parseFloat(parts[0]!);
      const den = parseFloat(parts[1]!);
      if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) ratios.push(num / den);
      continue;
    }
    if (trimmed.includes('.')) {
      const cents = parseFloat(trimmed);
      if (Number.isFinite(cents)) ratios.push(Math.pow(2, cents / 1200));
      continue;
    }
    const val = parseFloat(trimmed);
    if (Number.isFinite(val) && val > 0) ratios.push(val);
  }

  if (ratios.length === 0) return null;
  return { scaleName, baseFrequency: 261.625565, octave: 2, ratios };
}

function default12TET(): ScaleSnapshot {
  const ratio = Math.pow(2.0, 1.0 / 12.0);
  return {
    scaleName: '12TET',
    baseFrequency: 261.625565,
    octave: 2,
    ratios: Array.from({ length: 12 }, (_, i) => Math.pow(ratio, i)),
  };
}

export default function ScaleSelectionPanel({
  scale,
  onScaleChange,
}: ScaleSelectionPanelProps): React.ReactElement {
  const [scaleName, setScaleName] = useState(scale.scaleName);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChooseFile = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.scl';
    input.click();

    await new Promise<void>((resolve) => { input.onchange = () => resolve(); });

    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseScalaFile(text, file.name.replace(/\.scl$/i, ''));
      if (parsed) {
        setScaleName(parsed.scaleName);
        onScaleChange(parsed);
      }
    } catch { /* ignore */ }
  }, [onScaleChange]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const twelve = default12TET();
    setScaleName(twelve.scaleName);
    onScaleChange(twelve);
  }, [onScaleChange]);

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        className={BLUE_INSPECTOR_INLINE_INPUT_CLASS}
        value={scaleName}
        onChange={(e) => setScaleName(e.target.value)}
        onContextMenu={handleContextMenu}
        readOnly
      />
      <button
        className="px-2 py-1 text-body rounded border border-blue-border text-blue-muted hover:bg-blue-border/30"
        onClick={handleChooseFile}
        title="Load .scl scale file"
      >
        ...
      </button>
    </div>
  );
}
