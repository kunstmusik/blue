import {
  DEFAULT_LAYER_COLOR,
  BlueData,
  GenericScore,
  PolyObject,
  SoundLayer,
  Track,
  TrackLayerGroup,
  PatternLayer,
  PatternsLayerGroup,
  TimePosition,
  TimeDuration,
} from '@blue/data';
import type {
  ScoreLayerSnapshot,
  TrackSnapshot,
  PatternLayerSnapshot,
  ScoreRowObjectSnapshot,
  ScoreObjectEditorTargetSnapshot,
} from './project-editor';
import {
  assignLayerGroupId,
  assignPatternLayerId,
  assignScoreObjectId,
} from './project-editor/identity';

export function createMockScoreObjectTarget(
  overrides?: Partial<ScoreObjectEditorTargetSnapshot>,
): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: 'sobj-1',
    selectedObjectType: 'GenericScore',
    editorObjectType: 'GenericScore',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: {
      rootGroupIndex: 0,
      containerPath: [],
      layerIndex: 0,
      objectIndex: 0,
      rootGroupId: 'root-group-0',
      layerId: 'layer-0',
      layerKind: 'soundObject',
    },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
    ...overrides,
  };
}

export function createMockTrackItemTarget(
  overrides?: Partial<ScoreObjectEditorTargetSnapshot>,
): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: 'track-item-1',
    selectedObjectType: 'AudioClip',
    editorObjectType: 'AudioClip',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: {
      rootGroupIndex: 1,
      containerPath: [],
      layerIndex: 0,
      objectIndex: 0,
      rootGroupId: 'track-group-1',
      layerId: 'track-1',
      trackId: 'track-1',
      layerKind: 'track',
    },
    supportsTimeBehavior: false,
    supportsRepeatPoint: false,
    supportsNoteProcessorChain: false,
    ...overrides,
  };
}

export function createMockPatternSourceTarget(
  overrides?: Partial<ScoreObjectEditorTargetSnapshot>,
): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: 'pattern-src-1',
    selectedObjectType: 'GenericScore',
    editorObjectType: 'GenericScore',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    patternSource: {
      groupId: 'pattern-group-2',
      layerId: 'pattern-layer-0',
      sourceObjectId: 'pattern-src-1',
    },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
    ...overrides,
  };
}

export function createMockScoreRowObjectSnapshot(
  overrides?: Partial<ScoreRowObjectSnapshot>,
): ScoreRowObjectSnapshot {
  const target = overrides?.editorTarget ?? createMockScoreObjectTarget();
  return {
    objectId: target.selectionId ?? 'sobj-1',
    objectType: 'GenericScore',
    name: 'GenericScore',
    startBeats: 0,
    durationBeats: 4,
    startTimeBase: 'beats',
    durationTimeBase: 'beats',
    backgroundColor: DEFAULT_LAYER_COLOR,
    isContainer: false,
    editorTarget: target,
    barRenderer: {
      kind: 'generic',
      labelLines: ['GenericScore'],
      timeBehavior: 'scale',
      repeatPointBeats: null,
    },
    ...overrides,
  };
}

export function createMockScoreLayerSnapshot(
  overrides?: Partial<ScoreLayerSnapshot>,
): ScoreLayerSnapshot {
  return {
    layerId: 'layer-0',
    layerSelectionId: 'layer-sel-0',
    name: 'Layer 1',
    height: 22,
    backgroundColor: DEFAULT_LAYER_COLOR,
    muted: false,
    solo: false,
    items: [],
    ...overrides,
  };
}

export function createMockTrackSnapshot(overrides?: Partial<TrackSnapshot>): TrackSnapshot {
  return {
    layerKind: 'track',
    layerId: 'track-1',
    layerSelectionId: 'track-sel-1',
    name: 'Track 1',
    height: 22,
    backgroundColor: DEFAULT_LAYER_COLOR,
    muted: false,
    solo: false,
    items: [],
    instrument: null,
    ...overrides,
  };
}

export function createMockPatternLayerSnapshot(
  overrides?: Partial<PatternLayerSnapshot>,
): PatternLayerSnapshot {
  const target = createMockPatternSourceTarget();
  return {
    layerId: 'pattern-layer-0',
    layerSelectionId: 'pattern-sel-0',
    name: 'Pattern 1',
    height: 22,
    backgroundColor: DEFAULT_LAYER_COLOR,
    muted: false,
    solo: false,
    items: [],
    sourceObject: {
      objectId: target.selectionId ?? 'pattern-src-1',
      objectType: 'GenericScore',
      name: 'GenericScore',
      backgroundColor: DEFAULT_LAYER_COLOR,
      editorTarget: target,
      barRenderer: {
        kind: 'generic',
        labelLines: ['GenericScore'],
        timeBehavior: 'none',
        repeatPointBeats: null,
      },
    },
    activeCellIndices: [0],
    ...overrides,
  };
}

export function createTestProjectWithLayers(): {
  data: BlueData;
  polyGroup: PolyObject;
  soundLayer: SoundLayer;
  trackGroup: TrackLayerGroup;
  track: Track;
  patternGroup: PatternsLayerGroup;
  patternLayer: PatternLayer;
} {
  const data = new BlueData();
  const score = data.getScore();
  score.length = 0;

  // 1. PolyObject group
  const polyGroup = new PolyObject(true);
  polyGroup.length = 0;
  const soundLayer = new SoundLayer();
  soundLayer.setName('SoundLayer 1');
  const scoreObj = new GenericScore();
  scoreObj.setName('Score 1');
  scoreObj.setStartTime(TimePosition.beats(0));
  scoreObj.setSubjectiveDuration(TimeDuration.beats(4));
  soundLayer.push(scoreObj);
  polyGroup.push(soundLayer);
  score.push(polyGroup);

  // 2. Track group
  const trackGroup = new TrackLayerGroup();
  trackGroup.setUniqueId('track-group-1');
  const track = trackGroup.newLayerAt(0);
  track.setName('Track 1');
  const trackObj = new GenericScore();
  trackObj.setName('Track Score 1');
  trackObj.setStartTime(TimePosition.beats(0));
  trackObj.setSubjectiveDuration(TimeDuration.beats(2));
  track.push(trackObj);
  score.push(trackGroup);

  // 3. Pattern group
  const patternGroup = new PatternsLayerGroup();
  const patternLayer = new PatternLayer();
  patternLayer.setName('Pattern 1');
  patternGroup.push(patternLayer);
  score.push(patternGroup);

  return {
    data,
    polyGroup,
    polyGroupId: assignLayerGroupId(polyGroup),
    soundLayer,
    trackGroup,
    trackGroupId: trackGroup.getUniqueId(),
    track,
    patternGroup,
    patternGroupId: assignLayerGroupId(patternGroup),
    patternLayer,
    patternLayerId: assignPatternLayerId(patternLayer),
    patternSourceId: assignScoreObjectId(patternLayer.getSoundObject(), 'sobj'),
  };
}
