import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { parseJavaDecimal } from '@blue/data';
import type {
  BsbWidgetNodeSnapshot,
  BsbInterfacePatch,
} from '../../../../../../shared/project-editor';
import { getBsbObjectNameValidationKeysFromSnapshot } from '../../../../../../shared/bsb-widget-keys';
import FontChooserDialog, { type FontChoice } from './FontChooserDialog';
import ColorPickerButton from '../../../../ColorPicker';

interface BSBPropertySheetProps {
  widget: BsbWidgetNodeSnapshot | null;
  selectedCount?: number;
  editEnabled: boolean;
  allObjectNames: Set<string>;
  onBsbInterfacePatch: (patch: BsbInterfacePatch) => void;
}

const TYPE_DISPLAY_NAMES: Record<string, string> = {
  BSBHSlider: 'HSlider',
  BSBVSlider: 'VSlider',
  BSBKnob: 'Knob',
  BSBCheckBox: 'CheckBox',
  BSBDropdown: 'Dropdown',
  BSBLabel: 'Label',
  BSBTextField: 'TextField',
  BSBValue: 'Value',
  BSBXYController: 'XY Controller',
  BSBGroup: 'Group',
  BSBFileSelector: 'File Selector',
  BSBHSliderBank: 'HSlider Bank',
  BSBVSliderBank: 'VSlider Bank',
  BSBLineObject: 'Line Object',
  BSBSubChannelDropdown: 'SubChannel Dropdown',
};

const PROPERTY_ORDER = [
  'objectName',
  'x',
  'y',
  'width',
  'height',
  'value',
  'minimum',
  'maximum',
  'sliderWidth',
  'sliderHeight',
  'knobWidth',
  'textFieldWidth',
  'canvasWidth',
  'canvasHeight',
  'resolution',
  'gap',
  'numberOfSliders',
  'selectedIndex',
  'fontSize',
  'label',
  'labelEnabled',
  'groupName',
  'titleEnabled',
  'valueDisplayEnabled',
  'automationAllowed',
  'randomizable',
  'stringChannelEnabled',
  'leadingZero',
  'relativeXValues',
  'locked',
  'separatorType',
  'XMin',
  'XMax',
  'YMin',
  'YMax',
  'defaultValue',
  'fileName',
  'comment',
  'backgroundColor',
  'borderColor',
  'labelTextColor',
  'font.name',
  'font.size',
  'font.style',
  'labelFont.name',
  'labelFont.size',
  'labelFont.style',
];

const BOOLEAN_PROPS = new Set([
  'titleEnabled',
  'labelEnabled',
  'valueDisplayEnabled',
  'automationAllowed',
  'randomizable',
  'stringChannelEnabled',
  'leadingZero',
  'relativeXValues',
  'locked',
]);

const NUMBER_PROPS = new Set([
  'x',
  'y',
  'width',
  'height',
  'value',
  'minimum',
  'maximum',
  'sliderWidth',
  'sliderHeight',
  'knobWidth',
  'textFieldWidth',
  'canvasWidth',
  'canvasHeight',
  'gap',
  'numberOfSliders',
  'selectedIndex',
  'fontSize',
  'XMin',
  'XMax',
  'YMin',
  'YMax',
  'defaultValue',
  'font.size',
  'font.style',
  'labelFont.size',
  'labelFont.style',
]);

const BEANINFO_PROPERTIES: Record<string, string[]> = {
  BSBHSlider: ['objectName', 'x', 'y', 'sliderWidth', 'minimum', 'maximum', 'value', 'resolution', 'valueDisplayEnabled', 'automationAllowed', 'randomizable', 'comment'],
  BSBVSlider: ['objectName', 'x', 'y', 'sliderHeight', 'minimum', 'maximum', 'value', 'resolution', 'valueDisplayEnabled', 'automationAllowed', 'randomizable', 'comment'],
  BSBKnob: ['objectName', 'x', 'y', 'knobWidth', 'minimum', 'maximum', 'value', 'label', 'labelEnabled', 'labelFont', 'valueDisplayEnabled', 'automationAllowed', 'randomizable', 'comment'],
  BSBCheckBox: ['objectName', 'x', 'y', 'label', 'automationAllowed', 'randomizable', 'comment'],
  BSBDropdown: ['objectName', 'x', 'y', 'selectedIndex', 'BSBDropdownItemList', 'fontSize', 'automationAllowed', 'randomizable', 'comment'],
  BSBLabel: ['x', 'y', 'label', 'font'],
  BSBTextField: ['objectName', 'x', 'y', 'textFieldWidth', 'value', 'comment'],
  BSBValue: ['objectName', 'x', 'y', 'minimum', 'maximum', 'defaultValue', 'automationAllowed'],
  BSBXYController: ['objectName', 'x', 'y', 'width', 'height', 'XMin', 'XMax', 'YMin', 'YMax', 'valueDisplayEnabled', 'automationAllowed', 'randomizable', 'comment'],
  BSBGroup: ['x', 'y', 'groupName', 'titleEnabled', 'font', 'backgroundColor', 'borderColor', 'labelTextColor', 'comment'],
  BSBFileSelector: ['objectName', 'x', 'y', 'textFieldWidth', 'stringChannelEnabled', 'fileName', 'comment'],
  BSBHSliderBank: ['objectName', 'x', 'y', 'numberOfSliders', 'sliderWidth', 'minimum', 'maximum', 'resolution', 'gap', 'valueDisplayEnabled', 'automationAllowed', 'randomizable', 'comment'],
  BSBVSliderBank: ['objectName', 'x', 'y', 'numberOfSliders', 'sliderHeight', 'minimum', 'maximum', 'resolution', 'gap', 'valueDisplayEnabled', 'automationAllowed', 'randomizable', 'comment'],
  BSBLineObject: ['objectName', 'x', 'y', 'canvasWidth', 'canvasHeight', 'XMax', 'lines', 'separatorType', 'leadingZero', 'relativeXValues', 'locked', 'comment'],
  BSBSubChannelDropdown: ['objectName', 'x', 'y', 'comment'],
};

const TOP_LEVEL_PROPERTY_KEYS = new Set(['objectName', 'x', 'y', 'width', 'height', 'value', 'minimum', 'maximum']);
const NON_RENDERED_PROPERTIES = new Set(['BSBDropdownItemList', 'font', 'labelFont', 'lines']);

interface PropertyBinding {
  source: 'top' | 'properties';
  readKey?: string;
  writeKey?: string;
}

type DropdownItemEditor = {
  name?: string;
  value?: string;
  uniqueId?: string;
};

type LineEditorItem = {
  name?: string;
  varName?: string;
  min?: number;
  max?: number;
  color?: string | number;
  resolution?: string;
  rightBound?: boolean;
  endPointsLinked?: boolean;
  points: Array<{ x: number; y: number }>;
};

const LINE_PALETTE = [
  '#20dd00',
  '#0000ff',
  '#ffa500',
  '#008b00',
  '#ff00ff',
  '#cd3700',
  '#68228b',
  '#00688b',
  '#2f4f4f',
  '#cd1076',
  '#8b6914',
  '#458b74',
  '#8b4513',
  '#4169e1',
  '#8b7d6b',
  '#000080',
  '#7cfc00',
  '#483d8b',
  '#ffd700',
  '#838b8b',
  '#8b1a1a',
  '#7fff00',
  '#8b2323',
  '#8b7355',
  '#458b74',
  '#fa8072',
  '#8b3e2f',
  '#008b8b',
  '#458b00',
  '#a020f0',
];

const PROPERTY_BINDINGS: Record<string, Record<string, PropertyBinding>> = {
  BSBTextField: {
    value: { source: 'properties', readKey: 'textValue', writeKey: 'textValue' },
  },
  BSBXYController: {
    XMin: { source: 'properties', readKey: 'xMin', writeKey: 'xMin' },
    XMax: { source: 'properties', readKey: 'xMax', writeKey: 'xMax' },
    YMin: { source: 'properties', readKey: 'yMin', writeKey: 'yMin' },
    YMax: { source: 'properties', readKey: 'yMax', writeKey: 'yMax' },
  },
  BSBLineObject: {
    XMax: { source: 'properties', readKey: 'xMax', writeKey: 'xMax' },
  },
};

function getPropertyBinding(widgetType: string, key: string): PropertyBinding | undefined {
  return PROPERTY_BINDINGS[widgetType]?.[key];
}

function getDisplayPropertyValue(widget: BsbWidgetNodeSnapshot, key: string): unknown {
  if (key === 'resolution' && typeof widget.properties?.resolutionDecimal === 'string') {
    return widget.properties.resolutionDecimal;
  }
  const binding = getPropertyBinding(widget.type, key);
  if (binding?.source === 'top') {
    return (widget as unknown as Record<string, unknown>)[binding.readKey ?? key];
  }
  if (binding?.source === 'properties') {
    return widget.properties?.[binding.readKey ?? key];
  }
  if (TOP_LEVEL_PROPERTY_KEYS.has(key)) {
    return (widget as unknown as Record<string, unknown>)[key];
  }
  return widget.properties?.[key];
}

function getPatchPropertyKey(widgetType: string, key: string): string {
  return getPropertyBinding(widgetType, key)?.writeKey ?? key;
}

export default function BSBPropertySheet({
  widget,
  selectedCount,
  editEnabled,
  allObjectNames,
  onBsbInterfacePatch,
}: BSBPropertySheetProps): React.ReactElement {
  if (!widget) {
    return (
      <div className="p-3 text-role-body text-app-text-muted">
        {selectedCount && selectedCount > 1
          ? `${selectedCount} widgets selected.`
          : 'Select a widget to edit its properties.'}
      </div>
    );
  }

  if (!editEnabled) {
    return (
      <div className="p-3 text-role-body text-app-text-muted">
        Enable edit mode to edit widget properties.
      </div>
    );
  }

  if (widget.preservedOnly) {
    return (
      <div className="p-3 text-role-body text-app-warning">
        This widget type ({widget.type}) is preserved but not fully editable in this version.
      </div>
    );
  }

  return (
    <EditableBsbPropertySheet
      widget={widget}
      allObjectNames={allObjectNames}
      onBsbInterfacePatch={onBsbInterfacePatch}
    />
  );
}

function EditableBsbPropertySheet({
  widget,
  allObjectNames,
  onBsbInterfacePatch,
}: {
  widget: BsbWidgetNodeSnapshot;
  allObjectNames: Set<string>;
  onBsbInterfacePatch: (patch: BsbInterfacePatch) => void;
}): React.ReactElement {

  const allowed = BEANINFO_PROPERTIES[widget.type];
  const allowedSet = allowed ? new Set(allowed) : null;

  const updateProperty = (key: string, value: unknown) => {
    const patchKey = getPatchPropertyKey(widget.type, key);
    onBsbInterfacePatch({
      type: 'updateWidgetProperties',
      widgetId: widget.id,
      properties: { [patchKey]: value },
    });
  };

  const merged: Map<string, unknown> = new Map();

  if (allowed) {
    for (const key of allowed) {
      if (NON_RENDERED_PROPERTIES.has(key)) continue;
      const value = getDisplayPropertyValue(widget, key);
      if (value !== undefined && value !== null) {
        merged.set(key, value);
      }
    }
  }

  if (widget.properties) {
    for (const [key, value] of Object.entries(widget.properties)) {
      if (key === 'dropdownItems') continue;
      if (merged.has(key)) continue;
      const isFontKey = key.startsWith('labelFont.') || key.startsWith('font.');
      if (!isFontKey) continue;
      if (allowedSet && !allowedSet.has(key.startsWith('labelFont.') ? 'labelFont' : 'font')) continue;
      if (value !== undefined && value !== null) {
        merged.set(key, value);
      }
    }
  }

  const sortedEntries = Array.from(merged.entries()).sort((a, b) => {
    const ai = PROPERTY_ORDER.indexOf(a[0]);
    const bi = PROPERTY_ORDER.indexOf(b[0]);
    const ao = ai === -1 ? PROPERTY_ORDER.length : ai;
    const bo = bi === -1 ? PROPERTY_ORDER.length : bi;
    return ao - bo;
  });

  const typeName = TYPE_DISPLAY_NAMES[widget.type] || widget.type;

  const fontPrefixes = ['font.', 'labelFont.'];
  const fontKeys = new Set<string>();
  for (const [key] of sortedEntries) {
    for (const prefix of fontPrefixes) {
      if (key.startsWith(prefix)) {
        if (key === `${prefix}name` || key === `${prefix}size` || key === `${prefix}style`) {
          fontKeys.add(key);
        }
      }
    }
  }

  const fontGroups = useMemo(() => {
    const groups: Array<{ prefix: string; label: string; nameKey: string; font: FontChoice }> = [];
    for (const prefix of fontPrefixes) {
      if (fontKeys.has(`${prefix}name`)) {
        groups.push({
          prefix,
          label: prefix === 'font.' ? 'Font' : 'Label Font',
          nameKey: `${prefix}name`,
          font: {
            name: String(merged.get(`${prefix}name`) ?? 'Roboto'),
            size: Number(merged.get(`${prefix}size`) ?? 12),
            style: Number(merged.get(`${prefix}style`) ?? 0),
          },
        });
      }
    }
    return groups;
  }, [fontKeys, merged]);

  const [fontDialog, setFontDialog] = useState<{ prefix: string; font: FontChoice } | null>(null);

  const handleFontConfirm = (choice: FontChoice) => {
    if (!fontDialog) return;
    const p = fontDialog.prefix;
    onBsbInterfacePatch({
      type: 'updateWidgetProperties',
      widgetId: widget.id,
      properties: {
        [`${p}name`]: choice.name,
        [`${p}size`]: choice.size,
        [`${p}style`]: choice.style,
      },
    });
    setFontDialog(null);
  };

  return (
    <div className="space-y-2 p-3">
      <div className="mb-2 border-b border-app-border pb-1 text-role-headline font-bold uppercase tracking-[0.16em] text-app-text-muted">
        {typeName}
      </div>

      {sortedEntries.map(([key, rawVal]) => {
        if (fontKeys.has(key)) return null;

        if (BOOLEAN_PROPS.has(key)) {
          return (
            <PropertyRow key={key} label={formatLabel(key)}>
              <input
                type="checkbox"
                className="accent-app-accent"
                checked={!!rawVal}
                onChange={(e) => updateProperty(key, e.target.checked)}
              />
            </PropertyRow>
          );
        }

        const isExactResolution = key === 'resolution' && typeof rawVal === 'string';
        const isNumber = !isExactResolution && (NUMBER_PROPS.has(key) || typeof rawVal === 'number');
        const isObjectName = key === 'objectName';

        return (
          <PropertyRow key={key} label={formatLabel(key)}>
            <PropertyInput
              inputType={isNumber ? 'number' : 'text'}
              value={rawVal}
              isObjectName={isObjectName}
              widget={widget}
              widgetId={widget.id}
              allObjectNames={allObjectNames}
              validate={isExactResolution
                ? validateExactResolutionProperty
                : isNumber
                  ? (v: string) => validateNumericProperty(key, v, widget)
                  : undefined}
              onCommit={(val) => {
                if (isNumber) {
                  updateProperty(key, val === '' ? 0 : parseFloat(val as string));
                } else {
                  updateProperty(key, val);
                }
              }}
            />
          </PropertyRow>
        );
      })}

      {fontGroups.map(g => (
        <PropertyRow key={g.prefix} label={g.label}>
          <div className="flex items-center gap-1">
            <span className="flex-1 truncate rounded border border-app-border bg-app-surface-raised px-2 py-1 text-role-body text-app-text-strong">
              {fontSummary(g.font)}
            </span>
            <button
              className="rounded border border-app-border px-2 py-1 text-role-body text-app-text hover:bg-app-hover"
              onClick={() => setFontDialog({ prefix: g.prefix, font: { ...g.font } })}
            >
              ...
            </button>
          </div>
        </PropertyRow>
      ))}

      {widget.properties?.dropdownItems != null && (
        <DropdownItemsEditor
          items={widget.properties.dropdownItems as Array<{ name?: string; value?: string; uniqueId?: string }>}
          onUpdate={(items) => updateProperty('dropdownItems', items)}
        />
      )}

      {widget.type === 'BSBLineObject' && (
        <LineObjectEditor
          lines={Array.isArray(widget.properties?.lines) ? widget.properties.lines as Array<LineEditorItem> : []}
          onUpdate={(lines) => updateProperty('lines', lines)}
        />
      )}

      <div className="mt-2 border-t border-app-border pt-2 text-role-callout text-app-text-muted">
        Type: {widget.type}
      </div>

      <FontChooserDialog
        open={fontDialog !== null}
        font={fontDialog?.font ?? { name: 'Roboto', size: 12, style: 0 }}
        onConfirm={handleFontConfirm}
        onCancel={() => setFontDialog(null)}
      />
    </div>
  );
}

function validateExactResolutionProperty(proposed: string): string | null {
  const parsed = parseJavaDecimal(proposed);
  return parsed.ok ? parsed.value.canonicalText : null;
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="grid grid-cols-[80px_1fr] items-center gap-2">
      <label className="truncate text-role-body text-app-text">{label}</label>
      {children}
    </div>
  );
}

function PropertyInput({
  inputType,
  value,
  isObjectName,
  widget,
  widgetId,
  allObjectNames,
  validate,
  onCommit,
}: {
  inputType: 'text' | 'number';
  value: unknown;
  isObjectName: boolean;
  widget: BsbWidgetNodeSnapshot;
  widgetId: string;
  allObjectNames: Set<string>;
  validate?: (proposed: string) => string | null;
  onCommit: (val: string | number | boolean | null) => void;
}): React.ReactElement {
  const stringVal = String(value ?? '');
  const [localValue, setLocalValue] = useState(stringVal);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) {
      setLocalValue(stringVal);
    }
  }, [stringVal, focused]);

  const commit = () => {
    if (localValue === stringVal) return;
    let accepted = localValue;

    if (isObjectName) {
      const validationKeys = getBsbObjectNameValidationKeysFromSnapshot(widget, accepted);
      if (validationKeys.some((key) => allObjectNames.has(key))) {
        setLocalValue(stringVal);
        return;
      }
    }

    if (validate) {
      const result = validate(accepted);
      if (result === null) {
        setLocalValue(stringVal);
        return;
      }
      accepted = result;
    }

    if (accepted === stringVal) {
      setLocalValue(stringVal);
      return;
    }
    onCommit(accepted);
  };

  return (
    <input
      ref={inputRef}
      className="w-full rounded border border-app-border bg-app-surface-raised px-2 py-1 text-role-body text-app-text-strong outline-none focus:border-app-accent"
      type={inputType}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          inputRef.current?.blur();
        }
        if (e.key === 'Escape') {
          setLocalValue(stringVal);
          inputRef.current?.blur();
        }
      }}
    />
  );
}

const POSITIVE_INT_PROPS = new Set(['numberOfSliders']);
const INT_CLAMP_PROPS: Record<string, [number, number]> = {
  fontSize: [8, 36],
};

export function validateNumericProperty(
  key: string,
  proposed: string,
  widget: BsbWidgetNodeSnapshot,
): string | null {
  if (proposed === '' || proposed === '-') return null;
  let num = parseFloat(proposed);
  if (isNaN(num)) return null;

  if (key === 'x' || key === 'y') {
    return String(Math.max(0, num));
  }

  if (key === 'width' || key === 'height' || key === 'sliderWidth' ||
      key === 'sliderHeight' || key === 'knobWidth' || key === 'canvasWidth' ||
      key === 'canvasHeight') {
    return String(Math.max(1, Math.round(num)));
  }

  if (key === 'textFieldWidth') {
    return String(Math.max(5, Math.round(num)));
  }

  if (key === 'gap' || key === 'resolution' || key === 'selectedIndex') {
    return String(Math.max(0, num));
  }

  if (POSITIVE_INT_PROPS.has(key)) {
    return String(Math.max(1, Math.round(num)));
  }

  if (key in INT_CLAMP_PROPS) {
    const [lo, hi] = INT_CLAMP_PROPS[key];
    return String(Math.max(lo, Math.min(hi, Math.round(num))));
  }

  if (key === 'minimum') {
    const max = typeof widget.maximum === 'number' ? widget.maximum : null;
    if (max != null && num >= max) return null;
    return proposed;
  }
  if (key === 'maximum') {
    const min = typeof widget.minimum === 'number' ? widget.minimum : null;
    if (min != null && num <= min) return null;
    return proposed;
  }
  if (key === 'XMin') {
    const xMaxValue = getDisplayPropertyValue(widget, 'XMax');
    const xMax = typeof xMaxValue === 'number' ? xMaxValue : null;
    if (xMax != null && num >= xMax) return null;
    return proposed;
  }
  if (key === 'XMax') {
    const xMinValue = getDisplayPropertyValue(widget, 'XMin');
    const xMin = typeof xMinValue === 'number' ? xMinValue : null;
    if (xMin != null && num <= xMin) return null;
    return proposed;
  }
  if (key === 'YMin') {
    const yMaxValue = getDisplayPropertyValue(widget, 'YMax');
    const yMax = typeof yMaxValue === 'number' ? yMaxValue : null;
    if (yMax != null && num >= yMax) return null;
    return proposed;
  }
  if (key === 'YMax') {
    const yMinValue = getDisplayPropertyValue(widget, 'YMin');
    const yMin = typeof yMinValue === 'number' ? yMinValue : null;
    if (yMin != null && num <= yMin) return null;
    return proposed;
  }

  return proposed;
}

const STYLE_NAMES: Record<number, string> = { 0: 'Plain', 1: 'Bold', 2: 'Italic', 3: 'Bold Italic' };

function fontSummary(font: FontChoice): string {
  const styleName = STYLE_NAMES[font.style] ?? 'Plain';
  return `${font.name} ${font.size} ${styleName}`;
}

function formatLabel(key: string): string {
  if (key === 'objectName') return 'Object Name';
  if (key === 'groupName') return 'Group Name';
  if (key === 'textFieldWidth') return 'Field Width';
  if (key === 'sliderWidth') return 'Slider Width';
  if (key === 'sliderHeight') return 'Slider Height';
  if (key === 'knobWidth') return 'Knob Width';
  if (key === 'canvasWidth') return 'Canvas Width';
  if (key === 'canvasHeight') return 'Canvas Height';
  if (key === 'numberOfSliders') return 'Num Sliders';
  if (key === 'selectedIndex') return 'Selected Index';
  if (key === 'fontSize') return 'Font Size';
  if (key === 'valueDisplayEnabled') return 'Value Display';
  if (key === 'automationAllowed') return 'Automation';
  if (key === 'stringChannelEnabled') return 'String Channel';
  if (key === 'leadingZero') return 'Leading Zero';
  if (key === 'relativeXValues') return 'Relative X';
  if (key === 'separatorType') return 'Separator';
  if (key === 'defaultValue') return 'Default';
  if (key === 'fileName') return 'File Name';
  if (key === 'titleEnabled') return 'Title Enabled';
  if (key === 'labelEnabled') return 'Label Enabled';
  if (key.startsWith('font.')) return 'Font ' + key.split('.')[1];
  if (key.startsWith('labelFont.')) return 'Label Font ' + key.split('.')[1];
  const result = key.replace(/([A-Z])/g, ' $1');
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function DropdownItemsEditor({
  items,
  onUpdate,
}: {
  items: Array<DropdownItemEditor>;
  onUpdate: (items: Array<DropdownItemEditor>) => void;
}): React.ReactElement | null {
  const safeItems = Array.isArray(items) ? items : [];
  const normalizedItems = useMemo(() => safeItems.map(normalizeDropdownItem), [safeItems]);
  const needsNormalization = normalizedItems.some((item, index) => item.uniqueId !== safeItems[index]?.uniqueId);

  useEffect(() => {
    if (Array.isArray(items) && needsNormalization) {
      onUpdate(normalizedItems);
    }
  }, [items, needsNormalization, normalizedItems, onUpdate]);

  if (!Array.isArray(items)) return null;

  return (
    <div className="mt-2 border-t border-app-border pt-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-role-headline font-bold uppercase tracking-[0.16em] text-app-text-muted">Dropdown Items</span>
        <button
          className="rounded bg-app-accent px-2 py-0.5 text-role-callout text-app-text-strong hover:bg-app-accent-hover"
          onClick={() => onUpdate([...normalizedItems, createDropdownItem('New Item', String(normalizedItems.length))])}
        >
          + Add
        </button>
      </div>
      {normalizedItems.map((item, i) => (
        <div key={item.uniqueId ?? i} className="mb-1 grid grid-cols-[1fr_1fr_auto] items-center gap-1">
          <input
            className="w-full rounded border border-app-border bg-app-surface-raised px-1 py-0.5 text-role-body text-app-text-strong outline-none focus:border-app-accent"
            value={item.name}
            placeholder="Name"
            onChange={(e) => {
              const next = normalizedItems.map(cloneDropdownItem);
              next[i] = { ...next[i], name: e.target.value };
              onUpdate(next);
            }}
          />
          <input
            className="w-full rounded border border-app-border bg-app-surface-raised px-1 py-0.5 text-role-body text-app-text-strong outline-none focus:border-app-accent"
            value={item.value}
            placeholder="Value"
            onChange={(e) => {
              const next = normalizedItems.map(cloneDropdownItem);
              next[i] = { ...next[i], value: e.target.value };
              onUpdate(next);
            }}
          />
          <span className="flex gap-0.5">
            <button
              className="p-0.5 text-role-callout text-app-text-muted hover:text-app-text-strong"
              onClick={() => {
                if (i === 0) return;
                const next = normalizedItems.map(cloneDropdownItem);
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                onUpdate(next);
              }}
              title="Move up"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              className="p-0.5 text-role-callout text-app-text-muted hover:text-app-text-strong"
              onClick={() => {
                if (i >= normalizedItems.length - 1) return;
                const next = normalizedItems.map(cloneDropdownItem);
                [next[i], next[i + 1]] = [next[i + 1], next[i]];
                onUpdate(next);
              }}
              title="Move down"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
            <button
              className="p-0.5 text-role-callout text-app-danger hover:opacity-80"
              onClick={() => onUpdate(normalizedItems.filter((_, idx) => idx !== i).map(cloneDropdownItem))}
              title="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function LineObjectEditor({
  lines,
  onUpdate,
}: {
  lines: Array<LineEditorItem>;
  onUpdate: (lines: Array<LineEditorItem>) => void;
}): React.ReactElement | null {
  const safeLines = Array.isArray(lines) ? lines : [];
  const normalizedLines = useMemo(() => normalizeLineItems(safeLines), [safeLines]);
  const updateLine = (index: number, patch: Partial<LineEditorItem>) => {
    const next = normalizedLines.map(cloneLineItem);
    const current = next[index];
    if (!current) return;

    const nextLine = {
      ...current,
      ...patch,
      points: patch.points
        ? patch.points.map((point) => ({ ...point }))
        : current.points.map((point) => ({ ...point })),
    };

    if (patch.varName !== undefined && !isLineNameAvailable(next, index, patch.varName)) {
      return;
    }

    if (patch.endPointsLinked === true && nextLine.points.length >= 2) {
      const first = nextLine.points[0]!;
      const last = nextLine.points[nextLine.points.length - 1]!;
      nextLine.points[nextLine.points.length - 1] = { ...last, y: first.y };
    }

    next[index] = nextLine;
    onUpdate(next);
  };

  useEffect(() => {
    const needsNormalization = normalizedLines.some((line, index) => !lineValuesEqual(line, safeLines[index]));
    if (Array.isArray(lines) && needsNormalization) {
      onUpdate(normalizedLines);
    }
  }, [lines, normalizedLines, onUpdate, safeLines]);

  if (!Array.isArray(lines)) return null;

  return (
    <div className="mt-2 border-t border-app-border pt-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-role-headline font-bold uppercase tracking-[0.16em] text-app-text-muted">Lines</span>
        <button
          className="rounded bg-app-accent px-2 py-0.5 text-role-callout text-app-text-strong hover:bg-app-accent-hover"
          onClick={() => onUpdate([...normalizedLines, createLineItem(normalizedLines)])}
        >
          + Add
        </button>
      </div>
      <div className="overflow-x-auto rounded border border-app-border/50 bg-app-bg">
        <div className="grid min-w-[376px] grid-cols-[36px_minmax(82px,1fr)_64px_64px_88px_42px] items-center border-b border-app-border/60 bg-app-menu text-role-headline font-bold text-app-text-soft">
          <div className="px-1 py-1 text-center">[x]</div>
          <div className="px-1 py-1">Line Name</div>
          <div className="px-1 py-1">Min</div>
          <div className="px-1 py-1">Max</div>
          <div className="px-1 py-1 text-center">Link First/Last</div>
          <div className="px-1 py-1" />
        </div>
        {normalizedLines.map((line, i) => (
          <div key={`line-${i}`} className="grid min-w-[376px] grid-cols-[36px_minmax(82px,1fr)_64px_64px_88px_42px] items-center border-b border-app-border/30 text-role-body last:border-b-0">
            <label className="flex h-full min-h-8 items-center justify-center border-r border-app-border/30">
              <span className="sr-only">Color</span>
              <ColorPickerButton
                className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0"
                value={normalizeColorInput(line.color)}
                onChange={(value) => updateLine(i, { color: value })}
                title="Line color"
                ariaLabel={`BSB line ${i + 1} color`}
              />
            </label>
            <input
              className="h-8 w-full border-0 border-r border-app-border/30 bg-transparent px-1 text-role-body text-app-text-strong outline-none focus:bg-app-surface-raised focus:ring-1 focus:ring-app-accent"
              value={line.varName}
              placeholder={`line${i}`}
              onChange={(event) => updateLine(i, { varName: event.target.value })}
            />
            <input
              className="h-8 w-full border-0 border-r border-app-border/30 bg-transparent px-1 text-right text-role-body text-app-text-strong outline-none focus:bg-app-surface-raised focus:ring-1 focus:ring-app-accent"
              type="number"
              step="any"
              value={line.min}
              onChange={(event) => updateLine(i, { min: parseFloatField(event.target.value, line.min) })}
            />
            <input
              className="h-8 w-full border-0 border-r border-app-border/30 bg-transparent px-1 text-right text-role-body text-app-text-strong outline-none focus:bg-app-surface-raised focus:ring-1 focus:ring-app-accent"
              type="number"
              step="any"
              value={line.max}
              onChange={(event) => updateLine(i, { max: parseFloatField(event.target.value, line.max) })}
            />
            <label className="flex h-8 items-center justify-center border-r border-app-border/30">
              <span className="sr-only">Link First/Last</span>
              <input
                type="checkbox"
                className="accent-app-accent"
                checked={line.endPointsLinked === true}
                onChange={(event) => updateLine(i, { endPointsLinked: event.target.checked })}
              />
            </label>
            <div className="flex h-8 items-center justify-center gap-0.5">
              <button
                className="p-0.5 text-role-callout text-app-text-muted hover:text-app-text-strong"
                onClick={() => {
                  if (i === 0) return;
                  const next = normalizedLines.map(cloneLineItem);
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  onUpdate(next);
                }}
                title="Move up"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                className="p-0.5 text-role-callout text-app-text-muted hover:text-app-text-strong"
                onClick={() => {
                  if (i >= normalizedLines.length - 1) return;
                  const next = normalizedLines.map(cloneLineItem);
                  [next[i], next[i + 1]] = [next[i + 1], next[i]];
                  onUpdate(next);
                }}
                title="Move down"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
              <button
                className="p-0.5 text-role-callout text-app-danger hover:opacity-80"
                onClick={() => onUpdate(normalizedLines.filter((_, idx) => idx !== i).map(cloneLineItem))}
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function normalizeDropdownItem(item: DropdownItemEditor): DropdownItemEditor {
  return {
    name: typeof item.name === 'string' ? item.name : '',
    value: typeof item.value === 'string' ? item.value : '',
    uniqueId: typeof item.uniqueId === 'string' && item.uniqueId.length > 0
      ? item.uniqueId
      : createDropdownUniqueId(),
  };
}

function createDropdownItem(name: string, value: string): DropdownItemEditor {
  return {
    name,
    value,
    uniqueId: createDropdownUniqueId(),
  };
}

function cloneDropdownItem(item: DropdownItemEditor): DropdownItemEditor {
  return { ...normalizeDropdownItem(item) };
}

function createDropdownUniqueId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `dropdown-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeLineItems(items: Array<LineEditorItem>): Array<LineEditorItem> {
  const usedNames = new Set<string>();
  return items.map((item, index) => {
    const normalized = normalizeLineItem(item, index, usedNames);
    if (normalized.varName) {
      usedNames.add(normalized.varName);
    }
    return normalized;
  });
}

function normalizeLineItem(item: LineEditorItem, index = 0, usedNames = new Set<string>()): LineEditorItem {
  const points = Array.isArray(item.points) && item.points.length > 0
    ? item.points.map((point) => ({
        x: typeof point?.x === 'number' ? point.x : 0,
        y: typeof point?.y === 'number' ? point.y : 0,
      }))
    : createLineItem([], index).points;

  const rawName = typeof item.varName === 'string'
    ? item.varName
    : typeof item.name === 'string'
      ? item.name
      : '';
  const varName = rawName.trim().length > 0
    ? rawName
    : createUniqueLineNameFromNames(usedNames, index);

  return {
    varName,
    min: typeof item.min === 'number' && Number.isFinite(item.min) ? item.min : 0,
    max: typeof item.max === 'number' && Number.isFinite(item.max) ? item.max : 1,
    color: normalizeColorInput(item.color, getLinePaletteColor(index)),
    resolution: typeof item.resolution === 'string' ? item.resolution : undefined,
    rightBound: typeof item.rightBound === 'boolean' ? item.rightBound : true,
    endPointsLinked: item.endPointsLinked === true,
    points,
  };
}

function createLineItem(existingLines: Array<LineEditorItem> = [], colorIndex = existingLines.length): LineEditorItem {
  return {
    varName: createUniqueLineName(existingLines),
    min: 0,
    max: 1,
    color: getLinePaletteColor(colorIndex),
    rightBound: true,
    endPointsLinked: false,
    points: [
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 },
    ],
  };
}

function cloneLineItem(item: LineEditorItem): LineEditorItem {
  const normalized = normalizeLineItem(item);
  return {
    ...normalized,
    points: normalized.points.map((point) => ({ ...point })),
  };
}

function lineValuesEqual(a: LineEditorItem, b: LineEditorItem | undefined): boolean {
  if (!b) return false;
  return a.varName === b.varName
    && a.min === b.min
    && a.max === b.max
    && a.color === b.color
    && a.resolution === b.resolution
    && a.rightBound === b.rightBound
    && a.endPointsLinked === b.endPointsLinked
    && a.points.length === (b.points?.length ?? 0)
    && a.points.every((point, index) => point.x === b.points?.[index]?.x && point.y === b.points?.[index]?.y);
}

function parseFloatField(value: string, fallback?: number): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : (fallback ?? 0);
}

function getLinePaletteColor(index: number): string {
  return LINE_PALETTE[((index % LINE_PALETTE.length) + LINE_PALETTE.length) % LINE_PALETTE.length]!;
}

function createUniqueLineName(lines: Array<LineEditorItem>): string {
  const usedNames = new Set(
    lines
      .map((line) => typeof line.varName === 'string' ? line.varName : typeof line.name === 'string' ? line.name : '')
      .filter((name) => name.length > 0),
  );
  return createUniqueLineNameFromNames(usedNames, lines.length);
}

function createUniqueLineNameFromNames(usedNames: Set<string>, fallbackIndex: number): string {
  for (let index = 0; index < fallbackIndex; index++) {
    const candidate = `line${index}`;
    if (!usedNames.has(candidate)) {
      return candidate;
    }
  }
  let nextIndex = fallbackIndex;
  while (usedNames.has(`line${nextIndex}`)) {
    nextIndex += 1;
  }
  return `line${nextIndex}`;
}

function isLineNameAvailable(lines: Array<LineEditorItem>, currentIndex: number, proposedName: string): boolean {
  return lines.every((line, index) => index === currentIndex || line.varName !== proposedName);
}

function normalizeColorInput(color: string | number | undefined, fallback = '#808080'): string {
  if (typeof color === 'number' && Number.isFinite(color)) {
    const rgb = (color >>> 0) & 0x00ffffff;
    return `#${rgb.toString(16).padStart(6, '0')}`;
  }
  if (typeof color !== 'string') {
    return fallback;
  }
  const trimmed = color.trim();
  if (/^-?\d+$/.test(trimmed)) {
    const rgb = (parseInt(trimmed, 10) >>> 0) & 0x00ffffff;
    return `#${rgb.toString(16).padStart(6, '0')}`;
  }
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return fallback;
}
