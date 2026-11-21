import { XmlLoadContext } from '../../serialization/xml-load';
import { readBoolean } from '../../utilities/xml';
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

/** String-valued widget channel before or after assignment of its Csound name. */
export interface StringChannel {
  /** Name of the widget supplying the string. */
  objectName: string;
  /** Current string supplied by the widget. */
  value: string;
  /** Compiled channel name, or null before assignment. */
  channelName: string | null;
}

export class BSBFileSelector extends BSBWidget {
  /** Configured path to the selected file. */
  fileName = '';
  /** Width of the text entry field in pixels. */
  textFieldWidth = 100;
  /** Whether to expose the selected filename through a Csound string channel. */
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

  /** Reconstructs the file-selector widget from its Blue XML element, using the supplied diagnostic context when provided. */
  loadFromXML(data: Element, context = new XmlLoadContext(data)): void {
    this.loadFromXMLCommon(data, context);
    const fn = data.getTextString('fileName');
    if (fn !== null) this.fileName = fn;
    const tw = data.getTextString('textFieldWidth');
    if (tw) this.textFieldWidth = parseInt(tw, 10);
    const scEnabled = data.getElement('stringChannelEnabled');
    this.stringChannelEnabled = scEnabled ? readBoolean(scEnabled, context) : false;
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

  /** Returns the string channel stored on the file-selector widget. */
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
