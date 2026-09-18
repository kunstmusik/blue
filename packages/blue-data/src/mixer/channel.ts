/**
 * Channel — a mixer channel with effects chain and sends.
 * Mirrors the Java Channel class.
 */
import { EffectsChain } from './effects-chain';
import { Send } from './send';
import { Element } from '../serialization/xml-reader';
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

    this._panParameter = new Parameter();
    this._panParameter.setName(PARAM_PAN);
    this._panParameter.setLabel('');
    this._panParameter.setMinimum(0.0);
    this._panParameter.setMaximum(1.0);
    this._panParameter.setFixedValue(DEFAULT_PAN);
    this._panParameter.setResolution(-1.0);

    this._panWidthParameter = new Parameter();
    this._panWidthParameter.setName(PARAM_WIDTH);
    this._panWidthParameter.setLabel('');
    this._panWidthParameter.setMinimum(0.0);
    this._panWidthParameter.setMaximum(1.0);
    this._panWidthParameter.setFixedValue(DEFAULT_PAN_WIDTH);
    this._panWidthParameter.setResolution(-1.0);

    this._dualPanLeftParameter = new Parameter();
    this._dualPanLeftParameter.setName(PARAM_DUAL_LEFT);
    this._dualPanLeftParameter.setLabel('');
    this._dualPanLeftParameter.setMinimum(0.0);
    this._dualPanLeftParameter.setMaximum(1.0);
    this._dualPanLeftParameter.setFixedValue(DEFAULT_DUAL_PAN_LEFT);
    this._dualPanLeftParameter.setResolution(-1.0);

    this._dualPanRightParameter = new Parameter();
    this._dualPanRightParameter.setName(PARAM_DUAL_RIGHT);
    this._dualPanRightParameter.setLabel('');
    this._dualPanRightParameter.setMinimum(0.0);
    this._dualPanRightParameter.setMaximum(1.0);
    this._dualPanRightParameter.setFixedValue(DEFAULT_DUAL_PAN_RIGHT);
    this._dualPanRightParameter.setResolution(-1.0);
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
    postEffects.setAttribute('bin', 'post');
    elem.addElement(postEffects);

    if (this._effectsChain.length > 0 && this._effectsChain !== this._postEffects) {
      elem.addElement(this._effectsChain.saveAsXML());
    }

    elem.addElement(this._levelParameter.saveAsXML());
    elem.addElement(this._panParameter.saveAsXML());
    elem.addElement(this._panWidthParameter.saveAsXML());
    elem.addElement(this._dualPanLeftParameter.saveAsXML());
    elem.addElement(this._dualPanRightParameter.saveAsXML());

    return elem;
  }

  static loadFromXML(data: Element): Channel {
    const channel = new Channel();

    channel._name = data.getTextString('name') ?? '';
    channel._muted = data.getTextString('muted') === 'true';
    channel._solo = data.getTextString('solo') === 'true';

    // Out channel routing
    const outCh = data.getTextString('outChannel');
    if (outCh) channel._outChannel = outCh;

    // Level (in dB)
    const level = data.getTextString('level');
    if (level) channel._level = parseFloat(level);

    // Pan (finite in [0, 1], invalid XML falls back to center 0.5)
    const pan = data.getTextString('pan');
    if (pan) {
      const parsedPan = parseFloat(pan);
      channel._pan = isValidPan(parsedPan) ? parsedPan : DEFAULT_PAN;
    }

    // Stereo mode and scalars with independent fallbacks
    const stereoMode = data.getTextString('stereoPanMode');
    if (stereoMode) {
      channel._stereoPanMode = isValidStereoPanMode(stereoMode)
        ? stereoMode
        : DEFAULT_STEREO_PAN_MODE;
    }

    const width = data.getTextString('panWidth');
    if (width) {
      const parsedWidth = parseFloat(width);
      channel._panWidth = isValidPanWidth(parsedWidth) ? parsedWidth : DEFAULT_PAN_WIDTH;
    }

    const dualLeft = data.getTextString('dualPanLeft');
    if (dualLeft) {
      const parsedLeft = parseFloat(dualLeft);
      channel._dualPanLeft = isValidDualPan(parsedLeft) ? parsedLeft : DEFAULT_DUAL_PAN_LEFT;
    }

    const dualRight = data.getTextString('dualPanRight');
    if (dualRight) {
      const parsedRight = parseFloat(dualRight);
      channel._dualPanRight = isValidDualPan(parsedRight) ? parsedRight : DEFAULT_DUAL_PAN_RIGHT;
    }

    const assoc = data.getAttribute('association') ?? data.getTextString('association');
    if (assoc) channel._association = assoc;

    // Effects chains: <effectsChain bin='pre'> and <effectsChain bin='post'>
    const ecNodes = data.getElements('effectsChain');
    while (ecNodes.hasMoreElements()) {
      const ecNode = ecNodes.next();
      const loaded = EffectsChain.loadFromXML(ecNode);
      const bin = ecNode.getAttribute('bin') ?? '';
      if (bin === 'pre') {
        channel._preEffects = loaded;
      } else if (bin === 'post') {
        channel._postEffects = loaded;
      } else {
        channel._effectsChain = loaded;
        channel._postEffects = loaded;
      }
    }

    // Legacy standalone sends are treated as post-fader sends.
    const sendNodes = data.getElements('send');
    while (sendNodes.hasMoreElements()) {
      channel._postEffects.push(Send.loadFromXML(sendNodes.next()));
    }

    const paramNodes = data.getElements('parameter');
    while (paramNodes.hasMoreElements()) {
      const paramElem = paramNodes.next();
      const loadedParam = Parameter.loadFromXML(paramElem);
      const name = loadedParam.getName();
      if (name === PARAM_PAN) {
        channel._panParameter = loadedParam;
      } else if (name === PARAM_WIDTH) {
        channel._panWidthParameter = loadedParam;
      } else if (name === PARAM_DUAL_LEFT) {
        channel._dualPanLeftParameter = loadedParam;
      } else if (name === PARAM_DUAL_RIGHT) {
        channel._dualPanRightParameter = loadedParam;
      } else if (name === 'Volume') {
        channel._levelParameter = loadedParam;
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

    return channel;
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
