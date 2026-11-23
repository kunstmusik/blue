import { Element } from './serialization/xml-reader';
import { XmlLoadContext, requireXmlValue } from './serialization/xml-load';
import type { XmlDiagnosticSink } from './serialization/xml-load';
import { ObjRefSaveMap, ObjRefLoadMap } from './serialization/obj-ref-map';
import { BlueDataObject } from './blue-data-object';
import { LiveObjectBins } from './live/live-object-bins';
import { LiveObjectSetList } from './live/live-object-set-list';
import { LiveObject } from './live/live-object';
import type { CopyMode } from './deep-copyable';
import {
  checkRoot,
  checkShape,
  readText,
  readInt,
  writeInt,
  readBoolean,
  writeBoolean,
} from './utilities/xml';
import { loadSoundObjectFromXML } from './sound-objects/sound-object-registry';
import './sound-objects/register-sound-object-types';

export class LiveData implements BlueDataObject {
  private _commandLine = 'csound -Wdo devaudio -L stdin';
  private _commandLineEnabled = false;
  private _commandLineOverride = false;
  private _tempo = 60;
  private _repeat = 4;
  private _repeatEnabled = false;
  private _liveCodeText = '';
  private _liveObjectBins: LiveObjectBins;
  private _liveObjectSets: LiveObjectSetList;

  /** Creates Blue Live project state with an empty performance grid and no saved selections. */
  constructor() {
    this._liveObjectBins = new LiveObjectBins();
    this._liveObjectSets = new LiveObjectSetList();
  }

  /** Returns the command-line text supplied to the generator. */
  getCommandLine(): string {
    return this._commandLine;
  }

  /** Sets the command-line text supplied to the generator. */
  setCommandLine(v: string): void {
    this._commandLine = v ?? '';
  }

  /** Reports whether Blue Live uses its configured command line. */
  isCommandLineEnabled(): boolean {
    return this._commandLineEnabled;
  }

  /** Controls whether Blue Live uses its configured command line. */
  setCommandLineEnabled(v: boolean): void {
    this._commandLineEnabled = v;
  }

  /** Reports whether the configured command overrides the generated command line. */
  isCommandLineOverride(): boolean {
    return this._commandLineOverride;
  }

  /** Controls whether the configured command line replaces the generated one. */
  setCommandLineOverride(v: boolean): void {
    this._commandLineOverride = v;
  }

  /** Returns the tempo stored on the Blue Live performance state. */
  getTempo(): number {
    return this._tempo;
  }

  /** Sets the tempo stored on the Blue Live performance state. */
  setTempo(v: number): void {
    this._tempo = v;
  }

  /** Returns the repeat stored on the Blue Live performance state. */
  getRepeat(): number {
    return this._repeat;
  }

  /** Sets the repeat stored on the Blue Live performance state. */
  setRepeat(v: number): void {
    this._repeat = v;
  }

  /** Reports whether Blue Live is configured to repeat triggering. */
  isRepeatEnabled(): boolean {
    return this._repeatEnabled;
  }

  /** Enables or disables repeat triggering in Blue Live. */
  setRepeatEnabled(v: boolean): void {
    this._repeatEnabled = v;
  }

  /** Returns the editable Csound code stored with the Blue Live session. */
  getLiveCodeText(): string {
    return this._liveCodeText;
  }

  /** Replaces the live Csound code stored in the project. */
  setLiveCodeText(v: string): void {
    this._liveCodeText = v ?? '';
  }

  /** Returns the Live object bins stored on the Blue Live performance state. */
  getLiveObjectBins(): LiveObjectBins {
    return this._liveObjectBins;
  }

  /** Sets the Live object bins stored on the Blue Live performance state. */
  setLiveObjectBins(bins: LiveObjectBins): void {
    this._liveObjectBins = bins;
  }

  /** Returns the Live object sets stored on the Blue Live performance state. */
  getLiveObjectSets(): LiveObjectSetList {
    return this._liveObjectSets;
  }

  /** Sets the Live object sets stored on the Blue Live performance state. */
  setLiveObjectSets(sets: LiveObjectSetList): void {
    this._liveObjectSets = sets;
  }

  saveAsXML(objRefMap?: ObjRefSaveMap): Element {
    const retVal = new Element('liveData');
    retVal.addElement('commandLine').setText(this._commandLine);
    retVal.addElement(writeBoolean('commandLineEnabled', this._commandLineEnabled));
    retVal.addElement(writeBoolean('commandLineOverride', this._commandLineOverride));
    retVal.addElement(this._liveObjectBins.saveAsXML(objRefMap));
    retVal.addElement(this._liveObjectSets.saveAsXML());
    retVal.addElement(writeInt('repeat', this._repeat));
    retVal.addElement(writeInt('tempo', this._tempo));
    retVal.addElement(writeBoolean('repeatEnabled', this._repeatEnabled));
    retVal.addElement('liveCodeText').setText(this._liveCodeText);
    return retVal;
  }

  /** Reconstructs the Blue Live performance state from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(
    data: Element,
    objRefMap?: ObjRefLoadMap,
    context?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): LiveData {
    const ctx = context ?? new XmlLoadContext(data);
    checkRoot(data, 'liveData', ctx);
    checkShape(
      data,
      [],
      [
        'commandLine',
        'commandLineEnabled',
        'commandLineOverride',
        'liveObjectBins',
        'liveObjectSetList',
        'repeat',
        'tempo',
        'repeatEnabled',
        'liveCodeText',
        'liveObject',
        'soundObject',
      ],
      ctx,
      ['liveObject', 'soundObject'],
    );
    const liveData = new LiveData();
    const nodes = data.getElements();

    let doCommandLineUpgrade = true;
    const oldFormat: LiveObject[] = [];
    let liveObjectSetsNode: Element | null = null;

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const name = node.getName();
      switch (name) {
        case 'commandLine':
          liveData.setCommandLine(readText(node, ctx));
          break;
        case 'commandLineEnabled':
          liveData.setCommandLineEnabled(readBoolean(node, ctx));
          doCommandLineUpgrade = false;
          break;
        case 'commandLineOverride':
          liveData.setCommandLineOverride(readBoolean(node, ctx));
          doCommandLineUpgrade = false;
          break;
        case 'soundObject': {
          const sObj = loadSoundObjectFromXML(node, objRefMap, ctx);
          const lObj = new LiveObject();
          lObj.setSoundObject(sObj);
          oldFormat.push(lObj);
          break;
        }
        case 'liveObject':
          oldFormat.push(LiveObject.loadFromXML(node, objRefMap, ctx));
          break;
        case 'liveObjectBins':
          liveData._liveObjectBins = LiveObjectBins.loadFromXML(node, objRefMap, ctx);
          break;
        case 'repeat':
          liveData._repeat = readInt(node, ctx, 1);
          break;
        case 'tempo':
          liveData._tempo = readInt(node, ctx, 1);
          break;
        case 'liveObjectSetList':
          liveObjectSetsNode = node;
          break;
        case 'repeatEnabled':
          liveData.setRepeatEnabled(readBoolean(node, ctx));
          break;
        case 'liveCodeText':
          liveData.setLiveCodeText(readText(node, ctx));
          break;
      }
    }

    if (oldFormat.length > 0) {
      const explicitBins = data.getElement('liveObjectBins');
      if (
        explicitBins &&
        [...explicitBins.getElements('bin')].some(
          (bin) => [...bin.getElements('liveObject')].length > 0,
        )
      )
        throw ctx.at(explicitBins).error({
          code: 'conflict',
          message: 'Legacy Live objects coexist with a populated current grid.',
          recovery: 'Keep one authoritative Live grid.',
        });
      const grid: Array<Array<LiveObject | null>> = [];
      const col: Array<LiveObject | null> = [];
      for (const lObj of oldFormat) {
        col.push(lObj);
      }
      grid.push(col);
      liveData._liveObjectBins = LiveObjectBins.fromGrid(grid);
    }

    if (doCommandLineUpgrade) {
      liveData.setCommandLineEnabled(true);
      liveData.setCommandLineOverride(true);
    }

    const ids = new Set<string>();
    const bins = liveData._liveObjectBins;
    for (let c = 0; c < bins.getColumnCount(); c++) {
      for (let r = 0; r < bins.getRowCount(); r++) {
        const obj = bins.getLiveObject(c, r);
        if (!obj) continue;
        const id = obj.getUniqueId();
        if (ids.has(id))
          throw ctx.at(data).error({
            code: 'reference',
            value: id,
            message: 'Duplicate Live object ID.',
            recovery: 'Give every Live object a distinct ID before resolving saved sets.',
          });
        ids.add(id);
      }
    }
    if (liveObjectSetsNode) {
      liveData._liveObjectSets = LiveObjectSetList.loadFromXML(
        liveObjectSetsNode,
        liveData._liveObjectBins,
        ctx,
      );
    }

    return context ? liveData : requireXmlValue(ctx.result(liveData), sink);
  }

  deepCopy(mode: CopyMode = 'duplication'): BlueDataObject {
    const copy = new LiveData();
    copy._commandLine = this._commandLine;
    copy._tempo = this._tempo;
    copy._repeat = this._repeat;
    copy._commandLineEnabled = this._commandLineEnabled;
    copy._commandLineOverride = this._commandLineOverride;
    copy._repeatEnabled = this._repeatEnabled;
    copy._liveCodeText = this._liveCodeText;
    copy._liveObjectBins = this._liveObjectBins.deepCopy(mode) as LiveObjectBins;
    copy._liveObjectSets = this._liveObjectSets.deepCopy() as LiveObjectSetList;
    return copy;
  }
}
