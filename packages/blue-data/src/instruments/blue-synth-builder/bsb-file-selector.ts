/**
 * BSBFileSelector — file path selector widget.
 * Implements StringChannelProvider in Java (provides gS_blue_strN globals).
 * When stringChannelEnabled is true, this widget contributes a StringChannel
 * to the CSD output.
 */
import { Element } from '../../serialization/xml-reader';
import { BSBWidget } from './bsb-widget';
import { BSBCompilationUnit } from './bsb-compilation-unit';
import { Parameter } from '../../automation/parameter';

export interface StringChannel {
  objectName: string;
  value: string;
  channelName: string | null;
}

export class BSBFileSelector extends BSBWidget {
  fileName = '';
  textFieldWidth = 100;
  stringChannelEnabled = true;
  private stringChannel: StringChannel = {
    objectName: '',
    value: '',
    channelName: null,
  };

  override getPresetValue(): string {
    return this.fileName;
  }

  override setPresetValue(val: string): void {
    this.fileName = val;
    this.syncStringChannels();
  }

  loadFromXML(data: Element): void {
    this.loadFromXMLCommon(data);
    const fn = data.getTextString('fileName');
    if (fn !== null) this.fileName = fn;
    const tw = data.getTextString('textFieldWidth');
    if (tw) this.textFieldWidth = parseInt(tw, 10);
    const scEnabled = data.getElement('stringChannelEnabled');
    this.stringChannelEnabled = scEnabled ? scEnabled.getTextString() === 'true' : false;
    this.syncStringChannels();
  }

  override collectReplacements(unit: BSBCompilationUnit, _parameters?: Parameter[]): void {
    const fileNameValue = this.fileName.replace(/\\/g, '/');

    if (this.stringChannelEnabled && this.stringChannel.channelName) {
      this.stringChannel.value = fileNameValue;
      unit.addReplacementValue(this.objectName, this.stringChannel.channelName);
      return;
    }

    unit.addReplacementValue(this.objectName, fileNameValue);
  }

  getStringChannel(): StringChannel | null {
    if (!this.stringChannelEnabled) return null;
    this.syncStringChannel();
    return this.stringChannel;
  }

  private syncStringChannel(): void {
    this.stringChannel.objectName = this.objectName;
    this.stringChannel.value = this.fileName.replace(/\\/g, '/');
  }

  private syncStringChannels(): void {
    this.syncStringChannel();
  }
}
