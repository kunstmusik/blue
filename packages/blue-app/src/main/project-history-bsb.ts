import {
  BlueSynthBuilder,
  Effect,
  TrackLayerGroup,
  Sound,
  type BlueData,
  type Instrument,
} from '@blue/data';
import type {
  ProjectDocumentPatch,
  ProjectDocumentPatchContext,
  InstrumentPatch,
  EffectEditablePatch,
} from '../shared/project-editor/contract';
import { findMixerChannelById } from '../shared/project-editor';
import {
  getMixerEntrySnapshotId,
  readGraphEditorMetadata,
  restoreGraphEditorMetadata,
} from '../shared/project-editor/identity';
import {
  getHistoryNodeId,
  transferHistoryNodeIds,
} from '../shared/project-editor/history-node-identity';
import { applyInstrumentPatch } from '../shared/project-editor/snapshot-mixer-orchestra';
import { applyEffectEditablePatchToEffect } from '../shared/project-editor/patch-mixer-bluelive';
import { resolveEditorTarget } from '../shared/project-editor/snapshot-score';
import {
  applyProjectGraphDelta,
  captureProjectGraphDeltaWithSnapshots,
  isNetZeroProjectGraphDelta,
  type GraphSnapshot,
  type ProjectGraphDelta,
} from './project-history-graph';

type BsbOwner = BlueSynthBuilder | Effect;
type IsolatedOwner = Instrument | Effect;

interface OwnerGraphEntry {
  owner: IsolatedOwner;
  delta: ProjectGraphDelta;
  beforeSnapshot: GraphSnapshot;
  afterSnapshot: GraphSnapshot;
}

export interface PreparedBsbTransaction {
  readonly kind: 'bsb';
  readonly delta: ProjectGraphDelta;
  readonly changed: boolean;
  readonly patchChanged: boolean[];
  readonly patchAccepted: boolean[];
  apply(): void;
  getGroupingEndpointSnapshot(): GraphSnapshot;
}

export interface PreparedIsolatedStructureResult {
  readonly delta: ProjectGraphDelta;
  readonly changed: boolean;
  readonly patchChanged: boolean[];
  readonly patchAccepted: boolean[];
  apply(): void;
  getGroupingEndpointSnapshot(): GraphSnapshot;
}

function finalizeOwnerDeltas(
  data: BlueData,
  owners: Map<IsolatedOwner, IsolatedOwner>,
): {
  delta: ProjectGraphDelta;
  changed: boolean;
  apply(): void;
  getGroupingEndpointSnapshot(): GraphSnapshot;
} {
  const rootId = getHistoryNodeId(data);
  const delta: ProjectGraphDelta = {
    rootId,
    fields: [],
    contents: [],
    metadata: [],
    beforeNodes: [],
    afterNodes: [],
  };
  const ownerApplies: OwnerGraphEntry[] = [];
  for (const [before, after] of owners) {
    const {
      delta: part,
      beforeSnapshot,
      afterSnapshot,
    } = captureProjectGraphDeltaWithSnapshots(before, after);
    delta.fields.push(...part.fields);
    delta.contents.push(...part.contents);
    delta.metadata.push(...part.metadata);
    delta.beforeNodes.push(...part.beforeNodes);
    delta.afterNodes.push(...part.afterNodes);
    ownerApplies.push({ owner: before, delta: part, beforeSnapshot, afterSnapshot });
  }
  return {
    delta,
    changed: !isNetZeroProjectGraphDelta(delta),
    apply: () => {
      for (const item of ownerApplies) {
        applyProjectGraphDelta(item.owner, item.delta, 'after', item.beforeSnapshot);
      }
    },
    getGroupingEndpointSnapshot: () => {
      const nodes = new Map() as GraphSnapshot['nodes'];
      const objects = new Map<number, object>();
      for (const item of ownerApplies) {
        for (const [id, node] of item.afterSnapshot.nodes) nodes.set(id, node);
        for (const [id, obj] of item.afterSnapshot.objects) objects.set(id, obj);
      }
      return { nodes, objects };
    },
  };
}

/** BSB-only batches prepare detached owners; every BSB operation uses the same graph delta. */
export function prepareBsbTransaction(
  data: BlueData,
  patches: readonly ProjectDocumentPatch[],
  context?: ProjectDocumentPatchContext,
): PreparedBsbTransaction | null {
  const owners = new Map<BsbOwner, BsbOwner>();
  const patchChanged: boolean[] = [];
  for (const patch of patches) {
    if (Object.keys(patch).length !== 1) return null;
    let owner: BsbOwner | undefined;
    let edit: InstrumentPatch | EffectEditablePatch;
    if (patch.orchestra?.type === 'updateInstrument') {
      if (patch.orchestra.patch.name !== undefined) {
        return null;
      }
      const found = data.getArrangement().getInstrumentById(patch.orchestra.assignmentId);
      if (!(found instanceof BlueSynthBuilder)) return null;
      owner = found;
      edit = patch.orchestra.patch;
    } else if (patch.score?.type === 'updateTrackInstrument') {
      const ref = patch.score.track;
      if (
        ref.projectSessionId !== context?.projectSessionId ||
        ref.projectRevision !== context?.projectRevision
      )
        return null;
      const group = data
        .getScore()
        .find(
          (group) => group instanceof TrackLayerGroup && group.getUniqueId() === ref.rootGroupId,
        );
      const found =
        group instanceof TrackLayerGroup
          ? group.find((track) => track.getUniqueId() === ref.trackId)?.getInstrument()
          : undefined;
      if (!(found instanceof BlueSynthBuilder)) return null;
      owner = found;
      edit = patch.score.patch;
    } else if (patch.mixer?.type === 'updateEffect') {
      const effect = patch.mixer;
      const channel = findMixerChannelById(data.getMixer(), effect.channelId);
      const found = (
        effect.chain === 'pre' ? channel?.getPreEffects() : channel?.getPostEffects()
      )?.find((entry) => getMixerEntrySnapshotId(entry) === effect.entryId);
      if (!(found instanceof Effect)) return null;
      owner = found;
      edit = effect.patch;
    } else if (
      patch.score?.type === 'updateTypeSpecificEditor' &&
      Object.keys(patch.score.patch).length === 1 &&
      patch.score.patch.bsbInterfacePatch
    ) {
      const resolved = resolveEditorTarget(data, patch.score.target);
      if (!(resolved?.sObj instanceof Sound)) return null;
      owner = resolved.sObj.getBlueSynthBuilder();
      edit = {
        bsbInterface: patch.score.patch.bsbInterfacePatch as NonNullable<
          InstrumentPatch['bsbInterface']
        >,
      };
    } else return null;
    if (
      Object.keys(edit).length !== 1 ||
      !(
        ('bsbInterface' in edit && edit.bsbInterface) ||
        ('bsbWidgetValues' in edit && edit.bsbWidgetValues)
      )
    )
      return null;
    let candidate = owners.get(owner);
    if (!candidate) {
      candidate = owner.deepCopy('history') as BsbOwner;
      transferHistoryNodeIds(owner, candidate, (a, b) =>
        restoreGraphEditorMetadata(b, readGraphEditorMetadata(a)),
      );
      owners.set(owner, candidate);
    }
    const before = candidate.saveAsXML().toXml();
    if (candidate instanceof Effect) applyEffectEditablePatchToEffect(candidate, edit);
    else applyInstrumentPatch(candidate, edit);
    if (candidate instanceof BlueSynthBuilder) candidate.getParameters();
    patchChanged.push(before !== candidate.saveAsXML().toXml());
  }
  const finalized = finalizeOwnerDeltas(data, owners);
  return {
    kind: 'bsb',
    ...finalized,
    patchChanged,
    patchAccepted: patches.map(() => true),
  };
}

/**
 * Prepares isolated single-owner instrument/effect edits (code, comments, properties, BlueX7,
 * Effect edits without XML replacement) by cloning only the target subtree instead of the full project.
 */
export function prepareIsolatedOwnerStructureTransaction(
  data: BlueData,
  patches: readonly ProjectDocumentPatch[],
  context?: ProjectDocumentPatchContext,
): PreparedIsolatedStructureResult | null {
  if (patches.length === 0) return null;
  const owners = new Map<IsolatedOwner, IsolatedOwner>();
  const patchChanged: boolean[] = [];

  for (const patch of patches) {
    if (Object.keys(patch).length !== 1) return null;
    let owner: IsolatedOwner | undefined;
    let candidate: IsolatedOwner | undefined;
    const ensureCandidate = (source: IsolatedOwner): IsolatedOwner => {
      let copy = owners.get(source);
      if (!copy) {
        copy = source.deepCopy('history') as IsolatedOwner;
        transferHistoryNodeIds(source, copy, (a, b) =>
          restoreGraphEditorMetadata(b, readGraphEditorMetadata(a)),
        );
        owners.set(source, copy);
      }
      return copy;
    };

    if (patch.orchestra?.type === 'updateInstrument') {
      if (patch.orchestra.patch.name !== undefined) {
        return null;
      }
      const found = data.getArrangement().getInstrumentById(patch.orchestra.assignmentId);
      if (patch.orchestra.patch.bsbInterface && !(found instanceof BlueSynthBuilder)) {
        throw new Error(
          `BSB instrument '${patch.orchestra.assignmentId}' no longer exists; edit rejected`,
        );
      }
      if (!found) {
        patchChanged.push(false);
        continue;
      }
      owner = found;
      candidate = ensureCandidate(owner);
      patchChanged.push(applyInstrumentPatch(candidate as Instrument, patch.orchestra.patch));
    } else if (patch.orchestra?.type === 'updateInstrumentComment') {
      const found = data.getArrangement().getInstrumentById(patch.orchestra.assignmentId);
      if (!found) {
        patchChanged.push(false);
        continue;
      }
      owner = found;
      candidate = ensureCandidate(owner);
      const changed = (candidate as Instrument).getComment() !== patch.orchestra.comment;
      if (changed) (candidate as Instrument).setComment(patch.orchestra.comment);
      patchChanged.push(changed);
    } else if (patch.score?.type === 'updateTrackInstrument') {
      const ref = patch.score.track;
      if (
        ref.projectSessionId !== context?.projectSessionId ||
        ref.projectRevision !== context?.projectRevision
      ) {
        return null;
      }
      const group = data
        .getScore()
        .find((g) => g instanceof TrackLayerGroup && g.getUniqueId() === ref.rootGroupId);
      const found =
        group instanceof TrackLayerGroup
          ? group.find((track) => track.getUniqueId() === ref.trackId)?.getInstrument()
          : undefined;
      if (!found) {
        patchChanged.push(false);
        continue;
      }
      if (patch.score.patch.bsbInterface && !(found instanceof BlueSynthBuilder)) {
        return null;
      }
      owner = found;
      candidate = ensureCandidate(owner);
      patchChanged.push(applyInstrumentPatch(candidate as Instrument, patch.score.patch));
    } else if (patch.mixer?.type === 'updateEffect') {
      const effectPatch = patch.mixer;
      if (effectPatch.patch.effectXml !== undefined) return null;
      const channel = findMixerChannelById(data.getMixer(), effectPatch.channelId);
      const found = (
        effectPatch.chain === 'pre' ? channel?.getPreEffects() : channel?.getPostEffects()
      )?.find((entry) => getMixerEntrySnapshotId(entry) === effectPatch.entryId);
      if (!(found instanceof Effect)) {
        patchChanged.push(false);
        continue;
      }
      owner = found;
      candidate = ensureCandidate(owner);
      patchChanged.push(applyEffectEditablePatchToEffect(candidate as Effect, effectPatch.patch));
    } else {
      return null;
    }
  }

  const finalized = finalizeOwnerDeltas(data, owners);
  return {
    ...finalized,
    patchChanged,
    patchAccepted: patches.map(() => true),
  };
}
