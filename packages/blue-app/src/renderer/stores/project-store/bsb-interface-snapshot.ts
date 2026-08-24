import {
  collectBsbReplacementKeysFromSnapshotTree,
  createDefaultBsbWidgetSnapshot,
  ensureUniqueName,
  type BsbInterfacePatch,
  type BsbWidgetNodeSnapshot,
  type BlueSynthBuilderInstrumentSnapshot,
  type PresetGroupSnapshot,
  type PresetSnapshot,
} from '../../../shared/project-editor';
import {
  BSB_LINE_SELECTOR_HEIGHT,
  getBsbWidgetDisplaySize,
  getHSliderBankDisplaySize,
  getVSliderBankDisplaySize,
} from '../../../shared/bsb-widget-layout';
import {
  EMPTY_UDO_SNAPSHOT,
  cloneUdoSnapshot,
  convertUdoSnapshotStyle,
  formatUdoListAsOpcodeText,
} from '../../components/workbench/panels/udo/udo-snapshot-utils';

function cloneSnapshotValue<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneSnapshotValue(item)) as T;
  }

  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    next[key] = cloneSnapshotValue(item);
  }
  return next as T;
}
function clonePresetGroupSnapshot(
  group: PresetGroupSnapshot,
): PresetGroupSnapshot {
  return {
    ...group,
    subGroups: group.subGroups.map((subGroup) => clonePresetGroupSnapshot(subGroup)),
    presets: group.presets.map((preset) => ({
      ...preset,
      values: preset.values ? { ...preset.values } : undefined,
    })),
  };
}

export function applyBsbInterfacePatchToSnapshot(
  instrument: BlueSynthBuilderInstrumentSnapshot,
  patch: BsbInterfacePatch,
): void {
  const getSnapshotWidgetValue = (node: BsbWidgetNodeSnapshot): number => {
    if (node.type === 'BSBValue' && typeof node.properties.defaultValue === 'number') {
      return node.properties.defaultValue;
    }
    if (node.type === 'BSBCheckBox') {
      return node.properties.selected === true ? 1 : 0;
    }
    if (node.type === 'BSBDropdown' && typeof node.properties.selectedIndex === 'number') {
      return node.properties.selectedIndex;
    }
    return typeof node.value === 'number' ? node.value : 0;
  };

  const clampToRange = (value: number, minimum: number, maximum: number): number => (
    Math.min(maximum, Math.max(minimum, value))
  );

  const snapToResolution = (value: number, minimum: number, maximum: number, resolution: number): number => {
    if (!Number.isFinite(resolution) || resolution <= 0) {
      return clampToRange(value, minimum, maximum);
    }

    const snapped = minimum + (Math.round((value - minimum) / resolution) * resolution);
    return clampToRange(snapped, minimum, maximum);
  };

  const rescaleValue = (
    value: number,
    oldMinimum: number,
    oldMaximum: number,
    newMinimum: number,
    newMaximum: number,
    resolution: number,
  ): number => {
    if (oldMaximum === oldMinimum) {
      return snapToResolution(newMinimum, newMinimum, newMaximum, resolution);
    }

    const normalized = (value - oldMinimum) / (oldMaximum - oldMinimum);
    const nextValue = newMinimum + (normalized * (newMaximum - newMinimum));
    return snapToResolution(nextValue, newMinimum, newMaximum, resolution);
  };

  const getNodeResolution = (node: BsbWidgetNodeSnapshot): number => (
    typeof node.properties.resolution === 'number' ? node.properties.resolution : -1
  );

  const rescaleNodeMinimum = (node: BsbWidgetNodeSnapshot, newMinimum: number): void => {
    const oldMinimum = node.minimum;
    const oldMaximum = node.maximum;

    if (node.type === 'BSBHSliderBank' || node.type === 'BSBVSliderBank') {
      const sliders = Array.isArray(node.properties.sliders)
        ? node.properties.sliders as Array<{ value?: number }>
        : [];
      node.minimum = newMinimum;
      node.properties.minimum = newMinimum;
      node.properties.sliders = sliders.map((slider) => ({
        ...slider,
        value: rescaleValue(
          typeof slider.value === 'number' ? slider.value : oldMinimum,
          oldMinimum,
          oldMaximum,
          newMinimum,
          oldMaximum,
          getNodeResolution(node),
        ),
      }));
      return;
    }

    node.minimum = newMinimum;
    node.properties.minimum = newMinimum;
    node.value = rescaleValue(node.value, oldMinimum, oldMaximum, newMinimum, oldMaximum, getNodeResolution(node));
    if (node.type === 'BSBValue') {
      node.properties.defaultValue = node.value;
    }
  };

  const rescaleNodeMaximum = (node: BsbWidgetNodeSnapshot, newMaximum: number): void => {
    const oldMinimum = node.minimum;
    const oldMaximum = node.maximum;

    if (node.type === 'BSBHSliderBank' || node.type === 'BSBVSliderBank') {
      const sliders = Array.isArray(node.properties.sliders)
        ? node.properties.sliders as Array<{ value?: number }>
        : [];
      node.maximum = newMaximum;
      node.properties.maximum = newMaximum;
      node.properties.sliders = sliders.map((slider) => ({
        ...slider,
        value: rescaleValue(
          typeof slider.value === 'number' ? slider.value : oldMinimum,
          oldMinimum,
          oldMaximum,
          oldMinimum,
          newMaximum,
          getNodeResolution(node),
        ),
      }));
      return;
    }

    node.maximum = newMaximum;
    node.properties.maximum = newMaximum;
    node.value = rescaleValue(node.value, oldMinimum, oldMaximum, oldMinimum, newMaximum, getNodeResolution(node));
    if (node.type === 'BSBValue') {
      node.properties.defaultValue = node.value;
    }
  };

  const syncWidgetListFromTree = (): void => {
    if (!instrument.widgetTree?.children) {
      instrument.widgets = [];
      return;
    }

    const nextWidgets: typeof instrument.widgets = [];
    const visit = (node: BsbWidgetNodeSnapshot): void => {
      if (node.objectName) {
        nextWidgets.push({
          objectName: node.objectName,
          widgetType: node.type,
          value: getSnapshotWidgetValue(node),
          minimum: node.minimum,
          maximum: node.maximum,
        });
      }
      if (node.children) {
        node.children.forEach(visit);
      }
    };

    instrument.widgetTree.children.forEach(visit);
    instrument.widgets = nextWidgets.sort((left, right) => left.objectName.localeCompare(right.objectName));
  };

  const syncSliderBankLayout = (node: BsbWidgetNodeSnapshot): void => {
    const sliderCount = Array.isArray(node.properties.sliders)
      ? Math.max(1, node.properties.sliders.length)
      : typeof node.properties.numberOfSliders === 'number'
        ? Math.max(1, node.properties.numberOfSliders)
        : 1;
    const gap = typeof node.properties.gap === 'number' ? node.properties.gap : 5;
    const showValue = node.properties.valueDisplayEnabled === true;

    if (node.type === 'BSBHSliderBank') {
      const sliderWidth = typeof node.properties.sliderWidth === 'number' ? node.properties.sliderWidth : 150;
      const size = getHSliderBankDisplaySize(sliderCount, sliderWidth, gap, showValue);
      node.width = size.width;
      node.height = size.height;
    } else if (node.type === 'BSBVSliderBank') {
      const sliderHeight = typeof node.properties.sliderHeight === 'number' ? node.properties.sliderHeight : 150;
      const size = getVSliderBankDisplaySize(sliderCount, sliderHeight, gap, showValue);
      node.width = size.width;
      node.height = size.height;
    }
  };

  const parsePresetNumber = (raw: string): number | null => {
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parseLegacyPresetNumber = (raw: string): number | null => {
    return parsePresetNumber(raw.startsWith('ver2:') ? raw.substring(5) : raw);
  };

  const applyLineObjectPreset = (
    node: BsbWidgetNodeSnapshot,
    raw: string,
  ): void => {
    const existingLines = Array.isArray(node.properties.lines)
      ? (node.properties.lines as Array<{
          varName?: string;
          min?: number;
          max?: number;
          color?: string;
          points?: Array<{ x: number; y: number }>;
        }>).map((line) => ({
          ...line,
          points: Array.isArray(line.points) ? line.points.map((point) => ({ ...point })) : [],
        }))
      : [];

    const parts = raw.split('@_@');
    let version = 1;
    let startIndex = 0;
    if (parts[0]?.startsWith('version=')) {
      version = parseInt(parts[0].substring(8), 10) || 1;
      startIndex = 1;
    }

    for (let index = startIndex; index < parts.length; index++) {
      const values = parts[index].split(':');
      const lineName = values[0];
      const lineIndex = existingLines.findIndex((candidate) => candidate.varName === lineName);
      if (lineIndex < 0) continue;

      const line = existingLines[lineIndex]!;
      const min = typeof line.min === 'number' ? line.min : 0;
      const max = typeof line.max === 'number' ? line.max : 1;
      const range = max - min;
      const points: Array<{ x: number; y: number }> = [];

      for (let valueIndex = 1; valueIndex < values.length; valueIndex += 2) {
        const nextX = parseFloat(values[valueIndex]);
        const nextY = parseFloat(values[valueIndex + 1]);
        if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) continue;

        points.push({
          x: nextX,
          y: version === 1 ? (nextY * range) + min : nextY,
        });
      }

      existingLines[lineIndex] = { ...line, points };
    }

    node.properties = { ...node.properties, lines: existingLines };
  };

  const applyPresetValueToNode = (
    node: BsbWidgetNodeSnapshot,
    raw: string,
  ): void => {
    if (node.type === 'BSBHSliderBank' || node.type === 'BSBVSliderBank') {
      const sliderValues = raw.split(':');
      const sliderCount = typeof node.properties.numberOfSliders === 'number'
        ? Math.max(1, node.properties.numberOfSliders)
        : Array.isArray(node.properties.sliders)
          ? Math.max(1, node.properties.sliders.length)
          : 1;
      const existingSliders = Array.isArray(node.properties.sliders)
        ? (node.properties.sliders as Array<{ value?: number }>).map((slider) => ({ ...slider }))
        : Array.from({ length: sliderCount }, () => ({ value: node.minimum ?? 0 }));
      const nextSliders = existingSliders.slice(0, sliderCount);

      for (let index = 0; index < Math.min(nextSliders.length, sliderValues.length); index++) {
        const parsed = parsePresetNumber(sliderValues[index]);
        if (parsed === null) continue;
        nextSliders[index] = { ...nextSliders[index], value: parsed };
      }

      node.properties = { ...node.properties, sliders: nextSliders };
      return;
    }

    if (node.type === 'BSBCheckBox') {
      const selected = raw.startsWith('ver2:')
        ? (parseLegacyPresetNumber(raw) ?? 0) > 0
        : raw.toLowerCase() === 'true';
      node.properties = { ...node.properties, selected };
      node.value = selected ? 1 : 0;
      return;
    }

    if (node.type === 'BSBDropdown') {
      let selectedIndex: number | null = null;
      if (raw.startsWith('id:')) {
        const uniqueId = raw.substring(3);
        const items = Array.isArray(node.properties.dropdownItems)
          ? node.properties.dropdownItems as Array<{ uniqueId?: string }>
          : [];
        const index = items.findIndex((item) => item?.uniqueId === uniqueId);
        selectedIndex = index >= 0 ? index : null;
      } else {
        selectedIndex = parseLegacyPresetNumber(raw);
      }

      if (selectedIndex !== null) {
        node.properties = { ...node.properties, selectedIndex };
        node.value = selectedIndex;
      }
      return;
    }

    if (node.type === 'BSBTextField') {
      node.properties = { ...node.properties, textValue: raw };
      return;
    }

    if (node.type === 'BSBValue') {
      const parsed = parseLegacyPresetNumber(raw);
      if (parsed !== null) {
        node.properties = { ...node.properties, defaultValue: parsed };
        node.value = parsed;
      }
      return;
    }

    if (node.type === 'BSBXYController') {
      const parts = raw.split(':');
      let nextX = Number.NaN;
      let nextY = Number.NaN;

      const xMin = typeof node.properties.xMin === 'number' ? node.properties.xMin : 0;
      const xMax = typeof node.properties.xMax === 'number' ? node.properties.xMax : 1;
      const yMin = typeof node.properties.yMin === 'number' ? node.properties.yMin : 0;
      const yMax = typeof node.properties.yMax === 'number' ? node.properties.yMax : 1;

      if (parts.length === 2) {
        const relativeX = parsePresetNumber(parts[0]);
        const relativeY = parsePresetNumber(parts[1]);
        if (relativeX !== null && relativeY !== null) {
          nextX = (relativeX * (xMax - xMin)) + xMin;
          nextY = (relativeY * (yMax - yMin)) + yMin;
        }
      } else if (parts.length >= 3) {
        nextX = parseFloat(parts[1]);
        nextY = parseFloat(parts[2]);
      }

      if (Number.isFinite(nextX) && Number.isFinite(nextY)) {
        node.properties = { ...node.properties, xValue: nextX, yValue: nextY };
      }
      return;
    }

    if (node.type === 'BSBFileSelector') {
      node.properties = { ...node.properties, fileName: raw };
      return;
    }

    if (node.type === 'BSBSubChannelDropdown') {
      node.properties = { ...node.properties, channelOutput: raw };
      return;
    }

    if (node.type === 'BSBLineObject') {
      applyLineObjectPreset(node, raw);
      return;
    }

    if (node.type === 'BSBKnob') {
      if (raw.indexOf(':') < 0) {
        const relative = parsePresetNumber(raw);
        if (relative !== null) {
          node.value = (relative * (node.maximum - node.minimum)) + node.minimum;
        }
      } else {
        const parsed = parsePresetNumber(raw.substring(raw.indexOf(':') + 1));
        if (parsed !== null) {
          node.value = parsed;
        }
      }
      return;
    }

    const parsed = parseLegacyPresetNumber(raw);
    if (parsed !== null) {
      node.value = parsed;
    }
  };

  const cloneWidgetNode = (node: BsbWidgetNodeSnapshot): BsbWidgetNodeSnapshot => cloneSnapshotValue(node);

  const createPastedWidgetId = (): string => (
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `pasted-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  const normalizePastedWidgetNode = (raw: unknown): BsbWidgetNodeSnapshot | null => {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const record = raw as Record<string, unknown>;
    if (typeof record.type !== 'string') {
      return null;
    }

    const node = cloneSnapshotValue(record) as BsbWidgetNodeSnapshot;
    node.id = createPastedWidgetId();
    node.objectName = typeof node.objectName === 'string' ? node.objectName : '';
    node.x = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : 0;
    node.y = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : 0;
    node.width = typeof node.width === 'number' && Number.isFinite(node.width) ? node.width : 60;
    node.height = typeof node.height === 'number' && Number.isFinite(node.height) ? node.height : 24;
    node.value = typeof node.value === 'number' && Number.isFinite(node.value) ? node.value : 0;
    node.minimum = typeof node.minimum === 'number' && Number.isFinite(node.minimum) ? node.minimum : 0;
    node.maximum = typeof node.maximum === 'number' && Number.isFinite(node.maximum) ? node.maximum : 1;
    node.editable = node.editable !== false;
    node.properties = node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
      ? cloneSnapshotValue(node.properties)
      : {};

    if (Array.isArray(record.children)) {
      node.children = record.children
        .map((child) => normalizePastedWidgetNode(child))
        .filter((child): child is BsbWidgetNodeSnapshot => child !== null);
    }

    return node;
  };

  const syncWidgetTreeLayout = (
    previousNode: BsbWidgetNodeSnapshot | undefined,
    nextNode: BsbWidgetNodeSnapshot,
  ): BsbWidgetNodeSnapshot => {
    if (previousNode === nextNode) {
      return nextNode;
    }

    let nextLayoutNode = nextNode;

    if (nextNode.children && nextNode.children.length > 0) {
      const previousChildren = previousNode?.children ?? [];
      const nextChildren = nextNode.children.map((child, index) =>
        syncWidgetTreeLayout(previousChildren[index], child));
      const childrenChanged = nextChildren.some((child, index) => child !== nextNode.children?.[index]);
      if (childrenChanged) {
        nextLayoutNode = cloneWidgetNode(nextNode);
        nextLayoutNode.children = nextChildren;
      }
    }

    if (nextLayoutNode.type !== 'BSBRootGroup' && nextLayoutNode.type !== 'BSBGroup') {
      const size = getBsbWidgetDisplaySize(nextLayoutNode);
      if (nextLayoutNode.width !== size.width || nextLayoutNode.height !== size.height) {
        if (nextLayoutNode === nextNode) {
          nextLayoutNode = { ...nextNode };
        }
        nextLayoutNode.width = size.width;
        nextLayoutNode.height = size.height;
      }
    }

    return nextLayoutNode;
  };

  const rebuildWidgetIndexes = (): void => {
    if (!instrument.widgetTree?.children) {
      instrument.objectNames = [];
      instrument.widgets = [];
      return;
    }

    instrument.objectNames = collectObjectNamesFromTree(instrument.widgetTree);
    syncWidgetListFromTree();
  };

  const commitWidgetTreeMutation = (
    previousNode: BsbWidgetNodeSnapshot | undefined,
    nextNode: BsbWidgetNodeSnapshot,
  ): void => {
    instrument.widgetTree = syncWidgetTreeLayout(previousNode, nextNode);
    rebuildWidgetIndexes();
  };

  const updateWidgetTreeById = (
    node: BsbWidgetNodeSnapshot,
    widgetId: string,
    updater: (
      nextNode: BsbWidgetNodeSnapshot,
    ) => boolean,
  ): {
    node: BsbWidgetNodeSnapshot;
    changed: boolean;
  } => {
    if (node.id === widgetId) {
      const nextNode = cloneWidgetNode(node);
      return updater(nextNode)
        ? { node: nextNode, changed: true }
        : { node, changed: false };
    }

    if (!node.children) {
      return { node, changed: false };
    }

    let changed = false;
    const nextChildren = node.children.map((child) => {
      const result = updateWidgetTreeById(child, widgetId, updater);
      if (result.changed) {
        changed = true;
      }
      return result.node;
    });

    if (!changed) {
      return { node, changed: false };
    }

    const nextNode = cloneWidgetNode(node);
    nextNode.children = nextChildren;
    return { node: nextNode, changed: true };
  };

  const removeWidgetFromTree = (
    node: BsbWidgetNodeSnapshot,
    widgetId: string,
  ): {
    node: BsbWidgetNodeSnapshot;
    removed: boolean;
  } => {
    if (!node.children || node.children.length === 0) {
      return { node, removed: false };
    }

    const directIndex = node.children.findIndex((child) => child.id === widgetId);
    if (directIndex >= 0) {
      const nextNode = cloneWidgetNode(node);
      const nextChildren = node.children.slice();
      nextChildren.splice(directIndex, 1);
      nextNode.children = nextChildren;
      return { node: nextNode, removed: true };
    }

    let removed = false;
    const nextChildren = node.children.map((child) => {
      const result = removeWidgetFromTree(child, widgetId);
      if (result.removed) {
        removed = true;
      }
      return result.node;
    });

    if (!removed) {
      return { node, removed: false };
    }

    const nextNode = cloneWidgetNode(node);
    nextNode.children = nextChildren;
    return { node: nextNode, removed: true };
  };

  const applyPresetToTree = (
    node: BsbWidgetNodeSnapshot,
    valuesMap: Record<string, string>,
  ): {
    node: BsbWidgetNodeSnapshot;
    changed: boolean;
  } => {
    let nextNode = node;
    let changed = false;

    if (node.objectName && Object.prototype.hasOwnProperty.call(valuesMap, node.objectName)) {
      const raw = valuesMap[node.objectName];
      if (raw !== undefined) {
        nextNode = cloneWidgetNode(node);
        applyPresetValueToNode(nextNode, raw);
        changed = true;
      }
    }

    if (node.children) {
      let childrenChanged = false;
      const nextChildren = node.children.map((child) => {
        const result = applyPresetToTree(child, valuesMap);
        if (result.changed) {
          childrenChanged = true;
        }
        return result.node;
      });

      if (childrenChanged) {
        if (!changed) {
          nextNode = cloneWidgetNode(node);
          changed = true;
        }
        nextNode.children = nextChildren;
      }
    }

    return { node: nextNode, changed };
  };

  switch (patch.type) {
    case 'setEditEnabled':
      instrument.editEnabled = patch.value;
      break;
    case 'selectWidget':
      break;
    case 'updateWidgetProperties': {
      if (!instrument.widgetTree) break;
      const result = updateWidgetTreeById(instrument.widgetTree, patch.widgetId, (node) => {
        for (const [key, value] of Object.entries(patch.properties)) {
          switch (key) {
            case 'objectName': node.objectName = value as string; break;
            case 'x': node.x = value as number; break;
            case 'y': node.y = value as number; break;
            case 'width': node.width = value as number; break;
            case 'height': node.height = value as number; break;
            case 'value': node.value = value as number; break;
            case 'resolution':
              // Preserve the exact decimal text in the optimistic snapshot;
              // the numeric projection is display/layout-only.
              if (typeof value === 'string') {
                node.properties.resolutionDecimal = value;
                const numeric = Number(value);
                if (Number.isFinite(numeric)) {
                  node.properties.resolution = numeric;
                }
              } else if (typeof value === 'number') {
                node.properties.resolution = value;
              }
              break;
            case 'defaultValue':
              node.properties.defaultValue = value as number;
              if (node.type === 'BSBValue') {
                node.value = value as number;
              }
              break;
            case 'minimum':
              rescaleNodeMinimum(node, value as number);
              break;
            case 'maximum':
              rescaleNodeMaximum(node, value as number);
              break;
            case 'selectedIndex':
              node.properties.selectedIndex = value as number;
              node.value = value as number;
              break;
            case 'sliderWidth':
              node.properties.sliderWidth = value as number;
              if (node.type === 'BSBHSliderBank') {
                syncSliderBankLayout(node);
              } else {
                node.width = (value as number) + (node.properties.valueDisplayEnabled ? 50 : 0);
              }
              break;
            case 'sliderHeight':
              node.properties.sliderHeight = value as number;
              if (node.type === 'BSBVSliderBank') {
                syncSliderBankLayout(node);
              } else {
                node.height = (value as number) + (node.properties.valueDisplayEnabled ? 30 : 0);
              }
              break;
            case 'knobWidth':
              node.properties.knobWidth = value as number;
              node.width = value as number;
              break;
            case 'canvasWidth':
              node.properties.canvasWidth = value as number;
              node.width = value as number;
              break;
            case 'canvasHeight':
              node.properties.canvasHeight = value as number;
              node.height = node.type === 'BSBLineObject'
                ? (value as number) + BSB_LINE_SELECTOR_HEIGHT
                : (value as number);
              break;
            case 'textFieldWidth':
              node.properties.textFieldWidth = value as number;
              node.width = node.type === 'BSBFileSelector'
                ? (value as number) + 30
                : (value as number);
              break;
            case 'numberOfSliders': {
              const nextCount = Math.max(1, value as number);
              const previous = Array.isArray(node.properties.sliders)
                ? node.properties.sliders as Array<{ value?: number }>
                : [];
              node.properties.numberOfSliders = nextCount;
              node.properties.sliders = Array.from(
                { length: nextCount },
                (_unused, index) => previous[index] ?? { value: node.minimum ?? 0 },
              );
              syncSliderBankLayout(node);
              break;
            }
            case 'valueDisplayEnabled':
              node.properties.valueDisplayEnabled = value;
              if (node.type === 'BSBHSlider') {
                const sliderWidth = typeof node.properties.sliderWidth === 'number' ? node.properties.sliderWidth : 150;
                node.width = sliderWidth + (value ? 50 : 0);
              } else if (node.type === 'BSBVSlider') {
                const sliderHeight = typeof node.properties.sliderHeight === 'number' ? node.properties.sliderHeight : 150;
                node.height = sliderHeight + (value ? 30 : 0);
              } else if (node.type === 'BSBHSliderBank' || node.type === 'BSBVSliderBank') {
                syncSliderBankLayout(node);
              }
              break;
            case 'gap':
              node.properties.gap = value as number;
              if (node.type === 'BSBHSliderBank' || node.type === 'BSBVSliderBank') {
                syncSliderBankLayout(node);
              }
              break;
            case 'dropdownItems':
              if (Array.isArray(value)) {
                node.properties.dropdownItems = value.map((item) => {
                  const record = item as Record<string, unknown>;
                  return {
                    name: typeof record.name === 'string' ? record.name : '',
                    value: typeof record.value === 'string' ? record.value : '',
                    uniqueId: typeof record.uniqueId === 'string' && record.uniqueId.length > 0
                      ? record.uniqueId
                      : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                          ? `dropdown-${crypto.randomUUID()}`
                          : `dropdown-${Date.now()}-${Math.random().toString(16).slice(2)}`),
                  };
                });
              } else {
                node.properties.dropdownItems = value as unknown;
              }
              break;
            default: node.properties[key] = value; break;
          }
        }
        return true;
      });
      if (result.changed) {
        commitWidgetTreeMutation(instrument.widgetTree, result.node);
      }
      break;
    }
    case 'updateSliderBankValue': {
      if (!instrument.widgetTree) break;
      const result = updateWidgetTreeById(instrument.widgetTree, patch.widgetId, (node) => {
        const sliderCount = typeof node.properties.numberOfSliders === 'number'
          ? Math.max(1, node.properties.numberOfSliders)
          : Array.isArray(node.properties.sliders)
            ? Math.max(1, node.properties.sliders.length)
            : 1;
        const sliders = Array.isArray(node.properties.sliders)
          ? [...(node.properties.sliders as Array<{ value?: number }>)]
          : Array.from({ length: sliderCount }, () => ({ value: node.minimum ?? 0 }));
        if (patch.sliderIndex < 0 || patch.sliderIndex >= sliders.length) {
          return false;
        }
        sliders[patch.sliderIndex] = {
          ...sliders[patch.sliderIndex],
          value: patch.value,
        };
        node.properties.sliders = sliders;
        return true;
      });
      if (result.changed) {
        commitWidgetTreeMutation(instrument.widgetTree, result.node);
      }
      break;
    }
    case 'moveWidget': {
      if (!instrument.widgetTree) break;
      const result = updateWidgetTreeById(instrument.widgetTree, patch.widgetId, (node) => {
        node.x = patch.x;
        node.y = patch.y;
        return true;
      });
      if (result.changed) {
        commitWidgetTreeMutation(instrument.widgetTree, result.node);
      }
      break;
    }
    case 'resizeWidget': {
      if (!instrument.widgetTree) break;
      const result = updateWidgetTreeById(instrument.widgetTree, patch.widgetId, (node) => {
        node.width = patch.width;
        node.height = patch.height;
        return true;
      });
      if (result.changed) {
        commitWidgetTreeMutation(instrument.widgetTree, result.node);
      }
      break;
    }
    case 'updateGridSettings':
      instrument.gridSettings = { ...instrument.gridSettings, ...patch.patch };
      break;
    case 'applyPreset':
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
        instrument.presetGroup.currentPresetUniqueId = patch.presetUniqueId;
        instrument.presetGroup.currentPresetModified = false;
        const preset = findPresetById(instrument.presetGroup, patch.presetUniqueId);
        if (preset?.values && instrument.widgetTree) {
          const result = applyPresetToTree(instrument.widgetTree, preset.values);
          if (result.changed) {
            commitWidgetTreeMutation(instrument.widgetTree, result.node);
          }
        }
      }
      break;
    case 'updatePreset':
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
        instrument.presetGroup.currentPresetModified = false;
      }
      break;
    case 'addPreset':
      // Optimistic update - actual preset creation happens on main process
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
        instrument.presetGroup.currentPresetModified = false;
      }
      break;
    case 'addPresetGroup':
      // Optimistic update - actual group creation happens on main process
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
      }
      break;
    case 'addPresetFromSnapshot':
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
        const targetGroup = getPresetGroupSnapshotAtPath(
          instrument.presetGroup,
          patch.parentGroupPath,
        );
        if (targetGroup) {
          targetGroup.presets.push({
            ...patch.preset,
            values: patch.preset.values ? { ...patch.preset.values } : undefined,
          });
          targetGroup.currentPresetModified = false;
        }
      }
      break;
    case 'addPresetGroupFromSnapshot':
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
        const targetGroup = getPresetGroupSnapshotAtPath(
          instrument.presetGroup,
          patch.parentGroupPath,
        );
        if (targetGroup) {
          targetGroup.subGroups.push(clonePresetGroupSnapshot(patch.group));
        }
      }
      break;
    case 'renamePreset':
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
        const preset = findPresetById(instrument.presetGroup, patch.presetUniqueId);
        if (preset) preset.name = patch.name;
      }
      break;
    case 'renamePresetGroup':
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
        const group = getPresetGroupSnapshotAtPath(instrument.presetGroup, patch.groupPath);
        if (group) group.name = patch.name;
      }
      break;
    case 'removePreset':
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
        const parent = findPresetParentSnapshot(instrument.presetGroup, patch.presetUniqueId);
        const index = parent?.presets.findIndex((preset) => preset.uniqueId === patch.presetUniqueId) ?? -1;
        if (parent && index >= 0) {
          parent.presets.splice(index, 1);
          clearMissingCurrentPresetSnapshot(instrument.presetGroup);
        }
      }
      break;
    case 'removePresetGroup':
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
        removePresetGroupSnapshotAtPath(instrument.presetGroup, patch.groupPath);
      }
      break;
    case 'movePreset':
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
        movePresetSnapshot(
          instrument.presetGroup,
          patch.presetUniqueId,
          patch.parentGroupPath,
          patch.targetIndex,
        );
      }
      break;
    case 'movePresetGroup':
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
        movePresetGroupSnapshot(
          instrument.presetGroup,
          patch.groupPath,
          patch.parentGroupPath,
          patch.targetIndex,
        );
      }
      break;
    case 'synchronizePresets':
      // Optimistic update - actual sync happens on main process
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
      }
      break;
    case 'updateEmbeddedOpcodeList':
      instrument.opcodeListText = patch.opcodeList;
      break;
    case 'addWidget': {
      if (!instrument.widgetTree) break;
      const newNode = createDefaultBsbWidgetSnapshot(patch.widgetType);
      if (!newNode) break;
      newNode.x = patch.x;
      newNode.y = patch.y;
      const targetId = patch.parentGroupId;
      if (targetId) {
        const result = updateWidgetTreeById(instrument.widgetTree, targetId, (node) => {
          if (node.type !== 'BSBGroup') {
            return false;
          }
          node.children = [...(node.children ?? []), cloneWidgetNode(newNode)];
          return true;
        });
        if (result.changed) {
          commitWidgetTreeMutation(instrument.widgetTree, result.node);
        }
      } else {
        const nextRoot = cloneWidgetNode(instrument.widgetTree);
        nextRoot.children = [...(nextRoot.children ?? []), cloneWidgetNode(newNode)];
        commitWidgetTreeMutation(instrument.widgetTree, nextRoot);
      }
      break;
    }
    case 'pasteWidgets': {
      if (!instrument.widgetTree) break;
      let parsed: unknown;
      try {
        parsed = JSON.parse(patch.widgetData);
      } catch {
        break;
      }
      if (!Array.isArray(parsed)) break;

      const pastedNodes = parsed
        .map((node) => normalizePastedWidgetNode(node))
        .filter((node): node is BsbWidgetNodeSnapshot => node !== null);
      if (pastedNodes.length === 0) break;

      const existingNames = new Set(collectObjectNamesFromTree(instrument.widgetTree));
      for (const node of pastedNodes) {
        ensureUniqueName(node, existingNames);
      }

      const targetId = patch.parentGroupId;
      if (targetId) {
        const result = updateWidgetTreeById(instrument.widgetTree, targetId, (node) => {
          if (node.type !== 'BSBGroup') {
            return false;
          }
          node.children = [...(node.children ?? []), ...pastedNodes.map((pasted) => cloneWidgetNode(pasted))];
          return true;
        });
        if (result.changed) {
          commitWidgetTreeMutation(instrument.widgetTree, result.node);
        }
      } else {
        const nextRoot = cloneWidgetNode(instrument.widgetTree);
        nextRoot.children = [...(nextRoot.children ?? []), ...pastedNodes.map((pasted) => cloneWidgetNode(pasted))];
        commitWidgetTreeMutation(instrument.widgetTree, nextRoot);
      }
      break;
    }
    case 'removeWidget': {
      if (!instrument.widgetTree) break;
      const result = removeWidgetFromTree(instrument.widgetTree, patch.widgetId);
      if (result.removed) {
        commitWidgetTreeMutation(instrument.widgetTree, result.node);
      }
      break;
    }
    case 'addUdo': {
      const udolist = instrument.udolist ? [...instrument.udolist] : [];
      const newUdo = patch.definition
        ? cloneUdoSnapshot(patch.definition)
        : cloneUdoSnapshot(EMPTY_UDO_SNAPSHOT);
      if (patch.index !== undefined && patch.index >= 0 && patch.index <= udolist.length) {
        udolist.splice(patch.index, 0, newUdo);
      } else {
        udolist.push(newUdo);
      }
      instrument.udolist = udolist;
      instrument.opcodeListText = formatUdoListAsOpcodeText(udolist);
      break;
    }
    case 'removeUdo': {
      const removeUdolist = instrument.udolist ? [...instrument.udolist] : [];
      if (patch.index >= 0 && patch.index < removeUdolist.length) {
        removeUdolist.splice(patch.index, 1);
      }
      instrument.udolist = removeUdolist;
      instrument.opcodeListText = formatUdoListAsOpcodeText(removeUdolist);
      break;
    }
    case 'updateUdo': {
      const updateUdolist = instrument.udolist
        ? instrument.udolist.map((udo) => cloneUdoSnapshot(udo))
        : [];
      if (patch.index >= 0 && patch.index < updateUdolist.length) {
        updateUdolist[patch.index] = { ...updateUdolist[patch.index], ...patch.patch };
      }
      instrument.udolist = updateUdolist;
      instrument.opcodeListText = formatUdoListAsOpcodeText(updateUdolist);
      break;
    }
    case 'convertUdoStyle': {
      const convertedUdolist = instrument.udolist
        ? instrument.udolist.map((udo) => cloneUdoSnapshot(udo))
        : [];
      if (patch.index >= 0 && patch.index < convertedUdolist.length) {
        convertedUdolist[patch.index] = convertUdoSnapshotStyle(
          convertedUdolist[patch.index]!,
          patch.style,
        );
      }
      instrument.udolist = convertedUdolist;
      instrument.opcodeListText = formatUdoListAsOpcodeText(convertedUdolist);
      break;
    }
    case 'reorderUdo': {
      const reorderUdolist = instrument.udolist ? [...instrument.udolist] : [];
      if (patch.from >= 0 && patch.from < reorderUdolist.length && patch.to >= 0 && patch.to < reorderUdolist.length) {
        const [moved] = reorderUdolist.splice(patch.from, 1);
        reorderUdolist.splice(patch.to, 0, moved);
      }
      instrument.udolist = reorderUdolist;
      instrument.opcodeListText = formatUdoListAsOpcodeText(reorderUdolist);
      break;
    }
    case 'randomize':
      break;
  }
}

function shouldPreserveWidgetMetadataForBsbPatch(patch: BsbInterfacePatch): boolean {
  switch (patch.type) {
    case 'updateWidgetProperties': {
      const properties = patch.properties as Record<string, unknown>;
      return !(
        Object.prototype.hasOwnProperty.call(properties, 'objectName')
        || Object.prototype.hasOwnProperty.call(properties, 'lines')
        || Object.prototype.hasOwnProperty.call(properties, 'numberOfSliders')
        || Object.prototype.hasOwnProperty.call(properties, 'sliders')
      );
    }
    case 'updateSliderBankValue':
    case 'moveWidget':
    case 'resizeWidget':
    case 'setEditEnabled':
    case 'selectWidget':
    case 'updateGridSettings':
    case 'applyPreset':
    case 'updatePreset':
    case 'addPreset':
    case 'addPresetGroup':
    case 'addPresetFromSnapshot':
    case 'addPresetGroupFromSnapshot':
    case 'renamePreset':
    case 'renamePresetGroup':
    case 'removePreset':
    case 'removePresetGroup':
    case 'movePreset':
    case 'movePresetGroup':
    case 'synchronizePresets':
    case 'updateEmbeddedOpcodeList':
    case 'randomize':
      return true;
    case 'addWidget':
    case 'removeWidget':
    default:
      return false;
  }
}

function collectObjectNamesFromTree(node: BsbWidgetNodeSnapshot): string[] {
  return collectBsbReplacementKeysFromSnapshotTree(node);
}

function findPresetById(
  group: PresetGroupSnapshot | undefined,
  uniqueId: string,
): PresetSnapshot | undefined {
  if (!group) return undefined;
  for (const p of group.presets) {
    if (p.uniqueId === uniqueId) return p;
  }
  for (const sub of group.subGroups) {
    const found = findPresetById(sub, uniqueId);
    if (found) return found;
  }
  return undefined;
}

function getPresetGroupSnapshotAtPath(
  root: PresetGroupSnapshot,
  path: readonly number[],
): PresetGroupSnapshot | undefined {
  let current = root;
  for (const index of path) {
    if (!Number.isInteger(index) || index < 0) return undefined;
    const next = current.subGroups[index];
    if (!next) return undefined;
    current = next;
  }
  return current;
}

function findPresetParentSnapshot(
  root: PresetGroupSnapshot,
  uniqueId: string,
): PresetGroupSnapshot | undefined {
  if (root.presets.some((preset) => preset.uniqueId === uniqueId)) return root;
  for (const subGroup of root.subGroups) {
    const parent = findPresetParentSnapshot(subGroup, uniqueId);
    if (parent) return parent;
  }
  return undefined;
}

function clearMissingCurrentPresetSnapshot(group: PresetGroupSnapshot): void {
  if (group.currentPresetUniqueId && !findPresetById(group, group.currentPresetUniqueId)) {
    group.currentPresetUniqueId = undefined;
    group.currentPresetModified = false;
  }
}

function removePresetGroupSnapshotAtPath(
  root: PresetGroupSnapshot,
  path: readonly number[],
): boolean {
  if (path.length === 0) return false;
  const parent = getPresetGroupSnapshotAtPath(root, path.slice(0, -1));
  const index = path[path.length - 1];
  if (!parent || index === undefined || !Number.isInteger(index) || index < 0) return false;
  const [removed] = parent.subGroups.splice(index, 1);
  if (!removed) return false;
  clearMissingCurrentPresetSnapshot(root);
  return true;
}

function movePresetSnapshot(
  root: PresetGroupSnapshot,
  uniqueId: string,
  parentGroupPath: readonly number[],
  targetIndex: number,
): boolean {
  const sourceParent = findPresetParentSnapshot(root, uniqueId);
  const targetParent = getPresetGroupSnapshotAtPath(root, parentGroupPath);
  if (!sourceParent || !targetParent) return false;

  const sourceIndex = sourceParent.presets.findIndex((preset) => preset.uniqueId === uniqueId);
  if (sourceIndex < 0) return false;
  const [preset] = sourceParent.presets.splice(sourceIndex, 1);
  if (!preset) return false;

  const rawPresetIndex = Number.isFinite(targetIndex)
    ? Math.trunc(targetIndex) - targetParent.subGroups.length
    : targetParent.presets.length;
  const adjustedPresetIndex = sourceParent === targetParent && sourceIndex < rawPresetIndex
    ? rawPresetIndex - 1
    : rawPresetIndex;
  const presetIndex = Math.max(0, Math.min(adjustedPresetIndex, targetParent.presets.length));
  targetParent.presets.splice(presetIndex, 0, preset);
  return true;
}

function isSnapshotPathWithin(
  path: readonly number[],
  possibleParent: readonly number[],
): boolean {
  return possibleParent.length < path.length
    && possibleParent.every((index, position) => path[position] === index);
}

function movePresetGroupSnapshot(
  root: PresetGroupSnapshot,
  sourcePath: readonly number[],
  parentGroupPath: readonly number[],
  targetIndex: number,
): boolean {
  const samePath = sourcePath.length === parentGroupPath.length
    && sourcePath.every((index, position) => parentGroupPath[position] === index);
  if (sourcePath.length === 0 || samePath || isSnapshotPathWithin(parentGroupPath, sourcePath)) {
    return false;
  }

  const sourceParent = getPresetGroupSnapshotAtPath(root, sourcePath.slice(0, -1));
  const targetParent = getPresetGroupSnapshotAtPath(root, parentGroupPath);
  const sourceIndex = sourcePath[sourcePath.length - 1];
  if (
    !sourceParent
    || !targetParent
    || sourceIndex === undefined
    || !Number.isInteger(sourceIndex)
    || sourceIndex < 0
  ) {
    return false;
  }

  const [group] = sourceParent.subGroups.splice(sourceIndex, 1);
  if (!group) return false;
  const rawGroupIndex = Number.isFinite(targetIndex)
    ? Math.trunc(targetIndex)
    : targetParent.subGroups.length;
  const adjustedGroupIndex = sourceParent === targetParent && sourceIndex < rawGroupIndex
    ? rawGroupIndex - 1
    : rawGroupIndex;
  const groupIndex = Math.max(0, Math.min(adjustedGroupIndex, targetParent.subGroups.length));
  targetParent.subGroups.splice(groupIndex, 0, group);
  return true;
}

export function applyBsbInstrumentPatchToSnapshot(
  instrument: BlueSynthBuilderInstrumentSnapshot,
  patch: BsbInterfacePatch,
): void {
  const previousObjectNames = instrument.objectNames;
  const previousWidgets = instrument.widgets;
  applyBsbInterfacePatchToSnapshot(instrument, patch);
  if (shouldPreserveWidgetMetadataForBsbPatch(patch)) {
    instrument.objectNames = previousObjectNames;
    instrument.widgets = previousWidgets;
  }
}
