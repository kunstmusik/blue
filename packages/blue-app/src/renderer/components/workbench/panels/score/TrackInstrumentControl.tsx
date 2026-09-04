import { useCallback } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRight, Music2 } from 'lucide-react';
import { toast } from 'sonner';
import type {
  SupportedNewInstrumentType,
  TrackInstrumentSummary,
} from '../../../../../shared/project-editor';
import { getProjectDocumentRevision, useProjectStore } from '../../../../stores/project-store';
import { useLibraryStore } from '../../../../stores/library-store';
import { useMidiRoutingStore } from '../../../../stores/midi-routing-store';
import { useLibraryDropTarget } from '../../../libraries/use-library-drop-target';
import { PopoutContextMenuPortal, portalEventIsolationProps } from '../../../../hooks/host-portals';
import { cn } from '../../../../lib/cn';

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
  const flushPendingPatches = useProjectStore((state) => state.flushPendingPatches);
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

  const openEditor = useCallback(async () => {
    try {
      // A newly assigned Track instrument is optimistic until the pending
      // project patch reaches the main process. Flush before opening so the
      // native editor never races that assignment.
      await flushPendingPatches();
      await window.blueAPI.openTrackInstrumentEditor({ track });
    } catch (error) {
      console.error('[track-instrument-control] Failed to open editor:', error);
      toast.error(
        `Failed to open Track instrument editor: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, [flushPendingPatches, track]);

  const createInstrument = useCallback(
    async (instrumentType: SupportedNewInstrumentType) => {
      const instrumentLabel =
        NEW_INSTRUMENTS.find((option) => option.type === instrumentType)?.label ?? instrumentType;
      try {
        // Drain an earlier commit before reading the fence. Otherwise this
        // action can be queued behind a commit that advances the revision.
        await flushPendingPatches();
        const currentTrack = {
          rootGroupId: groupId,
          trackId,
          projectSessionId,
          // Track mutations are fenced; read the revision when the menu action
          // is selected instead of relying on the value captured during render.
          projectRevision: getProjectDocumentRevision(),
        } as const;

        await applyProjectDocumentPatch({
          score: { type: 'createTrackInstrument', track: currentTrack, instrumentType },
        });
        await flushPendingPatches();
      } catch (error: unknown) {
        toast.error(
          `Failed to add ${instrumentLabel} to Track: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [applyProjectDocumentPatch, flushPendingPatches, groupId, projectSessionId, trackId],
  );

  const copyInstrument = useCallback(() => {
    if (instrument?.snapshot) {
      void captureTrackInstrument({
        projectSessionId,
        projectRevision,
        rootGroupId: groupId,
        trackId,
      });
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
  }, [
    applyProjectDocumentPatch,
    captureTrackInstrument,
    groupId,
    instrument,
    projectRevision,
    projectSessionId,
    track,
    trackId,
  ]);

  const pasteInstrument = useCallback(() => {
    void libraryDrop.paste();
  }, [libraryDrop]);

  const label = instrument?.name?.trim() || instrument?.instrumentType || 'No Instrument';

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          {...libraryDrop.dropProps}
          className={cn(
            'flex shrink-0 items-center gap-px pt-0.5',
            libraryDrop.active && 'rounded-sm bg-app-accent/20 ring-1 ring-app-accent',
          )}
          data-track-instrument-control={trackId}
          title={libraryDrop.feedback || undefined}
          onContextMenu={(event) => {
            event.stopPropagation();
          }}
        >
          <button
            type="button"
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-sm border border-app-border/30',
              instrument
                ? 'bg-app-accent/20 text-app-text'
                : 'text-app-text-muted hover:text-app-text',
            )}
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
              if (instrument) void openEditor();
            }}
          >
            <Music2 size={13} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </ContextMenu.Trigger>
      <PopoutContextMenuPortal>
        <ContextMenu.Content
          className="editor-context-menu"
          sideOffset={4}
          {...portalEventIsolationProps}
        >
          <ContextMenu.Label className="px-3 py-1 text-role-headline font-bold text-app-text-muted">
            Track Instrument
          </ContextMenu.Label>
          <ContextMenu.Item
            className="editor-context-menu__item"
            disabled={!instrument}
            onSelect={() => void openEditor()}
          >
            Edit Instrument
          </ContextMenu.Item>
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="editor-context-menu__item editor-context-menu__subtrigger">
              <span>Use New Instrument</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </ContextMenu.SubTrigger>
            <PopoutContextMenuPortal>
              <ContextMenu.SubContent
                className="editor-context-menu editor-context-menu--submenu"
                sideOffset={2}
                alignOffset={-4}
                {...portalEventIsolationProps}
              >
                {NEW_INSTRUMENTS.map((option) => (
                  <ContextMenu.Item
                    key={option.type}
                    className="editor-context-menu__item"
                    onSelect={() => void createInstrument(option.type)}
                  >
                    {option.label}
                  </ContextMenu.Item>
                ))}
              </ContextMenu.SubContent>
            </PopoutContextMenuPortal>
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
      </PopoutContextMenuPortal>
    </ContextMenu.Root>
  );
}
