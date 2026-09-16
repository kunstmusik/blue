import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ArrowRight } from 'lucide-react';
import { Effect, Element } from '@blue/data';
import type {
  EffectEditorRequest,
  EffectEditorSnapshot,
  EffectEditablePatch,
  MixerChainEntrySnapshot,
  MixerChainKind,
  MixerChannelSnapshot,
  MixerEffectEntrySnapshot,
  MixerSendEntrySnapshot,
  MixerSnapshot,
  ProjectEffectRef,
  UdoDefinitionSnapshot,
} from '../../../../../shared/project-editor';
import {
  getLibraryTransferSourceType,
  type LibraryBrowseNode,
} from '../../../../../shared/unified-library';
import {
  applyEffectEditablePatchToEffect,
  createEffectEditorSnapshot,
} from '../../../../../shared/project-editor';
import {
  getValidOutputTargets,
  getValidSendTargets,
  validateOutputTarget,
  validateSendTarget,
} from '../../../../../shared/mixer-routing-validation';
import { cn } from '../../../../lib/cn';
import EffectEditorPanel from '../../../effect-editor/EffectEditorPanel';
import { createDefaultEffectXml } from '../../../../utils/program-settings-defaults';
import EffectsChainContextMenu from './EffectsChainContextMenu';
import { LibraryBlockDropMarker, LibraryDropZone } from '../../../libraries/LibraryDropMarker';
import { useLibraryStore } from '../../../../stores/library-store';
import {
  useProjectStore,
  getProjectDocumentId,
  getProjectDocumentRevision,
} from '../../../../stores/project-store';
import { registerHistoryEditorSettlement } from '../../../../lib/history-scope-router';
import { isTextEditingTarget } from '../../../../hooks/use-keyboard-shortcuts';
import { ProjectLibraryDragSource } from '../../../libraries/ProjectLibraryDragSource';
import { PopoutContextMenuPortal, PopoutDropdownMenuPortal } from '../../../../hooks/host-portals';
import { useHostDocument } from '../../../../hooks/use-host-document';
import { meterStore } from '../../../../stores/meter-store';
import { AppSelect } from '../../../AppSelect';
import { MeterCanvas } from './MeterCanvas';
import { MeterScaleRuler } from './MeterScaleRuler';
import { MixerLevelSlider } from './MixerLevelSlider';
import { METER_PROFILES, type MeterProfileKey } from './meter-profiles';

export const PeakReadout = React.memo(function PeakReadout({
  stripId,
}: {
  stripId: string;
}): React.ReactElement {
  const numericPeak = useSyncExternalStore(
    useCallback((cb) => meterStore.subscribeStrip(stripId, cb), [stripId]),
    () => meterStore.getNumericPeak(stripId),
  );
  const isClipped = useSyncExternalStore(
    useCallback((cb) => meterStore.subscribeStrip(stripId, cb), [stripId]),
    () => meterStore.getIsClipped(stripId),
  );

  const handleClick = useCallback(() => {
    meterStore.clearStrip(stripId);
  }, [stripId]);

  return (
    <button
      type="button"
      className={cn(
        'mixer-peak-readout text-role-subheadline font-mono px-1 py-0.5 my-0.5 rounded cursor-pointer select-none text-center min-w-[36px] transition-colors',
        isClipped
          ? 'bg-red-900/80 text-red-200 font-bold border border-red-500/70'
          : 'bg-blue-surface/70 text-blue-muted hover:text-blue-text hover:bg-blue-surface border border-blue-border/40',
      )}
      onClick={handleClick}
      title="Held peak in dBFS (Click to clear)"
      aria-label={`Held peak readout ${numericPeak} dBFS${isClipped ? ' clipped' : ''}`}
    >
      {numericPeak}
    </button>
  );
});

interface StripMeterAreaProps {
  stripId: string;
  isMaster: boolean;
  height: number;
  profileKey?: MeterProfileKey;
  onSelectProfile: (key: MeterProfileKey) => void;
  onDisableMeters?: () => void;
}

const StripMeterArea = React.memo(function StripMeterArea({
  stripId,
  isMaster,
  height,
  profileKey,
  onSelectProfile,
  onDisableMeters,
}: StripMeterAreaProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [menuPoint, setMenuPoint] = useState({ x: 0, y: 0 });

  const handleClear = useCallback(() => {
    meterStore.clearStrip(stripId);
  }, [stripId]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPoint({ x: e.clientX, y: e.clientY });
    setOpen(true);
  }, []);

  return (
    <>
      <div
        className="mixer-strip-meter-area flex flex-row items-center gap-[1px] cursor-pointer"
        onContextMenu={handleContextMenu}
      >
        <MeterScaleRuler height={height} profileKey={profileKey} />
        <MeterCanvas
          height={height}
          stripId={stripId}
          isMaster={isMaster}
          profileKey={profileKey}
        />
      </div>
      {open && (
        <DropdownMenu.Root open={true} onOpenChange={setOpen}>
          <DropdownMenu.Trigger asChild>
            <div
              style={{
                position: 'fixed',
                left: menuPoint.x,
                top: menuPoint.y,
                width: 1,
                height: 1,
                pointerEvents: 'none',
              }}
            />
          </DropdownMenu.Trigger>
          <PopoutDropdownMenuPortal>
            <DropdownMenu.Content className="editor-context-menu" align="start">
              <DropdownMenu.Item className="editor-context-menu__item" onSelect={handleClear}>
                Clear Meter
              </DropdownMenu.Item>
              {onDisableMeters && (
                <DropdownMenu.Item className="editor-context-menu__item" onSelect={onDisableMeters}>
                  Disable Meters
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Separator className="editor-context-menu__separator" />
              <DropdownMenu.Label className="editor-context-menu__label px-2 py-1 text-role-subheadline font-semibold text-blue-muted">
                Meter Profile
              </DropdownMenu.Label>
              {Object.values(METER_PROFILES).map((p) => {
                const isSelected = p.key === (profileKey ?? 'peak-rms-mixing-plus-6');
                return (
                  <DropdownMenu.CheckboxItem
                    key={p.key}
                    className="editor-context-menu__item"
                    checked={isSelected}
                    onSelect={() => onSelectProfile(p.key)}
                    aria-label={`${p.label}. ${p.description}`}
                    title={p.description}
                  >
                    <span>{p.label}</span>
                    <DropdownMenu.ItemIndicator className="editor-context-menu__item-indicator">
                      <Check size={12} strokeWidth={2.5} />
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.CheckboxItem>
                );
              })}
            </DropdownMenu.Content>
          </PopoutDropdownMenuPortal>
        </DropdownMenu.Root>
      )}
    </>
  );
});

const BLUE_MIXER_EFFECT_DRAG_MIME = 'application/x-blue-mixer-effect';

export interface MixerChainSelection {
  readonly channelId: string;
  readonly chain: MixerChainKind;
  readonly entryId: string;
}

const MIXER_SLIDER_WIDTH = 32;
const MIXER_TRACK_W = 4;
const MIXER_THUMB_R = 7;
const MIXER_SLIDER_MIN_H = 60;

interface ChannelStripProps {
  mixer: MixerSnapshot;
  channel: MixerChannelSnapshot;
  unnamedDisplayName?: string;
  isMaster: boolean;
  isSubChannel: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
  projectSessionId: number;
  projectRevision: number;
  onOpenEffectInterface: (request: EffectEditorRequest) => void;
  onRemoveSubChannel?: (channelId: string) => void;
  selection?: MixerChainSelection | null;
  onSelectionChange?: (selection: MixerChainSelection | null) => void;
  projectEffectNodes?: readonly LibraryBrowseNode[];
  renderMeter?: boolean;
}

interface EffectDialogState {
  mode: 'create' | 'edit';
  chain: MixerChainKind;
  entryId: string;
  snapshot: EffectEditorSnapshot;
}

function getLevelDisplay(level: number): string {
  return `${level.toFixed(2)} dB`;
}

function buildEffectRequest(
  channelId: string,
  entry: MixerEffectEntrySnapshot,
): EffectEditorRequest {
  return entry.projectRef
    ? { ownerType: 'project', effectId: entry.entryId, projectRef: entry.projectRef }
    : entry.libraryRef
      ? { ownerType: 'library', effectId: entry.entryId, libraryRef: entry.libraryRef }
      : {
          ownerType: 'project',
          effectId: entry.entryId,
          projectRef: { channelId, chain: 'pre' as MixerChainKind, entryId: entry.entryId },
        };
}

function createProjectEffectSnapshotFromXml(
  effectXml: string,
  entryId: string,
  projectRef: ProjectEffectRef,
  projectUdos: readonly UdoDefinitionSnapshot[],
): EffectEditorSnapshot {
  const effect = Effect.loadFromXML(Element.parse(effectXml));
  return createEffectEditorSnapshot(effect, entryId, 'project', {
    projectRef,
    projectUdos: [...projectUdos],
  });
}

function applyEffectPatchToSnapshot(
  snapshot: EffectEditorSnapshot,
  patch: EffectEditablePatch,
  projectUdos: readonly UdoDefinitionSnapshot[],
): EffectEditorSnapshot {
  const effect = Effect.loadFromXML(Element.parse(snapshot.effectXml));
  applyEffectEditablePatchToEffect(effect, patch);
  return createEffectEditorSnapshot(effect, snapshot.effectId, snapshot.ownerType, {
    projectRef: snapshot.projectRef,
    libraryRef: snapshot.libraryRef,
    projectUdos: snapshot.ownerType === 'project' ? [...projectUdos] : [],
  });
}

function ChainEntry({ entry }: { entry: MixerChainEntrySnapshot }): React.ReactElement {
  if (entry.kind === 'send') {
    return (
      <div className={cn('mixer-chain-entry', !entry.enabled && 'mixer-chain-entry--disabled')}>
        <span className="mixer-chain-entry__send-icon">S</span>
        <span className="mixer-chain-entry__name">{entry.sendChannel}</span>
      </div>
    );
  }
  return (
    <div className={cn('mixer-chain-entry', !entry.enabled && 'mixer-chain-entry--disabled')}>
      <span className="mixer-chain-entry__name">{entry.name || 'Unnamed'}</span>
    </div>
  );
}

function ChainList({
  label,
  entries,
  channel,
  chain,
  isMaster,
  onPatch,
  onAddNewEffect,
  onOpenEffectInterface,
  onOpenSendEditor,
  onOpenEditEffectDialog,
  projectSessionId,
  projectRevision,
  selection,
  onSelectionChange,
  projectEffectNodes,
}: {
  label: string;
  entries: MixerChainEntrySnapshot[];
  channel: MixerChannelSnapshot;
  chain: MixerChainKind;
  isMaster: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
  onAddNewEffect: (chain: MixerChainKind) => void;
  onOpenEffectInterface: (entry: MixerEffectEntrySnapshot) => void;
  onOpenSendEditor: (entry: MixerSendEntrySnapshot, chain: MixerChainKind) => void;
  onOpenEditEffectDialog: (entry: MixerEffectEntrySnapshot, chain: MixerChainKind) => void;
  projectSessionId: number;
  projectRevision: number;
  selection: MixerChainSelection | null;
  onSelectionChange: (selection: MixerChainSelection | null) => void;
  projectEffectNodes: readonly LibraryBrowseNode[];
}): React.ReactElement {
  const selectedIndex =
    selection?.channelId === channel.id && selection.chain === chain
      ? entries.findIndex((entry) => entry.entryId === selection.entryId)
      : -1;
  const libraryClipboard = useLibraryStore((state) => state.clipboard);
  const transferLibraryItem = useLibraryStore((state) => state.transferToProject);
  const captureClipboard = useLibraryStore((state) => state.captureClipboard);
  const chainRevision = useMemo(
    () => entries.map((candidate) => candidate.entryId).join(':'),
    [entries],
  );
  const libraryTargetChannelId = channel.channelKind === 'subChannel' ? channel.name : channel.id;
  const libraryEffectAvailable = libraryClipboard
    ? getLibraryTransferSourceType(libraryClipboard.source) === 'effect'
    : false;
  const pasteLibraryEffect = useCallback(
    (insertIndex: number) => {
      if (!libraryClipboard || getLibraryTransferSourceType(libraryClipboard.source) !== 'effect')
        return;
      void transferLibraryItem(
        { kind: 'clipboard', source: libraryClipboard.source },
        {
          kind: 'effectChain',
          projectSessionId,
          projectRevision,
          channelId: libraryTargetChannelId,
          chain,
          insertIndex,
          chainRevision,
        },
      );
    },
    [
      chain,
      chainRevision,
      libraryTargetChannelId,
      libraryClipboard,
      projectRevision,
      projectSessionId,
      transferLibraryItem,
    ],
  );

  const handleItemClick = useCallback(
    (index: number) => {
      const entry = entries[index];
      if (!entry) return;
      onSelectionChange(
        selectedIndex === index ? null : { channelId: channel.id, chain, entryId: entry.entryId },
      );
    },
    [chain, channel.id, entries, onSelectionChange, selectedIndex],
  );

  const handleItemDoubleClick = useCallback(
    (index: number) => {
      const entry = entries[index];
      if (!entry) return;
      if (entry.kind === 'effect') {
        onOpenEffectInterface(entry);
      } else {
        onOpenSendEditor(entry, chain);
      }
    },
    [entries, onOpenEffectInterface, onOpenSendEditor, chain],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLocaleLowerCase() === 'v' &&
        libraryEffectAvailable &&
        !isTextEditingTarget(e.target)
      ) {
        e.preventDefault();
        pasteLibraryEffect(selectedIndex >= 0 ? selectedIndex + 1 : entries.length);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(selectedIndex + 1, entries.length - 1);
        const entry = entries[next];
        if (entry) onSelectionChange({ channelId: channel.id, chain, entryId: entry.entryId });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.max(selectedIndex - 1, 0);
        const entry = entries[next];
        if (entry) onSelectionChange({ channelId: channel.id, chain, entryId: entry.entryId });
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        handleItemDoubleClick(selectedIndex);
      }
    },
    [
      chain,
      channel.id,
      entries,
      handleItemDoubleClick,
      libraryEffectAvailable,
      onSelectionChange,
      pasteLibraryEffect,
      selectedIndex,
    ],
  );

  const captureSelectedEffect = useCallback(
    (operation: 'copy' | 'cut') => {
      const selected = entries[selectedIndex];
      if (!selected || selected.kind !== 'effect') return;
      const node = projectEffectNodes.find(
        (candidate) =>
          candidate.key?.scope === 'projectOwned' &&
          candidate.key.locator.kind === 'effect' &&
          candidate.key.locator.channelId === channel.id &&
          candidate.key.locator.chain === chain &&
          candidate.key.locator.entryId === selected.entryId,
      );
      if (node) void captureClipboard(node, operation);
    },
    [captureClipboard, chain, channel.id, entries, projectEffectNodes, selectedIndex],
  );

  const handleInternalDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes(BLUE_MIXER_EFFECT_DRAG_MIME)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleInternalDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const raw = event.dataTransfer.getData(BLUE_MIXER_EFFECT_DRAG_MIME);
      if (!raw) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        const source = JSON.parse(raw) as Partial<MixerChainSelection>;
        const marker = (event.target as HTMLElement).closest<HTMLElement>(
          '[data-mixer-insert-index]',
        );
        const insertIndex = Number(marker?.dataset.mixerInsertIndex ?? entries.length);
        if (
          typeof source.channelId !== 'string' ||
          (source.chain !== 'pre' && source.chain !== 'post') ||
          typeof source.entryId !== 'string' ||
          !Number.isInteger(insertIndex)
        )
          return;
        const sourceIndex =
          source.channelId === channel.id && source.chain === chain
            ? entries.findIndex((entry) => entry.entryId === source.entryId)
            : -1;
        const destinationIndex =
          sourceIndex >= 0 && sourceIndex < insertIndex ? insertIndex - 1 : insertIndex;
        if (sourceIndex === destinationIndex) return;
        onPatch({
          type: 'moveChainEntryAcrossChains',
          fromChannelId: source.channelId,
          fromChain: source.chain,
          toChannelId: channel.id,
          toChain: chain,
          entryId: source.entryId,
          index: destinationIndex,
        });
        onSelectionChange({ channelId: channel.id, chain, entryId: source.entryId });
      } catch {
        return;
      }
    },
    [chain, channel.id, entries.length, onPatch, onSelectionChange],
  );

  return (
    <div className="mixer-chain-section">
      <div className="mixer-chain-label">{label}</div>
      <EffectsChainContextMenu
        entries={entries}
        selectedIndex={selectedIndex}
        chain={chain}
        channelId={channel.id}
        isMaster={isMaster}
        onPatch={onPatch}
        onAddNewEffect={() => onAddNewEffect(chain)}
        onOpenEffectEditor={onOpenEffectInterface}
        onOpenSendEditor={onOpenSendEditor}
        onOpenEditEffectDialog={onOpenEditEffectDialog}
        canPasteLibraryEffect={libraryEffectAvailable}
        onPasteLibraryEffect={() =>
          pasteLibraryEffect(selectedIndex >= 0 ? selectedIndex + 1 : entries.length)
        }
        onProjectClipboardCapture={captureSelectedEffect}
      >
        <div
          className={cn(
            'mixer-chain-list focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:ring-inset',
          )}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          role="listbox"
          aria-label={`${label} chain for ${channel.name}`}
          onDragOverCapture={handleInternalDragOver}
          onDropCapture={handleInternalDrop}
        >
          {entries.map((entry, index) => {
            const projectNode =
              entry.kind === 'effect'
                ? (projectEffectNodes.find(
                    (candidate) =>
                      candidate.key?.scope === 'projectOwned' &&
                      candidate.key.locator.kind === 'effect' &&
                      candidate.key.locator.channelId === channel.id &&
                      candidate.key.locator.chain === chain &&
                      candidate.key.locator.entryId === entry.entryId,
                  ) ?? null)
                : null;
            return (
              <React.Fragment key={entry.entryId}>
                <div data-mixer-insert-index={index}>
                  <LibraryBlockDropMarker
                    target={{
                      kind: 'effectChain',
                      projectSessionId,
                      projectRevision,
                      channelId: libraryTargetChannelId,
                      chain,
                      insertIndex: index,
                      chainRevision,
                    }}
                    label={`Insert Effect before ${entry.kind === 'effect' ? entry.name : entry.sendChannel}`}
                    pasteContextMenu={false}
                  />
                </div>
                <LibraryDropZone
                  target={{
                    kind: 'effectChain',
                    projectSessionId,
                    projectRevision,
                    channelId: libraryTargetChannelId,
                    chain,
                    insertIndex: index + 1,
                    chainRevision,
                  }}
                >
                  {({ active, dropProps }) => (
                    <ProjectLibraryDragSource node={projectNode}>
                      <div
                        {...dropProps}
                        data-library-drop-target="effect-row"
                        className={cn(
                          'mixer-chain-entry-wrapper',
                          index === selectedIndex && 'mixer-chain-entry-wrapper--selected',
                          active && 'ring-1 ring-inset ring-app-accent',
                        )}
                        onClick={() => handleItemClick(index)}
                        onDoubleClick={() => handleItemDoubleClick(index)}
                        role="option"
                        aria-selected={index === selectedIndex}
                        draggable={entry.kind === 'effect'}
                        data-mixer-insert-index={index + 1}
                        onDragStart={(event) => {
                          if (entry.kind !== 'effect') return;
                          event.dataTransfer.setData(
                            BLUE_MIXER_EFFECT_DRAG_MIME,
                            JSON.stringify({
                              channelId: channel.id,
                              chain,
                              entryId: entry.entryId,
                            }),
                          );
                        }}
                      >
                        <ChainEntry entry={entry} />
                      </div>
                    </ProjectLibraryDragSource>
                  )}
                </LibraryDropZone>
              </React.Fragment>
            );
          })}
          <div className="flex min-h-8 flex-1 flex-col" data-mixer-insert-index={entries.length}>
            <LibraryBlockDropMarker
              target={{
                kind: 'effectChain',
                projectSessionId,
                projectRevision,
                channelId: libraryTargetChannelId,
                chain,
                insertIndex: entries.length,
                chainRevision,
              }}
              label={`Insert Effect at end of ${label} chain`}
              fillRemaining
              pasteContextMenu={false}
            />
          </div>
        </div>
      </EffectsChainContextMenu>
    </div>
  );
}

function SendEditorDialog({
  send,
  sendTargets,
  mixer,
  channelId,
  onPatch,
  chain,
  onClose,
}: {
  send: MixerSendEntrySnapshot;
  sendTargets: MixerChannelSnapshot[];
  mixer: MixerSnapshot;
  channelId: string;
  onPatch: (patch: Record<string, unknown>) => void;
  chain: MixerChainKind;
  onClose: () => void;
}): React.ReactElement {
  const levelPercent = Math.round(send.level * 100);

  return (
    <div className="mixer-send-editor-backdrop" onClick={onClose}>
      <div className="mixer-send-editor" onClick={(e) => e.stopPropagation()}>
        <div className="mixer-send-editor__header">Edit Send</div>
        <label className="mixer-send-editor__field">
          <span>Send Channel</span>
          <AppSelect
            value={send.sendChannel}
            onValueChange={(target) => {
              const issue = validateSendTarget(mixer, channelId, target);
              if (issue && issue.severity === 'error') return;
              onPatch({
                type: 'updateSend',
                channelId,
                chain,
                entryId: send.entryId,
                patch: { sendChannel: target },
              });
            }}
            options={sendTargets.map((channel) => ({ value: channel.name, label: channel.name }))}
          />
        </label>
        <label className="mixer-send-editor__field">
          <span>Amount</span>
          <div className="mixer-send-editor__slider-row">
            <span className="mixer-send-editor__slider-bound">0.0</span>
            <input
              type="range"
              min={0}
              max={100}
              value={levelPercent}
              onChange={(e) =>
                onPatch({
                  type: 'updateSend',
                  channelId,
                  chain,
                  entryId: send.entryId,
                  patch: { level: Number(e.target.value) / 100 },
                })
              }
              aria-label={send.sendChannel ? `Send amount for ${send.sendChannel}` : 'Send amount'}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={levelPercent}
              aria-valuetext={send.level.toFixed(2)}
              className="mixer-send-editor__slider"
            />
            <span className="mixer-send-editor__slider-bound">1.0</span>
          </div>
          <div className="mixer-send-editor__level-value">{send.level.toFixed(2)}</div>
        </label>
        <div className="mixer-send-editor__actions">
          <button type="button" className="toolbar-text-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function MixerEffectEditorDialog({
  title,
  snapshot,
  onPatch,
  onConfirm,
  onCancel,
}: {
  title: string;
  snapshot: EffectEditorSnapshot;
  onPatch: (patch: EffectEditablePatch) => void;
  onConfirm: () => void;
  onCancel: () => void;
}): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="flex h-[82vh] w-[88vw] max-w-7xl flex-col overflow-hidden rounded-md border border-blue-border bg-app-input shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-none items-center border-b border-blue-border bg-app-surface-strong px-4 py-3">
          <div className="text-role-headline font-bold text-app-text-strong">{title}</div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <EffectEditorPanel snapshot={snapshot} onPatch={onPatch} />
        </div>

        <div className="flex flex-none items-center justify-end gap-2 border-t border-blue-border bg-app-surface-strong px-4 py-3">
          <button type="button" className="toolbar-text-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="toolbar-text-button" onClick={onConfirm}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

let nextMixerGestureSequence = 1;

export default React.memo(function ChannelStrip({
  mixer,
  channel,
  unnamedDisplayName,
  isMaster,
  isSubChannel,
  onPatch,
  projectSessionId,
  projectRevision,
  onOpenEffectInterface,
  onRemoveSubChannel,
  selection: controlledSelection,
  onSelectionChange: controlledOnSelectionChange,
  projectEffectNodes = [],
  renderMeter = true,
}: ChannelStripProps): React.ReactElement {
  const [localSelection, setLocalSelection] = useState<MixerChainSelection | null>(null);
  const selection = controlledSelection === undefined ? localSelection : controlledSelection;
  const onSelectionChange = controlledOnSelectionChange ?? setLocalSelection;
  const projectUdos = useProjectStore((state) => state.projectUdos);
  const applyProjectDocumentPatch = useProjectStore((state) => state.applyProjectDocumentPatch);
  const flushPendingPatches = useProjectStore((state) => state.flushPendingPatches);
  const hostDocument = useHostDocument({ fallbackToGlobal: true });
  const [editingLevel, setEditingLevel] = useState(false);
  const [levelInput, setLevelInput] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [sendEditorEntryId, setSendEditorEntryId] = useState<string | null>(null);
  const [sendEditorChain, setSendEditorChain] = useState<MixerChainKind>('pre');
  const [effectDialog, setEffectDialog] = useState<EffectDialogState | null>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const levelControlsRef = useRef<HTMLDivElement>(null);
  const [sliderHeight, setSliderHeight] = useState(MIXER_SLIDER_MIN_H);
  const activeGestureRef = useRef<{
    gestureId: string;
    gestureSequence: number;
    baseRevision: number;
    documentId: string;
  } | null>(null);
  const [previewLevel, setPreviewLevel] = useState<number | null>(null);
  const [isSettling, setIsSettling] = useState(false);

  useEffect(() => {
    const el = levelControlsRef.current;
    if (!el) return;

    const updateSliderHeight = () => {
      const nextHeight = Math.max(
        MIXER_SLIDER_MIN_H,
        Math.round(el.getBoundingClientRect().height),
      );
      setSliderHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
    };

    updateSliderHeight();
    if (typeof ResizeObserver === 'undefined') return;
    const resizeObserver = new ResizeObserver(updateSliderHeight);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  const canRename = isSubChannel || channel.association != null;
  const hasExplicitName = channel.name.trim().length > 0;
  const displayName = hasExplicitName ? channel.name : (unnamedDisplayName ?? 'Unnamed');
  const isUsingUnnamedDisplayName = !hasExplicitName && unnamedDisplayName !== undefined;
  const channelNameClassName = cn(
    'mixer-channel-name',
    canRename && 'mixer-channel-name--editable',
    isUsingUnnamedDisplayName && 'mixer-channel-name--fallback',
  );

  const validOutputTargets = useMemo(
    () => getValidOutputTargets(mixer, channel.id),
    [mixer, channel.id],
  );

  const outputRoutingWarning = useMemo(
    () => validateOutputTarget(mixer, channel.id, channel.outChannel),
    [mixer, channel.id, channel.outChannel],
  );

  const validSendTargets = useMemo(
    () => getValidSendTargets(mixer, channel.id),
    [mixer, channel.id],
  );

  const handleSliderPreview = useCallback(
    (levelDb: number) => {
      setPreviewLevel(levelDb);
      const docId = getProjectDocumentId();
      if (!docId) return;

      if (!activeGestureRef.current) {
        activeGestureRef.current = {
          gestureId: crypto.randomUUID(),
          gestureSequence: nextMixerGestureSequence++,
          baseRevision: getProjectDocumentRevision(),
          documentId: docId,
        };
      }

      const gesture = activeGestureRef.current;
      void window.blueAPI.sendMixerRealtimeLevelUpdate({
        documentId: gesture.documentId,
        channelId: channel.id,
        gestureId: gesture.gestureId,
        gestureSequence: gesture.gestureSequence,
        baseRevision: gesture.baseRevision,
        phase: 'preview',
        level: levelDb,
      });
    },
    [channel.id],
  );

  const handleSliderCancel = useCallback(async () => {
    setPreviewLevel(null);
    const gesture = activeGestureRef.current;
    if (!gesture) return;
    activeGestureRef.current = null;

    try {
      await window.blueAPI.sendMixerRealtimeLevelUpdate({
        documentId: gesture.documentId,
        channelId: channel.id,
        gestureId: gesture.gestureId,
        gestureSequence: gesture.gestureSequence,
        baseRevision: gesture.baseRevision,
        phase: 'cancel',
      });
    } catch {
      // Safe fallback
    }
  }, [channel.id]);

  const handleSliderCommit = useCallback(
    (levelDb: number) => {
      const gesture = activeGestureRef.current;
      if (!gesture) {
        setPreviewLevel(null);
        onPatch({
          type: 'updateChannel',
          channelId: channel.id,
          patch: { level: levelDb },
        });
        return;
      }

      activeGestureRef.current = null;
      setIsSettling(true);
      void (async () => {
        try {
          const finishResult = await window.blueAPI.sendMixerRealtimeLevelUpdate({
            documentId: gesture.documentId,
            channelId: channel.id,
            gestureId: gesture.gestureId,
            gestureSequence: gesture.gestureSequence,
            baseRevision: gesture.baseRevision,
            phase: 'finish',
          });

          if (finishResult.status === 'applied') {
            await applyProjectDocumentPatch(
              {
                mixer: {
                  type: 'updateChannel',
                  channelId: channel.id,
                  patch: { level: levelDb },
                },
              },
              {
                label: 'Set Channel Level',
                gestureId: gesture.gestureId,
                fieldId: `mixer:channel:${channel.id}:level`,
                phase: 'end',
                expectedRevision: gesture.baseRevision,
              },
            );
            await flushPendingPatches();
          } else {
            try {
              await window.blueAPI.sendMixerRealtimeLevelUpdate({
                documentId: gesture.documentId,
                channelId: channel.id,
                gestureId: gesture.gestureId,
                gestureSequence: gesture.gestureSequence,
                baseRevision: gesture.baseRevision,
                phase: 'cancel',
              });
            } catch {
              // Safe fallback
            }
          }
        } catch {
          try {
            await window.blueAPI.sendMixerRealtimeLevelUpdate({
              documentId: gesture.documentId,
              channelId: channel.id,
              gestureId: gesture.gestureId,
              gestureSequence: gesture.gestureSequence,
              baseRevision: gesture.baseRevision,
              phase: 'cancel',
            });
          } catch {
            // Safe fallback
          }
        } finally {
          setPreviewLevel(null);
          setIsSettling(false);
        }
      })();
    },
    [applyProjectDocumentPatch, channel.id, flushPendingPatches, onPatch],
  );

  const handleSliderDoubleClick = useCallback(() => {
    setPreviewLevel(null);
    onPatch({ type: 'updateChannel', channelId: channel.id, patch: { level: 0 } });
  }, [channel.id, onPatch]);

  const handleLevelDoubleClick = useCallback(() => {
    setLevelInput(String(channel.level));
    setEditingLevel(true);
  }, [channel.level]);

  const commitLevelEdit = useCallback(() => {
    setEditingLevel((prev) => {
      if (!prev) return false;
      const val = parseFloat(levelInput);
      if (!isNaN(val)) {
        onPatch({
          type: 'updateChannel',
          channelId: channel.id,
          patch: { level: Math.max(-96, Math.min(12, val)) },
        });
      }
      return false;
    });
  }, [channel.id, levelInput, onPatch]);

  useEffect(() => {
    const doc = hostDocument ?? (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    return registerHistoryEditorSettlement(doc, async () => {
      if (editingLevel) {
        commitLevelEdit();
      }
      if (activeGestureRef.current) {
        await handleSliderCancel();
      }
    });
  }, [hostDocument, editingLevel, commitLevelEdit, handleSliderCancel]);

  const handleOutChannelChange = useCallback(
    (target: string) => {
      const issue = validateOutputTarget(mixer, channel.id, target);
      if (issue && issue.severity === 'error') return;
      onPatch({ type: 'updateChannel', channelId: channel.id, patch: { outChannel: target } });
    },
    [mixer, channel.id, onPatch],
  );

  const handleOpenInterface = useCallback(
    (entry: MixerEffectEntrySnapshot) => {
      onOpenEffectInterface(buildEffectRequest(channel.id, entry));
    },
    [channel.id, onOpenEffectInterface],
  );

  const handleOpenSendEditorForEntry = useCallback(
    (entry: MixerSendEntrySnapshot, chain: MixerChainKind) => {
      setSendEditorEntryId(entry.entryId);
      setSendEditorChain(chain);
    },
    [],
  );

  const handleOpenEditDialog = useCallback(
    (entry: MixerEffectEntrySnapshot, chain: MixerChainKind) => {
      const projectRef = entry.projectRef ?? {
        channelId: channel.id,
        chain,
        entryId: entry.entryId,
      };
      setEffectDialog({
        mode: 'edit',
        chain,
        entryId: entry.entryId,
        snapshot: createProjectEffectSnapshotFromXml(
          entry.effectXml,
          entry.entryId,
          projectRef,
          projectUdos,
        ),
      });
    },
    [channel.id, projectUdos],
  );

  const handleAddNewEffectDialog = useCallback(
    (chain: MixerChainKind) => {
      void (async () => {
        const entryId = crypto.randomUUID();
        const effectXml = await createDefaultEffectXml();
        const projectRef = { channelId: channel.id, chain, entryId };
        setEffectDialog({
          mode: 'create',
          chain,
          entryId,
          snapshot: createProjectEffectSnapshotFromXml(effectXml, entryId, projectRef, projectUdos),
        });
      })();
    },
    [channel.id, projectUdos],
  );

  const handleEffectDialogPatch = useCallback(
    (patch: EffectEditablePatch) => {
      setEffectDialog((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          snapshot: applyEffectPatchToSnapshot(current.snapshot, patch, projectUdos),
        };
      });
    },
    [projectUdos],
  );

  const handleConfirmEffectDialog = useCallback(() => {
    if (!effectDialog) {
      return;
    }

    if (effectDialog.mode === 'create') {
      onPatch({
        type: 'addEffectFromLibrary',
        channelId: channel.id,
        chain: effectDialog.chain,
        libraryEffectId: '__new__',
        effectXml: effectDialog.snapshot.effectXml,
        entryId: effectDialog.entryId,
      });
    } else {
      onPatch({
        type: 'updateEffect',
        channelId: channel.id,
        chain: effectDialog.chain,
        entryId: effectDialog.entryId,
        patch: { effectXml: effectDialog.snapshot.effectXml },
      });
    }

    setEffectDialog(null);
  }, [channel.id, effectDialog, onPatch]);

  const handleNameDoubleClick = useCallback(() => {
    if (!canRename) return;
    setNameInput(channel.name);
    setEditingName(true);
  }, [canRename, channel.name]);

  const commitNameEdit = useCallback(() => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== channel.name) {
      onPatch({ type: 'updateChannel', channelId: channel.id, patch: { name: trimmed } });
    }
    setEditingName(false);
  }, [channel.id, channel.name, nameInput, onPatch]);

  const sendEditorEntry = sendEditorEntryId
    ? ([...channel.preChain, ...channel.postChain].find(
        (e): e is MixerSendEntrySnapshot => e.kind === 'send' && e.entryId === sendEditorEntryId,
      ) ?? null)
    : null;

  const handleSelectMeterProfile = useCallback(
    (key: MeterProfileKey) => {
      const current = mixer.meterProfileKey ?? 'peak-rms-mixing-plus-6';
      if (key !== current) {
        onPatch({
          type: 'setMeterProfile',
          value: key,
        });
      }
    },
    [mixer.meterProfileKey, onPatch],
  );

  const handleDisableMeters = useCallback(() => {
    onPatch({
      type: 'setMeterEnabled',
      value: false,
    });
  }, [onPatch]);

  const stripContent = (
    <>
      <div
        className={channelNameClassName}
        title={canRename ? `${displayName} (double-click to rename)` : displayName}
        onDoubleClick={handleNameDoubleClick}
        ref={nameRef}
      >
        {editingName ? (
          <input
            type="text"
            className="mixer-channel-name-input"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitNameEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitNameEdit();
              if (e.key === 'Escape') setEditingName(false);
            }}
            autoFocus
          />
        ) : (
          displayName
        )}
      </div>

      <div className="mixer-strip-ms flex flex-row items-center justify-center gap-1">
        <button
          type="button"
          className={cn(
            'mixer-strip-mute rounded-sm border font-bold',
            channel.muted && 'bg-app-warning text-app-warning-foreground',
          )}
          aria-pressed={channel.muted}
          aria-label={`${displayName} Mute`}
          title={
            !mixer.enabled
              ? 'Mixer is disabled; enable the mixer for mute to affect audio'
              : channel.outputExcludedBySolo
                ? channel.hasIncludedSend
                  ? `${displayName} output is excluded by solo; its send is still audible`
                  : `${displayName} output is excluded by solo`
                : `${displayName} Mute`
          }
          disabled={!mixer.enabled}
          onClick={() =>
            onPatch({
              type: 'updateChannel',
              channelId: channel.id,
              patch: { muted: !channel.muted },
            })
          }
        >
          M
        </button>
        {!isMaster && (
          <button
            type="button"
            className={cn(
              'mixer-strip-solo rounded-sm border font-bold',
              channel.solo && 'bg-app-success text-app-success-foreground',
            )}
            aria-pressed={channel.solo}
            aria-label={`${displayName} Solo`}
            title={
              !mixer.enabled
                ? 'Mixer is disabled; enable the mixer for solo to affect audio'
                : `${displayName} Solo`
            }
            disabled={!mixer.enabled}
            onClick={() =>
              onPatch({
                type: 'updateChannel',
                channelId: channel.id,
                patch: { solo: !channel.solo },
              })
            }
          >
            S
          </button>
        )}
      </div>

      <ChainList
        label="Pre"
        entries={channel.preChain}
        channel={channel}
        chain="pre"
        isMaster={isMaster}
        onPatch={onPatch}
        onAddNewEffect={handleAddNewEffectDialog}
        onOpenEffectInterface={handleOpenInterface}
        onOpenSendEditor={handleOpenSendEditorForEntry}
        onOpenEditEffectDialog={handleOpenEditDialog}
        projectSessionId={projectSessionId}
        projectRevision={projectRevision}
        selection={selection}
        onSelectionChange={onSelectionChange}
        projectEffectNodes={projectEffectNodes}
      />

      <div className="mixer-level-section">
        <div className="mixer-level-label">Level</div>
        {renderMeter && mixer.enableMeters !== false && <PeakReadout stripId={channel.id} />}
        <div
          ref={levelControlsRef}
          className="mixer-level-controls flex flex-row items-center justify-center gap-1.5 flex-1 min-h-[60px] w-full overflow-hidden"
        >
          <MixerLevelSlider
            channelName={displayName}
            levelDb={previewLevel ?? channel.level}
            sliderHeight={sliderHeight}
            disabled={isSettling}
            onPreview={handleSliderPreview}
            onCommit={handleSliderCommit}
            onCancel={handleSliderCancel}
            onDoubleClickReset={handleSliderDoubleClick}
          />
          {renderMeter && mixer.enableMeters !== false && (
            <StripMeterArea
              stripId={channel.id}
              isMaster={isMaster}
              height={sliderHeight}
              profileKey={mixer.meterProfileKey}
              onSelectProfile={handleSelectMeterProfile}
              onDisableMeters={handleDisableMeters}
            />
          )}
        </div>
        <div
          className="mixer-level-value"
          onDoubleClick={handleLevelDoubleClick}
          title="Double-click to edit"
        >
          {editingLevel ? (
            <input
              type="text"
              className="mixer-level-input"
              value={levelInput}
              onChange={(e) => setLevelInput(e.target.value)}
              onBlur={commitLevelEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLevelEdit();
                if (e.key === 'Escape') setEditingLevel(false);
              }}
              autoFocus
            />
          ) : (
            getLevelDisplay(previewLevel ?? channel.level)
          )}
        </div>
      </div>

      <ChainList
        label="Post"
        entries={channel.postChain}
        channel={channel}
        chain="post"
        isMaster={isMaster}
        onPatch={onPatch}
        onAddNewEffect={handleAddNewEffectDialog}
        onOpenEffectInterface={handleOpenInterface}
        onOpenSendEditor={handleOpenSendEditorForEntry}
        onOpenEditEffectDialog={handleOpenEditDialog}
        projectSessionId={projectSessionId}
        projectRevision={projectRevision}
        selection={selection}
        onSelectionChange={onSelectionChange}
        projectEffectNodes={projectEffectNodes}
      />

      {!isMaster && (
        <div className="mixer-output-section">
          <ArrowRight
            className="mixer-output-arrow text-blue-muted flex-shrink-0"
            size={12}
            aria-hidden="true"
          />
          <AppSelect
            className="mixer-output-select"
            value={channel.outChannel}
            onValueChange={handleOutChannelChange}
            title={channel.outChannel}
            aria-label={`Output for ${displayName}`}
            options={validOutputTargets.map((target) => ({
              value: target.name,
              label: target.name,
            }))}
          />
          {outputRoutingWarning && (
            <div className="mixer-routing-warning" title={outputRoutingWarning.message}>
              ⚠
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {isSubChannel ? (
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild>
            <div className="mixer-channel-strip">{stripContent}</div>
          </ContextMenu.Trigger>
          <PopoutContextMenuPortal>
            <ContextMenu.Content className="editor-context-menu">
              <ContextMenu.Item
                className="editor-context-menu__item"
                onSelect={() => onRemoveSubChannel?.(channel.id)}
              >
                Remove SubChannel
              </ContextMenu.Item>
            </ContextMenu.Content>
          </PopoutContextMenuPortal>
        </ContextMenu.Root>
      ) : (
        <div className="mixer-channel-strip">{stripContent}</div>
      )}

      {sendEditorEntry && (
        <SendEditorDialog
          send={sendEditorEntry}
          sendTargets={validSendTargets}
          mixer={mixer}
          channelId={channel.id}
          onPatch={onPatch}
          chain={sendEditorChain}
          onClose={() => setSendEditorEntryId(null)}
        />
      )}

      {effectDialog && (
        <MixerEffectEditorDialog
          title={effectDialog.mode === 'create' ? 'New Effect' : 'Edit Effect Definition'}
          snapshot={effectDialog.snapshot}
          onPatch={handleEffectDialogPatch}
          onConfirm={handleConfirmEffectDialog}
          onCancel={() => setEffectDialog(null)}
        />
      )}
    </>
  );
});
