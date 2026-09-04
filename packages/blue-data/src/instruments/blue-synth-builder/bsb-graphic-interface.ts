/**
 * BSBGraphicInterface — root container for the BSB widget tree.
 * Mirrors the Java BSBGraphicInterface class.
 *
 * Holds the root BSBGroup and delegates replacement collection to it.
 */
import { Element } from '../../serialization/xml-reader';
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

  loadFromXML(data: Element): BsbWidgetIdRepair[] {
    this.rootGroup = new BSBGroup();
    const editEnabledAttr = data.getAttribute('editEnabled');
    if (editEnabledAttr !== null) this.editEnabled = editEnabledAttr === 'true';

    this.loadGridSettings(data);

    const bsbObjects = data.getElements('bsbObject');
    while (bsbObjects.hasMoreElements()) {
      const objElem = bsbObjects.next();
      const widget = loadBsbWidgetFromXML(objElem);
      if (widget) {
        if (widget instanceof BSBGroup) {
          this.rootGroup = widget;
        } else {
          this.rootGroup.addChild(widget);
        }
      }
    }

    return normalizeBsbWidgetIds(this.rootGroup);
  }

  private loadGridSettings(data: Element): void {
    const gsElem = data.getElement('gridSettings');
    if (!gsElem) {
      this.gridSettingsData = createDefaultGridSettings();
      this.gridSettingsRaw = '';
      return;
    }

    this.gridSettingsRaw = gsElem.toXml();

    const width = gsElem.getTextString('width');
    const height = gsElem.getTextString('height');
    const snapEnabled = gsElem.getTextString('snapGridEnabled');
    const gridStyle = gsElem.getTextString('gridStyle');

    this.gridSettingsData = {
      enabled: gridStyle ? gridStyle !== 'NONE' : false,
      snapEnabled: snapEnabled === 'true',
      width: width ? parseInt(width, 10) : 10,
      height: height ? parseInt(height, 10) : 10,
      gridStyle: (gridStyle as GridStyle) || 'NONE',
    };
  }

  saveAsXML(): Element {
    const elem = new Element('graphicInterface');
    elem.setAttribute('editEnabled', this.editEnabled.toString());

    if (this.gridSettingsRaw) {
      elem.addElement(Element.parse(this.gridSettingsRaw));
    } else {
      const gsElem = new Element('gridSettings');
      gsElem.addElement('width').setText(String(this.gridSettingsData.width));
      gsElem.addElement('height').setText(String(this.gridSettingsData.height));
      gsElem.addElement('gridStyle').setText(this.gridSettingsData.gridStyle);
      gsElem.addElement('snapGridEnabled').setText(this.gridSettingsData.snapEnabled.toString());
      elem.addElement(gsElem);
    }

    elem.addElement(this.rootGroup.saveAsXML());
    return elem;
  }

  deepCopy(): BSBGraphicInterface {
    const copy = new BSBGraphicInterface();
    copy.rootGroup = this.rootGroup.deepCopy();
    normalizeBsbWidgetIds(copy.rootGroup);
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
