import {
  BSBGroup,
  BSBWidget,
  Effect,
  PolyObject,
  TrackLayerGroup,
  type BlueData,
  type Channel,
} from '@blue/data';
import type { EngineBridge } from './engine-bridge';
import type { ProjectDocumentCommitMetadata } from '../shared/project-history';
import {
  createBsbRealtimeControlUpdate,
  createEffectEditorSnapshot,
  createEffectEditorViewSnapshot,
  createProjectUdoListSnapshot,
  createTrackInstrumentEditorSnapshot,
  findMixerChannelById,
  getMixerEntrySnapshotId,
  type EffectEditorPatchRequest,
  type EffectEditorRequest,
  type EffectEditorSnapshot,
  type ProjectDocumentCommitReceipt,
  type ProjectDocumentPatch,
  type TrackInstrumentEditorPatchRequest,
  type TrackInstrumentEditorPatchResult,
  type TrackInstrumentEditorRequest,
  type TrackInstrumentEditorSnapshot,
} from '../shared/project-editor';
import { closeEffectEditorWindow } from './effect-editor-window-manager';
import {
  closeTrackInstrumentEditorWindowsForGroup,
  closeTrackInstrumentEditorWindowsForTrack,
} from './track-instrument-editor-window-manager';

export interface SecondaryEditorCoordinatorDeps {
  getCurrentData: () => BlueData | null;
  getCurrentProjectSessionId: () => number;
  getCurrentProjectRevision: () => number;
  getEngineBridge: () => EngineBridge | null;
  isBlueLiveRunning: () => boolean;
  commitProjectDocumentPatchBatch: (
    patches: ProjectDocumentPatch[],
    options?: ProjectDocumentCommitMetadata & { expectedRevision?: number },
  ) => Promise<ProjectDocumentCommitReceipt>;
  syncEngineWithProjectPatch: (data: BlueData, patch: ProjectDocumentPatch) => Promise<void>;
}

export interface ProjectEffectEntryMatch {
  channel: Channel;
  chain: ReturnType<Channel['getPreEffects']>;
  entry: Effect;
  effectId: string;
}

export interface SecondaryEditorCoordinator {
  captureSecondaryWindowPublishedSnapshot: (
    hasEffectWindows: boolean,
    trackTargets: readonly { rootGroupId: string; trackId: string }[],
  ) => unknown;
  getProjectMixerChannelBySnapshotId: (channelId: string) => Channel | null;
  getProjectEffectEntryByRequest: (request: EffectEditorRequest) => ProjectEffectEntryMatch | null;
  getProjectEffectEditorSnapshot: (request: EffectEditorRequest) => EffectEditorSnapshot | null;
  trackInstrumentRequestIsCurrent: (request: TrackInstrumentEditorRequest) => boolean;
  getTrackInstrumentEditorSnapshot: (
    request: TrackInstrumentEditorRequest,
  ) => TrackInstrumentEditorSnapshot | null;
  getCurrentTrackInstrumentEditorSnapshot: (
    request: TrackInstrumentEditorRequest,
  ) => TrackInstrumentEditorSnapshot | null;
  applyTrackInstrumentEditorPatch: (
    request: TrackInstrumentEditorPatchRequest,
  ) => Promise<TrackInstrumentEditorPatchResult>;
  computeInterfaceBounds: (effect: Effect) => { maxW: number; maxH: number };
  applyProjectEffectEditorPatch: (
    request: EffectEditorPatchRequest,
  ) => Promise<EffectEditorSnapshot | null>;
  maybeCloseRemovedProjectEffectEditors: (patch: ProjectDocumentPatch) => void;
  maybeCloseRemovedTrackInstrumentEditors: (patch: ProjectDocumentPatch) => void;
}

function getWidgetSize(widget: BSBWidget, ctor: string): { width: number; height: number } {
  const w = widget as unknown as {
    valueDisplayEnabled?: unknown;
    knobWidth?: unknown;
    labelEnabled?: unknown;
    sliderHeight?: unknown;
    sliderWidth?: unknown;
    width?: unknown;
    height?: unknown;
  };
  const vde = w.valueDisplayEnabled === true;

  switch (ctor) {
    case 'BSBKnob': {
      const kw = typeof w.knobWidth === 'number' ? w.knobWidth : 60;
      const le = w.labelEnabled === true;
      return { width: kw, height: kw + (le ? 16 : 0) + (vde ? 14 : 0) };
    }
    case 'BSBVSlider': {
      const sh = typeof w.sliderHeight === 'number' ? w.sliderHeight : 150;
      return { width: 50, height: sh + (vde ? 30 : 0) };
    }
    case 'BSBHSlider': {
      const sw = typeof w.sliderWidth === 'number' ? w.sliderWidth : 150;
      return { width: sw + (vde ? 50 : 0), height: 30 };
    }
    case 'BSBXYController': {
      const cw = typeof w.width === 'number' ? w.width : 100;
      const ch = typeof w.height === 'number' ? w.height : 100;
      return { width: cw + (vde ? 50 : 0), height: ch + (vde ? 30 : 0) };
    }
    default:
      return {
        width: typeof w.width === 'number' ? w.width : 50,
        height: typeof w.height === 'number' ? w.height : 24,
      };
  }
}

function computeInterfaceBounds(effect: Effect): { maxW: number; maxH: number } {
  let maxW = 1;
  let maxH = 1;
  const gi = effect.getGraphicInterface();
  const rootGroup = gi.getRootGroup();

  const visit = (widgets: BSBWidget[]) => {
    for (const widget of widgets) {
      if (widget instanceof BSBGroup) {
        visit(widget.getChildren());
        continue;
      }
      const ctor = widget.constructor.name;
      const size = getWidgetSize(widget, ctor);
      maxW = Math.max(maxW, widget.x + size.width);
      maxH = Math.max(maxH, widget.y + size.height);
    }
  };

  visit(rootGroup.getChildren());
  return { maxW, maxH };
}

function findTrackLayerGroupById(
  groups: readonly unknown[],
  groupId: string,
): TrackLayerGroup | null {
  for (const candidate of groups) {
    if (candidate instanceof TrackLayerGroup) {
      const trackGroup = candidate as TrackLayerGroup;
      if (trackGroup.getUniqueId() === groupId) return trackGroup;
    }
    if (candidate instanceof PolyObject) {
      const nested = findTrackLayerGroupById(candidate as readonly unknown[], groupId);
      if (nested) return nested;
    }
  }
  return null;
}

export function createSecondaryEditorCoordinator(
  deps: SecondaryEditorCoordinatorDeps,
): SecondaryEditorCoordinator {
  function captureSecondaryWindowPublishedSnapshot(
    hasEffectWindows: boolean,
    trackTargets: readonly { rootGroupId: string; trackId: string }[],
  ): unknown {
    const data = deps.getCurrentData();
    if (!data) return null;
    const projectUdos = createProjectUdoListSnapshot(data);
    if (trackTargets.length === 0) {
      return hasEffectWindows ? { projectUdos } : null;
    }

    const groupsByRootId = new Map<
      string,
      {
        groupId: string;
        groupType: 'track';
        layers: Array<{
          layerId: string;
          instrument: {
            snapshot: NonNullable<
              ReturnType<typeof createTrackInstrumentEditorSnapshot>
            >['instrument'];
          };
        }>;
      }
    >();

    for (const target of trackTargets) {
      const trackSnapshot = createTrackInstrumentEditorSnapshot(data, {
        track: {
          rootGroupId: target.rootGroupId,
          trackId: target.trackId,
          projectSessionId: deps.getCurrentProjectSessionId(),
          projectRevision: deps.getCurrentProjectRevision(),
        },
      });
      if (!trackSnapshot) continue;
      let group = groupsByRootId.get(target.rootGroupId);
      if (!group) {
        group = { groupId: target.rootGroupId, groupType: 'track', layers: [] };
        groupsByRootId.set(target.rootGroupId, group);
      }
      if (!group.layers.some((layer) => layer.layerId === target.trackId)) {
        group.layers.push({
          layerId: target.trackId,
          instrument: { snapshot: trackSnapshot.instrument },
        });
      }
    }

    return {
      projectUdos,
      score: {
        layerGroups: [...groupsByRootId.values()],
      },
    };
  }

  function getProjectMixerChannelBySnapshotId(channelId: string): Channel | null {
    const data = deps.getCurrentData();
    if (!data) {
      return null;
    }

    return findMixerChannelById(data.getMixer(), channelId);
  }

  function getProjectEffectEntryByRequest(
    request: EffectEditorRequest,
  ): ProjectEffectEntryMatch | null {
    const data = deps.getCurrentData();
    if (!data || request.ownerType !== 'project' || !request.projectRef) {
      return null;
    }

    const channel = getProjectMixerChannelBySnapshotId(request.projectRef.channelId);
    if (!channel) {
      return null;
    }

    const chain =
      request.projectRef.chain === 'pre' ? channel.getPreEffects() : channel.getPostEffects();
    const index = chain.findIndex(
      (entry) => getMixerEntrySnapshotId(entry) === request.projectRef?.entryId,
    );
    if (index < 0) {
      return null;
    }

    const entry = chain[index];
    if (!(entry instanceof Effect)) {
      return null;
    }

    return {
      channel,
      chain,
      entry,
      effectId: request.projectRef.entryId,
    };
  }

  function getProjectEffectEditorSnapshot(
    request: EffectEditorRequest,
  ): EffectEditorSnapshot | null {
    const result = getProjectEffectEntryByRequest(request);
    if (!result) {
      return null;
    }

    const data = deps.getCurrentData();
    const createSnapshot =
      request.includeSerializedXml === false
        ? createEffectEditorViewSnapshot
        : createEffectEditorSnapshot;
    return createSnapshot(result.entry, result.effectId, 'project', {
      projectRef: request.projectRef,
      projectUdos: data ? createProjectUdoListSnapshot(data) : [],
    });
  }

  function trackInstrumentRequestIsCurrent(request: TrackInstrumentEditorRequest): boolean {
    const { projectSessionId, projectRevision } = request.track;
    return (
      projectSessionId === deps.getCurrentProjectSessionId() &&
      projectRevision === deps.getCurrentProjectRevision()
    );
  }

  function getCurrentTrackInstrumentEditorSnapshot(
    request: TrackInstrumentEditorRequest,
  ): TrackInstrumentEditorSnapshot | null {
    const data = deps.getCurrentData();
    if (!data || request.track.projectSessionId !== deps.getCurrentProjectSessionId()) return null;

    return createTrackInstrumentEditorSnapshot(data, {
      track: {
        ...request.track,
        projectSessionId: deps.getCurrentProjectSessionId(),
        projectRevision: deps.getCurrentProjectRevision(),
      },
    });
  }

  function getTrackInstrumentEditorSnapshot(
    request: TrackInstrumentEditorRequest,
  ): TrackInstrumentEditorSnapshot | null {
    if (!deps.getCurrentData() || !trackInstrumentRequestIsCurrent(request)) return null;

    return getCurrentTrackInstrumentEditorSnapshot(request);
  }

  async function applyTrackInstrumentEditorPatch(
    request: TrackInstrumentEditorPatchRequest,
  ): Promise<TrackInstrumentEditorPatchResult> {
    const data = deps.getCurrentData();
    if (!data) {
      return { status: 'unavailable', snapshot: null };
    }
    const currentSnapshot = getCurrentTrackInstrumentEditorSnapshot(request);
    if (!currentSnapshot) {
      return { status: 'unavailable', snapshot: null };
    }
    if (!trackInstrumentRequestIsCurrent(request)) {
      return { status: 'stale', snapshot: currentSnapshot };
    }

    const patch: ProjectDocumentPatch = {
      score: {
        type: 'updateTrackInstrument',
        track: currentSnapshot.track,
        patch: request.patch,
      },
    };

    const receipt = await deps.commitProjectDocumentPatchBatch([patch], {
      label: request.historyContext?.label ?? 'Update Track Instrument',
      gestureId: request.historyContext?.gestureId,
      fieldId: request.historyContext?.fieldId,
      phase: request.historyContext?.phase,
      expectedRevision: request.track.projectRevision,
      operationId: request.historyContext?.operationId,
      contextSequence: request.historyContext?.contextSequence,
      barrierId: request.historyContext?.barrierId,
      origin: request.historyContext
        ? {
            contextId: request.historyContext.contextId,
            viewId: request.historyContext.viewId,
            selection: request.historyContext.selection,
          }
        : undefined,
    });

    if (!receipt.changed) {
      return { status: 'unchanged', snapshot: currentSnapshot };
    }

    const directRealtimeUpdate = request.patch.bsbInterface
      ? createBsbRealtimeControlUpdate(
          {
            track: {
              projectSessionId: deps.getCurrentProjectSessionId(),
              rootGroupId: request.track.rootGroupId,
              trackId: request.track.trackId,
            },
          },
          request.patch.bsbInterface,
        )
      : undefined;
    const engineBridge = deps.getEngineBridge();
    if (!directRealtimeUpdate && (engineBridge?.isCurrentlyPlaying() || deps.isBlueLiveRunning())) {
      const updatedData = deps.getCurrentData();
      if (updatedData) {
        try {
          await deps.syncEngineWithProjectPatch(updatedData, patch);
        } catch (error) {
          console.error('[main] Failed to sync Track instrument editor patch:', error);
        }
      }
    }
    return {
      status: 'applied',
      snapshot: getTrackInstrumentEditorSnapshot({
        track: {
          ...request.track,
          projectSessionId: deps.getCurrentProjectSessionId(),
          projectRevision: deps.getCurrentProjectRevision(),
        },
      }),
    };
  }

  async function applyProjectEffectEditorPatch(
    request: EffectEditorPatchRequest,
  ): Promise<EffectEditorSnapshot | null> {
    if (!deps.getCurrentData()) {
      return null;
    }

    if (request.ownerType === 'library') {
      return null;
    }

    const effectEntry = getProjectEffectEntryByRequest(request);
    if (!effectEntry || !request.projectRef) {
      return null;
    }

    const patch: ProjectDocumentPatch = {
      mixer: {
        type: 'updateEffect',
        channelId: request.projectRef.channelId,
        chain: request.projectRef.chain,
        entryId: request.projectRef.entryId,
        patch: request.patch,
      },
    };

    await deps.commitProjectDocumentPatchBatch([patch], {
      label: request.historyContext?.label ?? 'Update Effect',
      gestureId: request.historyContext?.gestureId,
      fieldId: request.historyContext?.fieldId,
      phase: request.historyContext?.phase,
      expectedRevision: request.historyContext?.expectedRevision,
      operationId: request.historyContext?.operationId,
      contextSequence: request.historyContext?.contextSequence,
      barrierId: request.historyContext?.barrierId,
      origin: request.historyContext
        ? {
            contextId: request.historyContext.contextId,
            viewId: request.historyContext.viewId,
            selection: request.historyContext.selection,
          }
        : undefined,
    });

    const updatedEntry = getProjectEffectEntryByRequest(request);
    if (!updatedEntry) {
      return null;
    }

    const engineBridge = deps.getEngineBridge();
    if (engineBridge?.isCurrentlyPlaying() && request.patch.bsbInterface) {
      const params = updatedEntry.entry.getParameters();
      for (const param of params) {
        const varName = param.getCompilationVarName();
        if (varName) {
          void engineBridge.setChannel(varName, param.getValue(0)).catch(() => {});
        }
      }
    }

    const data = deps.getCurrentData();
    const createSnapshot =
      request.includeSerializedXml === false
        ? createEffectEditorViewSnapshot
        : createEffectEditorSnapshot;
    return createSnapshot(updatedEntry.entry, updatedEntry.effectId, 'project', {
      projectRef: request.projectRef,
      projectUdos: data ? createProjectUdoListSnapshot(data) : [],
    });
  }

  function maybeCloseRemovedProjectEffectEditors(patch: ProjectDocumentPatch): void {
    if (!patch.mixer || !deps.getCurrentData()) {
      return;
    }

    if (patch.mixer.type !== 'removeChainEntry') {
      return;
    }

    const channel = getProjectMixerChannelBySnapshotId(patch.mixer.channelId);
    if (!channel) {
      return;
    }

    const chain = patch.mixer.chain === 'pre' ? channel.getPreEffects() : channel.getPostEffects();
    const { entryId } = patch.mixer;
    const removed = chain.find((entry) => getMixerEntrySnapshotId(entry) === entryId);
    if (!removed || !(removed instanceof Effect)) {
      return;
    }

    closeEffectEditorWindow({
      ownerType: 'project',
      effectId: entryId,
      projectRef: {
        channelId: patch.mixer.channelId,
        chain: patch.mixer.chain,
        entryId,
      },
    });
  }

  function maybeCloseRemovedTrackInstrumentEditors(patch: ProjectDocumentPatch): void {
    const scorePatch = patch.score;
    const data = deps.getCurrentData();
    if (!scorePatch || !data) return;

    if (scorePatch.type === 'removeLayerGroup') {
      closeTrackInstrumentEditorWindowsForGroup(scorePatch.groupId);
      return;
    }

    if (
      scorePatch.type === 'clearTrackInstrument' ||
      scorePatch.type === 'replaceTrackInstrument'
    ) {
      closeTrackInstrumentEditorWindowsForTrack(
        scorePatch.track.rootGroupId,
        scorePatch.track.trackId,
      );
      return;
    }

    if (scorePatch.type === 'removeLayerRanges') {
      const removedCountByGroup = new Map<string, number>();
      for (const r of scorePatch.ranges) {
        const group = findTrackLayerGroupById(data.getScore(), r.groupId);
        if (group) {
          const startIndex = Math.max(0, r.startIndex);
          const endIndex = Math.min(group.length - 1, r.endIndex);
          for (let i = startIndex; i <= endIndex; i++) {
            const track = group[i];
            if (track) {
              closeTrackInstrumentEditorWindowsForTrack(group.getUniqueId(), track.getUniqueId());
            }
          }
          if (endIndex >= startIndex) {
            removedCountByGroup.set(
              r.groupId,
              (removedCountByGroup.get(r.groupId) ?? 0) + endIndex - startIndex + 1,
            );
          }
        }
      }
      if (scorePatch.deleteEmptyLayerGroups) {
        for (const [groupId, removedCount] of removedCountByGroup) {
          const group = findTrackLayerGroupById(data.getScore(), groupId);
          if (group && group.length > 0 && removedCount >= group.length) {
            closeTrackInstrumentEditorWindowsForGroup(groupId);
          }
        }
      }
      return;
    }

    if (scorePatch.type !== 'removeLayer') return;
    const group = findTrackLayerGroupById(data.getScore(), scorePatch.groupId);
    const track = group?.[scorePatch.layerIndex];
    if (track) {
      closeTrackInstrumentEditorWindowsForTrack(group.getUniqueId(), track.getUniqueId());
    }
  }

  return {
    captureSecondaryWindowPublishedSnapshot,
    getProjectMixerChannelBySnapshotId,
    getProjectEffectEntryByRequest,
    getProjectEffectEditorSnapshot,
    trackInstrumentRequestIsCurrent,
    getTrackInstrumentEditorSnapshot,
    getCurrentTrackInstrumentEditorSnapshot,
    applyTrackInstrumentEditorPatch,
    computeInterfaceBounds,
    applyProjectEffectEditorPatch,
    maybeCloseRemovedProjectEffectEditors,
    maybeCloseRemovedTrackInstrumentEditors,
  };
}
