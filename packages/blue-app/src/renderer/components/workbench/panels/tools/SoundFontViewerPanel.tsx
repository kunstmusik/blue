import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Copy,
  FolderOpen,
  ListMusic,
  Music2,
} from 'lucide-react';
import { DEFAULT_SPLIT_SIZE_PX } from '../../../../../shared/window-layout-settings';
import type { SoundFontInfo } from '../../../../../shared/soundfont-viewer';
import { subscribePendingSoundFontFile } from './soundfont-viewer-bus';
import SplitPane from '../orchestra/SplitPane';
import { cn } from '../../../../lib/cn';

const WIDE_PANEL_BREAKPOINT = 640;

const SECONDARY_BUTTON_CLASS =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded border border-app-border/40 bg-app-surface px-2.5 py-1.5 text-role-body text-app-text transition-colors hover:bg-app-hover hover:text-app-text-bright disabled:cursor-not-allowed disabled:opacity-50';

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

export default function SoundFontViewerPanel(): React.ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [info, setInfo] = useState<SoundFontInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isChoosing, setIsChoosing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isWide, setIsWide] = useState(false);

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

  // SPEC 076: a File Manager double-clicked .sf2 file arrives on the
  // pending-file bus (delivered here on mount when the panel was closed).
  useEffect(() => {
    return subscribePendingSoundFontFile((path) => {
      void inspectFile(path);
    });
  }, [inspectFile]);

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
        className={cn(
          'shrink-0 border-b px-3 py-3 transition-colors',
          isDragging
            ? 'border-app-accent/60 bg-app-accent/10 ring-1 ring-inset ring-app-accent/60'
            : 'border-app-border/30 bg-app-surface/30',
        )}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-role-headline font-bold uppercase tracking-[0.14em] text-app-text-muted">SoundFont file</div>
            <div className="truncate text-role-body text-app-text-bright" title={filePath ?? undefined}>
              {filePath ? basename(filePath) : 'No SoundFont selected'}
            </div>
            <div className="truncate text-role-body text-app-text-muted" title={filePath ?? undefined}>
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
        <div className="mx-3 mt-3 shrink-0 rounded border border-red-400/30 bg-red-400/10 px-2.5 py-2 text-role-callout text-red-200">
          {error}
        </div>
      )}

      {isInspecting && (
        <div className="mx-3 mt-3 shrink-0 text-role-callout text-app-accent">Reading SoundFont metadata…</div>
      )}

      <div className="flex min-h-0 flex-1 p-2">
        <SplitPane
          orientation={isWide ? 'horizontal' : 'vertical'}
          ariaLabel="Resize instrument and preset panels"
          splitId="soundfont-viewer.tables"
          controlledPane="first"
          defaultSizePx={DEFAULT_SPLIT_SIZE_PX}
          minFirstSize={140}
          minSecondSize={140}
          className="h-full w-full"
          firstClassName="min-h-0 min-w-0"
          secondClassName="min-h-0 min-w-0"
          separatorProps={{
            'data-soundfont-splitter': 'true',
          } as React.ButtonHTMLAttributes<HTMLButtonElement>}
          first={
            <SoundFontTable
              title="Instruments"
              count={info?.instruments.length ?? 0}
              icon={<Music2 size={13} />}
              headers={['#', 'Instrument']}
              rows={instrumentRows}
              emptyMessage={info ? 'No instruments reported.' : 'Choose a SoundFont to inspect.'}
            />
          }
          second={
            <SoundFontTable
              title="Presets"
              count={info?.presets.length ?? 0}
              icon={<ListMusic size={13} />}
              headers={['#', 'Preset', 'Bank', 'Preset #']}
              rows={presetRows}
              emptyMessage={info ? 'No presets reported.' : 'Choose a SoundFont to inspect.'}
            />
          }
        />
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
        <div className="flex items-center gap-1.5 text-role-headline font-bold text-app-text-bright">
          <span className="text-app-accent">{icon}</span>
          {title}
        </div>
        <span className="rounded-full bg-app-accent/10 px-1.5 py-0.5 text-role-callout tabular-nums text-app-accent">{count}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-black">
        <table className="w-full border-collapse text-left text-role-body">
          <thead className="sticky top-0 bg-app-menu text-role-headline font-bold uppercase tracking-wider text-app-text-muted">
            <tr>
              {headers.map((header) => (
                <th key={header} className="border-b border-app-border/30 px-2.5 py-2">
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
                    className={cn(
                      'px-2.5 py-1.5 text-app-text',
                      columnIndex === 0 && 'w-8 tabular-nums text-app-text-muted',
                    )}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="px-3 py-8 text-center text-role-callout text-app-text-muted">{emptyMessage}</div>
        )}
      </div>
    </section>
  );
}
