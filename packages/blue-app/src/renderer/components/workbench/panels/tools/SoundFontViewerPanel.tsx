import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Copy,
  FolderOpen,
  ListMusic,
  Music2,
} from 'lucide-react';
import type { SoundFontInfo } from '../../../../shared/soundfont-viewer';

const WIDE_PANEL_BREAKPOINT = 640;
const MIN_SPLIT_RATIO = 0.25;
const MAX_SPLIT_RATIO = 0.75;

const SECONDARY_BUTTON_CLASS =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded border border-app-border/40 bg-app-surface px-2.5 py-1.5 text-[11px] text-app-text transition-colors hover:bg-app-hover hover:text-app-text-bright disabled:cursor-not-allowed disabled:opacity-50';

function basename(filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/');
  const name = normalized.substring(normalized.lastIndexOf('/') + 1);
  return name || normalized;
}

function isSoundFontPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.sf2');
}

function getDroppedFilePath(event: React.DragEvent<HTMLElement>): string | null {
  const droppedFile = event.dataTransfer.files[0];
  const nativePath = droppedFile
    ? (droppedFile as File & { path?: string }).path
    : undefined;
  if (nativePath?.trim()) {
    return nativePath.trim();
  }

  if (droppedFile) {
    try {
      const electronPath = window.blueAPI.getPathForFile(droppedFile);
      if (electronPath?.trim()) {
        return electronPath.trim();
      }
    } catch {
      // Continue with URI/text fallbacks for non-Electron or synthetic drops.
    }
  }

  const uriList = event.dataTransfer.getData('text/uri-list')
    || event.dataTransfer.getData('text/plain');
  const firstUri = uriList
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .find((value) => value.length > 0 && !value.startsWith('#'));
  if (!firstUri) {
    return null;
  }

  if (!firstUri.startsWith('file://')) {
    return firstUri;
  }

  try {
    const fileUrl = new URL(firstUri);
    const decodedPath = decodeURIComponent(fileUrl.pathname);
    return /^\/[A-Za-z]:\//u.test(decodedPath)
      ? decodedPath.slice(1)
      : decodedPath;
  } catch {
    return decodeURI(firstUri.substring('file://'.length));
  }
}

function clampSplitRatio(value: number): number {
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, value));
}

export default function SoundFontViewerPanel(): React.ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);
  const tableAreaRef = useRef<HTMLDivElement>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [info, setInfo] = useState<SoundFontInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isChoosing, setIsChoosing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;

    const updateWidth = () => {
      setIsWide(panel.getBoundingClientRect().width >= WIDE_PANEL_BREAKPOINT);
    };

    updateWidth();
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateWidth);
    observer?.observe(panel);
    window.addEventListener('resize', updateWidth);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const inspectFile = useCallback(async (nextPath: string) => {
    const trimmedPath = nextPath.trim();
    if (!isSoundFontPath(trimmedPath)) {
      setError('Choose or drop an .sf2 SoundFont file.');
      return;
    }

    setFilePath(trimmedPath);
    setInfo(null);
    setError(null);
    setIsInspecting(true);
    try {
      setInfo(await window.blueAPI.inspectSoundFont(trimmedPath));
    } catch (inspectError) {
      setError(inspectError instanceof Error ? inspectError.message : String(inspectError));
    } finally {
      setIsInspecting(false);
    }
  }, []);

  const chooseFile = useCallback(async () => {
    setError(null);
    setIsChoosing(true);
    try {
      const selectedPath = await window.blueAPI.selectSoundFontFile();
      if (selectedPath) {
        await inspectFile(selectedPath);
      }
    } catch (chooseError) {
      setError(chooseError instanceof Error ? chooseError.message : String(chooseError));
    } finally {
      setIsChoosing(false);
    }
  }, [inspectFile]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const droppedPath = getDroppedFilePath(event);
    if (!droppedPath) {
      setError('Could not read the dropped file path. Try Choose file instead.');
      return;
    }

    void inspectFile(droppedPath);
  }, [inspectFile]);

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  }, []);

  const handleSplitterPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const tableArea = tableAreaRef.current;
    if (!tableArea) return;

    const startPosition = isWide ? event.clientX : event.clientY;
    const bounds = tableArea.getBoundingClientRect();
    const total = isWide ? bounds.width : bounds.height;
    if (total <= 0) return;

    const startRatio = splitRatio;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const position = isWide ? moveEvent.clientX : moveEvent.clientY;
      setSplitRatio(clampSplitRatio(startRatio + ((position - startPosition) / total)));
    };
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [isWide, splitRatio]);

  const handleSplitterKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const decrement = isWide ? event.key === 'ArrowLeft' : event.key === 'ArrowUp';
    const increment = isWide ? event.key === 'ArrowRight' : event.key === 'ArrowDown';
    if (event.key === 'Home') {
      event.preventDefault();
      setSplitRatio(MIN_SPLIT_RATIO);
    } else if (event.key === 'End') {
      event.preventDefault();
      setSplitRatio(MAX_SPLIT_RATIO);
    } else if (decrement || increment) {
      event.preventDefault();
      setSplitRatio((ratio) => clampSplitRatio(ratio + (increment ? 0.05 : -0.05)));
    }
  }, [isWide]);

  const instrumentRows = info?.instruments.map((instrument) => [
    String(instrument.number),
    instrument.name,
  ]) ?? [];
  const presetRows = info?.presets.map((preset) => [
    String(preset.number),
    preset.name,
    String(preset.bank),
    String(preset.presetNumber),
  ]) ?? [];

  return (
    <div ref={panelRef} data-soundfont-panel="true" className="relative flex h-full min-h-0 flex-col overflow-hidden bg-app-bg/15 text-app-text">
      <section
        data-soundfont-drop-target="true"
        className={`shrink-0 border-b px-3 py-3 transition-colors ${
          isDragging
            ? 'border-app-accent/60 bg-app-accent/10 ring-1 ring-inset ring-app-accent/60'
            : 'border-app-border/30 bg-app-surface/30'
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-app-text-muted">SoundFont file</div>
            <div className="truncate text-sm text-app-text-bright" title={filePath ?? undefined}>
              {filePath ? basename(filePath) : 'No SoundFont selected'}
            </div>
            <div className="truncate text-[10px] text-app-text-muted" title={filePath ?? undefined}>
              {filePath ?? 'Choose or drop an .sf2 file to inspect'}
            </div>
          </div>
          {filePath && (
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-app-border/40 bg-app-surface text-app-text-muted transition-colors hover:bg-app-hover hover:text-app-text-bright"
              onClick={() => { void window.blueAPI.writeClipboardText(filePath); }}
              title="Copy full path"
              aria-label="Copy full path"
            >
              <Copy size={12} />
            </button>
          )}
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => { void chooseFile(); }}
            disabled={isChoosing || isInspecting}
            title="Choose SoundFont file"
          >
            <FolderOpen size={13} />
            Choose file
          </button>
        </div>
      </section>

      {error && (
        <div className="mx-3 mt-3 shrink-0 rounded border border-red-400/30 bg-red-400/10 px-2.5 py-2 text-[11px] text-red-200">
          {error}
        </div>
      )}

      {isInspecting && (
        <div className="mx-3 mt-3 shrink-0 text-[11px] text-app-accent">Reading SoundFont metadata…</div>
      )}

      <div
        ref={tableAreaRef}
        className={`flex min-h-0 flex-1 gap-2 p-2 ${isWide ? 'flex-row' : 'flex-col'}`}
      >
        <div
          className="min-h-0 min-w-0 shrink-0"
          style={isWide ? { width: `${splitRatio * 100}%` } : { height: `${splitRatio * 100}%` }}
        >
          <SoundFontTable
            title="Instruments"
            count={info?.instruments.length ?? 0}
            icon={<Music2 size={13} />}
            headers={['#', 'Instrument']}
            rows={instrumentRows}
            emptyMessage={info ? 'No instruments reported.' : 'Choose a SoundFont to inspect.'}
          />
        </div>

        <div
          data-soundfont-splitter="true"
          role="separator"
          tabIndex={0}
          aria-label="Resize instrument and preset panels"
          aria-orientation={isWide ? 'vertical' : 'horizontal'}
          aria-valuemin={25}
          aria-valuemax={75}
          aria-valuenow={Math.round(splitRatio * 100)}
          className={`group flex shrink-0 items-center justify-center rounded text-app-border transition-colors hover:text-app-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-app-accent ${
            isWide ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize'
          }`}
          onPointerDown={handleSplitterPointerDown}
          onKeyDown={handleSplitterKeyDown}
        >
          <span className={isWide ? 'h-8 w-px bg-current' : 'h-px w-8 bg-current'} />
        </div>

        <div className="min-h-0 min-w-0 flex-1">
          <SoundFontTable
            title="Presets"
            count={info?.presets.length ?? 0}
            icon={<ListMusic size={13} />}
            headers={['#', 'Preset', 'Bank', 'Preset #']}
            rows={presetRows}
            emptyMessage={info ? 'No presets reported.' : 'Choose a SoundFont to inspect.'}
          />
        </div>
      </div>

    </div>
  );
}

function SoundFontTable({
  title,
  count,
  icon,
  headers,
  rows,
  emptyMessage,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  headers: string[];
  rows: string[][];
  emptyMessage: string;
}): React.ReactElement {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-app-border/30 bg-app-field/30">
      <div className="flex shrink-0 items-center justify-between border-b border-app-border/30 px-2.5 py-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-app-text-bright">
          <span className="text-app-accent">{icon}</span>
          {title}
        </div>
        <span className="rounded-full bg-app-accent/10 px-1.5 py-0.5 text-[10px] tabular-nums text-app-accent">{count}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-app-menu text-[10px] uppercase tracking-wider text-app-text-muted">
            <tr>
              {headers.map((header) => (
                <th key={header} className="border-b border-app-border/30 px-2.5 py-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${row[0]}-${rowIndex}`} className="border-b border-app-border/15 last:border-0 hover:bg-app-hover/50">
                {row.map((value, columnIndex) => (
                  <td
                    key={`${columnIndex}-${value}`}
                    className={`px-2.5 py-1.5 text-app-text ${columnIndex === 0 ? 'w-8 tabular-nums text-app-text-muted' : ''}`}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="px-3 py-8 text-center text-[11px] text-app-text-muted">{emptyMessage}</div>
        )}
      </div>
    </section>
  );
}
