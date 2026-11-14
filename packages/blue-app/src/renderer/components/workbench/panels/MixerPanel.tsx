import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Settings } from 'lucide-react';

import {
  mixerPatchActionLabel,
  type MixerChannelSnapshot,
  type MixerPatch,
  type MixerSnapshot,
} from '../../../../shared/project-editor';
import {
  getValidOutputTargets,
  validateOutputTarget,
  type MixerRoutingIssue,
} from '../../../../shared/mixer-routing-validation';
import type { LibraryBrowseNode, LibraryItemKey } from '../../../../shared/unified-library';
import { getProjectDocumentRevision, useProjectStore } from '../../../stores/project-store';
import { meterStore } from '../../../stores/meter-store';
import ChannelStrip, { type MixerChainSelection } from './mixer/ChannelStrip';
import { MixerSettingsDialog } from './mixer/MixerSettingsDialog';
import { useProjectLibraryNodes } from '../../libraries/use-project-library-nodes';
import CommitNumberInput from '../../CommitNumberInput';

const EMPTY_EFFECT_NODES: readonly LibraryBrowseNode[] = [];

function collectAllMixerChannels(mixer: MixerSnapshot): MixerChannelSnapshot[] {
  return [
    ...mixer.channelListGroups.flatMap((group) => group.channels),
    ...mixer.channels,
    ...mixer.subChannels,
    mixer.master,
  ];
}

function effectTopologyEntryKey(entry: MixerChannelSnapshot['preChain'][number]): string | null {
  if (entry.kind !== 'effect') return null;
  return `${entry.entryId}:${entry.name}:${entry.enabled ? '1' : '0'}:${entry.numIns}:${entry.numOuts}:${entry.style}:${entry.code}:${entry.comments}:${entry.effectXml ?? ''}`;
}

function buildEffectTopologyKey(channels: readonly MixerChannelSnapshot[]): string {
  return channels
    .map((channel) => {
      const pre = channel.preChain.map(effectTopologyEntryKey).filter(Boolean).join(',');
      const post = channel.postChain.map(effectTopologyEntryKey).filter(Boolean).join(',');
      if (!pre && !post) return `${channel.id}[]`;
      return `${channel.id}:${channel.name}[${pre}|${post}]`;
    })
    .join(';');
}

function buildRoutingTopologyKey(channels: readonly MixerChannelSnapshot[]): string {
  return channels
    .map((channel) => {
      const sends = [...channel.preChain, ...channel.postChain]
        .filter((entry) => entry.kind === 'send')
        .map((entry) => `${entry.sendChannel}:${entry.enabled ? '1' : '0'}`)
        .join(',');
      return `${channel.id}|${channel.channelKind}|${channel.name}|${channel.outChannel}|${sends}`;
    })
    .join(';');
}

function sameOutputTargets(
  prev: MixerChannelSnapshot[] | undefined,
  next: MixerChannelSnapshot[],
): boolean {
  if (!prev || prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (prev[i]!.id !== next[i]!.id || prev[i]!.name !== next[i]!.name) return false;
  }
  return true;
}

function sameRoutingIssue(
  prev: MixerRoutingIssue | null | undefined,
  next: MixerRoutingIssue | null,
): boolean {
  if (prev === next) return true;
  if (!prev || !next) return false;
  return (
    prev.severity === next.severity &&
    prev.code === next.code &&
    prev.message === next.message &&
    prev.targetName === next.targetName
  );
}

function sameStringArray(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function sameLibraryItemKey(a: LibraryItemKey | null, b: LibraryItemKey | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.scope !== b.scope || a.libraryType !== b.libraryType) return false;
  if (a.scope === 'user' || b.scope === 'user') {
    return a.scope === 'user' && b.scope === 'user' && a.nodeId === b.nodeId;
  }
  if (a.projectSessionId !== b.projectSessionId) return false;
  const la = a.locator;
  const lb = b.locator;
  if (la.kind !== lb.kind) return false;
  switch (la.kind) {
    case 'effect':
      return (
        lb.kind === 'effect' &&
        la.channelId === lb.channelId &&
        la.chain === lb.chain &&
        la.entryId === lb.entryId
      );
    case 'instrument':
      return lb.kind === 'instrument' && la.assignmentId === lb.assignmentId;
    case 'udo':
      return (
        lb.kind === 'udo' &&
        la.instrumentAssignmentId === lb.instrumentAssignmentId &&
        la.track?.rootGroupId === lb.track?.rootGroupId &&
        la.track?.trackId === lb.track?.trackId &&
        la.sessionObjectId === lb.sessionObjectId &&
        la.persistedFingerprint.canonicalHash === lb.persistedFingerprint.canonicalHash
      );
    case 'soundObject':
      return (
        lb.kind === 'soundObject' &&
        la.libraryId === lb.libraryId &&
        la.persistedFingerprint.canonicalHash === lb.persistedFingerprint.canonicalHash
      );
  }
}

function sameEffectNodes(
  prev: readonly LibraryBrowseNode[] | undefined,
  next: readonly LibraryBrowseNode[],
): boolean {
  if (!prev || prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    const a = prev[i]!;
    const b = next[i]!;
    if (a === b) continue;
    if (
      a.nodeId !== b.nodeId ||
      a.parentId !== b.parentId ||
      a.libraryType !== b.libraryType ||
      a.scope !== b.scope ||
      a.nodeKind !== b.nodeKind ||
      a.displayName !== b.displayName ||
      a.supportStatus !== b.supportStatus ||
      a.objectType !== b.objectType ||
      a.revision !== b.revision ||
      a.hasChildren !== b.hasChildren ||
      !sameLibraryItemKey(a.key, b.key) ||
      !sameStringArray(a.breadcrumb, b.breadcrumb)
    ) {
      return false;
    }
  }
  return true;
}

export default function MixerPanel(): React.ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const mixer = useProjectStore((state) => state.mixer);
  const setMixerPanning = useProjectStore((state) => state.setMixerPanning);
  const setMixerPanLaw = useProjectStore((state) => state.setMixerPanLaw);
  const setMixerPanBoost = useProjectStore((state) => state.setMixerPanBoost);
  const applyProjectDocumentPatch = useProjectStore((state) => state.applyProjectDocumentPatch);
  const flushPendingPatches = useProjectStore((state) => state.flushPendingPatches);
  const projectSessionId = useProjectStore((state) => state.sessionId);

  const mixerRef = useRef(mixer);
  mixerRef.current = mixer;
  const getMixer = useCallback(() => mixerRef.current, []);

  const allChannels = useMemo(() => collectAllMixerChannels(mixer), [mixer]);
  const effectTopologyKey = useMemo(() => buildEffectTopologyKey(allChannels), [allChannels]);
  const prevEffectTopologyKeyRef = useRef(effectTopologyKey);
  const effectRefreshSeqRef = useRef(0);
  if (prevEffectTopologyKeyRef.current !== effectTopologyKey) {
    prevEffectTopologyKeyRef.current = effectTopologyKey;
    effectRefreshSeqRef.current += 1;
  }

  const projectEffectNodes = useProjectLibraryNodes(
    'projectOwned',
    'effect',
    loaded ? projectSessionId : null,
    effectRefreshSeqRef.current,
  );

  const prevEffectNodesByChannelRef = useRef<Map<string, readonly LibraryBrowseNode[]>>(new Map());
  const effectNodesByChannel = useMemo(() => {
    const grouped = new Map<string, LibraryBrowseNode[]>();
    for (const node of projectEffectNodes) {
      if (node.key?.scope === 'projectOwned' && node.key.locator.kind === 'effect') {
        const channelId = node.key.locator.channelId;
        let list = grouped.get(channelId);
        if (!list) {
          list = [];
          grouped.set(channelId, list);
        }
        list.push(node);
      }
    }
    const prevMap = prevEffectNodesByChannelRef.current;
    const nextMap = new Map<string, readonly LibraryBrowseNode[]>();
    for (const [channelId, nodes] of grouped) {
      const prevNodes = prevMap.get(channelId);
      nextMap.set(channelId, sameEffectNodes(prevNodes, nodes) ? prevNodes! : nodes);
    }
    prevEffectNodesByChannelRef.current = nextMap;
    return nextMap;
  }, [projectEffectNodes]);

  const routingTopologyKey = useMemo(() => buildRoutingTopologyKey(allChannels), [allChannels]);
  const routingCacheRef = useRef<{
    key: string;
    validOutputTargetsByChannelId: Map<string, MixerChannelSnapshot[]>;
    outputRoutingWarningByChannelId: Map<string, MixerRoutingIssue | null>;
  } | null>(null);
  const routingState = useMemo(() => {
    const prev = routingCacheRef.current;
    if (prev && prev.key === routingTopologyKey) {
      return prev;
    }
    const validOutputTargetsByChannelId = new Map<string, MixerChannelSnapshot[]>();
    const outputRoutingWarningByChannelId = new Map<string, MixerRoutingIssue | null>();
    for (const channel of allChannels) {
      const nextTargets = getValidOutputTargets(mixer, channel.id);
      const prevTargets = prev?.validOutputTargetsByChannelId.get(channel.id);
      validOutputTargetsByChannelId.set(
        channel.id,
        sameOutputTargets(prevTargets, nextTargets) ? prevTargets! : nextTargets,
      );
      if (channel.channelKind !== 'master') {
        const nextWarning = validateOutputTarget(mixer, channel.id, channel.outChannel);
        const prevWarning = prev?.outputRoutingWarningByChannelId.get(channel.id);
        outputRoutingWarningByChannelId.set(
          channel.id,
          sameRoutingIssue(prevWarning, nextWarning) ? (prevWarning ?? null) : nextWarning,
        );
      }
    }
    const nextCache = {
      key: routingTopologyKey,
      validOutputTargetsByChannelId,
      outputRoutingWarningByChannelId,
    };
    routingCacheRef.current = nextCache;
    return nextCache;
  }, [allChannels, mixer, routingTopologyKey]);

  const [chainSelection, setChainSelection] = useState<MixerChainSelection | null>(null);

  const [groupRenameDialog, setGroupRenameDialog] = useState<{
    association: string;
    name: string;
  } | null>(null);
  const groupRenameInputRef = useRef<HTMLInputElement>(null);
  const isGroupRenameDialogOpen = groupRenameDialog !== null;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (mixer.enableMeters === false) {
      meterStore.clearAll();
    }
  }, [mixer.enableMeters]);

  const handleMixerPatch = useCallback(
    (patch: Record<string, unknown>) => {
      const mixerPatch = patch as MixerPatch;
      void applyProjectDocumentPatch(
        { mixer: mixerPatch },
        {
          label: mixerPatchActionLabel(mixerPatch),
        },
      );
    },
    [applyProjectDocumentPatch],
  );

  const handleOpenEffectInterface = useCallback(
    (request: {
      ownerType: 'project' | 'library';
      effectId: string;
      projectRef?: { channelId: string; chain: 'pre' | 'post'; entryId: string };
      libraryRef?: { libraryEffectId: string };
    }) => {
      void (async () => {
        await flushPendingPatches();
        const focused = await window.blueAPI.focusEffectEditor(request);
        if (!focused) {
          await window.blueAPI.openEffectInterface(request);
        }
      })();
    },
    [flushPendingPatches],
  );

  const handleRemoveSubChannel = useCallback(
    (channelId: string) => {
      handleMixerPatch({ type: 'removeSubChannel', channelId });
    },
    [handleMixerPatch],
  );

  const openGroupRenameDialog = useCallback((association: string, currentName: string) => {
    setGroupRenameDialog({ association, name: currentName });
  }, []);

  const closeGroupRenameDialog = useCallback(() => {
    setGroupRenameDialog(null);
  }, []);

  const commitGroupRenameDialog = useCallback(() => {
    if (!groupRenameDialog) {
      return;
    }

    const nextName = groupRenameDialog.name.trim();
    if (nextName.length > 0) {
      handleMixerPatch({
        type: 'renameChannelListGroup',
        association: groupRenameDialog.association,
        name: nextName,
      });
    }

    closeGroupRenameDialog();
  }, [groupRenameDialog, handleMixerPatch, closeGroupRenameDialog]);

  useEffect(() => {
    if (!isGroupRenameDialogOpen) {
      return;
    }

    groupRenameInputRef.current?.focus();
    groupRenameInputRef.current?.select();
  }, [isGroupRenameDialogOpen]);

  if (!loaded) {
    return (
      <div className="workbench-panel-shell">
        <div className="workbench-panel-shell__content">
          <div className="flex h-full items-center justify-center text-role-body text-blue-muted">
            No project loaded
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="workbench-panel-shell">
      <div className="workbench-panel-shell__content mixer-panel">
        <div className="mixer-toolbar">
          <label className="mixer-toolbar__check">
            <input
              type="checkbox"
              checked={mixer.enabled}
              onChange={(event) =>
                handleMixerPatch({ type: 'setMixerEnabled', value: event.target.checked })
              }
              className="accent-blue-accent"
            />
            <span>Enabled</span>
          </label>
          <label className="mixer-toolbar__field">
            <span>Extra render time</span>
            <CommitNumberInput
              aria-label="Extra render time"
              value={mixer.extraRenderTime}
              step="any"
              min={0}
              resolveValue={(text) => {
                const parsed = parseFloat(text);
                return Number.isFinite(parsed) && parsed >= 0 ? parsed : mixer.extraRenderTime;
              }}
              onChange={(val) =>
                handleMixerPatch({
                  type: 'updateExtraRenderTime',
                  value: val,
                })
              }
              className="mixer-toolbar__input"
            />
          </label>
          <button
            type="button"
            className="toolbar-text-button"
            onClick={() => handleMixerPatch({ type: 'addSubChannel', name: undefined })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Subchannel
          </button>
          <button
            type="button"
            className="mixer-settings-button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Mixer Settings"
            title="Mixer Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mixer-main">
          <div className="mixer-channels-scroll">
            {mixer.channelListGroups.map((group, index) =>
              group.channels.length > 0 ? (
                <div
                  key={group.association ?? `channel-group-${index}`}
                  className="mixer-channel-group"
                >
                  <div
                    className="mixer-channel-group__header"
                    onDoubleClick={() => {
                      if (!group.association) {
                        return;
                      }
                      openGroupRenameDialog(
                        group.association,
                        group.listName || 'Track Layer Group',
                      );
                    }}
                    title={group.association ? 'Double-click to rename group' : undefined}
                  >
                    {group.listName || 'Track Layer Group'}
                  </div>
                  <div className="mixer-channel-group__strips">
                    {group.channels.map((channel, channelIndex) => (
                      <ChannelStrip
                        key={channel.id}
                        channel={channel}
                        unnamedDisplayName={`Track ${channelIndex + 1}`}
                        isMaster={false}
                        isSubChannel={false}
                        onPatch={handleMixerPatch}
                        projectSessionId={projectSessionId}
                        getMixer={getMixer}
                        getProjectRevision={getProjectDocumentRevision}
                        mixerEnabled={mixer.enabled}
                        enableMeters={mixer.enableMeters !== false}
                        meterProfileKey={mixer.meterProfileKey}
                        validOutputTargets={routingState.validOutputTargetsByChannelId.get(
                          channel.id,
                        )}
                        outputRoutingWarning={
                          routingState.outputRoutingWarningByChannelId.get(channel.id) ?? null
                        }
                        panningEnabled={mixer.panningEnabled}
                        onOpenEffectInterface={handleOpenEffectInterface}
                        selection={chainSelection?.channelId === channel.id ? chainSelection : null}
                        onSelectionChange={setChainSelection}
                        projectEffectNodes={
                          effectNodesByChannel.get(channel.id) ?? EMPTY_EFFECT_NODES
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null,
            )}
            {mixer.channels.length > 0 && (
              <div className="mixer-channel-group">
                <div className="mixer-channel-group__header">Orchestra</div>
                <div className="mixer-channel-group__strips">
                  {mixer.channels.map((channel) => (
                    <ChannelStrip
                      key={channel.id}
                      channel={channel}
                      isMaster={false}
                      isSubChannel={false}
                      onPatch={handleMixerPatch}
                      projectSessionId={projectSessionId}
                      getMixer={getMixer}
                      getProjectRevision={getProjectDocumentRevision}
                      mixerEnabled={mixer.enabled}
                      enableMeters={mixer.enableMeters !== false}
                      meterProfileKey={mixer.meterProfileKey}
                      validOutputTargets={routingState.validOutputTargetsByChannelId.get(
                        channel.id,
                      )}
                      outputRoutingWarning={
                        routingState.outputRoutingWarningByChannelId.get(channel.id) ?? null
                      }
                      panningEnabled={mixer.panningEnabled}
                      onOpenEffectInterface={handleOpenEffectInterface}
                      selection={chainSelection?.channelId === channel.id ? chainSelection : null}
                      onSelectionChange={setChainSelection}
                      projectEffectNodes={
                        effectNodesByChannel.get(channel.id) ?? EMPTY_EFFECT_NODES
                      }
                    />
                  ))}
                </div>
              </div>
            )}
            {mixer.subChannels.length > 0 && (
              <div className="mixer-channel-group">
                <div className="mixer-channel-group__header">Subchannels</div>
                <div className="mixer-channel-group__strips">
                  {mixer.subChannels.map((channel) => (
                    <ChannelStrip
                      key={channel.id}
                      channel={channel}
                      isMaster={false}
                      isSubChannel
                      onPatch={handleMixerPatch}
                      projectSessionId={projectSessionId}
                      getMixer={getMixer}
                      getProjectRevision={getProjectDocumentRevision}
                      mixerEnabled={mixer.enabled}
                      enableMeters={mixer.enableMeters !== false}
                      meterProfileKey={mixer.meterProfileKey}
                      validOutputTargets={routingState.validOutputTargetsByChannelId.get(
                        channel.id,
                      )}
                      outputRoutingWarning={
                        routingState.outputRoutingWarningByChannelId.get(channel.id) ?? null
                      }
                      panningEnabled={mixer.panningEnabled}
                      onOpenEffectInterface={handleOpenEffectInterface}
                      selection={chainSelection?.channelId === channel.id ? chainSelection : null}
                      onSelectionChange={setChainSelection}
                      projectEffectNodes={
                        effectNodesByChannel.get(channel.id) ?? EMPTY_EFFECT_NODES
                      }
                      onRemoveSubChannel={handleRemoveSubChannel}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mixer-master-strip">
            <ChannelStrip
              channel={mixer.master}
              isMaster
              isSubChannel={false}
              onPatch={handleMixerPatch}
              projectSessionId={projectSessionId}
              getMixer={getMixer}
              getProjectRevision={getProjectDocumentRevision}
              mixerEnabled={mixer.enabled}
              enableMeters={mixer.enableMeters !== false}
              meterProfileKey={mixer.meterProfileKey}
              validOutputTargets={routingState.validOutputTargetsByChannelId.get(mixer.master.id)}
              outputRoutingWarning={null}
              panningEnabled={mixer.panningEnabled}
              onOpenEffectInterface={handleOpenEffectInterface}
              selection={chainSelection?.channelId === mixer.master.id ? chainSelection : null}
              onSelectionChange={setChainSelection}
              projectEffectNodes={effectNodesByChannel.get(mixer.master.id) ?? EMPTY_EFFECT_NODES}
            />
          </div>
        </div>
      </div>

      <MixerSettingsDialog
        isOpen={isSettingsOpen}
        enableMeters={mixer.enableMeters !== false}
        mixer={mixer}
        onToggleEnableMeters={(enabled) => {
          const current = mixer.enableMeters !== false;
          if (enabled === current) return;
          handleMixerPatch({
            type: 'setMeterEnabled',
            value: enabled,
          });
        }}
        onToggleEnablePanning={setMixerPanning}
        onPanLawChange={setMixerPanLaw}
        onPanBoostChange={setMixerPanBoost}
        onClose={() => setIsSettingsOpen(false)}
      />

      {groupRenameDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeGroupRenameDialog}
        >
          <div
            className="w-90 rounded-lg border border-blue-border/50 bg-blue-bg shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-blue-border/30 px-4 py-3 text-role-headline font-bold text-blue-text">
              Edit Track Layer Group Name
            </div>
            <div className="px-4 py-3">
              <input
                ref={groupRenameInputRef}
                className="w-full rounded-sm border border-blue-accent/40 bg-blue-surface/60 px-2 py-1 text-role-body text-blue-text outline-none"
                value={groupRenameDialog.name}
                onChange={(event) => {
                  setGroupRenameDialog((prev) =>
                    prev ? { ...prev, name: event.target.value } : prev,
                  );
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    commitGroupRenameDialog();
                  }
                  if (event.key === 'Escape') {
                    closeGroupRenameDialog();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-blue-border/30 px-4 py-3">
              <button
                type="button"
                className="rounded border border-blue-border/50 bg-blue-surface/40 px-3 py-1 text-role-body text-blue-muted hover:text-blue-text"
                onClick={closeGroupRenameDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded border border-blue-accent/60 bg-blue-accent/30 px-3 py-1 text-role-body text-blue-text"
                onClick={commitGroupRenameDialog}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
