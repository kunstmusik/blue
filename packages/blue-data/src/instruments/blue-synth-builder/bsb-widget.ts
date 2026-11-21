/**
 * BSBWidget — abstract base for all BlueSynthBuilder widgets.
 * Mirrors the Java BSBObject class.
 *
 * Each widget contributes a replacement value during compilation:
 *   objectName → value (or automation variable name)
 */
import { XmlLoadContext } from '../../serialization/xml-load';
import { readBoolean } from '../../utilities/xml';
import { validateBsbWidget } from './bsb-xml';
import { Element } from '../../serialization/xml-reader';
import { BSBCompilationUnit } from './bsb-compilation-unit';
import { Parameter } from '../../automation/parameter';
import { formatBlueNumber } from '../../utilities/number-format';
import { generatePrefixedUuid } from '../../utilities/uuid';
import type { CopyMode } from '../../deep-copyable';

/** Base for BlueSynthBuilder controls that supply preset values and orchestra template replacements. */
export abstract class BSBWidget {
  /** Name used to look up the widget's orchestra template replacement and automation parameter. */
  objectName = '';
  /** Horizontal position in the containing widget group, in pixels. */
  x = 0;
  /** Vertical position in the containing widget group, in pixels. */
  y = 0;
  /** Optional descriptive text stored with the widget. */
  comment = '';
  /** Whether the widget allows its value to be controlled by automation. */
  automationAllowed = true;
  /** Current numeric value. Widgets with specialized state use their own value accessors. */
  value = 0;
  /** Configured lower bound for widgets with a numeric range. */
  minimum = 0;
  /** Configured upper bound for widgets with a numeric range. */
  maximum = 1;
  /** Optional stored parameter name associated with the widget. */
  parameterName: string | null = null;
  /** Persistent widget identifier when assigned. An empty string denotes an unassigned ID. */
  id = '';

  /** Encodes the current value for a preset. Subclasses can use specialized formats or return `null` to omit a value. */
  getPresetValue(): string | null {
    return String(this.value);
  }

  /** Applies a serialized preset value. The base implementation applies a finite numeric prefix when one is present. */
  setPresetValue(val: string): void {
    const parsed = parseFloat(val);
    if (Number.isFinite(parsed)) {
      this.setValue(parsed);
    }
  }

  /**
   * Set the numeric value of this widget.
   * Subclasses should override this to sync internal state (e.g. selected, selectedIndex).
   */
  setValue(val: number): void {
    this.value = val;
  }

  protected getCompilationVarName(key: string, parameters?: Parameter[]): string | null {
    if (key && parameters) {
      const param = parameters.find((candidate) => candidate.getName() === key);
      if (param && param.getCompilationVarName()) {
        return param.getCompilationVarName();
      }
    }

    return null;
  }

  protected addCompilationReplacement(
    unit: BSBCompilationUnit,
    key: string,
    fallback: string,
    parameters?: Parameter[],
  ): void {
    unit.addReplacementValue(key, this.getCompilationVarName(key, parameters) ?? fallback);
  }

  /**
   * Collect this widget's replacement value into the compilation unit.
   * Looks up the parameter by this widget's objectName in the parameters list.
   * If found with a compilationVarName, uses that (e.g. "gk_blue_auto0");
   * otherwise uses the raw numeric value.
   *
   * This matches the Java BSBObject.setupForCompilation() logic:
   *   Parameter param = parameters.getParameter(this.getObjectName());
   *   if (param != null && param.getCompilationVarName() != null) {
   *       compilationUnit.addReplacementValue(getObjectName(), param.getCompilationVarName());
   *   }
   */
  collectReplacements(unit: BSBCompilationUnit, parameters?: Parameter[]): void {
    this.addCompilationReplacement(unit, this.objectName, formatBlueNumber(this.value), parameters);
  }

  /**
   * Load widget properties from XML.
   * Subclasses override to load type-specific properties.
   */
  static loadCommonFromXML(
    widget: BSBWidget,
    data: Element,
    context = new XmlLoadContext(data),
  ): void {
    validateBsbWidget(data, widget.constructor.name, context);
    const objName = data.getTextString('objectName');
    if (objName) widget.objectName = objName;
    const id = data.getAttribute('uniqueId') ?? data.getAttribute('id') ?? data.getTextString('id');
    if (id) widget.id = id;
    const x = data.getTextString('x');
    if (x) widget.x = parseInt(x, 10);
    const y = data.getTextString('y');
    if (y) widget.y = parseInt(y, 10);
    const comment = data.getTextString('comment');
    if (comment) widget.comment = comment;
    const autoAllowedElem = data.getElement('automationAllowed');
    if (autoAllowedElem) {
      widget.automationAllowed = readBoolean(autoAllowedElem, context);
    } else {
      widget.automationAllowed = false;
    }
    const val = data.getTextString('value');
    if (val) widget.value = parseFloat(val);
    const min = data.getTextString('minimum');
    if (min) widget.minimum = parseFloat(min);
    const max = data.getTextString('maximum');
    if (max) widget.maximum = parseFloat(max);
    const param = data.getTextString('parameterName');
    if (param) widget.parameterName = param;
  }

  /** Reads common XML attributes and fields into this widget instance. */
  loadFromXMLCommon(data: Element, context = new XmlLoadContext(data)): void {
    BSBWidget.loadCommonFromXML(this, data, context);
  }

  private cloneWidget(mode: CopyMode = 'duplication'): this {
    const Ctor = this.constructor as new () => this;
    const clone = new Ctor();

    const cloneValue = (val: unknown): unknown => {
      if (val == null || typeof val !== 'object') {
        return val;
      }

      if (val instanceof BSBWidget) {
        return val.deepCopy(mode);
      }

      if (Array.isArray(val)) {
        return val.map((item) => cloneValue(item));
      }

      const next: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(val as Record<string, unknown>)) {
        next[key] = cloneValue(value);
      }
      return next;
    };

    for (const key of Object.keys(this)) {
      const val = (this as any)[key];
      if (val == null || typeof val !== 'object') {
        (clone as any)[key] = val;
      } else {
        (clone as any)[key] = cloneValue(val);
      }
    }

    if (mode === 'history') {
      clone.id = this.id;
    } else {
      clone.id = this.id ? generatePrefixedUuid('w') : '';

      const dropdownItems = (clone as unknown as { dropdownItems?: Array<{ uniqueId?: string }> })
        .dropdownItems;
      if (Array.isArray(dropdownItems)) {
        for (const item of dropdownItems) {
          item.uniqueId = generatePrefixedUuid('dropdown');
        }
      }
    }

    return clone;
  }

  /** Copies the concrete widget including nested values. History preserves IDs, and duplication regenerates assigned IDs. */
  deepCopy(mode: CopyMode = 'duplication'): this {
    return this.cloneWidget(mode);
  }
}
