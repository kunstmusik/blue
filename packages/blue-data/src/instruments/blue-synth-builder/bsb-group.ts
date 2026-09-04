import { Element } from '../../serialization/xml-reader';
import { BSBWidget } from './bsb-widget';
import { BSBCompilationUnit } from './bsb-compilation-unit';
import { Parameter } from '../../automation/parameter';
import { BSBKnob } from './bsb-knob';
import { BSBCheckBox } from './bsb-check-box';
import { BSBHSlider } from './bsb-hslider';
import { BSBVSlider } from './bsb-vslider';
import { BSBHSliderBank } from './bsb-hslider-bank';
import { BSBVSliderBank } from './bsb-vslider-bank';
import { BSBValue } from './bsb-value';
import { BSBDropdown } from './bsb-dropdown';
import { BSBXYController } from './bsb-xy-controller';
import { BSBSubChannelDropdown } from './bsb-subchannel-dropdown';
import { BSBFileSelector } from './bsb-file-selector';
import { BSBTextField } from './bsb-text-field';
import { BSBLabel } from './bsb-label';
import { BSBLineObject, writeBsbLineToXml } from './bsb-line-object';
import { loadFontFromXML, saveFontToXML, type BSBFont } from './bsb-knob';
import { decodeBsbColorToCss, encodeCssColorToJavaHex } from './bsb-color';

type BSBWidgetCtor = new () => BSBWidget;

let _registry: Record<string, BSBWidgetCtor> | null = null;

function getRegistry(): Record<string, BSBWidgetCtor> {
  if (!_registry) {
    _registry = {
      'blue.orchestra.blueSynthBuilder.BSBKnob': BSBKnob,
      'blue.orchestra.blueSynthBuilder.BSBCheckBox': BSBCheckBox,
      'blue.orchestra.blueSynthBuilder.BSBHSlider': BSBHSlider,
      'blue.orchestra.blueSynthBuilder.BSBVSlider': BSBVSlider,
      'blue.orchestra.blueSynthBuilder.BSBHSliderBank': BSBHSliderBank,
      'blue.orchestra.blueSynthBuilder.BSBVSliderBank': BSBVSliderBank,
      'blue.orchestra.blueSynthBuilder.BSBValue': BSBValue,
      'blue.orchestra.blueSynthBuilder.BSBDropdown': BSBDropdown,
      'blue.orchestra.blueSynthBuilder.BSBXYController': BSBXYController,
      'blue.orchestra.blueSynthBuilder.BSBSubChannelDropdown': BSBSubChannelDropdown,
      'blue.orchestra.blueSynthBuilder.BSBFileSelector': BSBFileSelector,
      'blue.orchestra.blueSynthBuilder.BSBTextField': BSBTextField,
      'blue.orchestra.blueSynthBuilder.BSBLabel': BSBLabel,
      'blue.orchestra.blueSynthBuilder.BSBLineObject': BSBLineObject,
    };
  }
  _registry['blue.orchestra.blueSynthBuilder.BSBGroup'] = BSBGroup;
  return _registry;
}

export function loadBsbWidgetFromXML(data: Element): BSBWidget | null {
  const type = data.getAttribute('type') ?? '';
  const Ctor = getRegistry()[type];
  if (!Ctor) return null;

  const child = new Ctor();
  if (child instanceof BSBGroup) {
    child.loadFromXML(data);
  } else if ('loadFromXML' in child && typeof child.loadFromXML === 'function') {
    (child.loadFromXML as (data: Element) => void).call(child, data);
  } else {
    child.loadFromXMLCommon(data);
  }

  return child;
}

export class BSBGroup extends BSBWidget {
  private _children: BSBWidget[] = [];
  groupName = 'Group';
  backgroundColor = 'rgba(0,0,0,0.2)';
  borderColor = '#000000';
  labelTextColor = '#FFFFFF';
  titleEnabled = true;
  width = 20;
  height = 20;
  font: BSBFont = { name: 'Roboto', size: 12, style: 0 };

  getChildren(): BSBWidget[] {
    return [...this._children];
  }

  addChild(widget: BSBWidget): void {
    this._children.push(widget);
  }

  removeChildById(id: string): boolean {
    for (let i = 0; i < this._children.length; i++) {
      if (this._children[i].id === id) {
        this._children.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  clearChildren(): void {
    this._children.length = 0;
  }

  randomize(): void {
    for (const child of this._children) {
      if ('randomize' in child && typeof (child as any).randomize === 'function') {
        (child as any).randomize();
      }
    }
  }

  override collectReplacements(unit: BSBCompilationUnit, parameters?: Parameter[]): void {
    for (const child of this._children) {
      child.collectReplacements(unit, parameters);
    }
  }

  override getPresetValue(): string | null {
    return null;
  }

  override setPresetValue(_val: string): void {}

  loadFromXML(data: Element): void {
    this.loadFromXMLCommon(data);
    this.clearChildren();
    const gnAttr = data.getAttribute('groupName');
    if (gnAttr) this.groupName = gnAttr;
    const gn = data.getTextString('groupName');
    if (gn !== null) this.groupName = gn;
    const bg = data.getTextString('backgroundColor');
    if (bg) this.backgroundColor = decodeBsbColorToCss(bg, this.backgroundColor);
    const bc = data.getTextString('borderColor');
    if (bc) this.borderColor = decodeBsbColorToCss(bc, this.borderColor);
    const ltc = data.getTextString('labelTextColor');
    if (ltc) this.labelTextColor = decodeBsbColorToCss(ltc, this.labelTextColor);
    const te = data.getElement('titleEnabled');
    if (te) this.titleEnabled = te.getTextString() === 'true';
    const w = data.getTextString('width');
    if (w) this.width = parseInt(w, 10);
    const h = data.getTextString('height');
    if (h) this.height = parseInt(h, 10);
    const fontElem = data.getElement('font');
    if (fontElem) this.font = loadFontFromXML(fontElem);
    this._loadChildren(data);
  }

  private _loadChildren(data: Element): void {
    const children = data.getElements('bsbObject');
    while (children.hasMoreElements()) {
      const childElem = children.next();
      const child = loadBsbWidgetFromXML(childElem);
      if (child) {
        this._children.push(child);
      }
    }
  }

  override loadFromXMLCommon(data: Element): void {
    super.loadFromXMLCommon(data);
  }

  saveAsXML(): Element {
    return saveBsbWidgetAsXML(this);
  }
}

const SKIPPED_WIDGET_FIELDS = new Set([
  '_children',
  'stringChannel',
  'id',
  'labelFont',
  'font',
  'dropdownItems',
  'backgroundColor',
  'borderColor',
  'labelTextColor',
  'textValue',
  'defaultValue',
  'resolution',
  'resolutionDecimal',
  'objectName',
  'x',
  'y',
  'separatorType',
  'comment',
  'automationAllowed',
  'value',
  'minimum',
  'maximum',
  'parameterName',
]);

const INTEGER_WIDGET_FIELDS = new Set([
  'fontSize',
  'gap',
  'height',
  'canvasHeight',
  'canvasWidth',
  'knobWidth',
  'selectedIndex',
  'sliderHeight',
  'sliderWidth',
  'textFieldWidth',
  'width',
  'x',
  'y',
]);

const WIDGETS_WITH_VERSION_2 = new Set([
  'BSBKnob',
  'BSBHSlider',
  'BSBVSlider',
  'BSBDropdown',
  'BSBLabel',
  'BSBXYController',
]);

const WIDGETS_WITH_NUMERIC_RANGE = new Set(['BSBKnob', 'BSBHSlider', 'BSBVSlider']);

const WIDGETS_WITH_AUTOMATION_ALLOWED = new Set([
  'BSBKnob',
  'BSBHSlider',
  'BSBVSlider',
  'BSBCheckBox',
  'BSBDropdown',
  'BSBXYController',
  'BSBHSliderBank',
  'BSBVSliderBank',
  'BSBValue',
]);

function addPrimitiveElement(parent: Element, key: string, value: unknown): void {
  if (value === null || value === undefined) return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return;
    if (INTEGER_WIDGET_FIELDS.has(key)) {
      value = Math.round(value);
    }
  }
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return;
  }
  parent.addElement(key).setText(String(value));
}

export function saveBsbWidgetAsXML(widget: BSBWidget): Element {
  const elem = new Element('bsbObject');
  const ctorName = widget.constructor.name;
  elem.setAttribute('type', `blue.orchestra.blueSynthBuilder.${ctorName}`);

  if (WIDGETS_WITH_VERSION_2.has(ctorName)) {
    elem.setAttribute('version', '2');
  }

  if (widget.id) {
    elem.setAttribute('uniqueId', widget.id);
  }
  addPrimitiveElement(elem, 'objectName', widget.objectName);
  addPrimitiveElement(elem, 'x', widget.x);
  addPrimitiveElement(elem, 'y', widget.y);
  if (widget.comment) {
    elem.addElement('comment').setText(widget.comment);
  }
  if (WIDGETS_WITH_AUTOMATION_ALLOWED.has(ctorName)) {
    addPrimitiveElement(elem, 'automationAllowed', widget.automationAllowed);
  }
  if (WIDGETS_WITH_NUMERIC_RANGE.has(ctorName)) {
    addPrimitiveElement(elem, 'minimum', widget.minimum);
    addPrimitiveElement(elem, 'maximum', widget.maximum);
    addPrimitiveElement(elem, 'value', widget.value);
  }
  if (widget instanceof BSBHSlider || widget instanceof BSBVSlider) {
    elem.addElement('bdresolution').setText(widget.getResolutionText());
  }
  if (widget instanceof BSBTextField) {
    addPrimitiveElement(elem, 'value', widget.textValue);
  }
  if (widget instanceof BSBValue) {
    addPrimitiveElement(elem, 'minimum', widget.minimum);
    addPrimitiveElement(elem, 'maximum', widget.maximum);
    addPrimitiveElement(elem, 'defaultValue', widget.defaultValue);
  }
  if (widget instanceof BSBHSliderBank || widget instanceof BSBVSliderBank) {
    addPrimitiveElement(elem, 'minimum', widget.minimum);
    addPrimitiveElement(elem, 'maximum', widget.maximum);
    elem.addElement('bdresolution').setText(widget.getResolutionText());
  }
  if (widget.parameterName) {
    addPrimitiveElement(elem, 'parameterName', widget.parameterName);
  }

  for (const [key, value] of Object.entries(widget as unknown as Record<string, unknown>)) {
    if (SKIPPED_WIDGET_FIELDS.has(key)) {
      continue;
    }
    addPrimitiveElement(elem, key, value);
  }

  if (widget instanceof BSBKnob) {
    elem.addElement(saveFontToXML(widget.labelFont));
  }
  if (widget instanceof BSBLabel) {
    elem.addElement(saveFontToXML(widget.font));
  }
  if (widget instanceof BSBGroup) {
    elem.addElement('backgroundColor').setText(encodeCssColorToJavaHex(widget.backgroundColor));
    elem.addElement('borderColor').setText(encodeCssColorToJavaHex(widget.borderColor));
    elem.addElement('labelTextColor').setText(encodeCssColorToJavaHex(widget.labelTextColor));
  }
  if (widget instanceof BSBGroup) {
    elem.addElement(saveFontToXML(widget.font));
    for (const child of widget.getChildren()) {
      elem.addElement(saveBsbWidgetAsXML(child));
    }
  }
  if (widget instanceof BSBLineObject) {
    const separatorType =
      widget.separatorType === 'Comma'
        ? 'COMMA'
        : widget.separatorType === 'Single Quote'
          ? 'SINGLE_QUOTE'
          : 'NONE';
    elem.addElement('separatorType').setText(separatorType);
    const linesElem = elem.addElement('lines');
    for (const line of widget.lines) {
      writeBsbLineToXml(linesElem, line);
    }
  }
  if (widget instanceof BSBHSliderBank || widget instanceof BSBVSliderBank) {
    for (const slider of widget.sliders) {
      elem.addElement(saveBsbWidgetAsXML(slider));
    }
  }
  if (widget instanceof BSBDropdown && widget.dropdownItems.length > 0) {
    const listElem = elem.addElement('bsbDropdownItemList');
    for (const item of widget.dropdownItems) {
      const itemElem = listElem.addElement('bsbDropdownItem');
      itemElem.setAttribute('uniqueId', item.uniqueId);
      itemElem.addElement('name').setText(item.name);
      itemElem.addElement('value').setText(item.value);
    }
  }

  return elem;
}
