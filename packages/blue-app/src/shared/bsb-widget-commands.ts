import type { BsbInterfacePatch, BsbWidgetNodeSnapshot } from './project-editor';

/** Allocate identities once, before optimistic projection and canonical submission. */
export function prepareBsbWidgetCreation(patch: BsbInterfacePatch): BsbInterfacePatch {
  if (patch.type === 'addWidget' || patch.type === 'makeGroup') {
    return { ...patch, widgetId: patch.widgetId ?? crypto.randomUUID() };
  }
  if (patch.type !== 'pasteWidgets' || patch.preserveIds) return patch;
  const widgets: BsbWidgetNodeSnapshot[] = JSON.parse(patch.widgetData);
  const assignIds = (node: BsbWidgetNodeSnapshot): void => {
    node.id = crypto.randomUUID();
    node.children?.forEach(assignIds);
  };
  widgets.forEach(assignIds);
  return { ...patch, widgetData: JSON.stringify(widgets), preserveIds: true };
}
