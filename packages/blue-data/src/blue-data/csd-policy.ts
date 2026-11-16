import type { BlueData } from '../blue-data';
import { Arrangement } from '../arrangement';
import { ProjectProperties } from '../project-properties';
import { GlobalOrcSco } from '../global-orc-sco';
import { Tables } from '../tables';
import { Score } from '../score/score';
import { Note } from '../sound-objects/note';
import { NoteList } from '../sound-objects/note-list';
import {
  deferSoundInstruments,
  finalizeSoundInstruments,
} from '../sound-objects/sound-occurrences';
import { Mixer } from '../mixer/mixer';
import { OpcodeList } from '../opcodes/opcode-list';
import { Parameter } from '../automation/parameter';
import { CompileData } from '../compile-data';
import type {
  CompiledBlueX7Binding,
  CompiledMidiInstrumentTarget,
  CompiledMixerGateBindings,
  CompiledPannerBindings,
  MeterBindingMap,
} from '../compile-data';

import { getAllParameters, assignParameterNames } from '../automation/parameter-helper';
import { AudioLayoutCompileError, type AudioLayoutManifest } from '../score/audio/audio-layout';
import { disposeJavaScriptCompileState } from '../javascript-runtime';
import type { JavaScriptSession } from '../javascript-runtime';
import type { JavaRuntimeClientContract } from '../java-runtime';
import {
  processCommandBlocks,
  preprocessSco,
  getTempoScore,
  getTempoMapFromScoreText,
} from '../utilities/csd-render';
import { TempoMap } from '../time/tempo-map';
import {
  MIXER_GATE_SYMBOL_PREFIX,
  MIXER_GATE_COMMIT_CHANNEL,
  MIXER_GATE_APPLIED_CHANNEL,
  MIXER_GATE_RAMP_SECONDS,
  type BlueMixerGateContext,
  generateMixerOrchestra,
  buildMeterBindingMap,
  buildBlueMixerGateContext,
  buildCompiledMixerGateBindings,
  buildMixerGateInitStatements,
  buildCompiledPannerBindings,
  buildPannerInitStatements,
} from './csd-mixer-codegen';
export {
  MIXER_GATE_SYMBOL_PREFIX,
  MIXER_GATE_COMMIT_CHANNEL,
  MIXER_GATE_APPLIED_CHANNEL,
  MIXER_GATE_RAMP_SECONDS,
  type BlueMixerGateContext,
};
import {
  type CsdRenderProfile,
  buildOrchestraHeader,
  getNchnls,
  getRenderWindow,
  assignChannelIds,
  buildScoreText,
  buildRuntimeInitStatements,
  collectAlwaysOnInstruments,
  appendParameterAutomationNotes,
  addScoreNote,
  buildProjectInfo,
  createRenderSnapshot,
  createRenderEndInstrument,
  getNoteListDuration,
  getNoteListDurationFromText,
  buildParameterInits,
  collectStringChannels,
  buildParameterMap,
  buildStringChannelInits,
  appendFtgenTableNumbers,
} from './csd-parameter-score';
export { buildScoreText };
import { computeDiskPruningSet, getEffectiveTrackLayerMuteSoloMode } from './csd-disk-pruning';

export type RenderCsdResult = {
  csdText: string;
  parameters?: Parameter[];
  stringChannels?: Array<{ objectName: string; value: string; channelName: string }>;
  /**
   * Spec 067 disposable compiled MIDI target catalog: the exact enabled base Track
   * and Orchestra instruments compiled into this CSD snapshot, keyed by stable
   * project identity. Derived render output only; never serialized to XML.
   */
  midiInstrumentTargets: readonly CompiledMidiInstrumentTarget[];
  /**
   * Spec 092 disposable compiled BlueX7 bindings for this render: owner
   * identity -> direct-global parameter channels and per-instance domain epoch.
   * Derived render output only; never serialized to XML. Empty
   * when the project has no BlueX7 instruments.
   */
  blueX7Bindings: readonly CompiledBlueX7Binding[];
  meterBindingMap?: MeterBindingMap;
  /**
   * Spec 111 disposable compiled mixer gate bindings for realtime/BlueLive
   * renders: the deterministic mute/solo gate catalog staged through the
   * engine batch channel API. Absent for disk renders and when the mixer is
   * disabled. Derived render output only; never serialized to XML.
   */
  mixerGateBindings?: CompiledMixerGateBindings;
  /**
   * Spec 113 disposable compiled panner bindings for realtime/BlueLive
   * renders: score pan law/boost control channels and channel mode channels.
   * Absent when panning is disabled. Derived render output only; never serialized to XML.
   */
  pannerBindings?: CompiledPannerBindings;
};

type BlueDataCsdState = {
  arrangement: Arrangement;
  projectProperties: ProjectProperties;
  globalOrcSco: GlobalOrcSco;
  tableSet: Tables;
  score: Score;
  renderStartTime: number;
  renderEndTime: number;
  mixer: Mixer;
  opcodeList: OpcodeList;
};

function getBlueDataState(blueData: BlueData): BlueDataCsdState {
  return blueData as unknown as BlueDataCsdState;
}

function configureCompileChannels(compileData: CompileData, nchnls: number): void {
  compileData.setNchnls(nchnls);
  if (!compileData.isPanningEnabled() || nchnls <= 2) return;
  throw new AudioLayoutCompileError(`Unsupported project output channel count (${nchnls})`, {
    code: 'UNSUPPORTED_OUTPUT_CHANNELS',
    outputChannels: nchnls,
  });
}

interface StandardCSDState {
  blueData: BlueData;
  profile: CsdRenderProfile;
  clonedArrangement: Arrangement;
  clonedTables: Tables;
  clonedMixer: Mixer;
  compileData: CompileData;
  actualEmitMetering: boolean;
  channelIdAssignments: ReturnType<typeof assignChannelIds>;
  gateContext: ReturnType<typeof buildBlueMixerGateContext>;
  gateBindings: ReturnType<typeof buildCompiledMixerGateBindings> | undefined;
  orchestraHeader: string;
  nchnls: number;
  pannerBindings: ReturnType<typeof buildCompiledPannerBindings> | undefined;
  globalOrc: string;
  baseGlobalSco: string;
  udos: OpcodeList;
  startTime: number;
  endTime: number;
  pruneInaudibleTracks: Set<string> | undefined;
  prunedDurationSink: { value: number };
}

interface StandardCSDOrchestraInputs {
  allParameters: ReturnType<CompileData['getOriginalParameters']>;
  allStringChannels: ReturnType<CompileData['getStringChannels']>;
  parameterMap: ReturnType<typeof buildParameterMap>;
  globalSco: string;
  mixerInstruments: string;
  arrangementGlobalOrc: string;
  udoText: string;
}

function createStandardCSDState(
  blueData: BlueData,
  profile: CsdRenderProfile,
  session?: JavaScriptSession,
  runtimeClient?: JavaRuntimeClientContract | null,
  emitMetering = false,
  layoutManifest?: AudioLayoutManifest | null,
): StandardCSDState {
  const {
    arrangement: clonedArrangement,
    tables: clonedTables,
    mixer: clonedMixer,
    compileData,
  } = createRenderSnapshot(blueData, session, runtimeClient, layoutManifest);
  return {
    blueData,
    profile,
    clonedArrangement,
    clonedTables,
    clonedMixer,
    compileData,
    actualEmitMetering: profile === 'realtime' && emitMetering,
    channelIdAssignments: new Map(),
    gateContext: null,
    gateBindings: undefined,
    orchestraHeader: '',
    nchnls: 0,
    pannerBindings: undefined,
    globalOrc: '',
    baseGlobalSco: '',
    udos: new OpcodeList(),
    startTime: 0,
    endTime: 0,
    pruneInaudibleTracks: undefined,
    prunedDurationSink: { value: 0 },
  };
}

function appendStandardGlobalOrc(state: StandardCSDState, section: string): void {
  if (!section) {
    return;
  }
  if (state.globalOrc.length > 0 && !state.globalOrc.endsWith('\n')) {
    state.globalOrc += '\n';
  }
  state.globalOrc += section;
}

function prepareStandardCSDScoreGeneration(state: StandardCSDState) {
  const { blueData, profile, clonedArrangement, clonedTables, clonedMixer, compileData } = state;
  const channelIdAssignments = assignChannelIds(blueData, clonedMixer);
  for (const [channel, id] of channelIdAssignments) {
    compileData.getChannelIdAssignments().set(channel, id);
  }
  compileData.setMixerEnabled(clonedMixer.isEnabled());
  const gateContext = buildBlueMixerGateContext(clonedMixer, profile === 'disk' ? 'fixed' : 'live');
  const gateBindings = gateContext ? buildCompiledMixerGateBindings(gateContext) : undefined;

  // Build CsInstruments header (sr/ksmps/nchnls/0dbfs go here, not in CsOptions)
  const orchestraHeader = buildOrchestraHeader(blueData, profile);
  const nchnls = getNchnls(blueData, profile);
  configureCompileChannels(compileData, nchnls);
  const pannerBindings =
    clonedMixer.isEnabled() && compileData.isPanningEnabled() && nchnls === 2 && profile !== 'disk'
      ? buildCompiledPannerBindings(clonedMixer)
      : undefined;

  state.globalOrc = getBlueDataState(blueData).globalOrcSco.getGlobalOrc() || '';
  const baseGlobalSco = getBlueDataState(blueData).globalOrcSco.getGlobalSco() || '';

  if (clonedMixer.isEnabled()) {
    const mixerInits = clonedMixer.getInitStatements(
      channelIdAssignments,
      nchnls,
      state.actualEmitMetering,
    );
    if (mixerInits) {
      // Java appends an extra newline after mixer init statements before
      // adding them to GlobalOrcSco, which preserves a two-blank-line gap
      // before parameter init statements.
      appendStandardGlobalOrc(state, `${mixerInits}\n\n`);
    }
    if (gateContext && gateBindings && gateContext.mode === 'live') {
      const gateInits = buildMixerGateInitStatements(gateBindings);
      if (gateInits) {
        appendStandardGlobalOrc(state, `${gateInits}\n\n`);
      }
    }
    if (pannerBindings && profile !== 'disk') {
      const pannerInits = buildPannerInitStatements(blueData, pannerBindings, clonedMixer);
      if (pannerInits) {
        appendStandardGlobalOrc(state, `${pannerInits}\n\n`);
      }
    }
  }

  const udos = new OpcodeList(getBlueDataState(blueData).opcodeList);

  const parameters = getAllParameters(
    clonedArrangement,
    clonedMixer,
    compileData.isPanningEnabled(),
  );
  assignParameterNames(parameters);
  const stringChannels = collectStringChannels(blueData, clonedArrangement);
  compileData.registerExistingAutomationState(parameters, stringChannels);

  appendFtgenTableNumbers(state.globalOrc, clonedTables);
  clonedArrangement.generateFTables(clonedTables);
  compileData.registerBlueX7CompiledBindings();

  const { startTime, endTime } = getRenderWindow(blueData, profile);
  const pruneInaudibleTracks =
    gateContext?.mode === 'fixed' ? computeDiskPruningSet(blueData, gateContext) : undefined;
  const prunedDurationSink = { value: 0 };
  deferSoundInstruments(compileData);

  Object.assign(state, {
    channelIdAssignments,
    gateContext,
    gateBindings,
    orchestraHeader,
    nchnls,
    pannerBindings,
    baseGlobalSco,
    udos,
    startTime,
    endTime,
    pruneInaudibleTracks,
    prunedDurationSink,
  });

  return {
    trackLayerMuteSoloMode: getEffectiveTrackLayerMuteSoloMode(blueData, clonedMixer.isEnabled()),
    pruneInaudibleTracks:
      pruneInaudibleTracks && pruneInaudibleTracks.size > 0 ? pruneInaudibleTracks : undefined,
    prunedDurationSink,
  };
}

function prepareStandardCSDOrchestraInputs(
  state: StandardCSDState,
  noteList: NoteList,
): StandardCSDOrchestraInputs {
  const {
    blueData,
    profile,
    clonedArrangement,
    clonedMixer,
    compileData,
    channelIdAssignments,
    gateContext,
    nchnls,
    udos,
    baseGlobalSco,
    startTime,
    endTime,
    pruneInaudibleTracks,
    prunedDurationSink,
    actualEmitMetering,
  } = state;

  finalizeSoundInstruments(noteList, compileData, startTime, endTime);
  clonedArrangement.generateUserDefinedOpcodes(udos);
  const allParameters = compileData.getOriginalParameters();
  const allStringChannels = compileData.getStringChannels();
  compileData.setHandleParametersAndChannels(false);

  if (endTime > 0 && endTime > startTime) {
    const renderEndInstrument = createRenderEndInstrument(blueData);
    const renderEndInstrumentId = clonedArrangement.addInstrumentAtEnd(renderEndInstrument);

    const renderEndNote = Note.createNoteFromText(
      `i${renderEndInstrumentId} ${endTime - startTime} 0.1`,
    );
    if (renderEndNote) {
      noteList.add(renderEndNote);
    }
  }

  const parameterMap = buildParameterMap(blueData, clonedArrangement);

  const scoreTempoMap = getBlueDataState(blueData).score.getTimeContext().getTempoMap();
  let tempoMap: TempoMap | null = null;
  let scoreGlobalPrefix = baseGlobalSco;

  if (scoreTempoMap.isEnabled()) {
    tempoMap = scoreTempoMap;
    const tempoStatement = getTempoScore(scoreTempoMap, startTime, endTime);
    scoreGlobalPrefix = [baseGlobalSco, tempoStatement]
      .filter((section) => section.length > 0)
      .join('\n');
  } else {
    tempoMap = getTempoMapFromScoreText(baseGlobalSco);
  }

  const arrangementGlobalSco = clonedArrangement.generateGlobalSco(compileData);
  // Pruned tracks still hold their scheduling share of the render length.
  const totalDur = Math.max(getNoteListDuration(blueData, noteList), prunedDurationSink.value);
  const processingStart = startTime;
  const globalSco = preprocessSco(
    [scoreGlobalPrefix, arrangementGlobalSco].filter(Boolean).join('\n'),
    totalDur,
    startTime,
    processingStart,
    tempoMap,
  );
  let globalDur = getNoteListDurationFromText(blueData, globalSco);
  if (globalDur < totalDur) {
    globalDur = totalDur;
  }
  if (clonedMixer.isEnabled()) {
    globalDur += clonedMixer.getExtraRenderTime();
  }

  const alwaysOnInstruments = collectAlwaysOnInstruments(
    blueData,
    clonedArrangement,
    clonedMixer,
    channelIdAssignments,
    parameterMap,
    compileData,
    nchnls,
  );

  for (const instrument of alwaysOnInstruments) {
    const sourceId = compileData.getInstrSourceId(instrument);
    if (sourceId && /^\d+$/.test(sourceId)) {
      const instrId = clonedArrangement.addInstrumentAtEnd(instrument);
      addScoreNote(blueData, noteList, `i${instrId} 0 ${globalDur}`);
    } else {
      const alwaysOnId = `${sourceId ?? 'unknown'}_alwaysOn`;
      clonedArrangement.addInstrumentWithId(instrument, alwaysOnId, false);
      addScoreNote(blueData, noteList, `i"${alwaysOnId}" 0 ${globalDur}`);
    }
  }

  let mixerEffectUDOs: string[] = [];
  let mixerInstruments = '';
  if (clonedMixer.isEnabled()) {
    const mixerOutput = generateMixerOrchestra(
      blueData,
      channelIdAssignments,
      nchnls,
      udos,
      compileData,
      clonedMixer,
      actualEmitMetering,
      gateContext,
      pruneInaudibleTracks,
    );
    mixerEffectUDOs = mixerOutput.effectUDOs;
    mixerInstruments = mixerOutput.instrumentsText;
    addScoreNote(blueData, noteList, `i"BlueMixer" 0 ${globalDur}`);
  }

  if (profile === 'disk') {
    appendParameterAutomationNotes(
      blueData,
      allParameters,
      noteList,
      clonedArrangement,
      startTime,
      startTime + globalDur,
    );
  }

  const arrangementGlobalOrc = processCommandBlocks(
    clonedArrangement.generateGlobalOrc(compileData),
  );

  const initStatements = buildRuntimeInitStatements(
    blueData,
    allParameters,
    allStringChannels,
    profile,
    startTime,
  );
  if (initStatements.length > 0) {
    appendStandardGlobalOrc(state, `${initStatements}\n`);
  }

  const compileGlobalOrc = compileData.getGlobalOrc();
  if (compileGlobalOrc.trim().length > 0) {
    appendStandardGlobalOrc(state, compileGlobalOrc);
  }

  const allUDOText: string[] = [];
  const masterUDOText = udos.toString().trim();
  if (masterUDOText.length > 0) {
    allUDOText.push(masterUDOText);
  }
  if (mixerEffectUDOs.length > 0) {
    allUDOText.push(...mixerEffectUDOs);
  }
  const udoText = allUDOText.length > 0 ? `${allUDOText.join('\n')}\n` : '';

  return {
    allParameters,
    allStringChannels,
    parameterMap,
    globalSco,
    mixerInstruments,
    arrangementGlobalOrc,
    udoText,
  };
}

function assembleStandardCSDResult(
  state: StandardCSDState,
  inputs: StandardCSDOrchestraInputs,
  noteList: NoteList,
  orc: string,
): RenderCsdResult {
  const {
    blueData,
    clonedTables,
    clonedMixer,
    compileData,
    actualEmitMetering,
    channelIdAssignments,
    gateContext,
    gateBindings,
    orchestraHeader,
    nchnls,
    pannerBindings,
  } = state;

  const scoreText = buildScoreText(
    blueData,
    clonedTables.getAllTables(),
    inputs.globalSco,
    noteList,
  );
  const projectInfo = buildProjectInfo(blueData);

  const csdText =
    projectInfo +
    '<CsoundSynthesizer>\n\n' +
    '<CsInstruments>\n' +
    orchestraHeader +
    '\n\n' +
    state.globalOrc +
    '\n\n' +
    inputs.arrangementGlobalOrc +
    '\n\n' +
    inputs.udoText +
    '\n\n' +
    orc +
    inputs.mixerInstruments +
    '\n\n</CsInstruments>\n\n' +
    '<CsScore>\n\n' +
    scoreText +
    '</CsScore>\n\n' +
    '</CsoundSynthesizer>';

  return {
    csdText,
    parameters: inputs.allParameters,
    stringChannels: inputs.allStringChannels,
    midiInstrumentTargets: [],
    blueX7Bindings: compileData.getBlueX7Bindings(),
    meterBindingMap:
      actualEmitMetering && clonedMixer.isEnabled()
        ? buildMeterBindingMap(clonedMixer, channelIdAssignments, nchnls)
        : undefined,
    mixerGateBindings: gateContext?.mode === 'live' ? gateBindings : undefined,
    pannerBindings,
  };
}

function cleanupStandardCSDState(
  compileData: CompileData,
  logPrefix: string,
  generationError: unknown,
): void {
  try {
    disposeJavaScriptCompileState(compileData);
  } catch (cleanupError) {
    if (generationError === null) {
      throw cleanupError;
    }
    console.warn(`${logPrefix} Failed to dispose JavaScript runtime state:`, cleanupError);
  }
}

export function buildStandardCSD(
  blueData: BlueData,
  profile: CsdRenderProfile,
  session?: JavaScriptSession,
  emitMetering = false,
  layoutManifest?: AudioLayoutManifest | null,
): RenderCsdResult {
  const state = createStandardCSDState(
    blueData,
    profile,
    session,
    undefined,
    emitMetering,
    layoutManifest,
  );
  let generationError: unknown = null;
  const logPrefix = profile === 'disk' ? '[BlueData.toDiskCSD]' : '[BlueData.toCSD]';

  try {
    const scoreOptions = prepareStandardCSDScoreGeneration(state);
    const noteList = getBlueDataState(blueData).score.generateForCSD(
      state.compileData,
      state.startTime,
      state.endTime,
      scoreOptions,
    );
    const inputs = prepareStandardCSDOrchestraInputs(state, noteList);
    const orc = state.clonedArrangement.generateOrchestra(
      state.compileData,
      state.clonedMixer,
      state.nchnls,
      inputs.parameterMap,
    );
    return assembleStandardCSDResult(state, inputs, noteList, orc);
  } catch (error) {
    generationError = error;
    throw error;
  } finally {
    cleanupStandardCSDState(state.compileData, logPrefix, generationError);
  }
}

export async function buildStandardCSDAsync(
  blueData: BlueData,
  profile: CsdRenderProfile,
  session?: JavaScriptSession,
  runtimeClient?: JavaRuntimeClientContract | null,
  emitMetering = false,
  layoutManifest?: AudioLayoutManifest | null,
): Promise<RenderCsdResult> {
  const state = createStandardCSDState(
    blueData,
    profile,
    session,
    runtimeClient,
    emitMetering,
    layoutManifest,
  );
  let generationError: unknown = null;
  const logPrefix = profile === 'disk' ? '[BlueData.toDiskCSDAsync]' : '[BlueData.toCSDAsync]';

  try {
    const scoreOptions = prepareStandardCSDScoreGeneration(state);
    const noteList = await getBlueDataState(blueData).score.generateForCSDAsync(
      state.compileData,
      state.startTime,
      state.endTime,
      scoreOptions,
    );
    const inputs = prepareStandardCSDOrchestraInputs(state, noteList);
    const orc = await state.clonedArrangement.generateOrchestraAsync(
      state.compileData,
      state.clonedMixer,
      state.nchnls,
      inputs.parameterMap,
    );
    return assembleStandardCSDResult(state, inputs, noteList, orc);
  } catch (error) {
    generationError = error;
    throw error;
  } finally {
    cleanupStandardCSDState(state.compileData, logPrefix, generationError);
  }
}

export function toBlueLiveCSD(
  blueData: BlueData,
  session?: JavaScriptSession,
  emitMetering = false,
  layoutManifest?: AudioLayoutManifest | null,
): RenderCsdResult {
  return buildBlueLiveCSD(blueData, session, emitMetering, layoutManifest) as RenderCsdResult;
}

export async function toBlueLiveCSDAsync(
  blueData: BlueData,
  session?: JavaScriptSession,
  runtimeClient?: JavaRuntimeClientContract | null,
  emitMetering = false,
  layoutManifest?: AudioLayoutManifest | null,
): Promise<RenderCsdResult> {
  return buildBlueLiveCSD(blueData, session, emitMetering, layoutManifest, runtimeClient, true);
}

function buildBlueLiveCSD(
  blueData: BlueData,
  session?: JavaScriptSession,
  emitMetering = false,
  layoutManifest?: AudioLayoutManifest | null,
  runtimeClient?: JavaRuntimeClientContract | null,
  asynchronous = false,
): RenderCsdResult | Promise<RenderCsdResult> {
  const {
    arrangement: clonedArrangement,
    tables: clonedTables,
    mixer: clonedMixer,
    compileData,
  } = createRenderSnapshot(blueData, session, runtimeClient, layoutManifest);
  let generationError: unknown = null;
  let pending = false;
  const cleanup = () => {
    try {
      disposeJavaScriptCompileState(compileData);
    } catch (cleanupError) {
      if (generationError === null) {
        throw cleanupError;
      }
      console.warn(
        '[BlueData.toBlueLiveCSD] Failed to dispose JavaScript runtime state:',
        cleanupError,
      );
    }
  };

  try {
    const channelIdAssignments = assignChannelIds(blueData, clonedMixer);
    for (const [channel, id] of channelIdAssignments) {
      compileData.getChannelIdAssignments().set(channel, id);
    }
    compileData.setMixerEnabled(clonedMixer.isEnabled());
    const gateContext = buildBlueMixerGateContext(clonedMixer, 'live');
    const gateBindings = gateContext ? buildCompiledMixerGateBindings(gateContext) : undefined;

    const orchestraHeader = buildOrchestraHeader(blueData);
    const nchnls = getNchnls(blueData);
    configureCompileChannels(compileData, nchnls);
    const pannerBindings =
      clonedMixer.isEnabled() && compileData.isPanningEnabled() && nchnls === 2
        ? buildCompiledPannerBindings(clonedMixer)
        : undefined;

    let globalOrc = getBlueDataState(blueData).globalOrcSco.getGlobalOrc() || '';
    let globalSco = getBlueDataState(blueData).globalOrcSco.getGlobalSco() || '';

    const appendGlobalOrc = (section: string) => {
      if (!section) return;
      globalOrc += `\n${section}`;
    };

    if (clonedMixer.isEnabled()) {
      const mixerInits = clonedMixer.getInitStatements(channelIdAssignments, nchnls, emitMetering);
      if (mixerInits) {
        appendGlobalOrc(`${mixerInits}\n\n`);
      }
      if (gateContext && gateBindings) {
        const gateInits = buildMixerGateInitStatements(gateBindings);
        if (gateInits) {
          appendGlobalOrc(`${gateInits}\n\n`);
        }
      }
      if (pannerBindings) {
        const pannerInits = buildPannerInitStatements(blueData, pannerBindings, clonedMixer);
        if (pannerInits) {
          appendGlobalOrc(`${pannerInits}\n\n`);
        }
      }
    }

    const udos = new OpcodeList(getBlueDataState(blueData).opcodeList);
    clonedArrangement.generateUserDefinedOpcodes(udos);

    const parameters = getAllParameters(
      clonedArrangement,
      clonedMixer,
      compileData.isPanningEnabled(),
    );
    assignParameterNames(parameters);
    const stringChannels = collectStringChannels(blueData, clonedArrangement);
    compileData.registerExistingAutomationState(parameters, stringChannels);
    const stringInits = buildStringChannelInits(blueData, compileData.getStringChannels());
    const paramInits = buildParameterInits(
      blueData,
      compileData.getOriginalParameters(),
      'realtime',
      getBlueDataState(blueData).renderStartTime,
      false,
    );
    const runtimeInitStatements = [stringInits, paramInits]
      .filter((section) => section.length > 0)
      .join('\n');
    if (runtimeInitStatements) {
      appendGlobalOrc(`${runtimeInitStatements}\n`);
    }

    clonedArrangement.generateFTables(clonedTables);
    compileData.registerBlueX7CompiledBindings();

    const ftables = clonedTables.getAllTables();
    const parameterMap = buildParameterMap(blueData, clonedArrangement);
    const totalDur = 36000;

    const baseArrangementItems = clonedArrangement
      .getArrangement()
      .filter((ia) => ia.enabled && ia.instr);
    const baseInstrIds = baseArrangementItems
      .map((ia) => ia.arrangementId)
      .filter((id): id is string => Boolean(id));

    const midiInstrumentTargets = compileData.getCompiledMidiInstrumentTargets();

    const alwaysOnInstruments = collectAlwaysOnInstruments(
      blueData,
      clonedArrangement,
      clonedMixer,
      channelIdAssignments,
      parameterMap,
      compileData,
      nchnls,
    );

    let blueLiveSco = `${globalSco}\n`;
    for (const instrument of alwaysOnInstruments) {
      const sourceId = compileData.getInstrSourceId(instrument);
      if (sourceId && /^\d+$/.test(sourceId)) {
        const instrId = clonedArrangement.addInstrumentAtEnd(instrument);
        blueLiveSco += `i${instrId} 0 ${totalDur}\n`;
      } else {
        const alwaysOnId = `${sourceId ?? 'unknown'}_alwaysOn`;
        clonedArrangement.addInstrumentWithId(instrument, alwaysOnId, false);
        blueLiveSco += `i "${alwaysOnId}" 0 ${totalDur}\n`;
      }
    }

    let mixerEffectUDOs: string[] = [];
    let mixerInstruments = '';
    if (clonedMixer.isEnabled()) {
      const mixerOutput = generateMixerOrchestra(
        blueData,
        channelIdAssignments,
        nchnls,
        udos,
        compileData,
        clonedMixer,
        emitMetering,
        gateContext,
      );
      mixerEffectUDOs = mixerOutput.effectUDOs;
      mixerInstruments = mixerOutput.instrumentsText;
    }

    const arrangementGlobalOrc = clonedArrangement.generateGlobalOrc(compileData);
    const allUDOText: string[] = [];
    const masterUDOText = udos.toString().trim();
    if (masterUDOText.length > 0) {
      allUDOText.push(masterUDOText);
    }
    if (mixerEffectUDOs.length > 0) {
      allUDOText.push(...mixerEffectUDOs);
    }
    const udoText = allUDOText.length > 0 ? `${allUDOText.join('\n')}\n` : '';

    const finish = (orc: string): RenderCsdResult => {
      let blueLiveOrc = orc + mixerInstruments;
      blueLiveOrc += '\n\n' + createAllNotesOffInstrument(blueData, baseInstrIds);

      if (clonedMixer.isEnabled()) {
        blueLiveSco += `i "BlueMixer" 0 ${totalDur}\n`;
      }

      const projectInfo = buildProjectInfo(blueData);

      const csdText =
        projectInfo +
        '<CsoundSynthesizer>\n\n' +
        '<CsInstruments>\n' +
        orchestraHeader +
        '\n\n' +
        globalOrc +
        '\n\n' +
        arrangementGlobalOrc +
        '\n\n' +
        udoText +
        '\n\n' +
        blueLiveOrc +
        '\n\n</CsInstruments>\n\n' +
        '<CsScore>\n\n' +
        ftables +
        '\n\n' +
        blueLiveSco +
        'e ' +
        totalDur +
        '\n\n' +
        '</CsScore>\n\n' +
        '</CsoundSynthesizer>';

      return {
        csdText,
        parameters: compileData.getOriginalParameters(),
        stringChannels: compileData.getStringChannels(),
        midiInstrumentTargets,
        blueX7Bindings: compileData.getBlueX7Bindings(),
        meterBindingMap:
          emitMetering && clonedMixer.isEnabled()
            ? buildMeterBindingMap(clonedMixer, channelIdAssignments, nchnls)
            : undefined,
        mixerGateBindings: gateBindings ?? undefined,
        pannerBindings,
      };
    };
    if (asynchronous) {
      pending = true;
      return clonedArrangement
        .generateOrchestraAsync(compileData, clonedMixer, nchnls, parameterMap)
        .then(finish)
        .catch((error) => {
          generationError = error;
          throw error;
        })
        .finally(cleanup);
    }
    return finish(
      clonedArrangement.generateOrchestra(compileData, clonedMixer, nchnls, parameterMap),
    );
  } catch (error) {
    generationError = error;
    throw error;
  } finally {
    if (!pending) cleanup();
  }
}

function createAllNotesOffInstrument(blueData: BlueData, instrIds: string[]): string {
  const lines: string[] = [];
  lines.push('\tinstr blueAllNotesOff');
  lines.push('koff init 0');
  lines.push('if (koff == 0) then');

  for (let i = 0; i < instrIds.length; i++) {
    const id = instrIds[i] ?? '';
    const parts = id
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    for (let j = 0; j < parts.length; j++) {
      const part = parts[j] ?? '';
      const numId = parseInt(part, 10);
      if (!isNaN(numId)) {
        lines.push(`turnoff2 ${numId}, 0, 1`);
      } else {
        lines.push(`insno${i}${j} nstrnum "${part}"`);
        lines.push(`turnoff2 insno${i}${j}, 0, 1`);
      }
    }
  }

  lines.push('koff = 1');
  lines.push('else');
  lines.push('turnoff');
  lines.push('endif');
  lines.push('');
  lines.push('\tendin');
  lines.push('');

  return lines.join('\n');
}

/**
 * Build the orchestra header (sr/ksmps/nchnls/0dbfs).
 */
