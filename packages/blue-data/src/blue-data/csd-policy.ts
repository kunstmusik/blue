import type { BlueData } from '../blue-data';
import { BLUE_VERSION } from '../blue-constants';
import { Arrangement } from '../arrangement';
import { ProjectProperties } from '../project-properties';
import { GlobalOrcSco } from '../global-orc-sco';
import { Tables } from '../tables';
import { Score } from '../score/score';
import { TrackLayerGroup } from '../score/track/track-layer-group';
import { Track } from '../score/track/track';
import { AudioClip } from '../score/audio/audio-clip';
import { Note } from '../sound-objects/note';
import { NoteList } from '../sound-objects/note-list';
import { Mixer, buildSubChannelMeterKeys } from '../mixer/mixer';
import { OpcodeList } from '../opcodes/opcode-list';
import { Parameter } from '../automation/parameter';
import { Instrument } from '../instruments/instrument';
import { GenericInstrument } from '../instruments/generic-instrument';
import { CompileData } from '../compile-data';
import type {
  CompiledBlueX7Binding,
  CompiledMidiInstrumentTarget,
  CompiledMeterChannelBinding,
  CompiledMixerGateBinding,
  CompiledMixerGateBindings,
  CompiledMixerGateLocator,
  MeterBindingMap,
} from '../compile-data';
import {
  buildMixerRouteGraph,
  computeMixerGateState,
  getMixerRouteSignature,
  sortSubChannelsForRendering,
  type MixerGateState,
  type MixerRouteGraph,
} from '../mixer/mute-solo-policy';
import { Effect } from '../mixer/effect';
import { EffectsChain } from '../mixer/effects-chain';
import { Channel } from '../mixer/channel';
import { Send } from '../mixer/send';
import { UDOStyle } from '../opcodes/udo-style';
import { BSBCompilationUnit } from '../instruments/blue-synth-builder/bsb-compilation-unit';
import { getAllParameters, assignParameterNames } from '../automation/parameter-helper';
import {
  appendParameterScoreJava,
  getParameterInstrumentTextJava,
} from '../automation/csd-parameter-automation';
import { formatBlueNumber } from '../utilities/number-format';
import { disposeJavaScriptCompileState, setJavaScriptSession } from '../javascript-runtime';
import type { JavaScriptSession } from '../javascript-runtime';
import { setJavaRuntimeClient } from '../java-runtime';
import type { JavaRuntimeClientContract } from '../java-runtime';
import {
  processCommandBlocks,
  preprocessSco,
  getTempoScore,
  getTempoMapFromScoreText,
} from '../utilities/csd-render';
import { getNotes } from '../utilities/score';
import { TempoMap } from '../time/tempo-map';

type CsdRenderProfile = 'realtime' | 'disk';

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

export function buildStandardCSD(
  blueData: BlueData,
  profile: CsdRenderProfile,
  session?: JavaScriptSession,
  emitMetering = false,
): RenderCsdResult {
  const {
    arrangement: clonedArrangement,
    tables: clonedTables,
    mixer: clonedMixer,
    compileData,
  } = createRenderSnapshot(blueData, session);
  let generationError: unknown = null;
  const logPrefix = profile === 'disk' ? '[BlueData.toDiskCSD]' : '[BlueData.toCSD]';
  const actualEmitMetering = profile === 'realtime' && emitMetering;

  try {
    const channelIdAssignments = assignChannelIds(blueData, clonedMixer);
    for (const [channel, id] of channelIdAssignments) {
      compileData.getChannelIdAssignments().set(channel, id);
    }
    compileData.setMixerEnabled(clonedMixer.isEnabled());
    const gateContext = buildBlueMixerGateContext(
      clonedMixer,
      profile === 'disk' ? 'fixed' : 'live',
    );
    const gateBindings = gateContext ? buildCompiledMixerGateBindings(gateContext) : undefined;

    // Build CsInstruments header (sr/ksmps/nchnls/0dbfs go here, not in CsOptions)
    const orchestraHeader = buildOrchestraHeader(blueData, profile);
    const nchnls = getNchnls(blueData, profile);

    // Global orchestra/sco from stored data
    let globalOrc = getBlueDataState(blueData).globalOrcSco.getGlobalOrc() || '';
    const baseGlobalSco = getBlueDataState(blueData).globalOrcSco.getGlobalSco() || '';

    const appendGlobalOrc = (section: string) => {
      if (!section) {
        return;
      }
      if (globalOrc.length > 0 && !globalOrc.endsWith('\n')) {
        globalOrc += '\n';
      }
      globalOrc += section;
    };

    // Mixer init statements
    if (clonedMixer.isEnabled()) {
      const mixerInits = clonedMixer.getInitStatements(
        channelIdAssignments,
        nchnls,
        actualEmitMetering,
      );
      if (mixerInits) {
        // Java appends an extra newline after mixer init statements before
        // adding them to GlobalOrcSco, which preserves a two-blank-line gap
        // before parameter init statements.
        appendGlobalOrc(`${mixerInits}\n\n`);
      }
      if (gateContext && gateBindings && gateContext.mode === 'live') {
        const gateInits = buildMixerGateInitStatements(gateBindings);
        if (gateInits) {
          appendGlobalOrc(`${gateInits}\n\n`);
        }
      }
    }

    const udos = new OpcodeList(getBlueDataState(blueData).opcodeList);
    clonedArrangement.generateUserDefinedOpcodes(udos);

    const parameters = getAllParameters(clonedArrangement, clonedMixer);
    assignParameterNames(parameters);
    const stringChannels = collectStringChannels(blueData, clonedArrangement);
    compileData.registerExistingAutomationState(parameters, stringChannels);

    appendFtgenTableNumbers(globalOrc, clonedTables);
    clonedArrangement.generateFTables(clonedTables);
    compileData.registerBlueX7CompiledBindings();

    const ftables = clonedTables.getAllTables();

    // Score → score events
    const { startTime, endTime } = getRenderWindow(blueData, profile);
    const pruneInaudibleTracks =
      gateContext?.mode === 'fixed' ? computeDiskPruningSet(blueData, gateContext) : undefined;
    const prunedDurationSink = { value: 0 };
    const noteList = getBlueDataState(blueData).score.generateForCSD(
      compileData,
      startTime,
      endTime,
      {
        trackLayerMuteSoloMode: getEffectiveTrackLayerMuteSoloMode(
          blueData,
          clonedMixer.isEnabled(),
        ),
        pruneInaudibleTracks:
          pruneInaudibleTracks && pruneInaudibleTracks.size > 0 ? pruneInaudibleTracks : undefined,
        prunedDurationSink,
      },
    );
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
        clonedMixer,
        actualEmitMetering,
        gateContext,
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
      appendGlobalOrc(`${initStatements}\n`);
    }

    const compileGlobalOrc = compileData.getGlobalOrc();
    if (compileGlobalOrc.trim().length > 0) {
      appendGlobalOrc(compileGlobalOrc);
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

    const orc = clonedArrangement.generateOrchestra(compileData, clonedMixer, nchnls, parameterMap);

    const scoreText = buildScoreText(blueData, ftables, globalSco, noteList);

    // Build project info comments
    const projectInfo = buildProjectInfo(blueData);

    // Assemble CSD
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
      orc +
      mixerInstruments +
      '\n\n</CsInstruments>\n\n' +
      '<CsScore>\n\n' +
      scoreText +
      '</CsScore>\n\n' +
      '</CsoundSynthesizer>';

    return {
      csdText,
      parameters: allParameters,
      stringChannels: allStringChannels,
      midiInstrumentTargets: [],
      blueX7Bindings: compileData.getBlueX7Bindings(),
      meterBindingMap:
        actualEmitMetering && clonedMixer.isEnabled()
          ? buildMeterBindingMap(clonedMixer, channelIdAssignments, nchnls)
          : undefined,
      mixerGateBindings: gateContext?.mode === 'live' ? gateBindings : undefined,
    };
  } catch (error) {
    generationError = error;
    throw error;
  } finally {
    try {
      disposeJavaScriptCompileState(compileData);
    } catch (cleanupError) {
      if (generationError === null) {
        throw cleanupError;
      }
      console.warn(`${logPrefix} Failed to dispose JavaScript runtime state:`, cleanupError);
    }
  }
}

export async function buildStandardCSDAsync(
  blueData: BlueData,
  profile: CsdRenderProfile,
  session?: JavaScriptSession,
  runtimeClient?: JavaRuntimeClientContract | null,
  emitMetering = false,
): Promise<RenderCsdResult> {
  const {
    arrangement: clonedArrangement,
    tables: clonedTables,
    mixer: clonedMixer,
    compileData,
  } = createRenderSnapshot(blueData, session, runtimeClient);
  let generationError: unknown = null;
  const logPrefix = profile === 'disk' ? '[BlueData.toDiskCSDAsync]' : '[BlueData.toCSDAsync]';
  const actualEmitMetering = profile === 'realtime' && emitMetering;

  try {
    const channelIdAssignments = assignChannelIds(blueData, clonedMixer);
    for (const [channel, id] of channelIdAssignments) {
      compileData.getChannelIdAssignments().set(channel, id);
    }
    compileData.setMixerEnabled(clonedMixer.isEnabled());
    const gateContext = buildBlueMixerGateContext(
      clonedMixer,
      profile === 'disk' ? 'fixed' : 'live',
    );
    const gateBindings = gateContext ? buildCompiledMixerGateBindings(gateContext) : undefined;

    const orchestraHeader = buildOrchestraHeader(blueData, profile);
    const nchnls = getNchnls(blueData, profile);

    let globalOrc = getBlueDataState(blueData).globalOrcSco.getGlobalOrc() || '';
    const baseGlobalSco = getBlueDataState(blueData).globalOrcSco.getGlobalSco() || '';

    const appendGlobalOrc = (section: string) => {
      if (!section) {
        return;
      }
      if (globalOrc.length > 0 && !globalOrc.endsWith('\n')) {
        globalOrc += '\n';
      }
      globalOrc += section;
    };

    if (clonedMixer.isEnabled()) {
      const mixerInits = clonedMixer.getInitStatements(
        channelIdAssignments,
        nchnls,
        actualEmitMetering,
      );
      if (mixerInits) {
        appendGlobalOrc(`${mixerInits}\n\n`);
      }
      if (gateContext && gateBindings && gateContext.mode === 'live') {
        const gateInits = buildMixerGateInitStatements(gateBindings);
        if (gateInits) {
          appendGlobalOrc(`${gateInits}\n\n`);
        }
      }
    }

    const udos = new OpcodeList(getBlueDataState(blueData).opcodeList);
    clonedArrangement.generateUserDefinedOpcodes(udos);

    const parameters = getAllParameters(clonedArrangement, clonedMixer);
    assignParameterNames(parameters);
    const stringChannels = collectStringChannels(blueData, clonedArrangement);
    compileData.registerExistingAutomationState(parameters, stringChannels);

    appendFtgenTableNumbers(globalOrc, clonedTables);
    clonedArrangement.generateFTables(clonedTables);
    compileData.registerBlueX7CompiledBindings();

    const ftables = clonedTables.getAllTables();

    const { startTime, endTime } = getRenderWindow(blueData, profile);
    const pruneInaudibleTracks =
      gateContext?.mode === 'fixed' ? computeDiskPruningSet(blueData, gateContext) : undefined;
    const prunedDurationSink = { value: 0 };
    const noteList = await getBlueDataState(blueData).score.generateForCSDAsync(
      compileData,
      startTime,
      endTime,
      {
        trackLayerMuteSoloMode: getEffectiveTrackLayerMuteSoloMode(
          blueData,
          clonedMixer.isEnabled(),
        ),
        pruneInaudibleTracks:
          pruneInaudibleTracks && pruneInaudibleTracks.size > 0 ? pruneInaudibleTracks : undefined,
        prunedDurationSink,
      },
    );
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
        clonedMixer,
        actualEmitMetering,
        gateContext,
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
      appendGlobalOrc(`${initStatements}\n`);
    }

    const compileGlobalOrc = compileData.getGlobalOrc();
    if (compileGlobalOrc.trim().length > 0) {
      appendGlobalOrc(compileGlobalOrc);
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

    const orc = await clonedArrangement.generateOrchestraAsync(
      compileData,
      clonedMixer,
      nchnls,
      parameterMap,
    );

    const scoreText = buildScoreText(blueData, ftables, globalSco, noteList);

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
      orc +
      mixerInstruments +
      '\n\n</CsInstruments>\n\n' +
      '<CsScore>\n\n' +
      scoreText +
      '</CsScore>\n\n' +
      '</CsoundSynthesizer>';

    return {
      csdText,
      parameters: allParameters,
      stringChannels: allStringChannels,
      midiInstrumentTargets: [],
      blueX7Bindings: compileData.getBlueX7Bindings(),
      meterBindingMap:
        actualEmitMetering && clonedMixer.isEnabled()
          ? buildMeterBindingMap(clonedMixer, channelIdAssignments, nchnls)
          : undefined,
      mixerGateBindings: gateContext?.mode === 'live' ? gateBindings : undefined,
    };
  } catch (error) {
    generationError = error;
    throw error;
  } finally {
    try {
      disposeJavaScriptCompileState(compileData);
    } catch (cleanupError) {
      if (generationError === null) {
        throw cleanupError;
      }
      console.warn(`${logPrefix} Failed to dispose JavaScript runtime state:`, cleanupError);
    }
  }
}

export function toBlueLiveCSD(
  blueData: BlueData,
  session?: JavaScriptSession,
  emitMetering = false,
): RenderCsdResult {
  const {
    arrangement: clonedArrangement,
    tables: clonedTables,
    mixer: clonedMixer,
    compileData,
  } = createRenderSnapshot(blueData, session);
  let generationError: unknown = null;

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
    }

    const udos = new OpcodeList(getBlueDataState(blueData).opcodeList);
    clonedArrangement.generateUserDefinedOpcodes(udos);

    const parameters = getAllParameters(clonedArrangement, clonedMixer);
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

    const orc = clonedArrangement.generateOrchestra(compileData, clonedMixer, nchnls, parameterMap);

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
    };
  } catch (error) {
    generationError = error;
    throw error;
  } finally {
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

// ─── Conservative disk pruning eligibility (Spec 111 US3) ───

const NO_PRUNING: ReadonlySet<string> = new Set();

/**
 * Certifies a project for disk event pruning. Only built-in AudioClip-only
 * Track projects qualify: no custom global orchestra/score, no project UDOs,
 * no score/track note processors, no enabled arrangement instruments, no
 * opaque enabled mixer effects, valid acyclic routing. Every uncertain case
 * disables pruning entirely and falls back to ordinary gated rendering.
 */
function computeDiskPruningSet(
  blueData: BlueData,
  gateContext: BlueMixerGateContext,
): ReadonlySet<string> {
  const state = getBlueDataState(blueData);

  if (!gateContext.state.acyclic || gateContext.state.hasUnresolvedRoutes) return NO_PRUNING;
  if ((state.globalOrcSco.getGlobalOrc() ?? '').trim().length > 0) return NO_PRUNING;
  if ((state.globalOrcSco.getGlobalSco() ?? '').trim().length > 0) return NO_PRUNING;
  if (state.opcodeList.getOpcodes().length > 0) return NO_PRUNING;
  if (state.score.getNoteProcessorChain().getProcessors().length > 0) return NO_PRUNING;
  for (const group of state.score) {
    if (!(group instanceof TrackLayerGroup)) {
      return NO_PRUNING;
    }
  }
  for (const ia of state.arrangement.getArrangement()) {
    if (ia.enabled && ia.instr) return NO_PRUNING;
  }

  // No enabled effect anywhere in the mixer: effects are opaque code whose
  // state or side effects cannot be proven irrelevant.
  const chains = [
    ...state.mixer.getAllSourceChannels(),
    ...state.mixer.getSubChannels(),
    state.mixer.getMaster(),
  ].flatMap((channel) => [channel.getPreEffects(), channel.getPostEffects()]);
  for (const chain of chains) {
    for (const item of chain) {
      if (item instanceof Effect && item.isEnabled()) return NO_PRUNING;
    }
  }

  const prune = new Set<string>();
  for (const group of state.score) {
    if (!(group instanceof TrackLayerGroup)) continue;
    for (const track of group as TrackLayerGroup & Track[]) {
      const t = track as Track;
      if (!isAudioClipOnlyTrack(t)) continue;
      if (t.getNoteProcessorChain().getProcessors().length > 0) continue;
      if (!isTrackInaudible(gateContext, t.getUniqueId())) continue;
      prune.add(t.getUniqueId());
    }
  }
  return prune;
}

function isAudioClipOnlyTrack(track: Track): boolean {
  for (const item of track) {
    if (!(item instanceof AudioClip)) return false;
  }
  return track.length > 0;
}

/**
 * True when no permitted route from the track's associated channel reaches
 * the master terminal output. Tracks without an associated channel bypass
 * channel gates entirely and are never pruned (conservative fallback).
 */
function isTrackInaudible(gateContext: BlueMixerGateContext, trackId: string): boolean {
  const channel = gateContext.orderedChannels.find(
    (candidate) => candidate.getAssociation() === trackId,
  );
  if (!channel) return false;
  const nodeOrdinal = gateContext.graph.nodes.findIndex(
    (node) => gateContext.orderedChannels[node.ordinal] === channel,
  );
  if (nodeOrdinal < 0) return false;
  const indicator = gateContext.state.channels.find(
    (candidate) => candidate.ordinal === nodeOrdinal,
  );
  if (!indicator) return false;
  return !indicator.reachesAudibleOutput;
}

function buildOrchestraHeader(blueData: BlueData, profile: CsdRenderProfile = 'realtime'): string {
  const props = getBlueDataState(blueData).projectProperties;
  const isDisk = profile === 'disk';
  const nchnls = getNchnls(blueData, profile);

  const lines: string[] = [];
  if (isDisk) {
    if (props.diskSampleRate) lines.push(`sr=${props.diskSampleRate}`);
    if (props.diskKsmps) lines.push(`ksmps=${props.diskKsmps}`);
  } else {
    if (props.sampleRate) lines.push(`sr=${props.sampleRate}`);
    if (props.ksmps) lines.push(`ksmps=${props.ksmps}`);
  }
  lines.push(`nchnls=${nchnls}`);
  if (isDisk) {
    if (props.diskUseZeroDbFS) lines.push(`0dbfs=${props.diskZeroDbFS}`);
  } else if (props.useZeroDbFS) {
    lines.push(`0dbfs=${props.zeroDbFS}`);
  }

  return lines.join('\n');
}

/**
 * Get the number of channels for real-time playback.
 */
function getNchnls(blueData: BlueData, profile: CsdRenderProfile = 'realtime'): number {
  const props = getBlueDataState(blueData).projectProperties;
  const channels = profile === 'disk' ? props.diskChannels : props.channels;
  if (channels) {
    const n = parseInt(channels, 10);
    if (!isNaN(n)) return n;
  }
  return 2; // Default stereo
}

/**
 * Effective track header authority (Spec 111): Event whenever the mixer is
 * disabled, otherwise the parsed project preference (invalid values already
 * parse as Event).
 */
function getEffectiveTrackLayerMuteSoloMode(blueData: BlueData, mixerEnabled: boolean) {
  if (!mixerEnabled) return 'event' as const;
  return getBlueDataState(blueData).projectProperties.trackLayerMuteSoloMode;
}

function getRenderWindow(
  blueData: BlueData,
  profile: CsdRenderProfile,
): { startTime: number; endTime: number } {
  if (
    profile === 'disk' &&
    getBlueDataState(blueData).projectProperties.diskAlwaysRenderEntireProject
  ) {
    return { startTime: 0, endTime: -1 };
  }

  return {
    startTime: getBlueDataState(blueData).renderStartTime,
    endTime: getBlueDataState(blueData).renderEndTime,
  };
}

/**
 * Assign channel IDs for mixer init statements.
 * Mirrors Java's assignChannelIds().
 */
function assignChannelIds(
  blueData: BlueData,
  mixer: Mixer = getBlueDataState(blueData).mixer,
): Map<Channel, number> {
  const assignments = new Map<Channel, number>();
  let i = 0;

  // Source channels
  for (const channel of mixer.getAllSourceChannels()) {
    assignments.set(channel, i++);
  }

  // Sub channels
  for (const subChannel of mixer.getSubChannels()) {
    assignments.set(subChannel, i++);
  }

  assignments.set(mixer.getMaster(), i);

  return assignments;
}

/**
 * Build the score section with F-tables, globalSco, and generated score notes.
 */
export function buildScoreText(
  blueData: BlueData,
  ftables: string,
  globalSco: string,
  noteList: NoteList,
): string {
  const noteLines: string[] = [];

  // Generated notes
  if (noteList && noteList.length > 0) {
    for (let i = 0; i < noteList.length; i++) {
      noteLines.push(noteList.getNote(i).toScoreText());
    }
  }

  const scoreGlobalText = globalSco.trimEnd();

  const scoreNotesText = noteLines.length > 0 ? `${noteLines.join('\n')}\n` : '';

  return `${ftables}\n\n${scoreGlobalText}\n\n${scoreNotesText}e\n\n`;
}

function buildRuntimeInitStatements(
  blueData: BlueData,
  parameters: Parameter[],
  stringChannels: Array<{ objectName: string; value: string; channelName: string }>,
  profile: CsdRenderProfile = 'realtime',
  renderStartTime: number = getBlueDataState(blueData).renderStartTime,
): string {
  const stringInits = buildStringChannelInits(blueData, stringChannels, profile);
  const paramInits = buildParameterInits(blueData, parameters, profile, renderStartTime);

  return [stringInits, paramInits].filter((section) => section.length > 0).join('\n');
}

function collectAlwaysOnInstruments(
  blueData: BlueData,
  arrangement: Arrangement,
  mixer: Mixer,
  channelIdAssignments: Map<Channel, number>,
  parameterMap: Map<Instrument, Parameter[]>,
  compileData: CompileData,
): GenericInstrument[] {
  const alwaysOnInstruments: GenericInstrument[] = [];

  const sourceChannels = mixer.getAllSourceChannels();

  for (const ia of arrangement.getArrangement()) {
    if (!ia.enabled || !ia.instr) {
      continue;
    }

    const instr = ia.instr as any;
    let compiled = '';
    const instrParams = parameterMap.get(ia.instr);

    if (typeof instr.generateAlwaysOnInstrument === 'function') {
      compiled = instr.generateAlwaysOnInstrument(instrParams) ?? '';
    }

    if (!compiled && typeof instr.getAlwaysOnInstrumentText === 'function') {
      const alwaysOnText = instr.getAlwaysOnInstrumentText();
      if (!alwaysOnText) {
        continue;
      }

      const unit = new BSBCompilationUnit();
      if (typeof instr.getGraphicInterface === 'function') {
        instr.getGraphicInterface().collectReplacements(unit, instrParams);
      }
      compiled = unit.replaceBSBValues(alwaysOnText);
    }

    if (!compiled || compiled.trim().length === 0) {
      continue;
    }

    const sourceChannel = sourceChannels.find((channel) => channel.getName() === ia.arrangementId);
    const channelId = sourceChannel ? channelIdAssignments.get(sourceChannel) : undefined;

    if (channelId !== undefined) {
      compiled = compiled.replace(
        /(\w+),\s*(\w+)\s+blueMixerIn/g,
        `$1 = ga_bluemix_${channelId}_0\n $2 = ga_bluemix_${channelId}_1`,
      );
      compiled = compiled.replace(
        /blueMixerOut(\s+\w+),(\s*\w+)/g,
        `ga_bluemix_${channelId}_0 = $1\nga_bluemix_${channelId}_1 = $2`,
      );
    }

    const alwaysOnInstrument = new GenericInstrument();
    alwaysOnInstrument.setText(compiled);
    compileData.addInstrSourceId(alwaysOnInstrument, ia.arrangementId);
    alwaysOnInstruments.push(alwaysOnInstrument);
  }

  return alwaysOnInstruments;
}

function appendParameterAutomationNotes(
  blueData: BlueData,
  parameters: Parameter[],
  notes: NoteList,
  arrangement: Arrangement,
  renderStart: number,
  renderEnd: number,
): void {
  for (const param of parameters) {
    if (!param.isAutomationEnabled()) {
      continue;
    }

    const compilationVarName = param.getCompilationVarName();
    if (!compilationVarName) {
      continue;
    }

    const points = param.getPoints();
    if (points.length < 2) {
      continue;
    }

    const instr = new GenericInstrument();
    instr.setName(`Param: ${param.getName()}`);
    instr.setText(getParameterInstrumentTextJava(compilationVarName, param.getResolution()));

    const instrId = arrangement.addInstrumentAtEnd(instr);
    appendParameterScore(blueData, param, instrId, notes, renderStart, renderEnd);
  }
}

function appendParameterScore(
  blueData: BlueData,
  param: Parameter,
  instrId: number,
  notes: NoteList,
  renderStart: number,
  renderEnd: number,
): void {
  const score = appendParameterScoreJava({
    parameter: param,
    instrumentId: instrId,
    renderStart,
    renderEnd,
  });
  for (const line of score.split('\n')) {
    if (line.length > 0) {
      addScoreNote(blueData, notes, line);
    }
  }
}

function addScoreNote(blueData: BlueData, notes: NoteList, noteText: string): void {
  const note = Note.createNoteFromText(noteText);
  if (note) {
    notes.add(note);
  }
}

/**
 * Build project info comments for the top of the CSD.
 * Mirrors Java's appendProjectInfo().
 */
function buildProjectInfo(blueData: BlueData): string {
  const props = getBlueDataState(blueData).projectProperties;
  const notes = (props.notes || '').replace(/\n/g, '\n; ');

  return (
    ';\n' +
    `; "${props.title || ''}"\n` +
    `; by ${props.author || ''}\n` +
    ';\n' +
    `; ${notes}\n;\n` +
    `; Generated by blue ${BLUE_VERSION} (http://blue.kunstmusik.com)\n` +
    ';\n\n'
  );
}

function createRenderSnapshot(
  blueData: BlueData,
  session?: JavaScriptSession,
  runtimeClient?: JavaRuntimeClientContract | null,
): {
  arrangement: Arrangement;
  tables: Tables;
  mixer: Mixer;
  compileData: CompileData;
} {
  const arrangement = new Arrangement(getBlueDataState(blueData).arrangement);
  arrangement.clearUnusedInstrAssignments();
  const tables = new Tables(getBlueDataState(blueData).tableSet);
  const mixer = getBlueDataState(blueData).mixer.deepCopy() as Mixer;
  const compileData = new CompileData(arrangement, tables, false);
  getBlueDataState(blueData).score.prepareTrackInstruments(compileData);
  compileData.setHandleParametersAndChannels(true);

  if (session) {
    setJavaScriptSession(compileData, session);
  }

  if (runtimeClient) {
    setJavaRuntimeClient(compileData, runtimeClient);
  }

  return {
    arrangement,
    tables,
    mixer,
    compileData,
  };
}

function createRenderEndInstrument(blueData: BlueData): GenericInstrument {
  const instr = new GenericInstrument();
  instr.setText('event "e", 0, 0, 0.1');
  return instr;
}

function getNoteListDuration(blueData: BlueData, notes: NoteList): number {
  let max = 0;
  for (let i = 0; i < notes.length; i++) {
    const note = notes.getNote(i);
    const end = note.getStartTime() + note.getSubjectiveDuration();
    if (end > max) {
      max = end;
    }
  }
  return max;
}

function getNoteListDurationFromText(blueData: BlueData, scoreText: string): number {
  return getNoteListDuration(blueData, getNotes(scoreText));
}

/**
 * Build parameter init statements for globalOrc.
 * Uses standard chnexport so blue-engine can drive native Csound channels
 * and mirror them into shared memory for external readers.
 *
 * Output:
 *   gk_blue_auto0 init 0.5
 *   gk_blue_auto0 chnexport "gk_blue_auto0", 3
 *   ...
 */
function buildParameterInits(
  blueData: BlueData,
  parameters: Parameter[],
  profile: CsdRenderProfile = 'realtime',
  renderStartTime: number = getBlueDataState(blueData).renderStartTime,
  useRenderStartValue: boolean = true,
): string {
  const lines: string[] = [];

  for (const param of parameters) {
    const varName = param.getCompilationVarName();
    if (!varName) continue;

    const initialVal =
      param.isAutomationEnabled() && useRenderStartValue
        ? param.getValue(renderStartTime)
        : param.getFixedValue();

    // Init statement
    lines.push(`${varName} init ${formatBlueNumber(initialVal)}`);

    if (profile !== 'disk') {
      // Standard Csound channel export for engine-side channel bridging
      lines.push(`${varName} chnexport "${varName}", 3`);
    }
  }

  return lines.join('\n');
}

/**
 * Collect all StringChannels from BSB instruments in the arrangement.
 * Mirrors Java's getStringChannels() method.
 */
function collectStringChannels(
  blueData: BlueData,
  arrangement?: Arrangement,
): Array<{
  objectName: string;
  value: string;
  channelName: string;
}> {
  const channels: Array<{
    objectName: string;
    value: string;
    channelName: string;
  }> = [];
  let idx = 0;

  const arr = arrangement ?? getBlueDataState(blueData).arrangement;

  for (const ia of arr.getArrangement()) {
    if (!ia.enabled || !ia.instr) continue;
    const instr = ia.instr as any;
    if (typeof instr.getStringChannels === 'function') {
      for (const sc of instr.getStringChannels()) {
        const channelName = `gS_blue_str${idx++}`;
        sc.channelName = channelName;
        channels.push({
          objectName: sc.objectName,
          value: sc.value,
          channelName,
        });
      }
    }
  }

  return channels;
}

/**
 * Build a per-instrument parameter map for BSB compilation.
 * Each instrument gets its own Parameter[] with compilationVarName set.
 * This is used by generateInstrument() to replace widget values with gk_blue_autoN.
 */
function buildParameterMap(
  blueData: BlueData,
  arrangement?: Arrangement,
): Map<Instrument, Parameter[]> {
  const map = new Map<Instrument, Parameter[]>();
  const arr = arrangement ?? getBlueDataState(blueData).arrangement;

  for (const ia of arr.getArrangement()) {
    if (!ia.enabled || !ia.instr) continue;
    const instr = ia.instr as any;
    if (typeof instr.getParameters === 'function') {
      const instrParams = instr.getParameters();
      if (instrParams && Array.isArray(instrParams) && instrParams.length > 0) {
        map.set(ia.instr, instrParams);
      }
    }
  }

  return map;
}

/**
 * Build string channel init statements for globalOrc.
 * Mirrors Java's handleParameters() string channel handling.
 *
 * Output:
 *   gS_blue_str0 = "/path/to/file.wav"
 *   gS_blue_str0 chnexport "gS_blue_str0", 3
 *   ...
 */
function buildStringChannelInits(
  blueData: BlueData,
  channels: Array<{ objectName: string; value: string; channelName: string }>,
  profile: CsdRenderProfile = 'realtime',
): string {
  const lines: string[] = [];

  for (const sc of channels) {
    lines.push(`${sc.channelName} = "${sc.value}"`);
    if (profile !== 'disk') {
      lines.push(`${sc.channelName} chnexport "${sc.channelName}", 3`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate the mixer's orchestra code: effect UDOs and the BlueMixer
 * instrument text.
 *
 * Output structure:
 *   opcode blueEffect0,aa,aa ; EffectName
 *   ...
 *   endop
 *
 *   instr BlueMixer
 *   ...
 *   endin
 */
function generateMixerOrchestra(
  blueData: BlueData,
  channelIdAssignments: Map<Channel, number>,
  nchnls: number,
  udos: OpcodeList,
  mixer: Mixer = getBlueDataState(blueData).mixer,
  emitMetering = false,
  gateContext: BlueMixerGateContext | null = null,
): { effectUDOs: string[]; instrumentsText: string; effectIdMap: Map<Effect, number> } {
  const instrBuffer: string[] = [];
  const sourceChannels = mixer.getAllSourceChannels();
  const subChannels = sortSubChannelsForRendering(Array.from(mixer.getSubChannels()));

  let effectId = 0;
  const effectUDOs: string[] = [];
  const effectIdMap = new Map<Effect, number>();

  const registerEffects = (chain: EffectsChain) => {
    for (const item of chain) {
      if (!(item instanceof Effect) || !item.isEnabled() || effectIdMap.has(item)) {
        continue;
      }

      const udo = item.generateUDO(effectId, item.getParameters(), udos);
      if (!udo) {
        continue;
      }

      effectIdMap.set(item, effectId);
      effectUDOs.push(udo);
      effectId++;
    }
  };

  for (const channel of sourceChannels) {
    registerEffects(channel.getPreEffects());
    registerEffects(channel.getPostEffects());
  }

  for (const subChannel of subChannels) {
    registerEffects(subChannel.getPreEffects());
    registerEffects(subChannel.getPostEffects());
  }

  registerEffects(mixer.getMaster().getPreEffects());
  registerEffects(mixer.getMaster().getPostEffects());

  // Generate BlueMixer instrument
  const blueMixerCode = generateBlueMixer(
    blueData,
    sourceChannels,
    subChannels,
    channelIdAssignments,
    nchnls,
    effectIdMap,
    mixer,
    emitMetering,
    gateContext,
  );
  instrBuffer.push(blueMixerCode);

  return {
    effectUDOs,
    instrumentsText: instrBuffer.join('\n'),
    effectIdMap,
  };
}

function emitMeterTaps(
  csdKey: string,
  signalVars: string[],
  lines: string[],
  nextVarId: () => number,
): void {
  for (let ch = 0; ch < signalVars.length; ch++) {
    const vid = nextVarId();
    lines.push(`kMeter_rms_${vid} rms ${signalVars[ch]}`);
    lines.push(`kMeter_peak_${vid} maxk ${signalVars[ch]}, kMeterTrig, 1`);
    lines.push('if kMeterTrig == 1 then');
    lines.push(`  chnset kMeter_rms_${vid}, "bm_meter_rms_${csdKey}_${ch}"`);
    lines.push(`  chnset kMeter_peak_${vid}, "bm_meter_peak_${csdKey}_${ch}"`);
    lines.push('endif');
  }
}

function buildMeterBindingMap(
  mixer: Mixer,
  channelIdAssignments: Map<Channel, number>,
  nchnls: number,
): MeterBindingMap {
  const entries: CompiledMeterChannelBinding[] = [];

  let sourceIndex = 0;
  for (const channel of mixer.getAllSourceChannels()) {
    const id = channelIdAssignments.get(channel);
    if (id === undefined) continue;
    const csdKey = String(id);
    const stripId = channel.getAssociation().trim() || csdKey;
    entries.push({
      kind: 'source',
      csdKey,
      stripId,
      displayName: channel.getName(),
      channel,
      channelIndex: sourceIndex++,
    });
  }

  const subMeterKeys = buildSubChannelMeterKeys(Array.from(mixer.getSubChannels()));
  let subIndex = 0;
  for (const subChannel of mixer.getSubChannels()) {
    const name = subChannel.getName();
    const csdKey = subMeterKeys.get(subChannel) ?? `sub_${name.replace(/\s+/g, '_')}`;
    const stripId = subChannel.getAssociation().trim() || name;
    entries.push({
      kind: 'sub',
      csdKey,
      stripId,
      displayName: name,
      channel: subChannel,
      channelIndex: subIndex++,
    });
  }

  const master = mixer.getMaster();
  entries.push({
    kind: 'master',
    csdKey: 'sub_Master',
    stripId: 'master',
    displayName: 'Master',
    channel: master,
  });

  return {
    entries,
    nchnls,
  };
}

// ─── Mixer mute/solo audio gates (Spec 111) ───

export const MIXER_GATE_SYMBOL_PREFIX = 'gk_blue_mixgate_';
export const MIXER_GATE_COMMIT_CHANNEL = `${MIXER_GATE_SYMBOL_PREFIX}commit`;
export const MIXER_GATE_APPLIED_CHANNEL = `${MIXER_GATE_SYMBOL_PREFIX}applied`;
/** Shared transition ramp duration in seconds; initial values bypass the ramp. */
export const MIXER_GATE_RAMP_SECONDS = 0.005;

const GATE_RAMP_VAR = 'kMixGateStep';
const GATE_COMMIT_VAR = 'kMixGateCommit';
const GATE_BANK_VAR = 'kMixGateBank';

export interface BlueMixerGateContext {
  /** `live` emits engine-addressable two-bank gates; `fixed` bakes constants (disk). */
  readonly mode: 'live' | 'fixed';
  readonly state: MixerGateState;
  readonly graph: MixerRouteGraph;
  readonly signature: string;
  /** Cloned Send object -> gate ordinal, aligned with graph edge walk order. */
  readonly sendGateOrdinals: Map<Send, number>;
  /** Route node ordinal -> final-output gate ordinal. */
  readonly outputGateOrdinals: Map<number, number>;
  /** Cloned channels in graph ordinal order (sources, render-ordered subs, master). */
  readonly orderedChannels: Channel[];
}

/**
 * Builds the compile-time gate context for a mixer: route graph, gate state,
 * and the send/output ordinal maps the BlueMixer emitter uses. Returns null
 * when the mixer is disabled (no gates exist).
 */
function buildBlueMixerGateContext(
  mixer: Mixer,
  mode: 'live' | 'fixed',
): BlueMixerGateContext | null {
  if (!mixer.isEnabled()) return null;
  const graph = buildMixerRouteGraph(mixer);
  const state = computeMixerGateState(graph);

  const orderedChannels = [
    ...mixer.getAllSourceChannels(),
    ...sortSubChannelsForRendering(Array.from(mixer.getSubChannels())),
    mixer.getMaster(),
  ];
  const sendGateOrdinals = new Map<Send, number>();
  const outputGateOrdinals = new Map<number, number>();
  for (const edge of graph.edges) {
    const channel = orderedChannels[edge.sourceOrdinal];
    if (!channel) continue;
    if (edge.kind === 'send') {
      const chain = edge.chainKind === 'pre' ? channel.getPreEffects() : channel.getPostEffects();
      const item = chain[edge.chainIndex];
      if (item instanceof Send) sendGateOrdinals.set(item, edge.gateOrdinal);
    } else {
      outputGateOrdinals.set(edge.sourceOrdinal, edge.gateOrdinal);
    }
  }

  return {
    mode,
    state,
    graph,
    signature: getMixerRouteSignature(graph),
    sendGateOrdinals,
    outputGateOrdinals,
    orderedChannels,
  };
}

function buildCompiledMixerGateBindings(context: BlueMixerGateContext): CompiledMixerGateBindings {
  const nodes = context.graph.nodes;
  const gates: CompiledMixerGateBinding[] = context.graph.edges.map((edge) => {
    const node = nodes[edge.sourceOrdinal];
    const association = context.orderedChannels[edge.sourceOrdinal]?.getAssociation().trim() ?? '';
    let locator: CompiledMixerGateLocator;
    if (edge.kind === 'send') {
      locator = {
        route: 'send',
        channelOrdinal: edge.sourceOrdinal,
        channelKind: node.kind,
        chainKind: edge.chainKind,
        chainIndex: edge.chainIndex,
        targetName: edge.targetName,
        association,
      };
    } else {
      locator = {
        route: 'output',
        channelOrdinal: edge.sourceOrdinal,
        channelKind: node.kind,
        association,
      };
    }
    return {
      ordinal: edge.gateOrdinal,
      bankSymbols: [
        `${MIXER_GATE_SYMBOL_PREFIX}${edge.gateOrdinal}_0`,
        `${MIXER_GATE_SYMBOL_PREFIX}${edge.gateOrdinal}_1`,
      ],
      initial: context.state.gates[edge.gateOrdinal] ?? 1,
      locator,
    };
  });
  return {
    signature: context.signature,
    commitChannel: MIXER_GATE_COMMIT_CHANNEL,
    appliedChannel: MIXER_GATE_APPLIED_CHANNEL,
    gates,
  };
}

/**
 * Engine-addressable channel declarations for both gate banks and the
 * commit/applied tokens. Both banks start at the desired initial targets so
 * bank selection (commit token modulo two) is audible-safe from the first
 * control cycle.
 */
function buildMixerGateInitStatements(bindings: CompiledMixerGateBindings): string {
  const lines: string[] = [];
  const declare = (name: string, value: number) => {
    lines.push(`${name} init ${formatBlueNumber(value)}`);
    lines.push(`${name} chnexport "${name}", 3`);
  };
  for (const gate of bindings.gates) {
    declare(gate.bankSymbols[0], gate.initial);
    declare(gate.bankSymbols[1], gate.initial);
  }
  declare(MIXER_GATE_COMMIT_CHANNEL, 0);
  declare(MIXER_GATE_APPLIED_CHANNEL, 0);
  return lines.join('\n');
}

/**
 * Emits the per-cycle gate preamble for the BlueMixer instrument: the shared
 * 5 ms ramp step, one-per-cycle bank selection from the commit token, and
 * per-gate clamped linear transitions. Per-gate states are i-time
 * initialized at their targets, so startup never ramps or leaks muted audio.
 */
function emitGatePreamble(context: BlueMixerGateContext, lines: string[]): void {
  if (context.mode !== 'live') return;
  lines.push(`${GATE_RAMP_VAR} init ksmps / (${MIXER_GATE_RAMP_SECONDS} * sr)`);
  lines.push(`${GATE_COMMIT_VAR} = ${MIXER_GATE_COMMIT_CHANNEL}`);
  lines.push(`${GATE_BANK_VAR} = (${GATE_COMMIT_VAR} % 2)`);
  for (const edge of context.graph.edges) {
    const stateVar = gateStateVar(edge.gateOrdinal);
    const initial = context.state.gates[edge.gateOrdinal] ?? 1;
    lines.push(`${stateVar} init ${initial}`);
    lines.push(
      `${stateVar} += limit((${GATE_BANK_VAR} == 0 ? ` +
        `${MIXER_GATE_SYMBOL_PREFIX}${edge.gateOrdinal}_0 : ` +
        `${MIXER_GATE_SYMBOL_PREFIX}${edge.gateOrdinal}_1) - ${stateVar}, ` +
        `-${GATE_RAMP_VAR}, ${GATE_RAMP_VAR})`,
    );
  }
}

function gateStateVar(ordinal: number): string {
  return `kMixGateState_${ordinal}`;
}

/** Signal multiplier expression for a gate; empty string when ungated. */
function gateMultiplierExpr(context: BlueMixerGateContext, gateOrdinal: number): string {
  if (context.mode === 'live') {
    return ` * ${gateStateVar(gateOrdinal)}`;
  }
  // Fixed (disk) gates: bake the constant, and only when it silences the
  // route so ordinary projects keep their exact legacy CSD text.
  return (context.state.gates[gateOrdinal] ?? 1) === 1 ? '' : ' * 0';
}

/** In-place output gate lines; empty when the output route stays open. */
function emitOutputGate(
  context: BlueMixerGateContext,
  channelOrdinal: number,
  signalVars: string[],
  lines: string[],
): void {
  const gateOrdinal = context.outputGateOrdinals.get(channelOrdinal);
  if (gateOrdinal === undefined) return;
  const multiplier = gateMultiplierExpr(context, gateOrdinal);
  if (multiplier === '') return;
  if (context.mode === 'live') {
    const stateVar = gateStateVar(gateOrdinal);
    for (const signalVar of signalVars) {
      lines.push(`${signalVar} = ${signalVar} * ${stateVar}`);
    }
    return;
  }
  for (const signalVar of signalVars) {
    lines.push(`${signalVar} = ${signalVar} * 0`);
  }
}

/**
 * Generate the BlueMixer instrument.
 * Routes audio through volumes, sends, effect UDOs, and outputs via outc.
 * With a gate context (Spec 111), every send tap and every channel output is
 * gated after local processing, and output meters read the gated signal.
 */
function generateBlueMixer(
  blueData: BlueData,
  sourceChannels: Channel[],
  subChannels: Channel[],
  channelIdAssignments: Map<Channel, number>,
  nchnls: number,
  effectIdMap: Map<Effect, number>,
  mixer: Mixer = getBlueDataState(blueData).mixer,
  emitMetering = false,
  gateContext: BlueMixerGateContext | null = null,
): string {
  const lines: string[] = [];

  lines.push('\tinstr BlueMixer\t;Blue Mixer Instrument');

  let meterVarCounter = 0;
  const nextMeterVarId = () => meterVarCounter++;

  if (emitMetering) {
    lines.push('kMeterSamples init 0');
    lines.push('kMeterWindow = sr / 30');
    lines.push('kMeterSamples += ksmps');
    lines.push('if kMeterSamples >= kMeterWindow then');
    lines.push('  kMeterTrig = 1');
    lines.push('  kMeterSamples = 0');
    lines.push('else');
    lines.push('  kMeterTrig = 0');
    lines.push('endif');
  }

  if (gateContext) {
    emitGatePreamble(gateContext, lines);
  }

  // Process each source channel
  for (const channel of sourceChannels) {
    const channelId = channelIdAssignments.get(channel);
    if (channelId === undefined) continue;
    const signalVars = getSourceSignalVars(blueData, channelId, nchnls);

    applyEffectsChain(
      blueData,
      channel.getPreEffects(),
      signalVars,
      effectIdMap,
      lines,
      gateContext,
    );
    applyChannelLevel(blueData, signalVars, channel.getLevelParameter(), channel.getLevel(), lines);
    applyEffectsChain(
      blueData,
      channel.getPostEffects(),
      signalVars,
      effectIdMap,
      lines,
      gateContext,
    );
    if (gateContext) {
      emitOutputGate(gateContext, channelOrdinalOf(gateContext, channel), signalVars, lines);
    }
    if (emitMetering) {
      emitMeterTaps(String(channelId), signalVars, lines, nextMeterVarId);
    }
    routeChannelOutput(blueData, signalVars, channel.getOutChannel(), channel.getName(), lines);
  }

  // Process sub-channels
  const subMeterKeys = emitMetering ? buildSubChannelMeterKeys(subChannels) : null;
  for (const subChannel of subChannels) {
    const signalVars = getSubChannelSignalVars(blueData, subChannel.getName(), nchnls);

    applyEffectsChain(
      blueData,
      subChannel.getPreEffects(),
      signalVars,
      effectIdMap,
      lines,
      gateContext,
    );
    applyChannelLevel(
      blueData,
      signalVars,
      subChannel.getLevelParameter(),
      subChannel.getLevel(),
      lines,
    );
    applyEffectsChain(
      blueData,
      subChannel.getPostEffects(),
      signalVars,
      effectIdMap,
      lines,
      gateContext,
    );
    if (gateContext) {
      emitOutputGate(gateContext, channelOrdinalOf(gateContext, subChannel), signalVars, lines);
    }
    if (emitMetering && subMeterKeys) {
      const subKey =
        subMeterKeys.get(subChannel) ?? `sub_${subChannel.getName().replace(/\s+/g, '_')}`;
      emitMeterTaps(subKey, signalVars, lines, nextMeterVarId);
    }
    routeChannelOutput(
      blueData,
      signalVars,
      subChannel.getOutChannel(),
      subChannel.getName(),
      lines,
    );
  }

  const masterChannel = mixer.getMaster();
  const masterVars = getSubChannelSignalVars(blueData, 'Master', nchnls);
  applyEffectsChain(
    blueData,
    masterChannel.getPreEffects(),
    masterVars,
    effectIdMap,
    lines,
    gateContext,
  );
  applyChannelLevel(
    blueData,
    masterVars,
    masterChannel.getLevelParameter(),
    masterChannel.getLevel(),
    lines,
  );
  applyEffectsChain(
    blueData,
    masterChannel.getPostEffects(),
    masterVars,
    effectIdMap,
    lines,
    gateContext,
  );
  if (gateContext) {
    emitOutputGate(gateContext, channelOrdinalOf(gateContext, masterChannel), masterVars, lines);
  }
  if (emitMetering) {
    emitMeterTaps('sub_Master', masterVars, lines, nextMeterVarId);
  }
  lines.push(`outc ${masterVars.join(', ')}`);

  if (gateContext && gateContext.mode === 'live') {
    // Echo the sampled commit token after bank selection so the engine can
    // observe which values this control cycle actually used.
    lines.push(`${MIXER_GATE_APPLIED_CHANNEL} = ${GATE_COMMIT_VAR}`);
  }

  // Clear all audio variables
  for (const channel of sourceChannels) {
    const channelId = channelIdAssignments.get(channel);
    if (channelId === undefined) continue;
    for (const signalVar of getSourceSignalVars(blueData, channelId, nchnls)) {
      lines.push(`${signalVar} = 0`);
    }
  }
  for (const subChannel of subChannels) {
    for (const signalVar of getSubChannelSignalVars(blueData, subChannel.getName(), nchnls)) {
      lines.push(`${signalVar} = 0`);
    }
  }
  for (const signalVar of masterVars) {
    lines.push(`${signalVar} = 0`);
  }

  lines.push('');
  lines.push('\tendin');
  lines.push('');

  return lines.join('\n');
}

/** Graph ordinal of a cloned channel within the gate context. */
function channelOrdinalOf(context: BlueMixerGateContext, channel: Channel): number {
  return context.orderedChannels.indexOf(channel);
}

function applyEffectsChain(
  blueData: BlueData,
  chain: EffectsChain,
  signalVars: string[],
  effectIdMap: Map<Effect, number>,
  lines: string[],
  gateContext: BlueMixerGateContext | null = null,
): void {
  for (const item of chain) {
    if (item instanceof Effect) {
      if (!item.isEnabled()) {
        continue;
      }

      const effectId = effectIdMap.get(item);
      if (effectId === undefined) {
        continue;
      }

      if (item.getStyle() === UDOStyle.MODERN) {
        lines.push(`${signalVars.join(', ')} = blueEffect${effectId}(${signalVars.join(', ')})`);
      } else {
        lines.push(`${signalVars.join(', ')}\tblueEffect${effectId}\t${signalVars.join(', ')}`);
      }
      continue;
    }

    if (!item.isEnabled()) {
      continue;
    }

    const targetName = item.getSendChannel() || 'Master';
    const amountExpr = getSendAmountExpression(blueData, item);
    const gateExpr = gateContext
      ? gateMultiplierExpr(gateContext, gateContext.sendGateOrdinals.get(item) ?? -1)
      : '';

    for (let i = 0; i < signalVars.length; i++) {
      const targetVar = getSubChannelVar(blueData, targetName, i);
      lines.push(
        `${targetVar}\t+=\t${scaleSignal(blueData, signalVars[i], amountExpr)}${gateExpr}`,
      );
    }
  }
}

function applyChannelLevel(
  blueData: BlueData,
  signalVars: string[],
  levelParam: Parameter,
  fallbackLevel: number,
  lines: string[],
): void {
  const compilationVarName = levelParam.getCompilationVarName();
  if (compilationVarName) {
    lines.push(`ktempdb = ampdb(${compilationVarName})`);
    for (const signalVar of signalVars) {
      lines.push(`${signalVar} *= ktempdb`);
    }
    return;
  }

  const multiplier = Math.pow(10, fallbackLevel / 20);
  if (Math.abs(multiplier - 1.0) <= 0.0001) {
    return;
  }

  for (const signalVar of signalVars) {
    lines.push(`${signalVar} *= ${multiplier}`);
  }
}

function routeChannelOutput(
  blueData: BlueData,
  signalVars: string[],
  outChannel: string,
  channelName: string,
  lines: string[],
): void {
  const resolvedOutChannel = outChannel || 'Master';
  if (resolvedOutChannel === channelName) {
    return;
  }

  for (let i = 0; i < signalVars.length; i++) {
    lines.push(`${getSubChannelVar(blueData, resolvedOutChannel, i)}\t+=\t${signalVars[i]}`);
  }
}

function getSendAmountExpression(blueData: BlueData, send: Send): string {
  const levelParam = send.getLevelParameter();
  const compilationVarName = levelParam.getCompilationVarName();
  if (compilationVarName) {
    return compilationVarName;
  }

  return send.getLevel().toString();
}

function scaleSignal(blueData: BlueData, signalVar: string, amountExpr: string): string {
  if (amountExpr === '1' || amountExpr === '1.0') {
    return signalVar;
  }

  return `(${signalVar} * ${amountExpr})`;
}

function getSourceSignalVars(blueData: BlueData, channelId: number, nchnls: number): string[] {
  const signalVars: string[] = [];
  for (let i = 0; i < nchnls; i++) {
    signalVars.push(`ga_bluemix_${channelId}_${i}`);
  }
  return signalVars;
}

function getSubChannelSignalVars(
  blueData: BlueData,
  channelName: string,
  nchnls: number,
): string[] {
  const signalVars: string[] = [];
  for (let i = 0; i < nchnls; i++) {
    signalVars.push(getSubChannelVar(blueData, channelName, i));
  }
  return signalVars;
}

function getSubChannelVar(blueData: BlueData, channelName: string, outputIndex: number): string {
  const safeName = channelName === 'Master' ? 'Master' : channelName.replace(/\s+/g, '_');
  return `ga_bluesub_${safeName}_${outputIndex}`;
}

function appendFtgenTableNumbers(globalOrc: string, tables: Tables): void {
  const pattern = /ftgen\s+-?(\d+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(globalOrc)) !== null) {
    const ftgenNum = parseInt(match[1] ?? '0', 10);
    if (ftgenNum !== 0) {
      tables.addFtgenNumber(ftgenNum);
    }
  }
}
