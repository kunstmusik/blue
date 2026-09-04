import type { BsbWidgetNodeSnapshot } from './project-editor';

type BsbWidgetSnapshotLike = Pick<BsbWidgetNodeSnapshot, 'type' | 'objectName' | 'properties'>;
type BsbWidgetLike = {
  type?: unknown;
  objectName?: unknown;
  properties?: {
    sliders?: unknown;
    numberOfSliders?: unknown;
    lines?: unknown;
  } | null;
  constructor?: { name?: unknown };
  getChildren?: () => unknown[];
  sliders?: unknown[];
  numberOfSliders?: number;
  lines?: unknown[];
};

function getObjectName(value: { objectName?: unknown }): string {
  return typeof value.objectName === 'string' ? value.objectName.trim() : '';
}

function getWidgetType(value: { type?: unknown; constructor?: { name?: unknown } }): string {
  if (typeof value.type === 'string') {
    return value.type;
  }
  const ctorName = value.constructor?.name;
  return typeof ctorName === 'string' ? ctorName : '';
}

function getSliderBankCountFromSnapshot(node: BsbWidgetSnapshotLike): number {
  const sliders = node.properties?.sliders;
  if (Array.isArray(sliders)) {
    return Math.max(1, sliders.length);
  }

  const count = node.properties?.numberOfSliders;
  if (typeof count === 'number' && Number.isFinite(count)) {
    return Math.max(1, Math.round(count));
  }

  return 0;
}

function getSliderBankCountFromWidget(widget: BsbWidgetLike): number {
  if (Array.isArray(widget.sliders)) {
    return Math.max(1, widget.sliders.length);
  }

  if (typeof widget.numberOfSliders === 'number' && Number.isFinite(widget.numberOfSliders)) {
    return Math.max(1, Math.round(widget.numberOfSliders));
  }

  return 0;
}

function getLineVarNamesFromSnapshot(node: BsbWidgetSnapshotLike): string[] {
  const lines = node.properties?.lines;
  if (!Array.isArray(lines)) {
    return [];
  }

  const keys: string[] = [];
  for (const line of lines) {
    if (!line || typeof line !== 'object') continue;
    const record = line as Record<string, unknown>;
    const varName = typeof record.varName === 'string' ? record.varName.trim() : '';
    if (varName) {
      keys.push(varName);
    }
  }
  return keys;
}

function getLineVarNamesFromWidget(widget: BsbWidgetLike): string[] {
  const keys: string[] = [];
  for (const line of widget.lines ?? []) {
    if (!line || typeof line !== 'object') continue;
    const record = line as Record<string, unknown>;
    if (typeof record.varName === 'string' && record.varName.trim()) {
      keys.push(record.varName.trim());
    }
  }
  return keys;
}

export function getBsbObjectNameValidationKeysFromSnapshot(
  node: BsbWidgetSnapshotLike,
  objectName: string,
): string[] {
  if (objectName.length === 0) {
    return [];
  }

  switch (node.type) {
    case 'BSBXYController':
      return [`${objectName}X`, `${objectName}Y`];
    case 'BSBHSliderBank':
    case 'BSBVSliderBank': {
      const count = getSliderBankCountFromSnapshot(node);
      const keys: string[] = [];
      for (let index = 0; index < count; index++) {
        keys.push(`${objectName}_${index}`);
      }
      return keys;
    }
    default:
      return [objectName];
  }
}

const MULTI_KEY_TYPES = new Set([
  'BSBXYController',
  'BSBHSliderBank',
  'BSBVSliderBank',
  'BSBLineObject',
]);

function isMultiKeyType(type: string): boolean {
  return MULTI_KEY_TYPES.has(type);
}

function getDerivedKeysFromSnapshot(node: BsbWidgetSnapshotLike): string[] {
  const objectName = getObjectName(node);
  if (!objectName) return [];

  switch (node.type) {
    case 'BSBXYController':
      return [`${objectName}X`, `${objectName}Y`];
    case 'BSBHSliderBank':
    case 'BSBVSliderBank': {
      const count = getSliderBankCountFromSnapshot(node);
      const keys: string[] = [];
      for (let index = 0; index < count; index++) {
        keys.push(`${objectName}_${index}`);
      }
      return keys;
    }
    case 'BSBLineObject':
      return getLineVarNamesFromSnapshot(node).map((lineName) => `${objectName}_${lineName}`);
    default:
      return [];
  }
}

function getDerivedKeysFromWidget(widget: BsbWidgetLike): string[] {
  const objectName = getObjectName(widget);
  if (!objectName) return [];

  switch (getWidgetType(widget)) {
    case 'BSBXYController':
      return [`${objectName}X`, `${objectName}Y`];
    case 'BSBHSliderBank':
    case 'BSBVSliderBank': {
      const count = getSliderBankCountFromWidget(widget);
      const keys: string[] = [];
      for (let index = 0; index < count; index++) {
        keys.push(`${objectName}_${index}`);
      }
      return keys;
    }
    case 'BSBLineObject':
      return getLineVarNamesFromWidget(widget).map((lineName) => `${objectName}_${lineName}`);
    default:
      return [];
  }
}

export function getBsbReplacementKeysFromSnapshot(node: BsbWidgetNodeSnapshot): string[] {
  const objectName = getObjectName(node);
  if (!objectName) return [];
  const type = typeof node.type === 'string' ? node.type : '';
  if (isMultiKeyType(type)) return getDerivedKeysFromSnapshot(node);
  return [objectName];
}

export function getBsbReplacementKeysFromWidget(widget: BsbWidgetLike): string[] {
  const objectName = getObjectName(widget);
  if (!objectName) return [];
  const type = getWidgetType(widget);
  if (isMultiKeyType(type)) return getDerivedKeysFromWidget(widget);
  return [objectName];
}

export { getDerivedKeysFromSnapshot, getDerivedKeysFromWidget };

export function collectBsbReplacementKeysFromSnapshotTree(node: BsbWidgetNodeSnapshot): string[] {
  const keys = new Set<string>();
  const visit = (current: BsbWidgetNodeSnapshot): void => {
    for (const key of getBsbReplacementKeysFromSnapshot(current)) {
      keys.add(key);
    }
    current.children?.forEach(visit);
  };

  visit(node);
  return [...keys].sort((left, right) => left.localeCompare(right));
}

export function collectBsbReplacementKeysFromWidgetTree(widget: BsbWidgetLike): string[] {
  const keys = new Set<string>();
  const visit = (current: BsbWidgetLike): void => {
    for (const key of getBsbReplacementKeysFromWidget(current)) {
      keys.add(key);
    }
    if (typeof current.getChildren === 'function') {
      for (const child of current.getChildren()) {
        visit(child as BsbWidgetLike);
      }
    }
  };

  visit(widget);
  return [...keys].sort((left, right) => left.localeCompare(right));
}
