import type { BlueData } from "../blue-data";
import { BLUE_VERSION } from "../blue-constants";
import { Arrangement } from "../arrangement";
import { ProjectProperties } from "../project-properties";
import { GlobalOrcSco } from "../global-orc-sco";
import { Tables } from "../tables";
import { Score } from "../score/score";
import { Note } from "../sound-objects/note";
import { NoteList } from "../sound-objects/note-list";
import { Mixer } from "../mixer/mixer";
import { OpcodeList } from "../opcodes/opcode-list";
import { Parameter } from "../automation/parameter";
import { Instrument } from "../instruments/instrument";
import { GenericInstrument } from "../instruments/generic-instrument";
import { CompileData } from "../compile-data";
import type { CompiledBlueX7Binding, CompiledMidiInstrumentTarget } from "../compile-data";
import { Effect } from "../mixer/effect";
import { EffectsChain } from "../mixer/effects-chain";
import { Channel } from "../mixer/channel";
import { Send } from "../mixer/send";
import { UDOStyle } from "../opcodes/udo-style";
import { BSBCompilationUnit } from "../instruments/blue-synth-builder/bsb-compilation-unit";
import { getAllParameters, assignParameterNames } from "../automation/parameter-helper";
import {
  appendParameterScoreJava,
  getParameterInstrumentTextJava,
} from "../automation/csd-parameter-automation";
import { formatBlueNumber } from "../utilities/number-format";
import { disposeJavaScriptCompileState, setJavaScriptSession } from "../javascript-runtime";
import type { JavaScriptSession } from "../javascript-runtime";
import { setJavaRuntimeClient } from "../java-runtime";
import type { JavaRuntimeClientContract } from "../java-runtime";
import {
  processCommandBlocks,
  preprocessSco,
  getTempoScore,
  getTempoMapFromScoreText,
} from "../utilities/csd-render";
import { getNotes } from "../utilities/score";
import { TempoMap } from "../time/tempo-map";

type CsdRenderProfile = "realtime" | "disk";

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

export function buildStandardCSD(blueData: BlueData, profile: CsdRenderProfile, session?: JavaScriptSession): RenderCsdResult {
  const { arrangement: clonedArrangement, tables: clonedTables, mixer: clonedMixer, compileData } =
    createRenderSnapshot(blueData, session);
  let generationError: unknown = null;
  const logPrefix =
    profile === "disk" ? "[BlueData.toDiskCSD]" : "[BlueData.toCSD]";

  try {
    const channelIdAssignments = assignChannelIds(blueData, clonedMixer);
    for (const [channel, id] of channelIdAssignments) {
      compileData.getChannelIdAssignments().set(channel, id);
    }
    compileData.setMixerEnabled(clonedMixer.isEnabled());

    // Build CsInstruments header (sr/ksmps/nchnls/0dbfs go here, not in CsOptions)
    const orchestraHeader = buildOrchestraHeader(blueData, profile);
    const nchnls = getNchnls(blueData, profile);

    // Global orchestra/sco from stored data
    let globalOrc = getBlueDataState(blueData).globalOrcSco.getGlobalOrc() || "";
    const baseGlobalSco = getBlueDataState(blueData).globalOrcSco.getGlobalSco() || "";

    const appendGlobalOrc = (section: string) => {
      if (!section) {
        return;
      }
      if (globalOrc.length > 0 && !globalOrc.endsWith("\n")) {
        globalOrc += "\n";
      }
      globalOrc += section;
    };

    // Mixer init statements
    if (clonedMixer.isEnabled()) {
      const mixerInits = clonedMixer.getInitStatements(
        channelIdAssignments,
        nchnls,
      );
      if (mixerInits) {
        // Java appends an extra newline after mixer init statements before
        // adding them to GlobalOrcSco, which preserves a two-blank-line gap
        // before parameter init statements.
        appendGlobalOrc(`${mixerInits}\n\n`);
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
    const noteList = getBlueDataState(blueData).score.generateForCSD(compileData, startTime, endTime);
    const allParameters = compileData.getOriginalParameters();
    const allStringChannels = compileData.getStringChannels();
    compileData.setHandleParametersAndChannels(false);

    if (endTime > 0 && endTime > startTime) {
      const renderEndInstrument = createRenderEndInstrument(blueData, );
      const renderEndInstrumentId = clonedArrangement.addInstrumentAtEnd(
        renderEndInstrument,
      );

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
        .join("\n");
    } else {
      tempoMap = getTempoMapFromScoreText(baseGlobalSco);
    }

    const arrangementGlobalSco = clonedArrangement.generateGlobalSco(compileData);
    const totalDur = getNoteListDuration(blueData, noteList);
    const processingStart = startTime;
    const globalSco = preprocessSco(
      [scoreGlobalPrefix, arrangementGlobalSco].filter(Boolean).join("\n"),
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

    const alwaysOnInstruments = collectAlwaysOnInstruments(blueData,
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
        const alwaysOnId = `${sourceId ?? "unknown"}_alwaysOn`;
        clonedArrangement.addInstrumentWithId(instrument, alwaysOnId, false);
        addScoreNote(blueData, noteList, `i"${alwaysOnId}" 0 ${globalDur}`);
      }
    }

    let mixerEffectUDOs: string[] = [];
    let mixerInstruments = "";
    if (clonedMixer.isEnabled()) {
      const mixerOutput = generateMixerOrchestra(blueData,
        channelIdAssignments,
        nchnls,
        udos,
        clonedMixer,
      );
      mixerEffectUDOs = mixerOutput.effectUDOs;
      mixerInstruments = mixerOutput.instrumentsText;
      addScoreNote(blueData, noteList, `i"BlueMixer" 0 ${globalDur}`);
    }

    if (profile === "disk") {
      appendParameterAutomationNotes(blueData,
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

    const initStatements = buildRuntimeInitStatements(blueData,
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
    const udoText = allUDOText.length > 0 ? `${allUDOText.join("\n")}\n` : "";

    const orc = clonedArrangement.generateOrchestra(
      compileData,
      clonedMixer,
      nchnls,
      parameterMap,
    );

    const scoreText = buildScoreText(blueData,
      ftables,
      globalSco,
      noteList,
    );

    // Build project info comments
    const projectInfo = buildProjectInfo(blueData, );

    // Assemble CSD
    const csdText = (
      projectInfo +
      "<CsoundSynthesizer>\n\n" +
      "<CsInstruments>\n" +
      orchestraHeader +
      "\n\n" +
      globalOrc +
      "\n\n" +
      arrangementGlobalOrc +
      "\n\n" +
      udoText +
      "\n\n" +
      orc +
      mixerInstruments +
      "\n\n</CsInstruments>\n\n" +
      "<CsScore>\n\n" +
      scoreText +
      "</CsScore>\n\n" +
      "</CsoundSynthesizer>"
    );

    return {
      csdText,
      parameters: allParameters,
      stringChannels: allStringChannels,
      midiInstrumentTargets: [],
      blueX7Bindings: compileData.getBlueX7Bindings(),
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
): Promise<RenderCsdResult> {
  const { arrangement: clonedArrangement, tables: clonedTables, mixer: clonedMixer, compileData } =
    createRenderSnapshot(blueData, session, runtimeClient);
  let generationError: unknown = null;
  const logPrefix =
    profile === "disk" ? "[BlueData.toDiskCSDAsync]" : "[BlueData.toCSDAsync]";

  try {
    const channelIdAssignments = assignChannelIds(blueData, clonedMixer);
    for (const [channel, id] of channelIdAssignments) {
      compileData.getChannelIdAssignments().set(channel, id);
    }
    compileData.setMixerEnabled(clonedMixer.isEnabled());

    const orchestraHeader = buildOrchestraHeader(blueData, profile);
    const nchnls = getNchnls(blueData, profile);

    let globalOrc = getBlueDataState(blueData).globalOrcSco.getGlobalOrc() || "";
    const baseGlobalSco = getBlueDataState(blueData).globalOrcSco.getGlobalSco() || "";

    const appendGlobalOrc = (section: string) => {
      if (!section) {
        return;
      }
      if (globalOrc.length > 0 && !globalOrc.endsWith("\n")) {
        globalOrc += "\n";
      }
      globalOrc += section;
    };

    if (clonedMixer.isEnabled()) {
      const mixerInits = clonedMixer.getInitStatements(
        channelIdAssignments,
        nchnls,
      );
      if (mixerInits) {
        appendGlobalOrc(`${mixerInits}\n\n`);
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
    const noteList = await getBlueDataState(blueData).score.generateForCSDAsync(compileData, startTime, endTime);
    const allParameters = compileData.getOriginalParameters();
    const allStringChannels = compileData.getStringChannels();
    compileData.setHandleParametersAndChannels(false);

    if (endTime > 0 && endTime > startTime) {
      const renderEndInstrument = createRenderEndInstrument(blueData, );
      const renderEndInstrumentId = clonedArrangement.addInstrumentAtEnd(
        renderEndInstrument,
      );

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
        .join("\n");
    } else {
      tempoMap = getTempoMapFromScoreText(baseGlobalSco);
    }

    const arrangementGlobalSco = clonedArrangement.generateGlobalSco(compileData);
    const totalDur = getNoteListDuration(blueData, noteList);
    const processingStart = startTime;
    const globalSco = preprocessSco(
      [scoreGlobalPrefix, arrangementGlobalSco].filter(Boolean).join("\n"),
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

    const alwaysOnInstruments = collectAlwaysOnInstruments(blueData,
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
        const alwaysOnId = `${sourceId ?? "unknown"}_alwaysOn`;
        clonedArrangement.addInstrumentWithId(instrument, alwaysOnId, false);
        addScoreNote(blueData, noteList, `i"${alwaysOnId}" 0 ${globalDur}`);
      }
    }

    let mixerEffectUDOs: string[] = [];
    let mixerInstruments = "";
    if (clonedMixer.isEnabled()) {
      const mixerOutput = generateMixerOrchestra(blueData,
        channelIdAssignments,
        nchnls,
        udos,
        clonedMixer,
      );
      mixerEffectUDOs = mixerOutput.effectUDOs;
      mixerInstruments = mixerOutput.instrumentsText;
      addScoreNote(blueData, noteList, `i"BlueMixer" 0 ${globalDur}`);
    }

    if (profile === "disk") {
      appendParameterAutomationNotes(blueData,
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

    const initStatements = buildRuntimeInitStatements(blueData,
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
    const udoText = allUDOText.length > 0 ? `${allUDOText.join("\n")}\n` : "";

    const orc = await clonedArrangement.generateOrchestraAsync(
      compileData,
      clonedMixer,
      nchnls,
      parameterMap,
    );

    const scoreText = buildScoreText(blueData,
      ftables,
      globalSco,
      noteList,
    );

    const projectInfo = buildProjectInfo(blueData, );

    const csdText = (
      projectInfo +
      "<CsoundSynthesizer>\n\n" +
      "<CsInstruments>\n" +
      orchestraHeader +
      "\n\n" +
      globalOrc +
      "\n\n" +
      arrangementGlobalOrc +
      "\n\n" +
      udoText +
      "\n\n" +
      orc +
      mixerInstruments +
      "\n\n</CsInstruments>\n\n" +
      "<CsScore>\n\n" +
      scoreText +
      "</CsScore>\n\n" +
      "</CsoundSynthesizer>"
    );

    return {
      csdText,
      parameters: allParameters,
      stringChannels: allStringChannels,
      midiInstrumentTargets: [],
      blueX7Bindings: compileData.getBlueX7Bindings(),
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

export function toBlueLiveCSD(blueData: BlueData, session?: JavaScriptSession): RenderCsdResult {
  const { arrangement: clonedArrangement, tables: clonedTables, mixer: clonedMixer, compileData } =
    createRenderSnapshot(blueData, session);
  let generationError: unknown = null;

  try {
    const channelIdAssignments = assignChannelIds(blueData, clonedMixer);
    for (const [channel, id] of channelIdAssignments) {
      compileData.getChannelIdAssignments().set(channel, id);
    }
    compileData.setMixerEnabled(clonedMixer.isEnabled());

    const orchestraHeader = buildOrchestraHeader(blueData, );
    const nchnls = getNchnls(blueData, );

    let globalOrc = getBlueDataState(blueData).globalOrcSco.getGlobalOrc() || "";
    let globalSco = getBlueDataState(blueData).globalOrcSco.getGlobalSco() || "";

    const appendGlobalOrc = (section: string) => {
      if (!section) return;
      globalOrc += `\n${section}`;
    };

    if (clonedMixer.isEnabled()) {
      const mixerInits = clonedMixer.getInitStatements(channelIdAssignments, nchnls);
      if (mixerInits) {
        appendGlobalOrc(`${mixerInits}\n\n`);
      }
    }

    const udos = new OpcodeList(getBlueDataState(blueData).opcodeList);
    clonedArrangement.generateUserDefinedOpcodes(udos);

    const parameters = getAllParameters(clonedArrangement, clonedMixer);
    assignParameterNames(parameters);
    const stringChannels = collectStringChannels(blueData, clonedArrangement);
    compileData.registerExistingAutomationState(parameters, stringChannels);
    const stringInits = buildStringChannelInits(blueData, compileData.getStringChannels());
    const paramInits = buildParameterInits(blueData,
      compileData.getOriginalParameters(),
      "realtime",
      getBlueDataState(blueData).renderStartTime,
      false,
    );
    const runtimeInitStatements = [stringInits, paramInits]
      .filter((section) => section.length > 0)
      .join("\n");
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

    const alwaysOnInstruments = collectAlwaysOnInstruments(blueData,
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
        const alwaysOnId = `${sourceId ?? "unknown"}_alwaysOn`;
        clonedArrangement.addInstrumentWithId(instrument, alwaysOnId, false);
        blueLiveSco += `i "${alwaysOnId}" 0 ${totalDur}\n`;
      }
    }

    let mixerEffectUDOs: string[] = [];
    let mixerInstruments = "";
    if (clonedMixer.isEnabled()) {
      const mixerOutput = generateMixerOrchestra(blueData,
        channelIdAssignments,
        nchnls,
        udos,
        clonedMixer,
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
    const udoText = allUDOText.length > 0 ? `${allUDOText.join("\n")}\n` : "";

    const orc = clonedArrangement.generateOrchestra(
      compileData,
      clonedMixer,
      nchnls,
      parameterMap,
    );

    let blueLiveOrc = orc + mixerInstruments;
    blueLiveOrc += "\n\n" + createAllNotesOffInstrument(blueData, baseInstrIds);

    if (clonedMixer.isEnabled()) {
      blueLiveSco += `i "BlueMixer" 0 ${totalDur}\n`;
    }

    const projectInfo = buildProjectInfo(blueData, );

    const csdText =
      projectInfo +
      "<CsoundSynthesizer>\n\n" +
      "<CsInstruments>\n" +
      orchestraHeader +
      "\n\n" +
      globalOrc +
      "\n\n" +
      arrangementGlobalOrc +
      "\n\n" +
      udoText +
      "\n\n" +
      blueLiveOrc +
      "\n\n</CsInstruments>\n\n" +
      "<CsScore>\n\n" +
      ftables +
      "\n\n" +
      blueLiveSco +
      "e " + totalDur + "\n\n" +
      "</CsScore>\n\n" +
      "</CsoundSynthesizer>";

    return {
      csdText,
      parameters: compileData.getOriginalParameters(),
      stringChannels: compileData.getStringChannels(),
      midiInstrumentTargets,
      blueX7Bindings: compileData.getBlueX7Bindings(),
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
      console.warn('[BlueData.toBlueLiveCSD] Failed to dispose JavaScript runtime state:', cleanupError);
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
    const parts = id.split(',').map((part) => part.trim()).filter((part) => part.length > 0);

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
function buildOrchestraHeader(blueData: BlueData, profile: CsdRenderProfile = "realtime"): string {
  const props = getBlueDataState(blueData).projectProperties;
  const isDisk = profile === "disk";
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

  return lines.join("\n");
}

/**
 * Get the number of channels for real-time playback.
 */
function getNchnls(blueData: BlueData, profile: CsdRenderProfile = "realtime"): number {
  const props = getBlueDataState(blueData).projectProperties;
  const channels = profile === "disk" ? props.diskChannels : props.channels;
  if (channels) {
    const n = parseInt(channels, 10);
    if (!isNaN(n)) return n;
  }
  return 2; // Default stereo
}

function getRenderWindow(blueData: BlueData, profile: CsdRenderProfile): { startTime: number; endTime: number } {
  if (profile === "disk" && getBlueDataState(blueData).projectProperties.diskAlwaysRenderEntireProject) {
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
function assignChannelIds(blueData: BlueData, mixer: Mixer = getBlueDataState(blueData).mixer): Map<Channel, number> {
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
export function buildScoreText(blueData: BlueData,
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

  const scoreNotesText = noteLines.length > 0 ? `${noteLines.join("\n")}\n` : "";

  return `${ftables}\n\n${scoreGlobalText}\n\n${scoreNotesText}e\n\n`;
}

function buildRuntimeInitStatements(blueData: BlueData,
  parameters: Parameter[],
  stringChannels: Array<{ objectName: string; value: string; channelName: string }>,
  profile: CsdRenderProfile = "realtime",
  renderStartTime: number = getBlueDataState(blueData).renderStartTime,
): string {
  const stringInits = buildStringChannelInits(blueData, stringChannels, profile);
  const paramInits = buildParameterInits(blueData, parameters, profile, renderStartTime);

  return [stringInits, paramInits]
    .filter((section) => section.length > 0)
    .join("\n");
}

function collectAlwaysOnInstruments(blueData: BlueData,
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
    let compiled = "";
    const instrParams = parameterMap.get(ia.instr);

    if (typeof instr.generateAlwaysOnInstrument === "function") {
      compiled = instr.generateAlwaysOnInstrument(instrParams) ?? "";
    }

    if (!compiled && typeof instr.getAlwaysOnInstrumentText === "function") {
      const alwaysOnText = instr.getAlwaysOnInstrumentText();
      if (!alwaysOnText) {
        continue;
      }

      const unit = new BSBCompilationUnit();
      if (typeof instr.getGraphicInterface === "function") {
        instr.getGraphicInterface().collectReplacements(unit, instrParams);
      }
      compiled = unit.replaceBSBValues(alwaysOnText);
    }

    if (!compiled || compiled.trim().length === 0) {
      continue;
    }

    const sourceChannel = sourceChannels.find(
      (channel) => channel.getName() === ia.arrangementId,
    );
    const channelId = sourceChannel
      ? channelIdAssignments.get(sourceChannel)
      : undefined;

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

function appendParameterAutomationNotes(blueData: BlueData,
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
    appendParameterScore(blueData,
      param,
      instrId,
      notes,
      renderStart,
      renderEnd,
    );
  }
}

function appendParameterScore(blueData: BlueData,
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
function buildProjectInfo(blueData: BlueData, ): string {
  const props = getBlueDataState(blueData).projectProperties;
  const notes = (props.notes || "").replace(/\n/g, "\n; ");

  return (
    ";\n" +
    `; "${props.title || ""}"\n` +
    `; by ${props.author || ""}\n` +
    ";\n" +
    `; ${notes}\n;\n` +
    `; Generated by blue ${BLUE_VERSION} (http://blue.kunstmusik.com)\n` +
    ";\n\n"
  );
}

function createRenderSnapshot(blueData: BlueData,
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

function createRenderEndInstrument(blueData: BlueData, ): GenericInstrument {
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
function buildParameterInits(blueData: BlueData,
  parameters: Parameter[],
  profile: CsdRenderProfile = "realtime",
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

    if (profile !== "disk") {
      // Standard Csound channel export for engine-side channel bridging
      lines.push(`${varName} chnexport "${varName}", 3`);
    }
  }

  return lines.join("\n");
}

/**
 * Collect all StringChannels from BSB instruments in the arrangement.
 * Mirrors Java's getStringChannels() method.
 */
function collectStringChannels(blueData: BlueData, arrangement?: Arrangement): Array<{
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
    if (typeof instr.getStringChannels === "function") {
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
function buildParameterMap(blueData: BlueData, arrangement?: Arrangement): Map<Instrument, Parameter[]> {
  const map = new Map<Instrument, Parameter[]>();
  const arr = arrangement ?? getBlueDataState(blueData).arrangement;

  for (const ia of arr.getArrangement()) {
    if (!ia.enabled || !ia.instr) continue;
    const instr = ia.instr as any;
    if (typeof instr.getParameters === "function") {
      const instrParams = instr.getParameters();
      if (
        instrParams &&
        Array.isArray(instrParams) &&
        instrParams.length > 0
      ) {
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
function buildStringChannelInits(blueData: BlueData,
  channels: Array<{ objectName: string; value: string; channelName: string }>,
  profile: CsdRenderProfile = "realtime",
): string {
  const lines: string[] = [];

  for (const sc of channels) {
    lines.push(`${sc.channelName} = "${sc.value}"`);
    if (profile !== "disk") {
      lines.push(`${sc.channelName} chnexport "${sc.channelName}", 3`);
    }
  }

  return lines.join("\n");
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
function generateMixerOrchestra(blueData: BlueData,
  channelIdAssignments: Map<Channel, number>,
  nchnls: number,
  udos: OpcodeList,
  mixer: Mixer = getBlueDataState(blueData).mixer,
): { effectUDOs: string[]; instrumentsText: string; effectIdMap: Map<Effect, number> } {
  const instrBuffer: string[] = [];
  const sourceChannels = mixer.getAllSourceChannels();
  const subChannels = sortSubChannelsForRendering(blueData,
    Array.from(mixer.getSubChannels()),
  );

  let effectId = 0;
  const effectUDOs: string[] = [];
  const effectIdMap = new Map<Effect, number>();

  const registerEffects = (chain: EffectsChain) => {
    for (const item of chain) {
      if (!(item instanceof Effect) || !item.isEnabled() || effectIdMap.has(item)) {
        continue;
      }

      const udo = item.generateUDO(
        effectId,
        item.getParameters(),
        udos,
      );
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
  const blueMixerCode = generateBlueMixer(blueData,
    sourceChannels,
    subChannels,
    channelIdAssignments,
    nchnls,
    effectIdMap,
    mixer,
  );
  instrBuffer.push(blueMixerCode);

  return {
    effectUDOs,
    instrumentsText: instrBuffer.join("\n"),
    effectIdMap,
  };
}

/**
 * Generate the BlueMixer instrument.
 * Routes audio through volumes, sends, effect UDOs, and outputs via outc.
 */
function generateBlueMixer(blueData: BlueData,
  sourceChannels: Channel[],
  subChannels: Channel[],
  channelIdAssignments: Map<Channel, number>,
  nchnls: number,
  effectIdMap: Map<Effect, number>,
  mixer: Mixer = getBlueDataState(blueData).mixer,
): string {
  const lines: string[] = [];

  lines.push("\tinstr BlueMixer\t;Blue Mixer Instrument");

  // Process each source channel
  for (const channel of sourceChannels) {
    const channelId = channelIdAssignments.get(channel);
    if (channelId === undefined) continue;
    const signalVars = getSourceSignalVars(blueData, channelId, nchnls);

    applyEffectsChain(blueData, channel.getPreEffects(), signalVars, effectIdMap, lines);
    applyChannelLevel(blueData, signalVars, channel.getLevelParameter(), channel.getLevel(), lines);
    applyEffectsChain(blueData, channel.getPostEffects(), signalVars, effectIdMap, lines);
    routeChannelOutput(blueData, signalVars, channel.getOutChannel(), channel.getName(), lines);
  }

  // Process sub-channels
  for (const subChannel of subChannels) {
    const signalVars = getSubChannelSignalVars(blueData, subChannel.getName(), nchnls);

    applyEffectsChain(blueData, subChannel.getPreEffects(), signalVars, effectIdMap, lines);
    applyChannelLevel(blueData, signalVars, subChannel.getLevelParameter(), subChannel.getLevel(), lines);
    applyEffectsChain(blueData, subChannel.getPostEffects(), signalVars, effectIdMap, lines);
    routeChannelOutput(blueData, signalVars, subChannel.getOutChannel(), subChannel.getName(), lines);
  }

  const masterChannel = mixer.getMaster();
  const masterVars = getSubChannelSignalVars(blueData, "Master", nchnls);
  applyEffectsChain(blueData, masterChannel.getPreEffects(), masterVars, effectIdMap, lines);
  applyChannelLevel(blueData, masterVars, masterChannel.getLevelParameter(), masterChannel.getLevel(), lines);
  applyEffectsChain(blueData, masterChannel.getPostEffects(), masterVars, effectIdMap, lines);
  lines.push(`outc ${masterVars.join(", ")}`);

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

  lines.push("");
  lines.push("\tendin");
  lines.push("");

  return lines.join("\n");
}

function applyEffectsChain(blueData: BlueData,
  chain: EffectsChain,
  signalVars: string[],
  effectIdMap: Map<Effect, number>,
  lines: string[],
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
        lines.push(`${signalVars.join(", ")} = blueEffect${effectId}(${signalVars.join(", ")})`);
      } else {
        lines.push(`${signalVars.join(", ")}\tblueEffect${effectId}\t${signalVars.join(", ")}`);
      }
      continue;
    }

    if (!item.isEnabled()) {
      continue;
    }

    const targetName = item.getSendChannel() || "Master";
    const amountExpr = getSendAmountExpression(blueData, item);

    for (let i = 0; i < signalVars.length; i++) {
      const targetVar = getSubChannelVar(blueData, targetName, i);
      lines.push(`${targetVar}\t+=\t${scaleSignal(blueData, signalVars[i], amountExpr)}`);
    }
  }
}

function applyChannelLevel(blueData: BlueData,
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

function routeChannelOutput(blueData: BlueData,
  signalVars: string[],
  outChannel: string,
  channelName: string,
  lines: string[],
): void {
  const resolvedOutChannel = outChannel || "Master";
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
  if (amountExpr === "1" || amountExpr === "1.0") {
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

function getSubChannelSignalVars(blueData: BlueData, channelName: string, nchnls: number): string[] {
  const signalVars: string[] = [];
  for (let i = 0; i < nchnls; i++) {
    signalVars.push(getSubChannelVar(blueData, channelName, i));
  }
  return signalVars;
}

function getSubChannelVar(blueData: BlueData, channelName: string, outputIndex: number): string {
  const safeName = channelName === "Master"
    ? "Master"
    : channelName.replace(/\s+/g, "_");
  return `ga_bluesub_${safeName}_${outputIndex}`;
}

function sortSubChannelsForRendering(blueData: BlueData,
  subChannels: Channel[],
): Channel[] {
  const byName = new Map(subChannels.map(channel => [channel.getName(), channel]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: Channel[] = [];

  const visit = (channel: Channel) => {
    const name = channel.getName();
    if (visited.has(name) || visiting.has(name)) {
      return;
    }

    visiting.add(name);

    const targets = new Set<string>();
    const outChannel = channel.getOutChannel();
    if (outChannel && outChannel !== "Master" && outChannel !== name && byName.has(outChannel)) {
      targets.add(outChannel);
    }

    for (const send of channel.getSends()) {
      const target = send.getSendChannel();
      if (target && target !== "Master" && target !== name && byName.has(target)) {
        targets.add(target);
      }
    }

    for (const target of targets) {
      visit(byName.get(target)!);
    }

    visiting.delete(name);
    visited.add(name);
    ordered.push(channel);
  };

  for (const channel of subChannels) {
    visit(channel);
  }

  return ordered.reverse();
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
