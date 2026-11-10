import { BlueSynthBuilder, Effect, TrackLayerGroup, Sound, type BlueData } from '@blue/data';
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
  captureProjectGraphDelta,
  isNetZeroProjectGraphDelta,
  type ProjectGraphDelta,
} from './project-history-graph';

type Owner = BlueSynthBuilder | Effect;
export interface PreparedBsbTransaction {
  readonly kind: 'bsb';
  readonly delta: ProjectGraphDelta;
  readonly changed: boolean;
  readonly patchChanged: boolean[];
  readonly patchAccepted: boolean[];
  apply(): void;
}

/** BSB-only batches prepare detached owners; every BSB operation uses the same graph delta. */
export function prepareBsbTransaction(
  data: BlueData,
  patches: readonly ProjectDocumentPatch[],
  context?: ProjectDocumentPatchContext,
): PreparedBsbTransaction | null {
  const owners = new Map<Owner, Owner>();
  const patchChanged: boolean[] = [];
  for (const patch of patches) {
    if (Object.keys(patch).length !== 1) return null;
    let owner: Owner | undefined;
    let edit: InstrumentPatch | EffectEditablePatch;
    if (patch.orchestra?.type === 'updateInstrument') {
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
      candidate = owner.deepCopy('history') as Owner;
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
  const rootId = getHistoryNodeId(data);
  const delta: ProjectGraphDelta = {
    rootId,
    fields: [],
    contents: [],
    metadata: [],
    beforeNodes: [],
    afterNodes: [],
  };
  for (const [before, after] of owners) {
    const part = captureProjectGraphDelta(before, after);
    delta.fields.push(...part.fields);
    delta.contents.push(...part.contents);
    delta.metadata.push(...part.metadata);
    delta.beforeNodes.push(...part.beforeNodes);
    delta.afterNodes.push(...part.afterNodes);
  }
  return {
    kind: 'bsb',
    delta,
    changed: !isNetZeroProjectGraphDelta(delta),
    patchChanged,
    patchAccepted: patches.map(() => true),
    apply: () => applyProjectGraphDelta(data, delta, 'after'),
  };
}
