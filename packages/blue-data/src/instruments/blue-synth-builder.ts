/**
 * BlueSynthBuilder — instrument implementation with BSB widget system.
 * Mirrors the Java BlueSynthBuilder class.
 *
 * Generates CSD orchestra code from an instrumentText template
 * with `<objectName>` placeholders replaced by BSB widget values.
 */
import { Element } from "../serialization/xml-reader";
import { ObjRefSaveMap, ObjRefLoadMap } from "../serialization/obj-ref-map";
import { Instrument } from "./instrument";
import { BSBCompilationUnit } from "./blue-synth-builder/bsb-compilation-unit";
import { BSBGraphicInterface, GridSettingsData } from "./blue-synth-builder/bsb-graphic-interface";
import { BSBGroup } from "./blue-synth-builder/bsb-group";
import { BSBWidget } from "./blue-synth-builder/bsb-widget";
import { Parameter, AutomationCurve } from "../automation/parameter";
import { clamp } from '../utilities/math-utils';
import { JavaDecimal, parseJavaDecimal, snapToResolutionJava } from '../automation/java-decimal';
import { BSBCheckBox } from "./blue-synth-builder/bsb-check-box";
import { BSBHSlider } from "./blue-synth-builder/bsb-hslider";
import { BSBXYController } from "./blue-synth-builder/bsb-xy-controller";
import {
  StringChannel,
  BSBFileSelector,
} from "./blue-synth-builder/bsb-file-selector";
import { BSBDropdown } from "./blue-synth-builder/bsb-dropdown";
import { BSBKnob } from "./blue-synth-builder/bsb-knob";
import { BSBLabel } from "./blue-synth-builder/bsb-label";
import { BSBValue } from "./blue-synth-builder/bsb-value";
import { BSBVSlider } from "./blue-synth-builder/bsb-vslider";
import { OpcodeList } from "../opcodes/opcode-list";
import { PresetGroup } from "./blue-synth-builder/preset-group";
import { Preset } from "./blue-synth-builder/preset";
import { OpcodeDefinition } from "../opcodes/opcode-definition";
import { UDOStyle } from "../opcodes/udo-style";
import {
  appendUserDefinedOpcodes,
  convertToClassic,
  convertToModern,
} from "../opcodes/udo-utilities";
import { ParameterList } from "../automation/parameter-list";
import { BSBHSliderBank } from './blue-synth-builder/bsb-hslider-bank';
import { BSBVSliderBank } from './blue-synth-builder/bsb-vslider-bank';
import {
  BSBLineObject,
  normalizeBsbLinePatch,
} from './blue-synth-builder/bsb-line-object';
import { replaceOpcodeNames } from "../utilities/text";
import { generatePrefixedUuid } from '../utilities/uuid';
import { collectBsbWidgets } from './blue-synth-builder/bsb-identity';

function parseUdoBlock(
  block: string,
  OpcodeDef: typeof OpcodeDefinition,
  style: typeof UDOStyle,
): OpcodeDefinition | null {
  const lines = block.split("\n").map((l) => l.trim());
  if (lines.length < 3) return null;
  const headerIdx = lines.findIndex((l) => l.startsWith("opcode "));
  if (headerIdx < 0) return null;
  const header = lines[headerIdx];
  const endIdx = lines.findIndex((l, i) => i > headerIdx && l.startsWith("endop"));
  const codeLines = endIdx > headerIdx ? lines.slice(headerIdx + 1, endIdx) : lines.slice(headerIdx + 1);

  const match = header.match(/^opcode\s+(\w+),\s*([^,]*),\s*(.*)$/);
  if (!match) return null;

  const udo = new OpcodeDef();
  udo.setName(match[1]);
  udo.setOutTypes(match[2].trim());
  udo.setInTypes(match[3].trim());
  udo.setStyle(style.MODERN);
  udo.setCode(codeLines.join("\n"));
  return udo;
}

interface BSBParameterSpec {
  name: string;
  fixedValue: number;
  minimum: number;
  maximum: number;
  resolution: JavaDecimal;
}

function parseRequiredDecimal(text: string): JavaDecimal {
  const result = parseJavaDecimal(text);
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.value;
}

function rescaleValue(
  value: number,
  oldMinimum: number,
  oldMaximum: number,
  newMinimum: number,
  newMaximum: number,
  resolution: JavaDecimal,
): number {
  if (oldMaximum === oldMinimum) {
    return snapToResolutionJava(newMinimum, newMinimum, newMaximum, resolution);
  }

  const normalized = (value - oldMinimum) / (oldMaximum - oldMinimum);
  const nextValue = newMinimum + (normalized * (newMaximum - newMinimum));
  return snapToResolutionJava(nextValue, newMinimum, newMaximum, resolution);
}

function getWidgetResolution(widget: BSBWidget): JavaDecimal {
  if (widget instanceof BSBHSlider || widget instanceof BSBVSlider) {
    return widget.resolutionDecimal;
  }

  if (widget instanceof BSBHSliderBank || widget instanceof BSBVSliderBank) {
    return widget.resolutionDecimal;
  }

  const result = parseJavaDecimal('-1');
  if (!result.ok) throw new Error('default BSB parameter resolution failed to parse');
  return result.value;
}

function rescaleScalarWidgetValue(
  widget: BSBWidget,
  oldMinimum: number,
  oldMaximum: number,
  newMinimum: number,
  newMaximum: number,
): void {
  const nextValue = rescaleValue(
    widget instanceof BSBValue ? widget.defaultValue : widget.value,
    oldMinimum,
    oldMaximum,
    newMinimum,
    newMaximum,
    getWidgetResolution(widget),
  );
  widget.setValue(nextValue);
}

function rescaleWidgetRangeMinimum(widget: BSBWidget, newMinimum: number): void {
  const oldMinimum = widget.minimum;
  const oldMaximum = widget.maximum;

  if (widget instanceof BSBHSliderBank || widget instanceof BSBVSliderBank) {
    widget.minimum = newMinimum;
    for (const slider of widget.sliders) {
      slider.setValue(rescaleValue(slider.value, oldMinimum, oldMaximum, newMinimum, oldMaximum, widget.resolutionDecimal));
    }
    return;
  }

  widget.minimum = newMinimum;
  if (widget instanceof BSBKnob || widget instanceof BSBHSlider || widget instanceof BSBVSlider || widget instanceof BSBValue) {
    rescaleScalarWidgetValue(widget, oldMinimum, oldMaximum, newMinimum, oldMaximum);
  }
}

function rescaleWidgetRangeMaximum(widget: BSBWidget, newMaximum: number): void {
  const oldMinimum = widget.minimum;
  const oldMaximum = widget.maximum;

  if (widget instanceof BSBHSliderBank || widget instanceof BSBVSliderBank) {
    widget.maximum = newMaximum;
    for (const slider of widget.sliders) {
      slider.setValue(rescaleValue(slider.value, oldMinimum, oldMaximum, oldMinimum, newMaximum, widget.resolutionDecimal));
    }
    return;
  }

  widget.maximum = newMaximum;
  if (widget instanceof BSBKnob || widget instanceof BSBHSlider || widget instanceof BSBVSlider || widget instanceof BSBValue) {
    rescaleScalarWidgetValue(widget, oldMinimum, oldMaximum, oldMinimum, newMaximum);
  }
}

function dropdownPresetReferenceKey(objectName: string, itemId: string): string {
  return `${objectName}\0${itemId}`;
}

function collectDuplicateDropdownItemIdMap(
  previousRoot: BSBGroup,
  duplicateRoot: BSBGroup,
): Map<string, string> {
  const previousDropdowns = collectBsbWidgets(previousRoot).filter(
    (widget): widget is BSBDropdown => widget instanceof BSBDropdown,
  );
  const duplicateDropdowns = collectBsbWidgets(duplicateRoot).filter(
    (widget): widget is BSBDropdown => widget instanceof BSBDropdown,
  );
  const itemIdMap = new Map<string, string>();

  for (let dropdownIndex = 0; dropdownIndex < previousDropdowns.length; dropdownIndex += 1) {
    const previousDropdown = previousDropdowns[dropdownIndex];
    const duplicateDropdown = duplicateDropdowns[dropdownIndex];
    if (!previousDropdown || !duplicateDropdown || !previousDropdown.objectName) {
      continue;
    }

    for (let itemIndex = 0; itemIndex < previousDropdown.dropdownItems.length; itemIndex += 1) {
      const previousId = previousDropdown.dropdownItems[itemIndex]?.uniqueId;
      const duplicateId = duplicateDropdown.dropdownItems[itemIndex]?.uniqueId;
      if (previousId && duplicateId && previousId !== duplicateId) {
        itemIdMap.set(
          dropdownPresetReferenceKey(previousDropdown.objectName, previousId),
          duplicateId,
        );
      }
    }
  }

  return itemIdMap;
}

function rewriteDuplicateDropdownPresetReferences(
  presetGroup: PresetGroup,
  itemIdMap: Map<string, string>,
): void {
  if (itemIdMap.size === 0) {
    return;
  }

  for (const preset of presetGroup.getPresets()) {
    const values = preset.getValuesMap();
    for (const [objectName, value] of values) {
      if (!value.startsWith('id:')) {
        continue;
      }
      const nextId = itemIdMap.get(dropdownPresetReferenceKey(objectName, value.substring(3)));
      if (nextId) {
        preset.setValue(objectName, `id:${nextId}`);
      }
    }
  }

  for (const group of presetGroup.getSubGroups()) {
    rewriteDuplicateDropdownPresetReferences(group, itemIdMap);
  }
}

function hasLegacyBsbWidgetChildId(element: Element): boolean {
  if (element.getName() === 'bsbObject' && element.getElement('id') !== null) {
    return true;
  }

  const children = element.getElements();
  while (children.hasMoreElements()) {
    if (hasLegacyBsbWidgetChildId(children.next())) {
      return true;
    }
  }

  return false;
}

export class BlueSynthBuilder extends Instrument {
  private _instrumentText = "";
  private _alwaysOnInstrumentText = "";
  private _globalOrc = "";
  private _globalSco = "";
  private _graphicInterface = new BSBGraphicInterface();
  private _graphicInterfaceXML: Element | null = null;
  private _parameters = new ParameterList();
  private _opcodeList = new OpcodeList();
  private _presetGroup: PresetGroup | null = null;
  private _udoReplacementValues: Map<string, string> | null = null;

  constructor(other?: BlueSynthBuilder) {
    super();
    if (other) {
      const previousRootGroup = other._graphicInterface.getRootGroup();
      this._name = other._name;
      this._enabled = other._enabled;
      this._comment = other._comment;
      this._instrumentText = other._instrumentText;
      this._alwaysOnInstrumentText = other._alwaysOnInstrumentText;
      this._globalOrc = other._globalOrc;
      this._globalSco = other._globalSco;
      this._editEnabled = other._editEnabled;
      this._opcodeList = new OpcodeList(other._opcodeList);
      this._graphicInterface = other._graphicInterface.deepCopy();
      this._graphicInterfaceXML = null;
      this._parameters = other._parameters.deepCopy();
      if (other._presetGroup) {
        this._presetGroup = other._presetGroup.deepCopy();
        rewriteDuplicateDropdownPresetReferences(
          this._presetGroup,
          collectDuplicateDropdownItemIdMap(
            previousRootGroup,
            this._graphicInterface.getRootGroup(),
          ),
        );
      }
    } else {
      this.setName('untitled');
    }

    this.syncParametersFromWidgets();
  }

  private _editEnabled = true;

  getInstrumentText(): string {
    return this._instrumentText;
  }
  setInstrumentText(text: string): void {
    this._instrumentText = text;
  }

  getAlwaysOnInstrumentText(): string {
    return this._alwaysOnInstrumentText;
  }
  setAlwaysOnInstrumentText(text: string): void {
    this._alwaysOnInstrumentText = text;
  }

  getGlobalOrc(): string {
    return this._globalOrc;
  }
  setGlobalOrc(orc: string): void {
    this._globalOrc = orc;
  }

  getGlobalSco(): string {
    return this._globalSco;
  }
  setGlobalSco(sco: string): void {
    this._globalSco = sco;
  }

  getGraphicInterface(): BSBGraphicInterface {
    return this._graphicInterface;
  }
  setGraphicInterface(gi: BSBGraphicInterface): void {
    this._graphicInterface = gi;
    this._graphicInterfaceXML = null;
    this.syncParametersFromWidgets();
  }

  isEditEnabled(): boolean {
    return this._editEnabled;
  }
  setEditEnabled(enabled: boolean): void {
    this._editEnabled = enabled;
  }

  /**
   * Generate the instrument text with all BSB widget values substituted.
   * This is the core compilation step:
   * 1. Collect all widget values into a BSBCompilationUnit
   * 2. Replace all <objectName> tokens with their values
   *
   * @param parameters - Optional parameter list for automation variable lookup.
   *   If provided, widgets with matching parameterName use the parameter's
   *   compilationVarName instead of their raw value.
   */
  generateInstrument(parameters?: Parameter[]): string {
    if (!this._instrumentText) return "";

    return this.renderTextWithReplacements(this._instrumentText, parameters);
  }

  override generateAlwaysOnInstrument(): string | null {
    if (!this._alwaysOnInstrumentText || this._alwaysOnInstrumentText.trim().length === 0) {
      return null;
    }

    return this.renderTextWithReplacements(
      this._alwaysOnInstrumentText,
      this._parameters,
      true,
    );
  }

  generateGlobalOrc(): string | null {
    if (!this._globalOrc) return null;
    return this.renderTextWithReplacements(this._globalOrc, this._parameters);
  }

  generateGlobalSco(): string | null {
    if (!this._globalSco) return null;
    return this.renderTextWithReplacements(this._globalSco, this._parameters);
  }

  /**
   * Get all automation parameters for this instrument.
   * Used by ParameterHelper to collect parameters from arrangement instruments.
   */
  getParameters(): Parameter[] {
    this.syncParametersFromWidgets();
    return [...this._parameters];
  }

  private isParameterBackedWidget(widget: BSBWidget): boolean {
    return widget instanceof BSBKnob
      || widget instanceof BSBHSlider
      || widget instanceof BSBVSlider
      || widget instanceof BSBCheckBox
      || widget instanceof BSBDropdown
      || widget instanceof BSBValue
      || widget instanceof BSBXYController
      || widget instanceof BSBHSliderBank
      || widget instanceof BSBVSliderBank;
  }

  private buildParameterSpecs(widget: BSBWidget): BSBParameterSpec[] {
    const objectName = widget.objectName.trim();
    if (!objectName) {
      return [];
    }

    if (widget instanceof BSBXYController) {
      return [
        {
          name: `${objectName}X`,
          fixedValue: widget.xValue,
          minimum: widget.xMin,
          maximum: widget.xMax,
          resolution: getWidgetResolution(widget),
        },
        {
          name: `${objectName}Y`,
          fixedValue: widget.yValue,
          minimum: widget.yMin,
          maximum: widget.yMax,
          resolution: getWidgetResolution(widget),
        },
      ];
    }

    if (widget instanceof BSBHSliderBank || widget instanceof BSBVSliderBank) {
      return widget.sliders.map((slider, index) => ({
        name: `${objectName}_${index}`,
        fixedValue: slider.value,
        minimum: widget.minimum,
        maximum: widget.maximum,
        resolution: widget.resolutionDecimal,
      }));
    }

    if (widget instanceof BSBCheckBox) {
      return [{
        name: objectName,
        fixedValue: widget.selected ? 1 : 0,
        minimum: 0,
        maximum: 1,
        resolution: parseRequiredDecimal('1'),
      }];
    }

    if (widget instanceof BSBDropdown) {
      return [{
        name: objectName,
        fixedValue: widget.selectedIndex,
        minimum: 0,
        maximum: Math.max(0, widget.dropdownItems.length - 1),
        resolution: parseRequiredDecimal('1'),
      }];
    }

    if (widget instanceof BSBHSlider || widget instanceof BSBVSlider) {
      return [{
        name: objectName,
        fixedValue: widget.value,
        minimum: widget.minimum,
        maximum: widget.maximum,
        resolution: widget.resolutionDecimal,
      }];
    }

    if (widget instanceof BSBKnob || widget instanceof BSBValue) {
      const fixedValue = widget instanceof BSBValue ? widget.defaultValue : widget.value;
      return [{
        name: objectName,
        fixedValue,
        minimum: widget.minimum,
        maximum: widget.maximum,
        resolution: parseRequiredDecimal('-1'),
      }];
    }

    return [];
  }

  private syncParametersFromWidgets(): void {
    const existingByName = new Map<string, Parameter>();
    for (const parameter of this._parameters) {
      existingByName.set(parameter.getName(), parameter);
    }

    const nextParameters = new ParameterList();
    const seenNames = new Set<string>();
    let mutatedWidgetState = false;

    const visit = (widget: BSBWidget): void => {
      if (widget instanceof BSBGroup) {
        for (const child of widget.getChildren()) {
          visit(child);
        }
        return;
      }

      if (!this.isParameterBackedWidget(widget)) {
        return;
      }

      const specs = this.buildParameterSpecs(widget);
      if (specs.length === 0) {
        return;
      }

      const hasAutomatedParameter = specs.some((spec) => existingByName.get(spec.name)?.isAutomationEnabled());
      if (!widget.automationAllowed && !hasAutomatedParameter) {
        return;
      }

      if (hasAutomatedParameter && !widget.automationAllowed) {
        widget.automationAllowed = true;
        mutatedWidgetState = true;
      }

      for (const spec of specs) {
        if (seenNames.has(spec.name)) {
          continue;
        }

        const parameter = existingByName.get(spec.name) ?? new Parameter();
        parameter.setName(spec.name);
        parameter.setMinimum(spec.minimum);
        parameter.setMaximum(spec.maximum);
        parameter.setResolutionDecimal(spec.resolution);
        if (!parameter.isAutomationEnabled()) {
          parameter.setFixedValue(spec.fixedValue);
        }

        nextParameters.push(parameter);
        seenNames.add(spec.name);
      }
    };

    visit(this._graphicInterface.getRootGroup());
    this._parameters = nextParameters;

    if (mutatedWidgetState) {
      this._graphicInterfaceXML = null;
    }
  }

  private renameParametersForWidget(widget: BSBWidget, oldObjectName: string): void {
    const previousName = oldObjectName.trim();
    const nextName = widget.objectName.trim();
    if (!previousName || previousName === nextName || !this.isParameterBackedWidget(widget)) {
      return;
    }

    const renameParameter = (from: string, to: string): void => {
      if (!to) {
        return;
      }

      const parameter = this._parameters.find((candidate) => candidate.getName() === from);
      if (parameter) {
        parameter.setName(to);
      }
    };

    if (widget instanceof BSBXYController) {
      renameParameter(`${previousName}X`, `${nextName}X`);
      renameParameter(`${previousName}Y`, `${nextName}Y`);
      return;
    }

    if (widget instanceof BSBHSliderBank || widget instanceof BSBVSliderBank) {
      for (let index = 0; index < widget.sliders.length; index += 1) {
        renameParameter(`${previousName}_${index}`, `${nextName}_${index}`);
      }
      return;
    }

    renameParameter(previousName, nextName);
  }

  /**
   * Get all string channels from BSBFileSelector widgets.
   * Used by CSD generation to collect string channel init statements.
   */
  getStringChannels(): StringChannel[] {
    return this._collectStringChannels(this._graphicInterface.getRootGroup());
  }

  /**
   * Get the opcode list (UDOs) for this instrument.
   */
  getOpcodeList(): OpcodeList {
    return this._opcodeList;
  }

  setOpcodeList(opcodeList: OpcodeList): void {
    this._opcodeList = opcodeList;
  }

  override generateUserDefinedOpcodes(udoList: unknown): void {
    if (!(udoList instanceof OpcodeList)) {
      return;
    }

    this._udoReplacementValues = appendUserDefinedOpcodes(
      this._opcodeList,
      udoList,
    );
  }

  getOpcodeListText(): string {
    return this._opcodeList.toString();
  }

  setOpcodeListText(text: string): void {
    const lines = text.split("\n");
    const newList = new OpcodeList();
    let current: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("opcode") && trimmed.includes(",") && !current.some((l) => l.trim().startsWith("opcode"))) {
        if (current.length > 0) {
          const udo = parseUdoBlock(current.join("\n"), OpcodeDefinition, UDOStyle);
          if (udo) newList.addOpcode(udo);
        }
        current = [line];
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) {
      const udo = parseUdoBlock(current.join("\n"), OpcodeDefinition, UDOStyle);
      if (udo) newList.addOpcode(udo);
    }
    this._opcodeList = newList;
  }

  /**
   * Get all UDO definitions as a structured array.
   */
  getUdoList(): OpcodeDefinition[] {
    return this._opcodeList.getOpcodes();
  }

  /**
   * Add a new UDO at the specified index (or append if index is out of bounds).
   */
  addUdo(index?: number, definition?: OpcodeDefinition): boolean {
    const udo = definition ?? new OpcodeDefinition();
    if (index === undefined || index < 0 || index > this._opcodeList.size()) {
      this._opcodeList.addOpcode(udo);
    } else {
      this._opcodeList.addOpcodeAt(index, udo);
    }
    this._graphicInterfaceXML = null;
    return true;
  }

  /**
   * Remove the UDO at the specified index.
   */
  removeUdo(index: number): boolean {
    const result = this._opcodeList.removeOpcodeAt(index);
    if (result) {
      this._graphicInterfaceXML = null;
    }
    return result;
  }

  /**
   * Update a UDO at the specified index with partial properties.
   */
  updateUdo(index: number, patch: Partial<{
    name: string;
    style: UDOStyle;
    outTypes: string;
    inTypes: string;
    inputArguments: string;
    code: string;
    comments: string;
  }>): boolean {
    const udo = this._opcodeList.getOpcode(index);
    if (!udo) return false;

    if (patch.name !== undefined) udo.setName(patch.name);
    if (patch.style !== undefined) udo.setStyle(patch.style);
    if (patch.outTypes !== undefined) udo.setOutTypes(patch.outTypes);
    if (patch.inTypes !== undefined) udo.setInTypes(patch.inTypes);
    if (patch.inputArguments !== undefined) udo.setInputArguments(patch.inputArguments);
    if (patch.code !== undefined) udo.setCode(patch.code);
    if (patch.comments !== undefined) udo.setComments(patch.comments);

    this._graphicInterfaceXML = null;
    return true;
  }

  /**
   * Reorder a UDO from one index to another.
   */
  reorderUdo(fromIndex: number, toIndex: number): boolean {
    if (fromIndex === toIndex) return true;
    const udo = this._opcodeList.getOpcode(fromIndex);
    if (!udo) return false;

    this._opcodeList.removeOpcodeAt(fromIndex);
    this._opcodeList.addOpcodeAt(toIndex, udo);
    this._graphicInterfaceXML = null;
    return true;
  }

  convertUdoStyle(index: number, style: UDOStyle): boolean {
    const udo = this._opcodeList.getOpcode(index);
    if (!udo) return false;

    if (style === UDOStyle.MODERN) {
      convertToModern(udo);
    } else {
      convertToClassic(udo);
    }

    this._graphicInterfaceXML = null;
    return true;
  }

  getPresetGroup(): PresetGroup | null {
    return this._presetGroup;
  }

  setPresetGroup(group: PresetGroup | null): void {
    this._presetGroup = group;
  }

  applyPreset(presetUniqueId: string): boolean {
    if (!this._presetGroup) return false;
    const preset = this._presetGroup.findPresetByUniqueId(presetUniqueId);
    if (!preset) return false;

    const valuesMap = preset.getValuesMap();
    const visit = (widgets: BSBWidget[]): void => {
      for (const widget of widgets) {
        const val = valuesMap.get(widget.objectName);
        if (val !== undefined) {
          if (typeof widget.setPresetValue === 'function') {
            widget.setPresetValue(val);
          } else {
            const parsed = parseFloat(val.replace(/^ver2:/, ""));
            if (Number.isFinite(parsed)) {
              widget.value = parsed;
            }
          }

          // Sync with parameter(s) if they exist
          if (widget instanceof BSBXYController) {
            const px = this._parameters.find(p => p.getName() === `${widget.objectName}X`);
            const py = this._parameters.find(p => p.getName() === `${widget.objectName}Y`);
            if (px) px.setFixedValue(widget.xValue);
            if (py) py.setFixedValue(widget.yValue);
          } else {
            const param = this._parameters.find(p => p.getName() === widget.objectName);
            if (param) {
              param.setFixedValue(widget.value);
            }
          }
        }
        if (widget instanceof BSBGroup) {
          visit(widget.getChildren());
        }
      }
    };
    visit(this._graphicInterface.getRootGroup().getChildren());
    this.syncParametersFromWidgets();
    this._graphicInterfaceXML = null;
    this._presetGroup.setCurrentPresetUniqueId(presetUniqueId);
    this._presetGroup.setCurrentPresetModified(false);
    return true;
  }

  updateWidgetProperties(
    widgetId: string,
    properties: Record<string, unknown>,
  ): boolean {
    const widget = this._graphicInterface.findWidgetById(widgetId);
    if (!widget) return false;
    const previousObjectName = widget.objectName;

    const applyFontPatch = (
      rootKey: 'font' | 'labelFont',
      field: 'name' | 'size' | 'style',
      value: unknown,
    ): boolean => {
      const target = widget as unknown as Record<string, unknown>;
      const current = target[rootKey];
      const next = current && typeof current === 'object'
        ? { ...(current as Record<string, unknown>) }
        : { name: 'Roboto', size: 12, style: 0 };

      if (field === 'name' && typeof value === 'string') {
        next.name = value;
      } else if (field === 'size' && typeof value === 'number') {
        next.size = value;
      } else if (field === 'style' && typeof value === 'number') {
        next.style = value;
      } else {
        return false;
      }

      target[rootKey] = next;
      return true;
    };

    for (const [key, value] of Object.entries(properties)) {
      switch (key) {
        case "objectName":
          if (typeof value === "string") widget.objectName = value;
          break;
        case "x":
          if (typeof value === "number") widget.x = value;
          break;
        case "y":
          if (typeof value === "number") widget.y = value;
          break;
        case "value":
          if (typeof value === "number") {
            widget.setValue(value);
            if (widget.objectName) {
              const param = this._parameters.find(p => p.getName() === widget.objectName);
              if (param) {
                param.setFixedValue(value);
              }
            }
          }
          break;
        case "selected":
          if (typeof value === "boolean") {
            widget.setValue(value ? 1 : 0);
            if (widget.objectName) {
              const param = this._parameters.find(p => p.getName() === widget.objectName);
              if (param) {
                param.setFixedValue(value ? 1 : 0);
              }
            }
          }
          break;
        case "selectedIndex":
          if (typeof value === "number") {
            widget.setValue(value);
            if (widget.objectName) {
              const param = this._parameters.find(p => p.getName() === widget.objectName);
              if (param) {
                param.setFixedValue(value);
              }
            }
          }
          break;
        case "dropdownItems":
          if (widget instanceof BSBDropdown && Array.isArray(value)) {
            widget.dropdownItems = value.map((item) => {
              const record = item as Record<string, unknown>;
              return {
                name: typeof record.name === 'string' ? record.name : '',
                value: typeof record.value === 'string' ? record.value : '',
                uniqueId: typeof record.uniqueId === 'string' && record.uniqueId.length > 0
                  ? record.uniqueId
                  : generatePrefixedUuid('dropdown'),
              };
            });
          }
          break;
        case "fontSize":
          if (widget instanceof BSBDropdown && typeof value === "number") {
            widget.setFontSize(value);
          }
          break;
        case "lines":
          if (widget instanceof BSBLineObject) {
            widget.lines = normalizeBsbLinePatch(value);
          }
          break;
        case "font.name":
          if (widget instanceof BSBGroup || widget instanceof BSBLabel) {
            applyFontPatch("font", "name", value);
          }
          break;
        case "font.size":
          if (widget instanceof BSBGroup || widget instanceof BSBLabel) {
            applyFontPatch("font", "size", value);
          }
          break;
        case "font.style":
          if (widget instanceof BSBGroup || widget instanceof BSBLabel) {
            applyFontPatch("font", "style", value);
          }
          break;
        case "labelFont.name":
          if (widget instanceof BSBKnob) {
            applyFontPatch("labelFont", "name", value);
          }
          break;
        case "labelFont.size":
          if (widget instanceof BSBKnob) {
            applyFontPatch("labelFont", "size", value);
          }
          break;
        case "labelFont.style":
          if (widget instanceof BSBKnob) {
            applyFontPatch("labelFont", "style", value);
          }
          break;
        case "defaultValue":
          if (typeof value === "number") {
            widget.setValue(value);
            if (widget.objectName) {
              const param = this._parameters.find(p => p.getName() === widget.objectName);
              if (param) {
                param.setFixedValue(value);
              }
            }
          }
          break;
        case "xValue":
          if (typeof value === "number") {
            (widget as unknown as Record<string, unknown>)["xValue"] = value;
            const xName = widget.objectName + "X";
            const px = this._parameters.find(p => p.getName() === xName);
            if (px) px.setFixedValue(value);
          }
          break;
        case "yValue":
          if (typeof value === "number") {
            (widget as unknown as Record<string, unknown>)["yValue"] = value;
            const yName = widget.objectName + "Y";
            const py = this._parameters.find(p => p.getName() === yName);
            if (py) py.setFixedValue(value);
          }
          break;
        case "minimum":
          if (typeof value === "number") {
            rescaleWidgetRangeMinimum(widget, value);
          }
          break;
        case "maximum":
          if (typeof value === "number") {
            rescaleWidgetRangeMaximum(widget, value);
          }
          break;
        case "resolution":
          if (
            widget instanceof BSBHSlider
            || widget instanceof BSBVSlider
            || widget instanceof BSBHSliderBank
            || widget instanceof BSBVSliderBank
          ) {
            if (typeof value === "string") {
              widget.setResolutionText(value);
            } else if (typeof value === "number") {
              widget.resolution = value;
            }
          }
          break;
        case "resolutionDecimal":
          if (
            typeof value === "string"
            && (widget instanceof BSBHSlider
              || widget instanceof BSBVSlider
              || widget instanceof BSBHSliderBank
              || widget instanceof BSBVSliderBank)
          ) {
            widget.setResolutionText(value);
          }
          break;
        default:
          if (key in widget) {
            (widget as unknown as Record<string, unknown>)[key] = value;
          }
          break;
      }
    }

    if (previousObjectName !== widget.objectName) {
      this.renameParametersForWidget(widget, previousObjectName);
    }

    this.syncParametersFromWidgets();
    this._graphicInterfaceXML = null;
    return true;
  }

  updateSliderBankValue(widgetId: string, sliderIndex: number, value: number): boolean {
    const widget = this._graphicInterface.findWidgetById(widgetId);
    if (!(widget instanceof BSBHSliderBank) && !(widget instanceof BSBVSliderBank)) {
      return false;
    }

    if (sliderIndex < 0 || sliderIndex >= widget.sliders.length) {
      return false;
    }

    const clamped = clamp(value, widget.minimum, widget.maximum);
    widget.sliders[sliderIndex].setValue(clamped);

    if (widget.objectName) {
      const paramName = `${widget.objectName}_${sliderIndex}`;
      const param = this._parameters.find((candidate) => candidate.getName() === paramName);
      if (param) {
        param.setFixedValue(clamped);
      }
    }

    this.syncParametersFromWidgets();
    this._graphicInterfaceXML = null;
    return true;
  }

  invalidateGraphicInterfaceCache(): void {
    this._graphicInterfaceXML = null;
  }

  setBsbEditEnabled(enabled: boolean): void {
    this._graphicInterface.setEditEnabled(enabled);
    this._editEnabled = enabled;
    this._graphicInterfaceXML = null;
  }

  setBsbGridSettings(settings: Partial<GridSettingsData>): void {
    this._graphicInterface.setGridSettings(settings);
    this._graphicInterfaceXML = null;
  }

  updateWidgetValue(objectName: string, value: number): boolean {
    const widget = this.findWidgetByObjectName(objectName);
    if (!widget || widget.value === value) {
      return false;
    }

    widget.setValue(value);

    // Sync with parameter if it exists
    const param = this._parameters.find(p => p.getName() === objectName);
    if (param) {
      param.setFixedValue(value);
    }

    this.syncParametersFromWidgets();
    this._graphicInterfaceXML = null;
    return true;
  }

  private findWidgetByObjectName(objectName: string): BSBWidget | null {
    const visit = (widget: BSBWidget): BSBWidget | null => {
      if (widget.objectName === objectName) {
        return widget;
      }

      if (widget instanceof BSBGroup) {
        for (const child of widget.getChildren()) {
          const found = visit(child);
          if (found) return found;
        }
      }

      return null;
    };

    return visit(this._graphicInterface.getRootGroup());
  }

  /**
   * Recursively collect StringChannels from BSBGroup and its children.
   */
  private _collectStringChannels(group: any): StringChannel[] {
    const channels: StringChannel[] = [];
    if (!group) return channels;

    const getChildren = (group as any).getChildren;
    if (typeof getChildren !== "function") return channels;

    for (const child of getChildren.call(group) || []) {
      if (child instanceof BSBFileSelector) {
        const sc = child.getStringChannel();
        if (sc) channels.push(sc);
      } else if (typeof (child as any).getChildren === "function") {
        channels.push(...this._collectStringChannels(child));
      }
    }

    return channels;
  }

  // ─── XML Serialization ───

  saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = new Element("instrument");
    elem.setAttribute("type", "blue.orchestra.BlueSynthBuilder");
    elem.setAttribute("enabled", this._enabled.toString());
    elem.setAttribute("editEnabled", this._editEnabled.toString());
    elem.addElement("name").setText(this._name);
    elem.addElement("comment").setText(this._comment);
    elem.addElement("globalOrc").setText(this._globalOrc || "");
    elem.addElement("globalSco").setText(this._globalSco || "");
    elem.addElement("instrumentText").setText(this._instrumentText || "");
    elem.addElement("alwaysOnInstrumentText").setText(this._alwaysOnInstrumentText || "");
    if (this._graphicInterfaceXML) {
      elem.addElement(Element.parse(this._graphicInterfaceXML.toXml()));
    } else {
      elem.addElement(this._graphicInterface.saveAsXML());
    }
    const plist = new ParameterList();
    plist.push(...this.getParameters());
    elem.addElement(plist.saveAsXML());
    if (this._presetGroup) {
      elem.addElement(this._presetGroup.saveAsXML());
    }
    elem.addElement(this._opcodeList.saveAsXML());
    return elem;
  }

  static loadFromXML(
    data: Element,
    _objRefMap?: ObjRefLoadMap,
  ): BlueSynthBuilder {
    const bsb = new BlueSynthBuilder();

    bsb._enabled = data.getAttribute("enabled") !== "false";

    const editEnabled = data.getAttribute("editEnabled");
    if (editEnabled !== null) bsb._editEnabled = editEnabled === "true";

    const name = data.getTextString("name");
    bsb._name = name !== null ? name : "";

    const comment = data.getTextString("comment");
    if (comment) bsb._comment = comment;

    const instrText = data.getTextString("instrumentText");
    if (instrText) bsb._instrumentText = instrText;

    const alwaysOnText = data.getTextString("alwaysOnInstrumentText");
    if (alwaysOnText) bsb._alwaysOnInstrumentText = alwaysOnText;

    const globalOrc = data.getTextString("globalOrc");
    if (globalOrc) bsb._globalOrc = globalOrc;

    const globalSco = data.getTextString("globalSco");
    if (globalSco) bsb._globalSco = globalSco;

    // Load graphic interface
    const giElem = data.getElement("graphicInterface");
    if (giElem) {
      const hasLegacyWidgetIds = hasLegacyBsbWidgetChildId(giElem);
      const idRepairs = bsb._graphicInterface.loadFromXML(giElem);
      bsb._graphicInterfaceXML = idRepairs.length === 0 && !hasLegacyWidgetIds
        ? Element.parse(giElem.toXml())
        : null;
    }

    // Load preset group
    const presetGroupElem = data.getElement("presetGroup");
    if (presetGroupElem) {
      bsb._presetGroup = PresetGroup.loadFromXML(presetGroupElem);
    }

    // Load parameters
    const paramListElem = data.getElement("parameterList") ?? data.getElement("bsbParameterList");
    if (paramListElem) {
      bsb._parameters = BlueSynthBuilder._loadParameters(paramListElem);
    }

    // Load opcode list (UDOs)
    const opcodeListElem = data.getElement("opcodeList");
    if (opcodeListElem) {
      bsb._opcodeList = OpcodeList.loadFromXML(opcodeListElem);
    }

    bsb.syncParametersFromWidgets();

    return bsb;
  }

  /**
   * Load parameters from <parameterList> XML.
   */
  private static _loadParameters(data: Element): ParameterList {
    const parameters = new ParameterList();
    const paramElems = data.getElements("parameter");

    while (paramElems.hasMoreElements()) {
      const elem = paramElems.next();
      parameters.push(Parameter.loadFromXML(elem));
    }

    return parameters;
  }

  private renderTextWithReplacements(
    text: string,
    parameters?: Parameter[],
    consumeUdoReplacementValues = false,
  ): string {
    const unit = new BSBCompilationUnit();
    const replacementParameters = parameters ?? this.getParameters();
    this._graphicInterface.collectReplacements(unit, replacementParameters);

    let rendered = unit.replaceBSBValues(text);
    if (this._udoReplacementValues && this._udoReplacementValues.size > 0) {
      rendered = replaceOpcodeNames(this._udoReplacementValues, rendered);
      if (consumeUdoReplacementValues) {
        this._udoReplacementValues = null;
      }
    }

    return rendered;
  }

  override deepCopy(): BlueSynthBuilder {
    return new BlueSynthBuilder(this);
  }
}
