import React, { useCallback, useMemo, useRef, useState } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
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
} from '../../../../../shared/project-editor';
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
import EffectEditorPanel from '../../../effect-editor/EffectEditorPanel';
import { createDefaultEffectXml } from '../../../../utils/program-settings-defaults';
import EffectsChainContextMenu from './EffectsChainContextMenu';

const MIXER_SLIDER_WIDTH = 32;
const MIXER_TRACK_W = 4;
const MIXER_THUMB_R = 7;
const MIXER_SLIDER_MIN_H = 60;

interface ChannelStripProps {
  mixer: MixerSnapshot;
  channel: MixerChannelSnapshot;
  isMaster: boolean;
  isSubChannel: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
  onOpenLibrary: (channelId: string, chain: MixerChainKind, insertIndex: number) => void;
  onOpenEffectInterface: (request: EffectEditorRequest) => void;
  onRemoveSubChannel?: (channelId: string) => void;
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

function getSliderValue(level: number): number {
  return level > 0 ? level * 20 : level * 10;
}

function sliderToLevel(rawValue: number): number {
  return rawValue > 0 ? rawValue / 20 : rawValue / 10;
}

function buildEffectRequest(channelId: string, entry: MixerEffectEntrySnapshot): EffectEditorRequest {
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
): EffectEditorSnapshot {
  const effect = Effect.loadFromXML(Element.parse(effectXml));
  return createEffectEditorSnapshot(effect, entryId, 'project', { projectRef });
}

function applyEffectPatchToSnapshot(
  snapshot: EffectEditorSnapshot,
  patch: EffectEditablePatch,
): EffectEditorSnapshot {
  const effect = Effect.loadFromXML(Element.parse(snapshot.effectXml));
  applyEffectEditablePatchToEffect(effect, patch);
  return createEffectEditorSnapshot(effect, snapshot.effectId, snapshot.ownerType, {
    projectRef: snapshot.projectRef,
    libraryRef: snapshot.libraryRef,
  });
}

function ChainEntry({ entry }: { entry: MixerChainEntrySnapshot }): React.ReactElement {
  if (entry.kind === 'send') {
    return (
      <div className={`mixer-chain-entry ${!entry.enabled ? 'mixer-chain-entry--disabled' : ''}`}>
        <span className="mixer-chain-entry__send-icon">S</span>
        <span className="mixer-chain-entry__name">{entry.sendChannel}</span>
      </div>
    );
  }
  return (
    <div className={`mixer-chain-entry ${!entry.enabled ? 'mixer-chain-entry--disabled' : ''}`}>
      <span className="mixer-chain-entry__name">{entry.name || 'Unnamed'}</span>
    </div>
  );
}

function MixerLevelSlider({
  value,
  min,
  max,
  onChange,
  onInput,
  onDoubleClick,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInput: (e: React.FormEvent<HTMLInputElement>) => void;
  onDoubleClick: () => void;
}): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const sliderHeight = MIXER_SLIDER_MIN_H;
  const range = max - min || 1;
  const pct = Math.max(0, Math.min(1, (value - min) / range));
  const trackX = MIXER_SLIDER_WIDTH / 2 - MIXER_TRACK_W / 2;
  const thumbCy = MIXER_THUMB_R + (sliderHeight - 2 * MIXER_THUMB_R) * (1 - pct);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!hiddenInputRef.current) return;
      hiddenInputRef.current.focus();
      hiddenInputRef.current.value = String(value);

      const startY = e.clientY;
      const startVal = value;

      const onMouseMove = (me: MouseEvent) => {
        const dy = startY - me.clientY;
        const newVal = Math.max(min, Math.min(max, startVal + dy * (range / (sliderHeight - 2 * MIXER_THUMB_R))));
        const clamped = Math.round(newVal);
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = String(clamped);
        }
        const fakeEvent = {
          target: { value: String(clamped) },
          currentTarget: { value: String(clamped) },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(fakeEvent);
        const fakeInputEvent = {
          target: hiddenInputRef.current,
        } as unknown as React.FormEvent<HTMLInputElement>;
        onInput(fakeInputEvent);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [value, min, max, range, sliderHeight, onChange, onInput],
  );

  return (
    <div className="mixer-level-slider-wrapper" style={{ width: MIXER_SLIDER_WIDTH }}>
      <svg
        ref={svgRef}
        width={MIXER_SLIDER_WIDTH}
        height={sliderHeight}
        className="block cursor-pointer"
        onMouseDown={handleMouseDown}
        onDoubleClick={onDoubleClick}
      >
        <rect
          x={trackX}
          y={MIXER_THUMB_R}
          width={MIXER_TRACK_W}
          height={sliderHeight - 2 * MIXER_THUMB_R}
          rx={2}
          ry={2}
          fill="rgb(63,102,150)"
        />
        <rect
          x={trackX}
          y={thumbCy}
          width={MIXER_TRACK_W}
          height={sliderHeight - MIXER_THUMB_R - thumbCy}
          rx={2}
          ry={2}
          fill="rgb(102,177,253)"
        />
        <circle
          cx={MIXER_SLIDER_WIDTH / 2}
          cy={thumbCy}
          r={MIXER_THUMB_R}
          fill="rgb(102,177,253)"
        />
        <circle
          cx={MIXER_SLIDER_WIDTH / 2}
          cy={thumbCy}
          r={MIXER_THUMB_R - 2}
          fill="rgb(38,51,76)"
        />
      </svg>
      <input
        ref={hiddenInputRef}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        onInput={onInput}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
      />
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
  onOpenLibrary,
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
  onOpenLibrary: () => void;
}): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const handleItemClick = useCallback((index: number) => {
    setSelectedIndex((prev) => (prev === index ? -1 : index));
  }, []);

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
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, entries.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        handleItemDoubleClick(selectedIndex);
      }
    },
    [entries.length, selectedIndex, handleItemDoubleClick],
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
        onOpenLibrary={onOpenLibrary}
      >
        <div
          className="mixer-chain-list"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          role="listbox"
          aria-label={`${label} chain for ${channel.name}`}
        >
          {entries.length === 0 ? (
            <div className="mixer-chain-empty">&nbsp;</div>
          ) : (
            entries.map((entry, index) => (
              <div
                key={entry.entryId}
                className={`mixer-chain-entry-wrapper ${index === selectedIndex ? 'mixer-chain-entry-wrapper--selected' : ''}`}
                onClick={() => handleItemClick(index)}
                onDoubleClick={() => handleItemDoubleClick(index)}
                role="option"
                aria-selected={index === selectedIndex}
              >
                <ChainEntry entry={entry} />
              </div>
            ))
          )}
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
          <select
            value={send.sendChannel}
            onChange={(e) => {
              const target = e.target.value;
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
          >
            {sendTargets.map((ch) => (
              <option key={ch.id} value={ch.name}>{ch.name}</option>
            ))}
          </select>
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
              className="mixer-send-editor__slider"
            />
            <span className="mixer-send-editor__slider-bound">1.0</span>
          </div>
          <div className="mixer-send-editor__level-value">
            {send.level.toFixed(2)}
          </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="flex h-[82vh] w-[88vw] max-w-7xl flex-col overflow-hidden rounded-md border border-blue-border bg-app-input shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-none items-center border-b border-blue-border bg-app-surface-strong px-4 py-3">
          <div className="text-sm font-medium text-app-text-strong">{title}</div>
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

export default function ChannelStrip({
  mixer,
  channel,
  isMaster,
  isSubChannel,
  onPatch,
  onOpenLibrary,
  onOpenEffectInterface,
  onRemoveSubChannel,
}: ChannelStripProps): React.ReactElement {
  const [editingLevel, setEditingLevel] = useState(false);
  const [levelInput, setLevelInput] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [sendEditorEntryId, setSendEditorEntryId] = useState<string | null>(null);
  const [sendEditorChain, setSendEditorChain] = useState<MixerChainKind>('pre');
  const [effectDialog, setEffectDialog] = useState<EffectDialogState | null>(null);
  const nameRef = useRef<HTMLDivElement>(null);

  const sliderValue = getSliderValue(channel.level);
  const canRename = isSubChannel || channel.association != null;

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

  const handleLevelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = Number(e.target.value);
      onPatch({ type: 'updateChannel', channelId: channel.id, patch: { level: sliderToLevel(raw) } });
    },
    [channel.id, onPatch],
  );

  const handleLevelInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const raw = Number((e.target as HTMLInputElement).value);
      const level = sliderToLevel(raw);
      void window.blueAPI.sendMixerRealtimeLevelUpdate({ channelId: channel.id, level });
    },
    [channel.id],
  );

  const handleSliderDoubleClick = useCallback(() => {
    onPatch({ type: 'updateChannel', channelId: channel.id, patch: { level: 0 } });
  }, [channel.id, onPatch]);

  const handleLevelDoubleClick = useCallback(() => {
    setLevelInput(String(channel.level));
    setEditingLevel(true);
  }, [channel.level]);

  const commitLevelEdit = useCallback(() => {
    const val = parseFloat(levelInput);
    if (!isNaN(val)) {
      onPatch({ type: 'updateChannel', channelId: channel.id, patch: { level: Math.max(-96, Math.min(12, val)) } });
    }
    setEditingLevel(false);
  }, [channel.id, levelInput, onPatch]);

  const handleOutChannelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const target = e.target.value;
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
      const projectRef = entry.projectRef ?? { channelId: channel.id, chain, entryId: entry.entryId };
      setEffectDialog({
        mode: 'edit',
        chain,
        entryId: entry.entryId,
        snapshot: createProjectEffectSnapshotFromXml(entry.effectXml, entry.entryId, projectRef),
      });
    },
    [channel.id],
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
          snapshot: createProjectEffectSnapshotFromXml(effectXml, entryId, projectRef),
        });
      })();
    },
    [channel.id],
  );

  const handleEffectDialogPatch = useCallback((patch: EffectEditablePatch) => {
    setEffectDialog((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        snapshot: applyEffectPatchToSnapshot(current.snapshot, patch),
      };
    });
  }, []);

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
    ? [...channel.preChain, ...channel.postChain].find(
        (e): e is MixerSendEntrySnapshot => e.kind === 'send' && e.entryId === sendEditorEntryId,
      ) ?? null
    : null;

  const stripContent = (
    <>
      <div
        className={`mixer-channel-name ${canRename ? 'mixer-channel-name--editable' : ''}`}
        title={canRename ? `${channel.name} (double-click to rename)` : channel.name}
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
          channel.name || 'Unnamed'
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
        onOpenLibrary={() => onOpenLibrary(channel.id, 'pre', channel.preChain.length)}
      />

      <div className="mixer-level-section">
        <div className="mixer-level-label">Level</div>
        <MixerLevelSlider
          value={sliderValue}
          min={-960}
          max={240}
          onChange={handleLevelChange}
          onInput={handleLevelInput}
          onDoubleClick={handleSliderDoubleClick}
        />
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
            getLevelDisplay(channel.level)
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
        onOpenLibrary={() => onOpenLibrary(channel.id, 'post', channel.postChain.length)}
      />

      {!isMaster && (
        <div className="mixer-output-section">
          <div className="mixer-output-label">Output</div>
          <select
            className="mixer-output-select"
            value={channel.outChannel}
            onChange={handleOutChannelChange}
          >
            {validOutputTargets.map((ch) => (
              <option key={ch.id} value={ch.name}>{ch.name}</option>
            ))}
          </select>
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
            <div className="mixer-channel-strip">
              {stripContent}
            </div>
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Content className="editor-context-menu">
              <ContextMenu.Item
                className="editor-context-menu__item"
                onSelect={() => onRemoveSubChannel?.(channel.id)}
              >
                Remove SubChannel
              </ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ) : (
        <div className="mixer-channel-strip">
          {stripContent}
        </div>
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
}
