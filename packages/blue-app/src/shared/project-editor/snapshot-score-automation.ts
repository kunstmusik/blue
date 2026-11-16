import { PolyObject, Score, TrackLayer, TrackLayerGroup, getBlueX7Descriptor } from '@blue/data';
import type {
  Parameter as BlueDataParameter,
  AutomatableLayer as BlueDataAutomatableLayer,
  Arrangement as BlueDataArrangement,
  Mixer as BlueDataMixer,
  ProjectParameterEntry,
} from '@blue/data';
import type {
  AutomationLayerKind,
  AutomationTargetSourceKind,
  AutomationParameterSnapshot,
  AutomationAssignmentState,
  AutomationTargetSnapshot,
  AutomationTargetGroupSnapshot,
  ScoreLayerAutomationSnapshot,
} from './contract';
import { assignLayerGroupId } from './identity';

export interface ParameterMetadata {
  targetPath: string[];
  sourceKind: AutomationTargetSourceKind;
}

export function buildParameterMetadataMap(
  arrangement: BlueDataArrangement,
  mixer: BlueDataMixer,
  projectParameterCatalog: readonly ProjectParameterEntry[] = [],
): Map<string, ParameterMetadata> {
  const metadataMap = new Map<string, ParameterMetadata>();

  for (const ia of arrangement.getArrangement()) {
    if (!ia.instr) continue;
    const instr = ia.instr as any;
    if (typeof instr.getParameters !== 'function') continue;
    const instrParams = instr.getParameters();
    if (!instrParams || !Array.isArray(instrParams)) continue;
    const instrId = ia.arrangementId;
    const instrSegment = instrId.startsWith('instr ') ? instrId : `instr ${instrId}`;
    for (const param of instrParams) {
      if (!param) continue;
      const paramName = param.getName() || param.getLabel() || param.getUniqueId();
      metadataMap.set(param.getUniqueId(), {
        targetPath: [instrSegment, paramName],
        sourceKind: 'instrument',
      });
    }
  }

  function indexChannel(channel: any, channelPath: string[]) {
    if (!channel) return;
    const levelParam = channel.getLevelParameter?.();
    if (levelParam) {
      metadataMap.set(levelParam.getUniqueId(), {
        targetPath: [...channelPath, 'Volume'],
        sourceKind: 'mixer',
      });
    }

    const preEffects = channel.getPreEffects?.();
    if (preEffects && preEffects.length > 0) {
      for (const effect of preEffects) {
        const effectName =
          typeof (effect as any).getSendChannel === 'function'
            ? `Send: ${(effect as any).getSendChannel()}`
            : effect.getName?.() || 'Effect';
        const params = effect.getParameters?.() ?? [];
        for (const param of params) {
          if (!param) continue;
          const paramName = param.getName() || param.getLabel() || param.getUniqueId();
          metadataMap.set(param.getUniqueId(), {
            targetPath: [...channelPath, 'Pre-Effects', effectName, paramName],
            sourceKind: 'mixer',
          });
        }
      }
    }

    const postEffects = channel.getPostEffects?.();
    if (postEffects && postEffects.length > 0) {
      for (const effect of postEffects) {
        const effectName =
          typeof (effect as any).getSendChannel === 'function'
            ? `Send: ${(effect as any).getSendChannel()}`
            : effect.getName?.() || 'Effect';
        const params = effect.getParameters?.() ?? [];
        for (const param of params) {
          if (!param) continue;
          const paramName = param.getName() || param.getLabel() || param.getUniqueId();
          metadataMap.set(param.getUniqueId(), {
            targetPath: [...channelPath, 'Post-Effects', effectName, paramName],
            sourceKind: 'mixer',
          });
        }
      }
    }
  }

  if (mixer) {
    for (const channel of mixer.getAllSourceChannels()) {
      const channelName = channel.getName?.() || 'Channel';
      indexChannel(channel, ['Mixer', channelName]);
    }
    for (const channel of mixer.getSubChannels()) {
      const channelName = channel.getName?.() || 'SubChannel';
      indexChannel(channel, ['Mixer', channelName]);
    }
    if (mixer.getMaster()) {
      indexChannel(mixer.getMaster(), ['Mixer', 'Master']);
    }
  }

  for (const entry of projectParameterCatalog) {
    const parameter = entry.parameter;
    const descriptor = getBlueX7Descriptor(parameter.getName());
    if (!descriptor && metadataMap.has(parameter.getUniqueId())) continue;
    metadataMap.set(parameter.getUniqueId(), {
      targetPath: descriptor
        ? [...entry.path, descriptor.group, descriptor.label]
        : [...entry.path, parameter.getLabel() || parameter.getName()],
      sourceKind: entry.ownerKind === 'mixer' ? 'mixer' : 'instrument',
    });
  }

  return metadataMap;
}

function buildAutomationParameterSnapshot(
  param: BlueDataParameter,
  metadata?: ParameterMetadata,
): AutomationParameterSnapshot {
  const name = param.getName();
  const label = param.getLabel();
  return {
    parameterId: param.getUniqueId(),
    name,
    label,
    displayName: label || name || param.getUniqueId(),
    minimum: param.getMinimum(),
    maximum: param.getMaximum(),
    resolutionDecimal: param.getResolutionText(),
    resolution: param.getResolution(),
    curve: param.getCurve(),
    fixedValue: param.getFixedValue(),
    automationEnabled: param.isAutomationEnabled(),
    lineColor: param.getLineColor(),
    sourceKind: metadata?.sourceKind ?? resolveParameterSourceKind(param),
    targetPath: metadata?.targetPath ?? (name ? [name] : []),
    points: param.getPoints().map((p) => ({ time: p.time, value: p.value })),
  };
}

export function buildParameterMap(
  allParameters: BlueDataParameter[],
): Map<string, BlueDataParameter> {
  const paramMap = new Map<string, BlueDataParameter>();
  for (const p of allParameters) {
    paramMap.set(p.getUniqueId(), p);
  }
  return paramMap;
}

export function collectLayerAutomationSnapshot(
  layerId: string,
  layerKind: AutomationLayerKind,
  automatableLayer: BlueDataAutomatableLayer,
  allParameters: BlueDataParameter[],
  assignedElsewhere: Map<string, { layerId: string; layerName: string }>,
  layerGroupId: string,
  arrangement: BlueDataArrangement,
  mixer: BlueDataMixer,
  projectParameterCatalog: readonly ProjectParameterEntry[] = [],
  prepared?: {
    paramMap?: Map<string, BlueDataParameter>;
    metadataMap?: Map<string, ParameterMetadata>;
  },
): ScoreLayerAutomationSnapshot | undefined {
  const paramIdList = automatableLayer.getAutomationParameters();
  const assignedIds = paramIdList.getIds();

  const paramMap = prepared?.paramMap ?? buildParameterMap(allParameters);

  const metadataMap =
    prepared?.metadataMap ?? buildParameterMetadataMap(arrangement, mixer, projectParameterCatalog);

  const resolvedParameters: AutomationParameterSnapshot[] = [];
  const missingParameterIds: string[] = [];

  for (const id of assignedIds) {
    const param = paramMap.get(id);
    if (param) {
      resolvedParameters.push(buildAutomationParameterSnapshot(param, metadataMap.get(id)));
    } else {
      missingParameterIds.push(id);
    }
  }

  const selectedIdx = paramIdList.getSelectedIndex();
  const selectedParameterId =
    selectedIdx >= 0 && selectedIdx < assignedIds.length ? assignedIds[selectedIdx] : undefined;

  const targetGroups =
    layerKind === 'track'
      ? buildTrackAutomationTargetGroups(
          automatableLayer,
          assignedIds,
          assignedElsewhere,
          mixer,
          layerGroupId,
          projectParameterCatalog,
        )
      : buildAutomationTargetGroups(
          assignedIds,
          allParameters,
          assignedElsewhere,
          arrangement,
          mixer,
          projectParameterCatalog,
        );

  return {
    layerId,
    layerKind,
    parameterIds: assignedIds,
    selectedParameterId,
    parameters: resolvedParameters,
    targetGroups,
    missingParameterIds,
  };
}

function buildBlueX7TargetGroups(
  entries: readonly ProjectParameterEntry[],
  makeTarget: (parameter: BlueDataParameter) => AutomationTargetSnapshot,
): AutomationTargetGroupSnapshot[] {
  const groups = new Map<string, AutomationTargetGroupSnapshot>();
  for (const entry of entries) {
    const descriptor = getBlueX7Descriptor(entry.parameter.getName());
    if (!descriptor) continue;
    let group = groups.get(descriptor.group);
    if (!group) {
      group = {
        groupId: `${entry.ownerIdentity}:${descriptor.group}`,
        label: descriptor.group,
        subGroups: [],
        targets: [],
      };
      groups.set(descriptor.group, group);
    }
    group.targets.push(makeTarget(entry.parameter));
  }
  return [...groups.values()];
}

function buildAutomationTargetGroups(
  currentLayerAssignedIds: string[],
  allParameters: BlueDataParameter[],
  assignedElsewhere: Map<string, { layerId: string; layerName: string }>,
  arrangement: BlueDataArrangement,
  mixer: BlueDataMixer,
  projectParameterCatalog: readonly ProjectParameterEntry[] = [],
): AutomationTargetGroupSnapshot[] {
  const rootGroups: AutomationTargetGroupSnapshot[] = [];

  const paramMap = new Map<string, BlueDataParameter>();
  const catalogById = new Map(
    projectParameterCatalog.map((entry) => [entry.parameter.getUniqueId(), entry]),
  );
  for (const p of allParameters) {
    paramMap.set(p.getUniqueId(), p);
  }

  function getAssignmentState(id: string): {
    assignmentState: AutomationAssignmentState;
    ownerLayerId?: string;
    ownerLayerName?: string;
  } {
    if (currentLayerAssignedIds.includes(id)) {
      return { assignmentState: 'assignedCurrentLayer' };
    }
    const elsewhere = assignedElsewhere.get(id);
    if (elsewhere) {
      return {
        assignmentState: 'assignedOtherLayer',
        ownerLayerId: elsewhere.layerId,
        ownerLayerName: elsewhere.layerName,
      };
    }
    return { assignmentState: 'available' };
  }

  function makeTarget(param: BlueDataParameter): AutomationTargetSnapshot {
    const id = param.getUniqueId();
    const { assignmentState, ownerLayerId, ownerLayerName } = getAssignmentState(id);
    const catalogEntry = catalogById.get(id);
    const descriptor = getBlueX7Descriptor(param.getName());
    return {
      parameterId: id,
      label: descriptor?.label ?? (param.getLabel() || param.getName() || id),
      sourceKind: resolveParameterSourceKind(param),
      automationEnabled: param.isAutomationEnabled(),
      assignmentState,
      semanticKey: descriptor?.key,
      ownerIdentity: catalogEntry?.ownerIdentity,
      locationLabel: catalogEntry?.ownerLabel,
      updateClass: descriptor?.updateClass,
      ownerLayerId,
      ownerLayerName,
    };
  }

  // ─── Instrument group ───
  const instrGroup: AutomationTargetGroupSnapshot = {
    groupId: 'instrument',
    label: 'Instrument',
    subGroups: [],
    targets: [],
  };

  for (const ia of arrangement.getArrangement()) {
    if (!ia.enabled || !ia.instr) continue;
    const instr = ia.instr as any;
    if (typeof instr.getParameters !== 'function') continue;
    const ownerIdentity = `arrangement:${ia.arrangementId}`;
    const ownerEntries = projectParameterCatalog.filter(
      (entry) => entry.ownerIdentity === ownerIdentity,
    );
    const instrParams =
      ownerEntries.length > 0
        ? ownerEntries.map((entry) => entry.parameter)
        : instr.getParameters();
    if (!instrParams || !Array.isArray(instrParams) || instrParams.length === 0) continue;

    const instrSubGroup: AutomationTargetGroupSnapshot = {
      groupId: `instr-${ia.arrangementId}`,
      label:
        ownerEntries[0]?.ownerLabel ??
        `${ia.arrangementId}) ${(ia.instr as any).getName?.() ?? 'Instrument'}`,
      subGroups: buildBlueX7TargetGroups(ownerEntries, makeTarget),
      targets: ownerEntries.some((entry) => getBlueX7Descriptor(entry.parameter.getName()))
        ? []
        : instrParams
            .slice()
            .sort((a: BlueDataParameter, b: BlueDataParameter) =>
              a.getName().localeCompare(b.getName()),
            )
            .map((p: BlueDataParameter) => makeTarget(p)),
    };
    instrGroup.subGroups.push(instrSubGroup);
  }
  rootGroups.push(instrGroup);

  // ─── Mixer group ───
  if (mixer.isEnabled()) {
    const mixerGroup: AutomationTargetGroupSnapshot = {
      groupId: 'mixer',
      label: 'Mixer',
      subGroups: [],
      targets: [],
    };

    // Channels (source channels from channelListGroups + main channels)
    const sourceChannels = mixer.getAllSourceChannels();
    if (sourceChannels.length > 0) {
      const channelsSubGroup: AutomationTargetGroupSnapshot = {
        groupId: 'mixer-channels',
        label: 'Channels',
        subGroups: [],
        targets: [],
      };
      for (const channel of sourceChannels) {
        channelsSubGroup.subGroups.push(
          buildChannelSubGroup(channel, 'channel', getAssignmentState, 'mixer'),
        );
      }
      mixerGroup.subGroups.push(channelsSubGroup);
    }

    // Sub-Channels
    const subChannels = mixer.getSubChannels();
    if (subChannels.length > 0) {
      const subChannelsGroup: AutomationTargetGroupSnapshot = {
        groupId: 'mixer-subchannels',
        label: 'Sub-Channels',
        subGroups: [],
        targets: [],
      };
      for (const channel of subChannels) {
        subChannelsGroup.subGroups.push(
          buildChannelSubGroup(channel, 'subchannel', getAssignmentState, 'mixer'),
        );
      }
      mixerGroup.subGroups.push(subChannelsGroup);
    }

    // Master (directly, not under a "Channels" wrapper)
    mixerGroup.subGroups.push(
      buildChannelSubGroup(mixer.getMaster(), 'master', getAssignmentState, 'mixer'),
    );

    rootGroups.push(mixerGroup);
  }

  return rootGroups;
}

function buildTrackAutomationTargetGroups(
  automatableLayer: BlueDataAutomatableLayer,
  currentLayerAssignedIds: string[],
  assignedElsewhere: Map<string, { layerId: string; layerName: string }>,
  mixer: BlueDataMixer,
  layerGroupId: string,
  projectParameterCatalog: readonly ProjectParameterEntry[] = [],
): AutomationTargetGroupSnapshot[] {
  const getUniqueId = (automatableLayer as unknown as { getUniqueId?: () => string }).getUniqueId;
  const trackId = typeof getUniqueId === 'function' ? getUniqueId.call(automatableLayer) : '';
  if (!trackId) return [];

  function getAssignmentState(id: string): {
    assignmentState: AutomationAssignmentState;
    ownerLayerId?: string;
    ownerLayerName?: string;
  } {
    if (currentLayerAssignedIds.includes(id)) {
      return { assignmentState: 'assignedCurrentLayer' };
    }
    const elsewhere = assignedElsewhere.get(id);
    if (elsewhere) {
      return {
        assignmentState: 'assignedOtherLayer',
        ownerLayerId: elsewhere.layerId,
        ownerLayerName: elsewhere.layerName,
      };
    }
    return { assignmentState: 'available' };
  }

  const result: AutomationTargetGroupSnapshot[] = [];
  const ownerIdentity = `track:${layerGroupId}:${trackId}`;
  const trackEntries = projectParameterCatalog.filter(
    (entry) => entry.ownerIdentity === ownerIdentity,
  );
  if (trackEntries.length > 0) {
    const makeTrackTarget = (parameter: BlueDataParameter): AutomationTargetSnapshot => {
      const id = parameter.getUniqueId();
      const assignment = getAssignmentState(id);
      const descriptor = getBlueX7Descriptor(parameter.getName());
      return {
        parameterId: id,
        label: descriptor?.label ?? (parameter.getLabel() || parameter.getName() || id),
        sourceKind: 'instrument',
        automationEnabled: parameter.isAutomationEnabled(),
        ...assignment,
        semanticKey: descriptor?.key,
        ownerIdentity,
        locationLabel: trackEntries[0]?.ownerLabel,
        updateClass: descriptor?.updateClass,
      };
    };
    result.push({
      groupId: `${ownerIdentity}:instrument`,
      label: trackEntries[0]?.ownerLabel ?? 'Track Instrument',
      subGroups: buildBlueX7TargetGroups(trackEntries, makeTrackTarget),
      targets: trackEntries.some((entry) => getBlueX7Descriptor(entry.parameter.getName()))
        ? []
        : trackEntries.map((entry) => makeTrackTarget(entry.parameter)),
    });
  }

  const channel = mixer
    .getAllSourceChannels()
    .find((candidate) => candidate.getAssociation().trim() === trackId);
  if (channel) {
    const channelGroup = buildChannelSubGroup(channel, 'trackChannel', getAssignmentState, 'mixer');
    result.push({
      groupId: 'track-channel',
      label: 'Track Channel',
      subGroups: channelGroup.subGroups,
      targets: channelGroup.targets,
    });
  }

  return result;
}

function buildChannelSubGroup(
  channel: any,
  kind: string,
  getAssignmentState: (id: string) => {
    assignmentState: AutomationAssignmentState;
    ownerLayerId?: string;
    ownerLayerName?: string;
  },
  sourceKind: AutomationTargetSourceKind,
): AutomationTargetGroupSnapshot {
  const channelGroup: AutomationTargetGroupSnapshot = {
    groupId: `mixer-${kind}-${channel.getName?.() ?? 'unknown'}`,
    label: kind === 'master' ? 'Master' : (channel.getName?.() ?? 'Channel'),
    subGroups: [],
    targets: [],
  };

  function makeTarget(param: BlueDataParameter): AutomationTargetSnapshot {
    const id = param.getUniqueId();
    const { assignmentState, ownerLayerId, ownerLayerName } = getAssignmentState(id);
    return {
      parameterId: id,
      label: param.getLabel() || param.getName() || id,
      sourceKind,
      automationEnabled: param.isAutomationEnabled(),
      assignmentState,
      ownerLayerId,
      ownerLayerName,
    };
  }

  function buildEffectSubGroup(effect: any): AutomationTargetGroupSnapshot | null {
    const params = effect.getParameters?.();
    if (!params || params.length === 0) return null;
    return {
      groupId: `effect-${effect.getName?.() ?? 'unknown'}`,
      label:
        (effect.constructor as any).name === 'Send'
          ? `Send: ${(effect as any).getSendChannel?.() ?? 'unknown'}`
          : (effect.getName?.() ?? 'Effect'),
      subGroups: [],
      targets: params
        .slice()
        .sort((a: BlueDataParameter, b: BlueDataParameter) =>
          a.getName().localeCompare(b.getName()),
        )
        .map((p: BlueDataParameter) => makeTarget(p)),
    };
  }

  // Pre-Effects
  const preEffects = channel.getPreEffects?.();
  if (preEffects && preEffects.length > 0) {
    const preGroup: AutomationTargetGroupSnapshot = {
      groupId: `${channelGroup.groupId}-pre`,
      label: 'Pre-Effects',
      subGroups: [],
      targets: [],
    };
    for (const effect of preEffects) {
      const sub = buildEffectSubGroup(effect);
      if (sub) preGroup.subGroups.push(sub);
    }
    if (preGroup.subGroups.length > 0) channelGroup.subGroups.push(preGroup);
  }

  // Volume (channel level parameter)
  const levelParam = channel.getLevelParameter?.();
  if (levelParam) {
    channelGroup.targets.push(makeTarget(levelParam));
  }

  // Post-Effects
  const postEffects = channel.getPostEffects?.();
  if (postEffects && postEffects.length > 0) {
    const postGroup: AutomationTargetGroupSnapshot = {
      groupId: `${channelGroup.groupId}-post`,
      label: 'Post-Effects',
      subGroups: [],
      targets: [],
    };
    for (const effect of postEffects) {
      const sub = buildEffectSubGroup(effect);
      if (sub) postGroup.subGroups.push(sub);
    }
    if (postGroup.subGroups.length > 0) channelGroup.subGroups.push(postGroup);
  }

  return channelGroup;
}

function resolveParameterSourceKind(param: BlueDataParameter): AutomationTargetSourceKind {
  const compilationVar = param.getCompilationVarName();
  if (compilationVar && compilationVar.includes('mixer')) {
    return 'mixer';
  }
  return 'instrument';
}

export function buildAssignedAutomationLayerMap(
  score: Score,
): Map<string, { layerId: string; layerName: string }> {
  const result = new Map<string, { layerId: string; layerName: string }>();

  function visitGroup(group: unknown): void {
    if (!(group instanceof PolyObject) && !(group instanceof TrackLayerGroup)) {
      return;
    }

    const groupId = assignLayerGroupId(group);
    for (let li = 0; li < group.length; li++) {
      const layer = group[li] as BlueDataAutomatableLayer;
      const layerId =
        group instanceof TrackLayerGroup
          ? (group[li] as TrackLayer).getUniqueId()
          : `${groupId}-layer-${li}`;
      for (const id of layer.getAutomationParameters().getIds()) {
        result.set(id, { layerId, layerName: layer.getName() });
      }

      if (group instanceof PolyObject) {
        const soundLayer = group[li];
        if (!soundLayer) {
          continue;
        }
        for (const sObj of soundLayer) {
          if (sObj instanceof PolyObject) {
            visitGroup(sObj);
          }
        }
      }
    }
  }

  for (let gi = 0; gi < score.length; gi++) {
    visitGroup(score[gi]);
  }

  return result;
}

export function buildAssignedElsewhereMapForLayer(
  layerId: string,
  assignedLayerMap: Map<string, { layerId: string; layerName: string }>,
): Map<string, { layerId: string; layerName: string }> {
  const result = new Map<string, { layerId: string; layerName: string }>();
  for (const [parameterId, owner] of assignedLayerMap) {
    if (owner.layerId !== layerId) {
      result.set(parameterId, owner);
    }
  }
  return result;
}
