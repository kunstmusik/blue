import type { BlueData } from '../blue-data';
import { BLUE_VERSION } from '../blue-constants';
import { Arrangement, parseBlueMixerOut } from '../arrangement';
import { Tables } from '../tables';
import { Note } from '../sound-objects/note';
import { NoteList } from '../sound-objects/note-list';
import { Mixer } from '../mixer/mixer';
import { Channel } from '../mixer/channel';
import { Send } from '../mixer/send';
import { Parameter } from '../automation/parameter';
import { Instrument } from '../instruments/instrument';
import { GenericInstrument } from '../instruments/generic-instrument';
import { CompileData } from '../compile-data';
import { BSBCompilationUnit } from '../instruments/blue-synth-builder/bsb-compilation-unit';
import { setJavaScriptSession, type JavaScriptSession } from '../javascript-runtime';
import { setJavaRuntimeClient, type JavaRuntimeClientContract } from '../java-runtime';
import type { AudioLayoutManifest } from '../score/audio/audio-layout';
import {
  appendParameterScoreJava,
  getParameterInstrumentTextJava,
} from '../automation/csd-parameter-automation';
import { getNotes } from '../utilities/score';
import { formatBlueNumber } from '../utilities/number-format';

export type CsdRenderProfile = 'realtime' | 'disk';

export function buildOrchestraHeader(
  blueData: BlueData,
  profile: CsdRenderProfile = 'realtime',
): string {
  const props = blueData.getProjectProperties();
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
export function getNchnls(blueData: BlueData, profile: CsdRenderProfile = 'realtime'): number {
  const props = blueData.getProjectProperties();
  const channels = profile === 'disk' ? props.diskChannels : props.channels;
  if (channels) {
    const n = parseInt(channels, 10);
    if (!isNaN(n)) return n;
  }
  return 2; // Default stereo
}

export function getRenderWindow(
  blueData: BlueData,
  profile: CsdRenderProfile,
): { startTime: number; endTime: number } {
  if (profile === 'disk' && blueData.getProjectProperties().diskAlwaysRenderEntireProject) {
    return { startTime: 0, endTime: -1 };
  }

  return {
    startTime: blueData.getRenderStartTime(),
    endTime: blueData.getRenderEndTime(),
  };
}

/**
 * Assign channel IDs for mixer init statements.
 * Mirrors Java's assignChannelIds().
 */
export function assignChannelIds(
  blueData: BlueData,
  mixer: Mixer = blueData.getMixer(),
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

export function buildRuntimeInitStatements(
  blueData: BlueData,
  parameters: Parameter[],
  stringChannels: Array<{ objectName: string; value: string; channelName: string }>,
  profile: CsdRenderProfile = 'realtime',
  renderStartTime: number = blueData.getRenderStartTime(),
): string {
  const stringInits = buildStringChannelInits(blueData, stringChannels, profile);
  const paramInits = buildParameterInits(blueData, parameters, profile, renderStartTime);

  return [stringInits, paramInits].filter((section) => section.length > 0).join('\n');
}

export function collectAlwaysOnInstruments(
  blueData: BlueData,
  arrangement: Arrangement,
  mixer: Mixer,
  channelIdAssignments: Map<Channel, number>,
  parameterMap: Map<Instrument, Parameter[]>,
  compileData: CompileData,
  nchnls: number,
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

    const sourceId = compileData.getInstrSourceId(ia.instr);
    const sourceChannel =
      (sourceId
        ? sourceChannels.find((channel) => channel.getAssociation() === sourceId)
        : undefined) ?? sourceChannels.find((channel) => channel.getName() === ia.arrangementId);
    const channelId = sourceChannel ? channelIdAssignments.get(sourceChannel) : undefined;

    if (channelId !== undefined) {
      compiled = compiled.replace(
        /(\w+),\s*(\w+)\s+blueMixerIn/g,
        `$1 = ga_bluemix_${channelId}_0\n $2 = ga_bluemix_${channelId}_1`,
      );
      compiled = compiled
        .split('\n')
        .map((line: string) => {
          if (!line.trim().startsWith('blueMixerOut')) return line;
          const call = parseBlueMixerOut(line);
          if (/^".*"$/.test(call.args[0]?.trim() ?? '')) return line;
          const outputs = call.args
            .slice(0, nchnls)
            .map((arg, index) => `ga_bluemix_${channelId}_${index} = ${arg}`);
          if (call.comment) outputs.push(call.comment);
          return outputs.join('\n');
        })
        .join('\n');
    }

    const alwaysOnInstrument = new GenericInstrument();
    alwaysOnInstrument.setText(compiled);
    compileData.addInstrSourceId(alwaysOnInstrument, ia.arrangementId);
    alwaysOnInstruments.push(alwaysOnInstrument);
  }

  return alwaysOnInstruments;
}

export function appendParameterAutomationNotes(
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

export function appendParameterScore(
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

export function addScoreNote(blueData: BlueData, notes: NoteList, noteText: string): void {
  const note = Note.createNoteFromText(noteText);
  if (note) {
    notes.add(note);
  }
}

/**
 * Build project info comments for the top of the CSD.
 * Mirrors Java's appendProjectInfo().
 */
export function buildProjectInfo(blueData: BlueData): string {
  const props = blueData.getProjectProperties();
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

export function createRenderSnapshot(
  blueData: BlueData,
  session?: JavaScriptSession,
  runtimeClient?: JavaRuntimeClientContract | null,
  layoutManifest?: AudioLayoutManifest | null,
): {
  arrangement: Arrangement;
  tables: Tables;
  mixer: Mixer;
  compileData: CompileData;
} {
  const arrangement = new Arrangement(blueData.getArrangement());
  arrangement.clearUnusedInstrAssignments();
  const tables = new Tables(blueData.getTableSet());
  const sourceMixer = blueData.getMixer();
  const mixer = sourceMixer.deepCopy() as Mixer;
  copyMixerRuntimeIdentities(sourceMixer, mixer);
  const compileData = new CompileData(arrangement, tables, false);
  const score = blueData.getScore();
  compileData.setPanningEnabled(mixer.isPanningEnabled());
  compileData.setPanLawDb(mixer.getPanLawDb());
  compileData.setPanOffCenterBoost(mixer.isPanOffCenterBoost());
  if (layoutManifest) {
    compileData.setAudioLayoutManifest(layoutManifest);
  }
  score.prepareTrackInstruments(compileData);
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

/**
 * Render snapshots are ordinary duplication copies so model identity remains
 * isolated from compilation. Route-gate catalogs nevertheless need to bind
 * back to the canonical channel/send objects, so transfer only the disposable
 * runtime identities captured before cloning.
 */
export function copyMixerRuntimeIdentities(source: Mixer, target: Mixer): void {
  const sourceChannels = [
    ...source.getAllSourceChannels(),
    ...source.getSubChannels(),
    source.getMaster(),
  ];
  const targetChannels = [
    ...target.getAllSourceChannels(),
    ...target.getSubChannels(),
    target.getMaster(),
  ];

  for (let index = 0; index < sourceChannels.length; index++) {
    const sourceChannel = sourceChannels[index];
    const targetChannel = targetChannels[index];
    if (!sourceChannel || !targetChannel) continue;
    targetChannel.setRuntimeIdentity(sourceChannel.getRuntimeIdentity());

    const sourceChains = [
      sourceChannel.getPreEffects(),
      sourceChannel.getPostEffects(),
      sourceChannel.getEffectsChain(),
    ];
    const targetChains = [
      targetChannel.getPreEffects(),
      targetChannel.getPostEffects(),
      targetChannel.getEffectsChain(),
    ];
    for (let chainIndex = 0; chainIndex < sourceChains.length; chainIndex++) {
      const sourceChain = sourceChains[chainIndex];
      const targetChain = targetChains[chainIndex];
      if (!sourceChain || !targetChain) continue;
      for (let itemIndex = 0; itemIndex < sourceChain.length; itemIndex++) {
        const sourceItem = sourceChain[itemIndex];
        const targetItem = targetChain[itemIndex];
        if (sourceItem instanceof Send && targetItem instanceof Send) {
          targetItem.setRuntimeIdentity(sourceItem.getRuntimeIdentity());
        }
      }
    }
  }
}

export function createRenderEndInstrument(blueData: BlueData): GenericInstrument {
  const instr = new GenericInstrument();
  instr.setText('event "e", 0, 0, 0.1');
  return instr;
}

export function getNoteListDuration(blueData: BlueData, notes: NoteList): number {
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

export function getNoteListDurationFromText(blueData: BlueData, scoreText: string): number {
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
export function buildParameterInits(
  blueData: BlueData,
  parameters: Parameter[],
  profile: CsdRenderProfile = 'realtime',
  renderStartTime: number = blueData.getRenderStartTime(),
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
export function collectStringChannels(
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

  const arr = arrangement ?? blueData.getArrangement();

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
export function buildParameterMap(
  blueData: BlueData,
  arrangement?: Arrangement,
): Map<Instrument, Parameter[]> {
  const map = new Map<Instrument, Parameter[]>();
  const arr = arrangement ?? blueData.getArrangement();

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
export function buildStringChannelInits(
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
export function appendFtgenTableNumbers(globalOrc: string, tables: Tables): void {
  const pattern = /ftgen\s+-?(\d+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(globalOrc)) !== null) {
    const ftgenNum = parseInt(match[1] ?? '0', 10);
    if (ftgenNum !== 0) {
      tables.addFtgenNumber(ftgenNum);
    }
  }
}
