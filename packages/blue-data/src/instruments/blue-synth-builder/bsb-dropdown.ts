/**
 * BSBDropdown — dropdown selection list widget.
 * Mirrors the Java BSBDropdown class.
 */
import { Element } from '../../serialization/xml-reader';
import { BSBWidget } from './bsb-widget';
import { BSBCompilationUnit } from './bsb-compilation-unit';
import { Parameter } from '../../automation/parameter';
import { parseLegacySwingHtmlFont, stripLegacySwingHtml } from './legacy-swing-html';

export interface BSBDropdownItem {
  name: string;
  value: string;
  uniqueId: string;
}

export class BSBDropdown extends BSBWidget {
  selectedIndex = 0;
  fontSize = 12;
  randomizable = true;
  dropdownItems: BSBDropdownItem[] = [];

  setFontSize(size: number): void {
    this.fontSize = Math.max(8, Math.min(36, Math.round(size)));
  }

  override getPresetValue(): string {
    const item = this.dropdownItems[this.selectedIndex] ?? this.dropdownItems[0];
    return item ? `id:${item.uniqueId}` : String(this.selectedIndex);
  }

  override setPresetValue(val: string): void {
    if (val.startsWith('id:')) {
      const uniqueId = val.substring(3);
      const index = this.dropdownItems.findIndex((item) => item.uniqueId === uniqueId);
      if (index >= 0) {
        this.setValue(index);
      }
      return;
    }

    if (val.startsWith('ver2:')) {
      const parsed = parseInt(val.substring(5), 10);
      if (Number.isFinite(parsed)) {
        this.setValue(parsed);
      }
    } else {
      const parsed = parseInt(val, 10);
      if (Number.isFinite(parsed)) {
        this.setValue(parsed);
      } else {
        const idx = this.dropdownItems.findIndex((item) => item.value === val);
        if (idx !== -1) {
          this.setValue(idx);
        }
      }
    }
  }

  override setValue(val: number): void {
    this.value = val;
    this.selectedIndex = Math.floor(val);
  }

  override collectReplacements(unit: BSBCompilationUnit, parameters?: Parameter[]): void {
    const compilationVarName = this.getCompilationVarName(this.objectName, parameters);
    if (compilationVarName) {
      unit.addReplacementValue(this.objectName, compilationVarName);
      return;
    }

    if (this.dropdownItems.length === 0) {
      unit.addReplacementValue(this.objectName, '0');
      return;
    }
    if (this.automationAllowed) {
      unit.addReplacementValue(this.objectName, String(this.selectedIndex));
      return;
    }
    const item = this.dropdownItems[this.selectedIndex] ?? this.dropdownItems[0];
    unit.addReplacementValue(this.objectName, item?.value ?? '0');
  }

  loadFromXML(data: Element): void {
    this.loadFromXMLCommon(data);
    const versionAttr = data.getAttribute('version');
    const parsedVersion = versionAttr ? Number.parseInt(versionAttr, 10) : 1;
    const version = Number.isFinite(parsedVersion) ? parsedVersion : 1;
    const idx = data.getTextString('selectedIndex');
    if (idx) {
      const parsed = parseInt(idx, 10);
      if (Number.isFinite(parsed)) {
        this.setValue(parsed);
      }
    }
    const fs = data.getTextString('fontSize');
    if (fs) {
      const parsed = parseInt(fs, 10);
      if (Number.isFinite(parsed)) {
        this.setFontSize(parsed);
      }
    }
    const rand = data.getElement('randomizable');
    if (rand) this.randomizable = rand.getTextString() === 'true';
    const listElem = data.getElement('bsbDropdownItemList');
    if (listElem) {
      const items = listElem.getElements('bsbDropdownItem');
      while (items.hasMoreElements()) {
        const itemElem = items.next();
        this.dropdownItems.push({
          name: itemElem.getTextString('name') ?? 'name',
          value: itemElem.getTextString('value') ?? 'value',
          uniqueId: itemElem.getAttribute('uniqueId') ?? '',
        });
      }
    }

    if (version < 2) {
      let legacyFontSize = 12;
      for (const item of this.dropdownItems) {
        const font = parseLegacySwingHtmlFont(item.name);
        if (font.size !== 12) {
          legacyFontSize = font.size;
        }
        item.name = stripLegacySwingHtml(item.name);
      }
      if (legacyFontSize !== 12) {
        this.setFontSize(legacyFontSize);
      }
    }
  }

  randomize(): void {
    if (!this.randomizable || this.dropdownItems.length === 0) return;
    this.setValue(Math.floor(Math.random() * this.dropdownItems.length));
  }
}
