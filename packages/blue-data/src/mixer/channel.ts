/**
 * Channel — a mixer channel with effects chain and sends.
 * Mirrors the Java Channel class.
 */
import { EffectsChain } from './effects-chain';
import { Send } from './send';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import {
  checkRoot,
  checkShape,
  readText,
  readBoolean,
  readDouble,
  readEnum,
} from '../utilities/xml';

import { BlueDataObject } from '../blue-data-object';
import { Parameter } from '../automation/parameter';
import type { CopyMode } from '../deep-copyable';
import { writeDouble, writeBoolean } from '../utilities/xml';
import {
  clampPan,
  isValidPan,
  DEFAULT_PAN,
  type StereoPanMode,
  DEFAULT_STEREO_PAN_MODE,
  isValidStereoPanMode,
  clampStereoPanMode,
  DEFAULT_PAN_WIDTH,
  isValidPanWidth,
  clampPanWidth,
  DEFAULT_DUAL_PAN_LEFT,
  DEFAULT_DUAL_PAN_RIGHT,
  isValidDualPan,
  clampDualPan,
  PARAM_PAN,
  PARAM_WIDTH,
  PARAM_DUAL_LEFT,
  PARAM_DUAL_RIGHT,
} from './channel-pan';

let nextRuntimeIdentity = 1;

function createUnitRangeParameter(name: string, fixedValue: number): Parameter {
  const parameter = new Parameter();
  parameter.setName(name);
  parameter.setLabel('');
  parameter.setMinimum(0.0);
  parameter.setMaximum(1.0);
  parameter.setFixedValue(fixedValue);
  parameter.setResolution(-1.0);
  return parameter;
}

export class Channel implements BlueDataObject {
  static readonly MASTER = 'Master';
  static readonly NAME = 'name';
  static readonly LEVEL = 'level';
  static readonly SOLO = 'solo';
  static readonly MUTED = 'muted';
  static readonly OUT_CHANNEL = 'outChannel';

  private _name = 'Channel';
  private _outChannel = Channel.MASTER;
  private _muted = false;
  private _solo = false;
  private _level = 0;
  private _volume = 1.0;
  private _pan = DEFAULT_PAN;
  private _stereoPanMode: StereoPanMode = DEFAULT_STEREO_PAN_MODE;
  private _panWidth = DEFAULT_PAN_WIDTH;
  private _dualPanLeft = DEFAULT_DUAL_PAN_LEFT;
  private _dualPanRight = DEFAULT_DUAL_PAN_RIGHT;
  private _preEffects = new EffectsChain();
  private _postEffects = new EffectsChain();
  private _effectsChain = new EffectsChain();
  private _association = '';
  private _levelParameter: Parameter;
  private _panParameter: Parameter;
  private _panWidthParameter: Parameter;
  private _dualPanLeftParameter: Parameter;
  private _dualPanRightParameter: Parameter;
  /** Disposable identity used to bind compiled route gates to this object. */
  private _runtimeIdentity = `channel-${nextRuntimeIdentity++}`;

  constructor() {
    this._levelParameter = new Parameter();
    this._levelParameter.setName('Volume');
    this._levelParameter.setLabel('dB');
    this._levelParameter.setMinimum(-96.0);
    this._levelParameter.setMaximum(12.0);
    this._levelParameter.setFixedValue(0.0);
    this._levelParameter.setResolution(-1.0);

    this._panParameter = createUnitRangeParameter(PARAM_PAN, DEFAULT_PAN);
    this._panWidthParameter = createUnitRangeParameter(PARAM_WIDTH, DEFAULT_PAN_WIDTH);
    this._dualPanLeftParameter = createUnitRangeParameter(PARAM_DUAL_LEFT, DEFAULT_DUAL_PAN_LEFT);
    this._dualPanRightParameter = createUnitRangeParameter(
      PARAM_DUAL_RIGHT,
      DEFAULT_DUAL_PAN_RIGHT,
    );
  }

  getName(): string {
    return this._name;
  }
  setName(name: string): void {
    this._name = name;
  }

  getOutChannel(): string {
    return this._outChannel;
  }
  setOutChannel(ch: string): void {
    this._outChannel = ch;
  }

  isMuted(): boolean {
    return this._muted;
  }
  setMuted(m: boolean): void {
    this._muted = m;
  }

  isSolo(): boolean {
    return this._solo;
  }
  setSolo(s: boolean): void {
    this._solo = s;
  }

  getLevel(): number {
    return this._level;
  }
  setLevel(v: number): void {
    this._level = v;
    if (!this._levelParameter.isAutomationEnabled()) {
      this._levelParameter.setFixedValue(v);
    }
  }

  getVolume(): number {
    return this._volume;
  }
  setVolume(v: number): void {
    this._volume = v;
  }

  getPan(): number {
    return this._pan;
  }
  setPan(p: number): void {
    if (!isValidPan(p)) return;
    this._pan = p;
    if (!this._panParameter.isAutomationEnabled()) {
      this._panParameter.setFixedValue(p);
    }
  }

  getPanParameter(): Parameter {
    return this._panParameter;
  }
  setPanParameter(param: Parameter): void {
    this._panParameter = param;
  }

  getStereoPanMode(): StereoPanMode {
    return this._stereoPanMode;
  }
  setStereoPanMode(mode: StereoPanMode): void {
    if (!isValidStereoPanMode(mode)) return;
    this._stereoPanMode = mode;
  }

  getPanWidth(): number {
    return this._panWidth;
  }
  setPanWidth(w: number): void {
    if (!isValidPanWidth(w)) return;
    this._panWidth = w;
    if (!this._panWidthParameter.isAutomationEnabled()) {
      this._panWidthParameter.setFixedValue(w);
    }
  }

  getPanWidthParameter(): Parameter {
    return this._panWidthParameter;
  }
  setPanWidthParameter(param: Parameter): void {
    this._panWidthParameter = param;
  }

  getDualPanLeft(): number {
    return this._dualPanLeft;
  }
  setDualPanLeft(p: number): void {
    if (!isValidDualPan(p)) return;
    this._dualPanLeft = p;
    if (!this._dualPanLeftParameter.isAutomationEnabled()) {
      this._dualPanLeftParameter.setFixedValue(p);
    }
  }

  getDualPanLeftParameter(): Parameter {
    return this._dualPanLeftParameter;
  }
  setDualPanLeftParameter(param: Parameter): void {
    this._dualPanLeftParameter = param;
  }

  getDualPanRight(): number {
    return this._dualPanRight;
  }
  setDualPanRight(p: number): void {
    if (!isValidDualPan(p)) return;
    this._dualPanRight = p;
    if (!this._dualPanRightParameter.isAutomationEnabled()) {
      this._dualPanRightParameter.setFixedValue(p);
    }
  }

  getDualPanRightParameter(): Parameter {
    return this._dualPanRightParameter;
  }
  setDualPanRightParameter(param: Parameter): void {
    this._dualPanRightParameter = param;
  }

  getPreEffects(): EffectsChain {
    return this._preEffects;
  }
  getPostEffects(): EffectsChain {
    return this._postEffects;
  }
  getEffectsChain(): EffectsChain {
    return this._effectsChain;
  }

  getSends(): Send[] {
    return [
      ...this._preEffects.getSends(),
      ...this._postEffects.getSends(),
      ...this._effectsChain.getSends(),
    ];
  }

  getAssociation(): string {
    return this._association;
  }
  setAssociation(a: string): void {
    this._association = a;
  }

  getRuntimeIdentity(): string {
    return this._runtimeIdentity;
  }

  setRuntimeIdentity(identity: string): void {
    this._runtimeIdentity = identity;
  }

  getLevelParameter(): Parameter {
    return this._levelParameter;
  }
  setLevelParameter(param: Parameter): void {
    this._levelParameter = param;
  }

  getChannelParameter(): Parameter {
    return this._levelParameter;
  }

  saveAsXML(): Element {
    const elem = new Element('channel');
    if (this._association) {
      elem.setAttribute('association', this._association);
    }

    elem.addElement('name').setText(this._name);
    elem.addElement('outChannel').setText(this._outChannel);
    elem.addElement(writeDouble('level', this._level));
    elem.addElement(writeDouble('pan', this._pan));
    elem.addElement('stereoPanMode').setText(this._stereoPanMode);
    elem.addElement(writeDouble('panWidth', this._panWidth));
    elem.addElement(writeDouble('dualPanLeft', this._dualPanLeft));
    elem.addElement(writeDouble('dualPanRight', this._dualPanRight));
    elem.addElement(writeBoolean('muted', this._muted));
    elem.addElement(writeBoolean('solo', this._solo));

    const preEffects = this._preEffects.saveAsXML();
    preEffects.setAttribute('bin', 'pre');
    elem.addElement(preEffects);

    const postEffects = this._postEffects.saveAsXML();
    if (this._effectsChain !== this._postEffects) {
      for (const item of this._effectsChain) postEffects.addElement(item.saveAsXML());
    }
    postEffects.setAttribute('bin', 'post');
    elem.addElement(postEffects);

    elem.addElement(this._levelParameter.saveAsXML());
    elem.addElement(this._panParameter.saveAsXML());
    elem.addElement(this._panWidthParameter.saveAsXML());
    elem.addElement(this._dualPanLeftParameter.saveAsXML());
    elem.addElement(this._dualPanRightParameter.saveAsXML());

    return elem;
  }

  static loadFromXML(data: Element, context?: XmlLoadContext, sink?: XmlDiagnosticSink): Channel {
    const ctx = context ?? new XmlLoadContext(data);
    checkRoot(data, 'channel', ctx);
    checkShape(
      data,
      ['association'],
      [
        'name',
        'outChannel',
        'level',
        'muted',
        'solo',
        'pan',
        'stereoPanMode',
        'panWidth',
        'dualPanLeft',
        'dualPanRight',
        'association',
        'effectsChain',
        'send',
        'parameter',
      ],
      ctx,
      ['effectsChain', 'send', 'parameter'],
    );
    const channel = new Channel();
    for (const field of ['name', 'outChannel'] as const) {
      const child = data.getElement(field);
      if (child) {
        const value = readText(child, ctx);
        if (field === 'name') channel._name = value === 'master' ? Channel.MASTER : value;
        else channel._outChannel = value === 'master' ? Channel.MASTER : value;
      }
    }
    for (const field of ['muted', 'solo'] as const) {
      const child = data.getElement(field);
      if (child) {
        if (field === 'muted') channel._muted = readBoolean(child, ctx);
        else channel._solo = readBoolean(child, ctx);
      }
    }
    for (const field of ['level', 'pan', 'panWidth', 'dualPanLeft', 'dualPanRight'] as const) {
      const child = data.getElement(field);
      if (!child) continue;
      const value = readDouble(child, ctx);
      if (field !== 'level' && (value < 0 || value > 1))
        throw ctx.at(child).error({
          code: 'value',
          value: String(value),
          message: 'Panning value must be between zero and one.',
          recovery: 'Supply a value in the supported range.',
        });
      switch (field) {
        case 'level':
          channel._level = value;
          break;
        case 'pan':
          channel._pan = value;
          break;
        case 'panWidth':
          channel._panWidth = value;
          break;
        case 'dualPanLeft':
          channel._dualPanLeft = value;
          break;
        case 'dualPanRight':
          channel._dualPanRight = value;
          break;
      }
    }
    const mode = data.getElement('stereoPanMode');
    if (mode) channel._stereoPanMode = readEnum(mode, ['balance', 'stereoPan', 'dualPan'], ctx);
    const association = data.getAttribute('association');
    const associationElement = data.getElement('association');
    const childAssociation = associationElement ? readText(associationElement, ctx) : null;
    if (association !== null && childAssociation !== null && association !== childAssociation)
      throw ctx.error({
        code: 'conflict',
        member: 'association',
        message: 'Conflicting association representations.',
        recovery: 'Keep one association value.',
      });
    const resolvedAssociation = association ?? childAssociation;
    channel._association =
      resolvedAssociation === null || resolvedAssociation === 'null' ? '' : resolvedAssociation;
    const bins = new Set<string>();
    const chains = data.getElements('effectsChain').toArray();
    const directSends = data.getElements('send').toArray();
    for (const chainElement of chains) {
      const bin = chainElement.getAttribute('bin') ?? 'post';
      if (bins.has(bin))
        throw ctx.at(chainElement).error({
          code: 'conflict',
          member: '@bin',
          message: 'Competing effect chains for the same bin.',
          recovery: 'Keep one chain for each bin.',
        });
      bins.add(bin);
      if (bin === 'post' && chainElement.getAttribute('bin') !== null && directSends.length > 0)
        throw ctx.at(chainElement).error({
          code: 'conflict',
          message: 'An explicit post chain competes with legacy direct sends.',
          recovery: 'Move the sends into one post chain.',
        });
      const loaded = EffectsChain.loadFromXML(chainElement, ctx);
      if (bin === 'pre') channel._preEffects = loaded;
      else channel._postEffects = loaded;
    }
    for (const send of directSends) channel._postEffects.push(Send.loadFromXML(send, ctx));
    const parameters = new Set<string>();
    for (const parameter of data.getElements('parameter')) {
      const loaded = Parameter.loadFromXML(parameter, ctx);
      const name = loaded.getName();
      if (parameters.has(name))
        throw ctx.at(parameter).error({
          code: 'cardinality',
          value: name,
          message: 'Duplicate channel parameter.',
          recovery: 'Keep one parameter with this name.',
        });
      parameters.add(name);
      switch (name) {
        case 'Volume':
          channel._levelParameter = loaded;
          break;
        case PARAM_PAN:
          channel._panParameter = loaded;
          break;
        case PARAM_WIDTH:
          channel._panWidthParameter = loaded;
          break;
        case PARAM_DUAL_LEFT:
          channel._dualPanLeftParameter = loaded;
          break;
        case PARAM_DUAL_RIGHT:
          channel._dualPanRightParameter = loaded;
          break;
        default:
          throw ctx.at(parameter).error({
            code: 'value',
            value: name,
            message: 'Unsupported channel parameter name.',
            recovery: 'Use a modeled channel parameter.',
          });
      }
    }

    if (!channel._levelParameter.isAutomationEnabled()) {
      channel._levelParameter.setFixedValue(channel._level);
    }
    if (!channel._panParameter.isAutomationEnabled()) {
      channel._panParameter.setFixedValue(channel._pan);
    }
    if (!channel._panWidthParameter.isAutomationEnabled()) {
      channel._panWidthParameter.setFixedValue(channel._panWidth);
    }
    if (!channel._dualPanLeftParameter.isAutomationEnabled()) {
      channel._dualPanLeftParameter.setFixedValue(channel._dualPanLeft);
    }
    if (!channel._dualPanRightParameter.isAutomationEnabled()) {
      channel._dualPanRightParameter.setFixedValue(channel._dualPanRight);
    }

    return context ? channel : requireXmlValue(ctx.result(channel), sink);
  }

  deepCopy(mode: CopyMode = 'duplication'): BlueDataObject {
    const copy = new Channel();
    copy._name = this._name;
    copy._muted = this._muted;
    copy._solo = this._solo;
    copy._volume = this._volume;
    copy._pan = this._pan;
    copy._stereoPanMode = this._stereoPanMode;
    copy._panWidth = this._panWidth;
    copy._dualPanLeft = this._dualPanLeft;
    copy._dualPanRight = this._dualPanRight;
    copy._association = this._association;
    copy._level = this._level;
    copy._outChannel = this._outChannel;
    copy._preEffects = this._preEffects.deepCopy(mode) as EffectsChain;
    copy._postEffects = this._postEffects.deepCopy(mode) as EffectsChain;
    copy._effectsChain = this._effectsChain.deepCopy(mode) as EffectsChain;
    copy._levelParameter = this._levelParameter.deepCopy(mode) as Parameter;
    copy._panParameter = this._panParameter.deepCopy(mode) as Parameter;
    copy._panWidthParameter = this._panWidthParameter.deepCopy(mode) as Parameter;
    copy._dualPanLeftParameter = this._dualPanLeftParameter.deepCopy(mode) as Parameter;
    copy._dualPanRightParameter = this._dualPanRightParameter.deepCopy(mode) as Parameter;
    if (mode === 'history') {
      copy._runtimeIdentity = this._runtimeIdentity;
    }
    return copy;
  }
}
