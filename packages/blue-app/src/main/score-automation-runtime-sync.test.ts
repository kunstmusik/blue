import { describe, expect, it, vi } from 'vitest';
import {
  BlueData,
  BlueX7,
  Channel,
  PolyObject,
  TrackLayerGroup,
} from '@blue/data';
import { AutomationCurveCode } from '@blue/engine-client';
import { EngineBridge } from './engine-bridge';
import {
  collectAffectedProjectScoreAutomationParameterIds,
  syncScoreAutomationParametersToEngine,
} from './score-automation-runtime-sync';
import {
  applyProjectDocumentPatch,
  createScoreDocumentSnapshot,
} from '../shared/project-editor';
import type {
  ProjectDocumentPatch,
  ScoreAutomationLayerRef,
  ScorePatch,
} from '../shared/project-editor';

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {},
  dialog: { showErrorBox: vi.fn() },
}));

interface MockEngineClient {
  updateAutomation: ReturnType<typeof vi.fn>;
  createAutomation: ReturnType<typeof vi.fn>;
  deleteAutomation: ReturnType<typeof vi.fn>;
  setChannel: ReturnType<typeof vi.fn>;
  createChannel: ReturnType<typeof vi.fn>;
}

interface RuntimeProject {
  data: BlueData;
  bridge: EngineBridge;
  client: MockEngineClient;
  layerRef: ScoreAutomationLayerRef;
  params: ReturnType<Channel['getLevelParameter']>[];
}

const timing = {
  renderStartTime: 2,
  sampleRate: 44100,
  ksmps: 64,
};

function createMockClient(overrides: Partial<MockEngineClient> = {}): MockEngineClient {
  return {
    updateAutomation: vi.fn(async () => ({ ok: true, message: 'OK' })),
    createAutomation: vi.fn(async () => ({ ok: true, message: 'OK' })),
    deleteAutomation: vi.fn(async () => ({ ok: true, message: 'OK' })),
    setChannel: vi.fn(async () => ({ ok: true, message: 'OK' })),
    createChannel: vi.fn(async () => ({ ok: true, message: 'OK' })),
    ...overrides,
  };
}

function createBridge(client: MockEngineClient): EngineBridge {
  const bridge = new EngineBridge({ webContents: { send: vi.fn() } } as never);
  (bridge as unknown as { activeSession: { getClient: () => MockEngineClient } }).activeSession = {
    getClient: () => client,
  };
  return bridge;
}

function createRuntimeProject(parameterCount = 1, client = createMockClient()): RuntimeProject {
  const data = new BlueData();
  const score = data.getScore();
  score.length = 0;

  const poly = new PolyObject(true);
  poly.newLayerAt(0);
  score.push(poly);

  const params: RuntimeProject['params'] = [];
  for (let index = 0; index < parameterCount; index += 1) {
    const channel = new Channel();
    channel.setName(`Runtime Channel ${index + 1}`);
    data.getMixer().getChannels().splice(index, 0, channel);

    const param = channel.getLevelParameter();
    param.setCompilationVarName(`gk_blue_auto${index}`);
    param.setFixedValue(index + 0.25);
    params.push(param);
  }

  const snap = createScoreDocumentSnapshot(data);
  const group = snap.layerGroups[0]!;
  const layerRef: ScoreAutomationLayerRef = {
    rootGroupIndex: 0,
    groupId: group.groupId,
    layerId: group.layers[0]!.layerId,
    layerIndex: 0,
    layerKind: 'soundObject',
  };

  return {
    data,
    bridge: createBridge(client),
    client,
    layerRef,
    params,
  };
}

async function applyScorePatchAndSync(project: RuntimeProject, scorePatch: ScorePatch): Promise<void> {
  const patch: ProjectDocumentPatch = { score: scorePatch };
  const affectedIds = collectAffectedProjectScoreAutomationParameterIds(project.data, patch);
  const changed = applyProjectDocumentPatch(project.data, patch);
  if (changed) {
    for (const id of collectAffectedProjectScoreAutomationParameterIds(project.data, patch)) {
      affectedIds.add(id);
    }
  } else {
    affectedIds.clear();
  }

  await syncScoreAutomationParametersToEngine(project.data, affectedIds, project.bridge, timing);
}

function enableAutomation(param: RuntimeProject['params'][number], points = [
  { time: 2, value: 0.2 },
  { time: 6, value: 0.8 },
]): void {
  param.setAutomationEnabled(true);
  param.setPoints(points);
}

function assignToLayer(project: RuntimeProject, paramIndex = 0): void {
  const layer = (project.data.getScore()[0] as PolyObject)[0]!;
  layer.getAutomationParameters().addParameterId(project.params[paramIndex]!.getUniqueId());
}

function lastPoints(call: unknown[]): Array<{ time: number; value: number }> {
  return call[4] as Array<{ time: number; value: number }>;
}

describe('EngineBridge automation sync', () => {
  it('resolves arrangement and Track BlueX7 Parameters through the owner-aware catalog', async () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const arrangementX7 = new BlueX7();
    data.getArrangement().addInstrument(arrangementX7, '11');
    const group = new TrackLayerGroup();
    group.setUniqueId('group-x7');
    const track = group.newLayerAt(0);
    track.setUniqueId('track-x7');
    const trackX7 = new BlueX7();
    trackX7.setEnabled(true);
    track.setInstrument(trackX7);
    data.getScore().push(group);
    const arrangementParameter = arrangementX7.getParameters()[0]!;
    const trackParameter = (track.getInstrument() as BlueX7).getParameters()[0]!;
    const syncAutomationParameter = vi.fn();

    await syncScoreAutomationParametersToEngine(
      data,
      [arrangementParameter.getUniqueId(), trackParameter.getUniqueId()],
      { syncAutomationParameter },
      timing,
    );

    expect(syncAutomationParameter.mock.calls.map((call) => call[0])).toEqual([
      arrangementParameter,
      trackParameter,
    ]);
    expect(syncAutomationParameter).toHaveBeenCalledTimes(2);
  });

  it('moveAutomationPoint sends updateAutomation with converted engine seconds', async () => {
    const project = createRuntimeProject();
    const param = project.params[0]!;
    enableAutomation(param);

    await applyScorePatchAndSync(project, {
      type: 'moveAutomationPoint',
      parameterId: param.getUniqueId(),
      pointIndex: 1,
      point: { time: 8, value: 0.5 },
    });

    expect(project.client.updateAutomation).toHaveBeenCalledOnce();
    expect(project.client.updateAutomation).toHaveBeenCalledWith(
      'gk_blue_auto0',
      AutomationCurveCode.LINEAR,
      true,
      param.getResolutionText(),
      [
        { time: 0, value: 0.2 },
        { time: 6, value: 0.5 },
      ],
    );
  });

  it('publishes the authoritative decimal resolution text without numeric conversion', async () => {
    const project = createRuntimeProject();
    const param = project.params[0]!;
    param.setResolutionText('0.10');
    enableAutomation(param);

    await project.bridge.syncAutomationParameter(param, timing, { coalesce: false });

    expect(project.client.updateAutomation).toHaveBeenCalledWith(
      'gk_blue_auto0',
      AutomationCurveCode.LINEAR,
      true,
      '0.10',
      [
        { time: 0, value: 0.2 },
        { time: 4, value: 0.8 },
      ],
    );
  });

  it('falls back to createAutomation when updateAutomation reports a missing automation', async () => {
    const client = createMockClient({
      updateAutomation: vi.fn(async () => ({ ok: false, message: 'Automation not found' })),
    });
    const project = createRuntimeProject(1, client);
    const param = project.params[0]!;
    enableAutomation(param);

    await project.bridge.syncAutomationParameter(param, timing, { coalesce: false });

    expect(client.updateAutomation).toHaveBeenCalledOnce();
    expect(client.createAutomation).toHaveBeenCalledOnce();
  });

  it('single-point automation deletes the engine automation and restores the current value', async () => {
    const project = createRuntimeProject();
    const param = project.params[0]!;
    enableAutomation(param, [{ time: 4, value: 0.7 }]);

    await project.bridge.syncAutomationParameter(param, timing, { coalesce: false });

    expect(project.client.deleteAutomation).toHaveBeenCalledWith('gk_blue_auto0');
    expect(project.client.setChannel).toHaveBeenCalledWith('gk_blue_auto0', 0.7);
    expect(project.client.updateAutomation).not.toHaveBeenCalled();
  });

  it('coalesces rapid default sync calls per channel', async () => {
    vi.useFakeTimers();
    try {
      const project = createRuntimeProject();
      const param = project.params[0]!;
      enableAutomation(param);
      (project.bridge as unknown as {
        lastAutomationSyncAt: Map<string, number>;
      }).lastAutomationSyncAt.set('gk_blue_auto0', Date.now());

      void project.bridge.syncAutomationParameter(param, timing);
      param.setPoints([
        { time: 2, value: 0.3 },
        { time: 7, value: 0.9 },
      ]);
      void project.bridge.syncAutomationParameter(param, timing);

      expect(project.client.updateAutomation).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(33);

      expect(project.client.updateAutomation).toHaveBeenCalledOnce();
      expect(lastPoints(project.client.updateAutomation.mock.calls[0]!)).toEqual([
        { time: 0, value: 0.3 },
        { time: 5, value: 0.9 },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reprojects automation at seek, loop restart, and resume/rebuild origins', async () => {
    const project = createRuntimeProject();
    const param = project.params[0]!;
    enableAutomation(param, [
      { time: 0, value: 0.1 },
      { time: 8, value: 0.9 },
    ]);

    await project.bridge.syncAutomationParameter(param, {
      ...timing,
      renderStartTime: 4,
    }, { coalesce: false });
    await project.bridge.syncAutomationParameter(param, {
      ...timing,
      renderStartTime: 0,
    }, { coalesce: false });

    expect(lastPoints(project.client.updateAutomation.mock.calls[0]!)).toEqual([
      { time: 0, value: 0.5 },
      { time: 4, value: 0.9 },
    ]);
    expect(lastPoints(project.client.updateAutomation.mock.calls[1]!)).toEqual([
      { time: 0, value: 0.1 },
      { time: 8, value: 0.9 },
    ]);
  });

  it('resynchronizes authority and fixed values across pause and resume-from-origin cycles (FR-017)', async () => {
    const project = createRuntimeProject(2);
    const automated = project.params[0]!;
    const fixed = project.params[1]!;
    enableAutomation(automated, [
      { time: 0, value: 0.1 },
      { time: 8, value: 0.9 },
    ]);

    // Playing from the start: the curve is registered against the full timeline.
    await project.bridge.syncAutomationParameter(
      automated,
      { ...timing, renderStartTime: 0 },
      { coalesce: false },
    );
    project.client.updateAutomation.mockClear();
    project.client.setChannel.mockClear();

    // Paused: the user edits fixed values. The automated curve stays
    // authoritative for playback; the fixed edit is canonical only.
    automated.setFixedValue(0.55);
    fixed.setFixedValue(0.25);

    // Resume from a later origin: the timing context is rebuilt from the
    // live project with the advanced render start and both parameters resync.
    const resumeTiming = { ...timing, renderStartTime: 4 };
    await project.bridge.syncAutomationParameter(automated, resumeTiming, { coalesce: false });
    await project.bridge.syncAutomationParameter(fixed, resumeTiming, { coalesce: false });

    // The automated curve is reprojected to the resume origin and automation
    // remains authoritative: no fixed write lands on its channel.
    expect(lastPoints(project.client.updateAutomation.mock.calls[0]!)).toEqual([
      { time: 0, value: 0.5 },
      { time: 4, value: 0.9 },
    ]);
    expect(project.client.setChannel).not.toHaveBeenCalledWith('gk_blue_auto0', expect.any(Number));
    // The fixed-only channel is restored from its paused canonical edit.
    expect(project.client.setChannel).toHaveBeenCalledWith('gk_blue_auto1', 0.25);

    // A second pause removes the automation; the next resume must clear the
    // stale engine curve and surface the fixed value edited underneath it.
    automated.setAutomationEnabled(false);
    project.client.updateAutomation.mockClear();
    project.client.setChannel.mockClear();
    project.client.deleteAutomation.mockClear();
    await project.bridge.syncAutomationParameter(automated, resumeTiming, { coalesce: false });
    expect(project.client.deleteAutomation).toHaveBeenCalledWith('gk_blue_auto0');
    expect(project.client.setChannel).toHaveBeenCalledWith('gk_blue_auto0', 0.55);
    expect(project.client.updateAutomation).not.toHaveBeenCalled();
  });

  it('insertAutomationPoint, deleteAutomationPoint, and setAutomationPoints send updated point arrays', async () => {
    const setProject = createRuntimeProject();
    const setParam = setProject.params[0]!;
    enableAutomation(setParam);
    await applyScorePatchAndSync(setProject, {
      type: 'setAutomationPoints',
      parameterId: setParam.getUniqueId(),
      points: [
        { time: 2, value: 0.1 },
        { time: 5, value: 0.4 },
        { time: 8, value: 0.9 },
      ],
    });
    expect(lastPoints(setProject.client.updateAutomation.mock.calls[0])).toEqual([
      { time: 0, value: 0.1 },
      { time: 3, value: 0.4 },
      { time: 6, value: 0.9 },
    ]);

    const insertProject = createRuntimeProject();
    const insertParam = insertProject.params[0]!;
    enableAutomation(insertParam);
    await applyScorePatchAndSync(insertProject, {
      type: 'insertAutomationPoint',
      parameterId: insertParam.getUniqueId(),
      point: { time: 4, value: 0.6 },
    });
    expect(lastPoints(insertProject.client.updateAutomation.mock.calls[0])).toEqual([
      { time: 0, value: 0.2 },
      { time: 2, value: 0.6 },
      { time: 4, value: 0.8 },
    ]);

    const deleteProject = createRuntimeProject();
    const deleteParam = deleteProject.params[0]!;
    enableAutomation(deleteParam, [
      { time: 2, value: 0.2 },
      { time: 4, value: 0.6 },
      { time: 6, value: 0.8 },
    ]);
    await applyScorePatchAndSync(deleteProject, {
      type: 'deleteAutomationPoint',
      parameterId: deleteParam.getUniqueId(),
      pointIndex: 1,
    });
    expect(lastPoints(deleteProject.client.updateAutomation.mock.calls[0])).toEqual([
      { time: 0, value: 0.2 },
      { time: 4, value: 0.8 },
    ]);
  });

  it('assignAutomationToLayer creates runtime automation when the engine has no existing definition', async () => {
    const client = createMockClient({
      updateAutomation: vi.fn(async () => ({ ok: false, message: 'Automation not found' })),
    });
    const project = createRuntimeProject(1, client);
    const param = project.params[0]!;
    param.setPoints([
      { time: 2, value: 0.2 },
      { time: 6, value: 0.8 },
    ]);

    await applyScorePatchAndSync(project, {
      type: 'assignAutomationToLayer',
      layer: project.layerRef,
      parameterId: param.getUniqueId(),
      enableAutomation: true,
    });

    expect(client.createAutomation).toHaveBeenCalledOnce();
  });

  it('removeAutomationFromLayer stops stale automation and restores the fixed channel value', async () => {
    const project = createRuntimeProject();
    const param = project.params[0]!;
    enableAutomation(param);
    param.setFixedValue(0.35);
    assignToLayer(project);

    await applyScorePatchAndSync(project, {
      type: 'removeAutomationFromLayer',
      layer: project.layerRef,
      parameterId: param.getUniqueId(),
    });

    expect(project.client.deleteAutomation).toHaveBeenCalledWith('gk_blue_auto0');
    expect(project.client.setChannel).toHaveBeenCalledWith('gk_blue_auto0', 0.35);
    expect(project.client.updateAutomation).not.toHaveBeenCalled();
  });

  it('clearLayerAutomations clears every pre-apply layer parameter from the engine', async () => {
    const project = createRuntimeProject(2);
    for (let index = 0; index < 2; index += 1) {
      enableAutomation(project.params[index]!);
      assignToLayer(project, index);
    }

    await applyScorePatchAndSync(project, {
      type: 'clearLayerAutomations',
      layer: project.layerRef,
    });

    expect(project.client.deleteAutomation).toHaveBeenCalledTimes(2);
    expect(project.client.deleteAutomation).toHaveBeenCalledWith('gk_blue_auto0');
    expect(project.client.deleteAutomation).toHaveBeenCalledWith('gk_blue_auto1');
    expect(project.client.setChannel).toHaveBeenCalledTimes(2);
  });

  it('range move and range scale update every affected parameter once', async () => {
    const moveProject = createRuntimeProject(2);
    for (let index = 0; index < 2; index += 1) {
      enableAutomation(moveProject.params[index]!);
      assignToLayer(moveProject, index);
    }
    const moveParameterIds = moveProject.params.map((param) => param.getUniqueId());
    await applyScorePatchAndSync(moveProject, {
      type: 'moveAutomationRange',
      range: {
        startBeat: 1,
        endBeat: 7,
        layerIds: [moveProject.layerRef.layerId],
        parameterIdsByLayer: { [moveProject.layerRef.layerId]: moveParameterIds },
      },
      beatDelta: 1,
    });

    expect(moveProject.client.updateAutomation).toHaveBeenCalledTimes(2);
    expect(moveProject.client.updateAutomation.mock.calls.map((call) => call[0]).sort()).toEqual([
      'gk_blue_auto0',
      'gk_blue_auto1',
    ]);

    const scaleProject = createRuntimeProject(2);
    for (let index = 0; index < 2; index += 1) {
      enableAutomation(scaleProject.params[index]!);
      assignToLayer(scaleProject, index);
    }
    const scaleParameterIds = scaleProject.params.map((param) => param.getUniqueId());
    await applyScorePatchAndSync(scaleProject, {
      type: 'scaleAutomationRange',
      range: {
        startBeat: 1,
        endBeat: 7,
        layerIds: [scaleProject.layerRef.layerId],
        parameterIdsByLayer: { [scaleProject.layerRef.layerId]: scaleParameterIds },
      },
      anchorBeat: 2,
      scaleFactor: 2,
    });

    expect(scaleProject.client.updateAutomation).toHaveBeenCalledTimes(2);
    expect(scaleProject.client.updateAutomation.mock.calls.map((call) => call[0]).sort()).toEqual([
      'gk_blue_auto0',
      'gk_blue_auto1',
    ]);
  });

  it('visual-only automation patches do not call the engine', async () => {
    const project = createRuntimeProject();
    const param = project.params[0]!;
    enableAutomation(param);

    await applyScorePatchAndSync(project, {
      type: 'setAutomationLineColor',
      parameterId: param.getUniqueId(),
      lineColor: 0xff0000,
    });

    await applyScorePatchAndSync(project, {
      type: 'selectLayerAutomation',
      layer: project.layerRef,
      parameterId: param.getUniqueId(),
    });

    expect(project.client.updateAutomation).not.toHaveBeenCalled();
    expect(project.client.createAutomation).not.toHaveBeenCalled();
    expect(project.client.deleteAutomation).not.toHaveBeenCalled();
    expect(project.client.setChannel).not.toHaveBeenCalled();
  });
});
