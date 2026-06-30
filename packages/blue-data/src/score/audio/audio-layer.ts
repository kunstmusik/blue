/**
 * AudioLayer — a layer containing AudioClip objects.
 * Mirrors the Java AudioLayer class.
 *
 * AudioLayer implements ScoreObjectLayer<AudioClip> and AutomatableLayer.
 * During CSD generation, it produces diskin2-based score events with fade parameters.
 */
import { AudioClip } from './audio-clip';
import { ScoreObject } from '../../score/score-object';
import { ScoreObjectLayer } from '../../score/layers/score-object-layer';
import { AutomatableLayer } from '../../score/layers/automatable-layer';
import { ParameterIdList } from '../../automation/parameter-id-list';
import { LAYER_HEIGHT } from '../../score/layers/layer';
import { CompileData } from '../../compile-data';
import { NoteList } from '../../sound-objects/note-list';
import { Note } from '../../sound-objects/note';
import { TimeContext } from '../../time/time-context';
import { fadeTypeToCsound } from './fade-type';
import { Element } from '../../serialization/xml-reader';
import { ObjRefSaveMap } from '../../serialization/obj-ref-map';
import { GenericInstrument } from '../../instruments/generic-instrument';
import { Mixer } from '../../mixer/mixer';
import { Channel } from '../../mixer/channel';
import { BLUE_FADE_UDO } from './blue-fade-udo';
import { PLAYBACK_INSTRUMENT_ORC } from './playback-instrument-orc';

export class AudioLayer extends Array<AudioClip> implements ScoreObjectLayer<AudioClip>, AutomatableLayer {
  static HEIGHT_MAX_INDEX = 9;

  private _name = '';
  private _muted = false;
  private _solo = false;
  private _uniqueId = generateUniqueId();
  private _heightIndex = 0;
  private _automationParameters = new ParameterIdList();

  constructor() {
    super();
  }

  /** Copy constructor. */
  static copyFrom(src: AudioLayer): AudioLayer {
    const layer = new AudioLayer();
    layer._name = src._name;
    layer._muted = src._muted;
    layer._solo = src._solo;
    layer._uniqueId = src._uniqueId;
    layer._heightIndex = src._heightIndex;
    layer._automationParameters = src._automationParameters.deepCopy();
    for (const clip of src) {
      layer.push(AudioClip.copyFrom(clip));
    }
    return layer;
  }

  // ─── Layer ───

  getName(): string { return this._name; }
  setName(name: string): void { this._name = name; }
  getLayerHeight(): number { return LAYER_HEIGHT * (this._heightIndex + 1); }

  accepts(object: ScoreObject): boolean {
    return object instanceof AudioClip;
  }

  contains(object: ScoreObject): boolean {
    if (!(object instanceof AudioClip)) return false;
    return Array.prototype.includes.call(this, object);
  }

  remove(object: ScoreObject): boolean {
    if (!(object instanceof AudioClip)) return false;
    const idx = Array.prototype.indexOf.call(this, object);
    if (idx !== -1) {
      Array.prototype.splice.call(this, idx, 1);
      return true;
    }
    return false;
  }

  clearScoreObjects(): void {
    this.length = 0;
  }

  deepCopy(): AudioLayer {
    return AudioLayer.copyFrom(this);
  }

  // ─── ScoreObjectLayer ───

  getHeightIndex(): number { return this._heightIndex; }
  setHeightIndex(idx: number): void { this._heightIndex = idx; }

  getUniqueId(): string { return this._uniqueId; }

  isMuted(): boolean { return this._muted; }
  setMuted(m: boolean): void { this._muted = m; }

  isSolo(): boolean { return this._solo; }
  setSolo(s: boolean): void { this._solo = s; }

  getAutomationParameters(): ParameterIdList {
    return this._automationParameters;
  }

  // ─── CSD Generation ───

  /**
   * Generate diskin2-based score events for all audio clips.
   * Produces notes with p-fields for the playback instrument.
   */
  generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
  ): NoteList {
    if (compileData.getCompilationVariable('BLUE_FADE_UDO') == null) {
      compileData.appendGlobalOrc(BLUE_FADE_UDO);
      compileData.setCompilationVariable('BLUE_FADE_UDO', {});
    }

    const instrId = this.generateInstrumentForAudioLayer(compileData);
    const notes = new NoteList();
    const usesEndTime = endTime > startTime;
    const adjustedEndTime = endTime - startTime;

    for (const clip of this) {
      const clipStart = clip.getStartTime().toBeats(context);
      const clipFileStart = clip.getFileStartTime();
      const clipDur = clip.getSubjectiveDuration().toBeats(context);
      const clipEnd = clipStart + clipDur;

      // Skip clips outside render window
      if (clipEnd <= startTime || (usesEndTime && clipStart >= endTime)) {
        continue;
      }

      const startOffset = Math.max(startTime - clipStart, 0);
      const newStart = Math.max(clipStart - startTime, 0);
      const newEnd = clipEnd - startTime;
      const newDuration = (usesEndTime && newEnd > adjustedEndTime)
        ? adjustedEndTime - newStart
        : (newEnd - newStart);

      const path = clip.getAudioFile().replace(/\\/g, '/');

      // Create a note with diskin2 p-fields
      const n = Note.createNote(12);
      // p1: compile-time generated playback instrument ID
      n.setPField(instrId.toString(), 1);
      n.setStartTime(newStart);
      n.setSubjectiveDuration(newDuration);
      // p4: audio file path
      n.setPField(`"${path}"`, 4);
      // p5: file start time
      n.setPField(clipFileStart.toString(), 5);
      // p6: start offset
      n.setPField(startOffset.toString(), 6);
      // p7: duration
      n.setPField(clipDur.toString(), 7);
      // p8: fade-in type
      n.setPField(fadeTypeToCsound(clip.getFadeInType()).toString(), 8);
      // p9: fade-in time
      n.setPField(clip.getFadeIn().toString(), 9);
      // p10: fade-out type
      n.setPField(fadeTypeToCsound(clip.getFadeOutType()).toString(), 10);
      // p11: fade-out time
      n.setPField(clip.getFadeOut().toString(), 11);
      // p12: looping flag
      n.setPField(clip.isLooping() ? '1' : '0', 12);

      notes.push(n);
    }

    return notes;
  }

  protected getInstrumentText(var1: string, var2: string): string {
    return PLAYBACK_INSTRUMENT_ORC
      .replaceAll('{0}', var1)
      .replaceAll('{1}', var2);
  }

  protected generateInstrumentForAudioLayer(compileData: CompileData): number {
    const existing = compileData.getCompilationVariable(this._uniqueId);
    if (typeof existing === 'number') {
      return existing;
    }

    const assignments = compileData.getChannelIdAssignments();

    let associatedChannel: Channel | undefined;
    for (const channel of assignments.keys()) {
      if (channel.getAssociation() === this._uniqueId) {
        associatedChannel = channel;
        break;
      }
    }

    if (!associatedChannel) {
      for (const channel of assignments.keys()) {
        if (channel.getName() === Mixer.MASTER_CHANNEL) {
          associatedChannel = channel;
          break;
        }
      }
    }

    const instrument = new GenericInstrument();
    if (!associatedChannel) {
      instrument.setText(`${this.getInstrumentText("a1", "a2")}\noutc a1, a2\n`);
    } else {
      const channelId = assignments.get(associatedChannel);
      if (channelId == null) {
        throw new Error(
          `Error: missing mixer channel assignment for ${associatedChannel.getName()}`,
        );
      }

      const var1 = Mixer.getChannelVar(channelId, 0);
      const var2 = Mixer.getChannelVar(channelId, 1);
      instrument.setText(this.getInstrumentText(var1, var2));
    }

    const instrId = compileData.addInstrument(instrument);
    compileData.setCompilationVariable(this._uniqueId, instrId);

    return instrId;
  }

  // ─── XML Serialization ───

  saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const root = new Element('audioLayer');
    root.setAttribute('name', this._name);
    root.setAttribute('muted', this._muted.toString());
    root.setAttribute('solo', this._solo.toString());
    root.setAttribute('heightIndex', this._heightIndex.toString());
    root.setAttribute('uniqueId', this._uniqueId);
    root.setAttribute('automationSelectedIndex', this._automationParameters.getSelectedIndex().toString());

    for (const clip of this) {
      root.addElement(clip.saveAsXML(_objRefMap));
    }

    for (const id of this._automationParameters.getIds()) {
      root.addElement('parameterId').setText(id);
    }

    return root;
  }

  static loadFromXML(data: Element): AudioLayer {
    const layer = new AudioLayer();
    layer._name = data.getAttributeValue('name') ?? '';
    layer._muted = data.getAttributeValue('muted') === 'true';
    layer._solo = data.getAttributeValue('solo') === 'true';
    const uniqueId = data.getAttributeValue('uniqueId');
    if (uniqueId) layer._uniqueId = uniqueId;
    const heightIndex = data.getAttributeValue('heightIndex');
    if (heightIndex) layer._heightIndex = parseInt(heightIndex, 10);
    const automationSelectedIndex = data.getAttributeValue('automationSelectedIndex');

    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      if (node.getName() === 'audioClip') {
        layer.push(AudioClip.loadFromXML(node));
      } else if (node.getName() === 'parameterId') {
        layer._automationParameters.addParameterId(node.getTextString());
      }
    }
    if (automationSelectedIndex) {
      const parsed = parseInt(automationSelectedIndex, 10);
      if (!Number.isNaN(parsed)) {
        layer._automationParameters.setSelectedIndex(parsed);
      }
    }

    return layer;
  }
}

/**
 * Generate a unique ID for this layer.
 * Uses crypto.randomUUID() with counter fallback.
 */
function generateUniqueId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random
  return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
}
