import { XmlLoadContext } from '../../serialization/xml-load';
import { checkRoot, checkShape } from '../../utilities/xml';
import { Element } from '../../serialization/xml-reader';
import { generatePrefixedUuid } from '../../utilities/uuid';
import type { CopyMode } from '../../deep-copyable';
import type { BSBGraphicInterface } from './bsb-graphic-interface';
import type { BSBWidget } from './bsb-widget';
import { BSBGroup } from './bsb-group';

/** A named snapshot of BlueSynthBuilder control values keyed by widget name. */
export class Preset {
  /** Editable display name of the preset. */
  presetName = '';
  /** Persistent identifier. */
  uniqueId = generatePrefixedUuid('preset');
  private _valuesMap = new Map<string, string>();

  /** Returns the preset name stored on the preset. */
  getPresetName(): string {
    return this.presetName;
  }

  /** Sets the preset name stored on the preset. */
  setPresetName(name: string): void {
    this.presetName = name;
  }

  /** Returns the persistent identifier. */
  getUniqueId(): string {
    return this.uniqueId;
  }

  /** Returns a copy of the mapping from widget object name to preset value. */
  getValuesMap(): Map<string, string> {
    return new Map(this._valuesMap);
  }

  /** Replaces the stored widget values with a copy of the supplied mapping. */
  setValuesMap(values: Map<string, string>): void {
    this._valuesMap = new Map(values);
  }

  /** Returns the stored preset value for the named widget, or undefined when absent. */
  getValue(objectName: string): string | undefined {
    return this._valuesMap.get(objectName);
  }

  /** Stores one preset value keyed by the widget's object name. */
  setValue(objectName: string, value: string): void {
    this._valuesMap.set(objectName, value);
  }

  /** Replaces the preset values with the current values provided by named widgets in the graphic interface. */
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
    for (const key of Array.from(this._valuesMap.keys())) {
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

  /** Serializes the preset and its persisted settings to a new Blue XML element. */
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

  /** Reconstructs the preset from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Preset {
    checkRoot(data, 'preset', context);
    checkShape(data, ['name', 'uniqueId'], ['setting'], context, ['setting']);
    const preset = new Preset();
    preset.presetName = data.getAttribute('name') ?? '';
    const uniqueId = data.getAttribute('uniqueId');
    if (uniqueId) {
      preset.uniqueId = uniqueId;
    }
    const settings = data.getElements('setting');
    while (settings.hasMoreElements()) {
      const setting = settings.next();
      checkShape(setting, ['name'], [], context, [], true);
      const name = setting.getAttribute('name');
      if (!name || preset._valuesMap.has(name))
        throw context.at(setting).error({
          code: 'value',
          member: '@name',
          value: name ?? '',
          message: 'Setting requires a unique nonempty key.',
          recovery: 'Keep one scalar setting for each key.',
        });
      const value = setting.getTextString();
      if (name) {
        preset._valuesMap.set(name, value ?? '');
      }
    }
    return preset;
  }

  /** Copies the preset and its editable state. The copy mode controls which identities are retained. */
  deepCopy(presetIdMap?: Map<string, string>, mode: CopyMode = 'duplication'): Preset {
    const copy = new Preset();
    copy.presetName = this.presetName;
    if (mode === 'history') {
      copy.uniqueId = this.uniqueId;
    } else if (this.uniqueId) {
      presetIdMap?.set(this.uniqueId, copy.uniqueId);
    }
    copy._valuesMap = new Map(this._valuesMap);
    return copy;
  }
}
