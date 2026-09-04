import { Element } from '../../serialization/xml-reader';
import { generatePrefixedUuid } from '../../utilities/uuid';
import type { BSBGraphicInterface } from './bsb-graphic-interface';
import type { BSBWidget } from './bsb-widget';
import { BSBGroup } from './bsb-group';

export class Preset {
  presetName = '';
  uniqueId = generatePrefixedUuid('preset');
  private _valuesMap = new Map<string, string>();

  getPresetName(): string {
    return this.presetName;
  }

  setPresetName(name: string): void {
    this.presetName = name;
  }

  getUniqueId(): string {
    return this.uniqueId;
  }

  getValuesMap(): Map<string, string> {
    return new Map(this._valuesMap);
  }

  setValuesMap(values: Map<string, string>): void {
    this._valuesMap = new Map(values);
  }

  getValue(objectName: string): string | undefined {
    return this._valuesMap.get(objectName);
  }

  setValue(objectName: string, value: string): void {
    this._valuesMap.set(objectName, value);
  }

  updatePresets(gInterface: any): void {
    this._valuesMap.clear();
    const visit = (widgets: any[]): void => {
      for (const widget of widgets) {
        if (widget.objectName) {
          const value =
            typeof widget.getPresetValue === 'function'
              ? widget.getPresetValue()
              : widget.value !== undefined
                ? String(widget.value)
                : null;
          if (value !== null && value !== undefined) {
            this._valuesMap.set(widget.objectName, value);
          }
        }
        if (widget.getChildren && typeof widget.getChildren === 'function') {
          visit(widget.getChildren());
        }
      }
    };
    visit(gInterface.getRootGroup().getChildren());
  }

  /**
   * Synchronize this preset's stored values with the current BSB interface.
   *
   * Mirrors Java `Preset.synchronizeWithInterface(BSBGraphicInterface)`:
   * 1. Remove preset values whose widget objectName no longer exists in the interface.
   * 2. Add default preset values for widgets that exist in the interface but
   *    are not yet stored in this preset.
   */
  synchronizeWithInterface(graphicInterface: BSBGraphicInterface): void {
    // Build a set of all widget objectNames currently in the interface
    const nameSet = new Set<string>();
    const collectNames = (widgets: BSBWidget[]): void => {
      for (const widget of widgets) {
        if (widget.objectName) {
          nameSet.add(widget.objectName);
        }
        if (widget instanceof BSBGroup) {
          collectNames(widget.getChildren());
        }
      }
    };
    collectNames(graphicInterface.getRootGroup().getChildren());

    // Remove preset entries whose objectName no longer exists in the interface
    for (const key of [...this._valuesMap.keys()]) {
      if (!nameSet.has(key)) {
        this._valuesMap.delete(key);
      }
    }

    // Add default values for widgets present in the interface but missing from the preset
    const addMissing = (widgets: BSBWidget[]): void => {
      for (const widget of widgets) {
        const objName = widget.objectName;
        if (objName && objName.length > 0 && !this._valuesMap.has(objName)) {
          const val = widget.getPresetValue();
          if (val !== null && val !== undefined) {
            this._valuesMap.set(objName, val);
          }
        }
        if (widget instanceof BSBGroup) {
          addMissing(widget.getChildren());
        }
      }
    };
    addMissing(graphicInterface.getRootGroup().getChildren());
  }

  saveAsXML(): Element {
    const elem = new Element('preset');
    elem.setAttribute('name', this.presetName);
    elem.setAttribute('uniqueId', this.uniqueId);
    const sortedKeys = [...this._valuesMap.keys()].sort();
    for (const key of sortedKeys) {
      const setting = elem.addElement('setting');
      setting.setAttribute('name', key);
      setting.setText(this._valuesMap.get(key) ?? '');
    }
    return elem;
  }

  static loadFromXML(data: Element): Preset {
    const preset = new Preset();
    preset.presetName = data.getAttribute('name') ?? '';
    const uniqueId = data.getAttribute('uniqueId');
    if (uniqueId) {
      preset.uniqueId = uniqueId;
    }
    const settings = data.getElements('setting');
    while (settings.hasMoreElements()) {
      const setting = settings.next();
      const name = setting.getAttribute('name');
      const value = setting.getTextString();
      if (name) {
        preset._valuesMap.set(name, value ?? '');
      }
    }
    return preset;
  }

  deepCopy(presetIdMap?: Map<string, string>): Preset {
    const copy = new Preset();
    copy.presetName = this.presetName;
    if (this.uniqueId) {
      presetIdMap?.set(this.uniqueId, copy.uniqueId);
    }
    copy._valuesMap = new Map(this._valuesMap);
    return copy;
  }
}
