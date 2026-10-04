/**
 * Send — mixer send level to a channel.
 * Mirrors the Java Send class.
 */
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import { checkRoot, checkShape, readText, readBoolean, readDouble } from '../utilities/xml';

import { BlueDataObject } from '../blue-data-object';
import { CopyMode } from '../deep-copyable';
import { Parameter } from '../automation/parameter';
import { Channel } from './channel';

let nextRuntimeIdentity = 1;

export class Send implements BlueDataObject {
  private _sendChannel = Channel.MASTER;
  private _level = 1.0;
  private _enabled = true;
  private _parameter: Parameter;
  /** Disposable identity used to bind compiled send gates to this entry. */
  private _runtimeIdentity = `send-${nextRuntimeIdentity++}`;

  constructor() {
    this._parameter = new Parameter();
    this._parameter.setName('Send Amount');
    this._parameter.setMinimum(0.0);
    this._parameter.setMaximum(1.0);
    this._parameter.setFixedValue(1.0);
    this._parameter.setResolution(-1.0);
  }

  getSendChannel(): string {
    return this._sendChannel;
  }
  setSendChannel(sendChannel: string): void {
    this._sendChannel = sendChannel;
  }

  getLevel(): number {
    return this._level;
  }
  setLevel(level: number): void {
    this._level = level;
    if (!this._parameter.isAutomationEnabled()) {
      this._parameter.setFixedValue(level);
    }
  }

  isEnabled(): boolean {
    return this._enabled;
  }
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  getRuntimeIdentity(): string {
    return this._runtimeIdentity;
  }

  setRuntimeIdentity(identity: string): void {
    this._runtimeIdentity = identity;
  }

  getParameter(): Parameter {
    return this._parameter;
  }
  getLevelParameter(): Parameter {
    return this._parameter;
  }
  getParameters(): Parameter[] {
    return [this._parameter];
  }

  saveAsXML(): Element {
    const elem = new Element('send');
    elem.addElement('sendChannel').setText(this._sendChannel);
    elem.addElement('level').setText(this._level.toString());
    elem.addElement('enabled').setText(this._enabled.toString());
    elem.addElement(this._parameter.saveAsXML());
    return elem;
  }

  static loadFromXML(data: Element, context?: XmlLoadContext, sink?: XmlDiagnosticSink): Send {
    const ctx = context ?? new XmlLoadContext(data);
    checkRoot(data, 'send', ctx);
    checkShape(data, [], ['sendChannel', 'level', 'enabled', 'parameter'], ctx);
    const send = new Send();
    const target = data.getElement('sendChannel');
    if (target) send._sendChannel = readText(target, ctx);
    if (send._sendChannel === 'master') send._sendChannel = Channel.MASTER;
    const level = data.getElement('level');
    if (level) send._level = readDouble(level, ctx);
    const enabled = data.getElement('enabled');
    if (enabled) send._enabled = readBoolean(enabled, ctx);
    const parameter = data.getElement('parameter');
    if (parameter) send._parameter = Parameter.loadFromXML(parameter, ctx);
    if (!send._parameter.isAutomationEnabled()) send._parameter.setFixedValue(send._level);
    return context ? send : requireXmlValue(ctx.result(send), sink);
  }

  deepCopy(mode: CopyMode = 'duplication'): BlueDataObject {
    const copy = new Send();
    copy._sendChannel = this._sendChannel;
    copy._level = this._level;
    copy._enabled = this._enabled;
    copy._parameter = this._parameter.deepCopy(mode) as Parameter;
    if (mode === 'history') {
      copy._runtimeIdentity = this._runtimeIdentity;
    }
    return copy;
  }
}
