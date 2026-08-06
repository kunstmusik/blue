import { useCallback } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRight, Music2 } from 'lucide-react';
import type { SupportedNewInstrumentType, TrackInstrumentSummary } from '../../../../../shared/project-editor';
import { useProjectStore } from '../../../../stores/project-store';
import { useLibraryStore } from '../../../../stores/library-store';
import { useMidiRoutingStore } from '../../../../stores/midi-routing-store';
import { useLibraryDropTarget } from '../../../libraries/use-library-drop-target';

interface Props {
  groupId: string;
  trackId: string;
  instrument: TrackInstrumentSummary | null;
  projectSessionId: number;
  projectRevision: number;
  displayName: string;
}

const NEW_INSTRUMENTS: Array<{ type: SupportedNewInstrumentType; label: string }> = [
  { type: 'generic', label: 'Generic Instrument' },
  { type: 'python', label: 'Python Instrument' },
  { type: 'javascript', label: 'JavaScript Instrument' },
  { type: 'blueX7', label: 'BlueX7 Instrument' },
  { type: 'blueSynthBuilder', label: 'BlueSynthBuilder Instrument' },
];

export default function TrackInstrumentControl({
  groupId,
  trackId,
  instrument,
  projectSessionId,
  projectRevision,
  displayName,
}: Props) {
  const applyProjectDocumentPatch = useProjectStore((state) => state.applyProjectDocumentPatch);
  const captureTrackInstrument = useLibraryStore((state) => state.captureTrackInstrument);
  const track = {
    rootGroupId: groupId,
    trackId,
    projectSessionId,
    projectRevision,
  } as const;
  const libraryTarget = {
    kind: 'trackInstrument' as const,
    projectSessionId,
    projectRevision,
    track: { rootGroupId: groupId, trackId },
  };
  const libraryDrop = useLibraryDropTarget(libraryTarget, true);

  const openEditor = useCallback(() => {
    void window.blueAPI.openTrackInstrumentEditor({ track });
  }, [track]);

  const createInstrument = useCallback((instrumentType: SupportedNewInstrumentType) => {
    void applyProjectDocumentPatch({ score: { type: 'createTrackInstrument', track, instrumentType } });
  }, [applyProjectDocumentPatch, track]);

  const copyInstrument = useCallback(() => {
    if (instrument?.snapshot) {
      void captureTrackInstrument({ projectSessionId, projectRevision, rootGroupId: groupId, trackId });
    }
  }, [captureTrackInstrument, groupId, instrument, projectRevision, projectSessionId, trackId]);

  const cutInstrument = useCallback(async () => {
    if (!instrument?.snapshot) return;
    const captured = await captureTrackInstrument({
      projectSessionId,
      projectRevision,
      rootGroupId: groupId,
      trackId,
    });
    if (!captured) return;
    try {
      await applyProjectDocumentPatch({ score: { type: 'clearTrackInstrument', track } });
    } catch {
      // Keep the captured payload; the project assignment was not cleared.
    }
  }, [applyProjectDocumentPatch, captureTrackInstrument, groupId, instrument, projectRevision, projectSessionId, track, trackId]);

  const pasteInstrument = useCallback(() => {
    void libraryDrop.paste();
  }, [libraryDrop]);

  const label = instrument?.name?.trim() || instrument?.instrumentType || 'No Instrument';

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          {...libraryDrop.dropProps}
          className={`flex shrink-0 items-center gap-px pt-0.5 ${libraryDrop.active ? 'rounded-sm bg-app-accent/20 ring-1 ring-app-accent' : ''}`}
          data-track-instrument-control={trackId}
          title={libraryDrop.feedback || undefined}
        >
          <button
            type="button"
            className={`flex h-5 w-5 items-center justify-center rounded-sm border border-app-border/30 ${instrument ? 'bg-app-accent/20 text-app-text' : 'text-app-text-muted hover:text-app-text'}`}
            title={instrument ? `Track Instrument: ${label}` : 'Track Instrument: None'}
            aria-label={instrument ? `Track Instrument: ${label}` : 'Assign Track Instrument'}
            onClick={(event) => {
              event.stopPropagation();
              // Spec 067: an explicit pointer interaction with the Track instrument
              // control focuses this Track for MIDI routing.
              useMidiRoutingStore.getState().focusTrack({
                projectSessionId,
                rootGroupId: groupId,
                trackId,
                displayName,
              });
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (instrument?.snapshot) openEditor();
            }}
          >
            <Music2 size={13} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="editor-context-menu" sideOffset={4}>
          <ContextMenu.Label className="px-3 py-1 text-tiny text-app-text-muted">Track Instrument</ContextMenu.Label>
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="editor-context-menu__item editor-context-menu__subtrigger">
              <span>Use New Instrument</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent
                className="editor-context-menu editor-context-menu--submenu"
                sideOffset={2}
                alignOffset={-4}
              >
                {NEW_INSTRUMENTS.map((option) => (
                  <ContextMenu.Item
                    key={option.type}
                    className="editor-context-menu__item"
                    onSelect={() => createInstrument(option.type)}
                  >
                    {option.label}
                  </ContextMenu.Item>
                ))}
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <ContextMenu.Item
            className="editor-context-menu__item"
            disabled={!instrument?.snapshot}
            onSelect={() => void cutInstrument()}
          >
            Cut
          </ContextMenu.Item>
          <ContextMenu.Item
            className="editor-context-menu__item"
            disabled={!instrument?.snapshot}
            onSelect={copyInstrument}
          >
            Copy
          </ContextMenu.Item>
          <ContextMenu.Item
            className="editor-context-menu__item"
            disabled={!libraryDrop.canPaste}
            onSelect={pasteInstrument}
          >
            Paste
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
