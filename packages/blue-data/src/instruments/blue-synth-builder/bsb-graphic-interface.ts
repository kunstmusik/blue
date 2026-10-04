import {
  requireXmlValue,
  type XmlDiagnosticSink,
  XmlLoadContext,
} from '../../serialization/xml-load';
import {
  checkRoot,
  checkShape,
  readBoolean,
  readInt,
  readEnum,
  parseXmlBoolean,
} from '../../utilities/xml';
/**
 * BSBGraphicInterface — root container for the BSB widget tree.
 * Mirrors the Java BSBGraphicInterface class.
 *
 * Holds the root BSBGroup and delegates replacement collection to it.
 */
import { Element } from '../../serialization/xml-reader';
import type { CopyMode } from '../../deep-copyable';
import { BSBCompilationUnit } from './bsb-compilation-unit';
import { BSBGroup, loadBsbWidgetFromXML } from './bsb-group';
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
import { BSBLineObject } from './bsb-line-object';
import { BSBWidget } from './bsb-widget';
import { Parameter } from '../../automation/parameter';
import {
  type BsbWidgetIdRepair,
  createUniqueBsbWidgetId,
  findBsbWidgetById,
  normalizeBsbWidgetIds,
} from './bsb-identity';

export type GridStyle = 'NONE' | 'DOT' | 'LINE';

export interface GridSettingsData {
  enabled: boolean;
  snapEnabled: boolean;
  width: number;
  height: number;
  gridStyle: GridStyle;
}

type BSBWidgetCtor = new () => BSBWidget;

const WIDGET_TYPE_REGISTRY: Record<string, BSBWidgetCtor> = {
  BSBGroup: BSBGroup,
  BSBKnob: BSBKnob,
  BSBCheckBox: BSBCheckBox,
  BSBHSlider: BSBHSlider,
  BSBVSlider: BSBVSlider,
  BSBHSliderBank: BSBHSliderBank,
  BSBVSliderBank: BSBVSliderBank,
  BSBValue: BSBValue,
  BSBDropdown: BSBDropdown,
  BSBXYController: BSBXYController,
  BSBSubChannelDropdown: BSBSubChannelDropdown,
  BSBFileSelector: BSBFileSelector,
  BSBTextField: BSBTextField,
  BSBLabel: BSBLabel,
  BSBLineObject: BSBLineObject,
};

function createDefaultGridSettings(): GridSettingsData {
  return { enabled: false, snapEnabled: true, width: 10, height: 10, gridStyle: 'DOT' };
}

export class BSBGraphicInterface {
  rootGroup = new BSBGroup();
  gridSettingsRaw = '';
  gridSettingsData: GridSettingsData = createDefaultGridSettings();
  editEnabled = true;

  getRootGroup(): BSBGroup {
    return this.rootGroup;
  }

  getGridSettings(): GridSettingsData {
    return this.gridSettingsData;
  }

  setGridSettings(settings: Partial<GridSettingsData>): void {
    this.gridSettingsData = { ...this.gridSettingsData, ...settings };
    this.gridSettingsRaw = '';
  }

  isEditEnabled(): boolean {
    return this.editEnabled;
  }

  setEditEnabled(enabled: boolean): void {
    this.editEnabled = enabled;
  }

  collectReplacements(unit: BSBCompilationUnit, parameters?: Parameter[]): void {
    this.rootGroup.collectReplacements(unit, parameters);
  }

  loadFromXML(
    data: Element,
    context?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): BsbWidgetIdRepair[] {
    const ctx = context ?? new XmlLoadContext(data);
    const candidate = new BSBGraphicInterface();
    const repairs = candidate.loadValidatedXml(data, ctx);
    if (!context) requireXmlValue(ctx.result(repairs), sink);
    this.rootGroup = candidate.rootGroup;
    this.gridSettingsData = candidate.gridSettingsData;
    this.gridSettingsRaw = '';
    this.editEnabled = candidate.editEnabled;
    return repairs;
  }

  private loadValidatedXml(data: Element, context: XmlLoadContext): BsbWidgetIdRepair[] {
    checkRoot(data, 'graphicInterface', context);
    checkShape(data, ['editEnabled'], ['gridSettings', 'bsbObject'], context, ['bsbObject']);
    const roots = data.getElements('bsbObject').toArray();
    const groups = roots.filter(
      (elem) => elem.getAttribute('type') === 'blue.orchestra.blueSynthBuilder.BSBGroup',
    );
    if (groups.length > 1 || (groups.length && roots.length > 1))
      throw context.at(data).error({
        code: 'conflict',
        message: 'Graphic interface has competing root representations.',
        recovery: 'Keep one root group or the historical direct widgets.',
      });
    this.rootGroup = new BSBGroup();
    const editEnabledAttr = data.getAttribute('editEnabled');
    if (editEnabledAttr !== null)
      this.editEnabled = parseXmlBoolean(editEnabledAttr, context.at(data), '@editEnabled');

    this.loadGridSettings(data, context);

    const bsbObjects = data.getElements('bsbObject');
    while (bsbObjects.hasMoreElements()) {
      const objElem = bsbObjects.next();
      const widget = loadBsbWidgetFromXML(objElem, context);
      if (widget) {
        if (widget instanceof BSBGroup) {
          this.rootGroup = widget;
        } else {
          this.rootGroup.addChild(widget);
        }
      }
    }

    const duplicateSources = new Map<string, Element[]>();
    const seen = new Set<string>();
    const collect = (nodes: Element[]): void => {
      for (const node of nodes) {
        const id =
          node.getAttribute('uniqueId') ?? node.getAttribute('id') ?? node.getTextString('id');
        if (id) {
          if (seen.has(id)) duplicateSources.set(id, [...(duplicateSources.get(id) ?? []), node]);
          seen.add(id);
        }
        collect(node.getElements('bsbObject').toArray());
      }
    };
    collect(groups.length ? groups[0].getElements('bsbObject').toArray() : roots);
    const repairs = normalizeBsbWidgetIds(this.rootGroup);
    for (const repair of repairs) {
      if (repair.reason !== 'duplicate') continue;
      const node = duplicateSources.get(repair.previousId)?.shift() ?? data;
      const legacyId = node.getElement('id');
      const attribute = node.getAttribute('uniqueId') !== null ? '@uniqueId' : '@id';
      context.at(legacyId ?? node).diagnostic({
        code: 'R-BSB-IDENTITY',
        severity: 'warning',
        member: legacyId ? '#text' : attribute,
        value: repair.previousId,
        message: 'Duplicate widget identity was replaced with a unique identity.',
        recovery: 'Save canonical widget identities; musical content is unchanged.',
      });
    }
    return repairs;
  }

  private loadGridSettings(data: Element, context: XmlLoadContext): void {
    const gsElem = data.getElement('gridSettings');
    if (!gsElem) {
      this.gridSettingsData = {
        enabled: false,
        snapEnabled: false,
        width: 10,
        height: 10,
        gridStyle: 'NONE',
      };
      this.gridSettingsRaw = '';
      return;
    }

    checkShape(gsElem, [], ['width', 'height', 'gridStyle', 'snapGridEnabled'], context);
    this.gridSettingsRaw = '';
    const style = gsElem.getElement('gridStyle');
    const gridStyle = style ? readEnum(style, ['NONE', 'DOT', 'LINE'], context) : 'DOT';
    const width = gsElem.getElement('width');
    const height = gsElem.getElement('height');
    const snap = gsElem.getElement('snapGridEnabled');
    this.gridSettingsData = {
      enabled: gridStyle !== 'NONE',
      gridStyle,
      snapEnabled: snap ? readBoolean(snap, context) : true,
      width: width ? readInt(width, context, 1, 2147483647) : 10,
      height: height ? readInt(height, context, 1, 2147483647) : 10,
    };
  }

  saveAsXML(): Element {
    const elem = new Element('graphicInterface');
    elem.setAttribute('editEnabled', this.editEnabled.toString());

    const gsElem = new Element('gridSettings');
    gsElem.addElement('width').setText(String(this.gridSettingsData.width));
    gsElem.addElement('height').setText(String(this.gridSettingsData.height));
    gsElem.addElement('gridStyle').setText(this.gridSettingsData.gridStyle);
    gsElem.addElement('snapGridEnabled').setText(this.gridSettingsData.snapEnabled.toString());
    elem.addElement(gsElem);

    elem.addElement(this.rootGroup.saveAsXML());
    return elem;
  }

  deepCopy(mode: CopyMode = 'duplication'): BSBGraphicInterface {
    const copy = new BSBGraphicInterface();
    copy.rootGroup = this.rootGroup.deepCopy(mode);
    if (mode !== 'history') {
      normalizeBsbWidgetIds(copy.rootGroup);
    }
    copy.gridSettingsRaw = this.gridSettingsRaw;
    copy.gridSettingsData = { ...this.gridSettingsData };
    copy.editEnabled = this.editEnabled;
    return copy;
  }

  findWidgetById(id: string): BSBWidget | null {
    return findBsbWidgetById(this.rootGroup, id);
  }

  createWidgetByType(typeName: string): BSBWidget | null {
    const Ctor = WIDGET_TYPE_REGISTRY[typeName];
    if (!Ctor) return null;
    const widget = new Ctor();
    if (!widget.id) {
      widget.id = createUniqueBsbWidgetId(this.rootGroup);
    }
    return widget;
  }

  removeWidget(widgetId: string): boolean {
    const remove = (parent: BSBGroup): boolean => {
      if (parent.removeChildById(widgetId)) return true;
      for (const child of parent.getChildren()) {
        if (child instanceof BSBGroup && remove(child)) {
          return true;
        }
      }
      return false;
    };

    return remove(this.rootGroup);
  }
}
