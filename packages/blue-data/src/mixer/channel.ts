/**
 * Channel — a mixer channel with effects chain and sends.
 * Mirrors the Java Channel class.
 */
import { EffectsChain } from "./effects-chain";
import { Send } from "./send";
import { Element } from "../serialization/xml-reader";
import { BlueDataObject } from "../blue-data-object";
import { Parameter } from "../automation/parameter";
import { writeDouble, writeBoolean } from "../utilities/xml";

export class Channel implements BlueDataObject {
  static readonly MASTER = "Master";
  static readonly NAME = "name";
  static readonly LEVEL = "level";
  static readonly SOLO = "solo";
  static readonly MUTED = "muted";
  static readonly OUT_CHANNEL = "outChannel";

  private _name = "Channel";
  private _outChannel = Channel.MASTER;
  private _muted = false;
  private _solo = false;
  private _level = 0;
  private _volume = 1.0;
  private _pan = 0.5;
  private _preEffects = new EffectsChain();
  private _postEffects = new EffectsChain();
  private _effectsChain = new EffectsChain();
  private _association = "";
  private _levelParameter: Parameter;

  constructor() {
    this._levelParameter = new Parameter();
    this._levelParameter.setName("Volume");
    this._levelParameter.setLabel("dB");
    this._levelParameter.setMinimum(-96.0);
    this._levelParameter.setMaximum(12.0);
    this._levelParameter.setFixedValue(0.0);
    this._levelParameter.setResolution(-1.0);
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
    this._pan = p;
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
    const elem = new Element("channel");
    if (this._association) {
      elem.setAttribute("association", this._association);
    }

    elem.addElement("name").setText(this._name);
    elem.addElement("outChannel").setText(this._outChannel);
    elem.addElement(writeDouble("level", this._level));
    elem.addElement(writeBoolean("muted", this._muted));
    elem.addElement(writeBoolean("solo", this._solo));

    const preEffects = this._preEffects.saveAsXML();
    preEffects.setAttribute("bin", "pre");
    elem.addElement(preEffects);

    const postEffects = this._postEffects.saveAsXML();
    postEffects.setAttribute("bin", "post");
    elem.addElement(postEffects);

    if (this._effectsChain.length > 0 && this._effectsChain !== this._postEffects) {
      elem.addElement(this._effectsChain.saveAsXML());
    }

    elem.addElement(this._levelParameter.saveAsXML());

    return elem;
  }

  static loadFromXML(data: Element): Channel {
    const channel = new Channel();

    channel._name = data.getTextString("name") ?? "";
    channel._muted =
      data.getTextString("muted") === "true";
    channel._solo =
      data.getTextString("solo") === "true";

    // Out channel routing
    const outCh = data.getTextString("outChannel");
    if (outCh) channel._outChannel = outCh;

    // Level (in dB)
    const level = data.getTextString("level");
    if (level) channel._level = parseFloat(level);

    const assoc = data.getAttribute("association") ?? data.getTextString("association");
    if (assoc) channel._association = assoc;

    // Effects chains: <effectsChain bin='pre'> and <effectsChain bin='post'>
    const ecNodes = data.getElements("effectsChain");
    while (ecNodes.hasMoreElements()) {
      const ecNode = ecNodes.next();
      const loaded = EffectsChain.loadFromXML(ecNode);
      const bin = ecNode.getAttribute("bin") ?? "";
      if (bin === "pre") {
        channel._preEffects = loaded;
      } else if (bin === "post") {
        channel._postEffects = loaded;
      } else {
        channel._effectsChain = loaded;
        channel._postEffects = loaded;
      }
    }

    // Legacy standalone sends are treated as post-fader sends.
    const sendNodes = data.getElements("send");
    while (sendNodes.hasMoreElements()) {
      channel._postEffects.push(Send.loadFromXML(sendNodes.next()));
    }

    const paramNodes = data.getElements("parameter");
    while (paramNodes.hasMoreElements()) {
      const paramElem = paramNodes.next();
      channel._levelParameter = Parameter.loadFromXML(paramElem);
    }

    if (!channel._levelParameter.isAutomationEnabled()) {
      channel._levelParameter.setFixedValue(channel._level);
    }

    return channel;
  }

  deepCopy(): BlueDataObject {
    const copy = new Channel();
    copy._name = this._name;
    copy._muted = this._muted;
    copy._solo = this._solo;
    copy._volume = this._volume;
    copy._pan = this._pan;
    copy._association = this._association;
    copy._level = this._level;
    copy._outChannel = this._outChannel;
    copy._preEffects = this._preEffects.deepCopy() as EffectsChain;
    copy._postEffects = this._postEffects.deepCopy() as EffectsChain;
    copy._effectsChain = this._effectsChain.deepCopy() as EffectsChain;
    copy._levelParameter = this._levelParameter.deepCopy() as Parameter;
    return copy;
  }
}
