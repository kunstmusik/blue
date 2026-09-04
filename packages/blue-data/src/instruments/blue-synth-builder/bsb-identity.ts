import { generatePrefixedUuid } from '../../utilities/uuid';
import { BSBGroup } from './bsb-group';
import { BSBHSliderBank } from './bsb-hslider-bank';
import { BSBVSliderBank } from './bsb-vslider-bank';
import { BSBWidget } from './bsb-widget';

export type BsbWidgetIdRepairReason = 'missing' | 'duplicate';

export interface BsbWidgetIdRepair {
  widget: BSBWidget;
  reason: BsbWidgetIdRepairReason;
  previousId: string;
  nextId: string;
}

type WidgetCollectionRoot = BSBGroup | BSBWidget[];

function isSliderBank(widget: BSBWidget): widget is BSBHSliderBank | BSBVSliderBank {
  return widget instanceof BSBHSliderBank || widget instanceof BSBVSliderBank;
}

function getRootChildren(root: WidgetCollectionRoot): BSBWidget[] {
  return root instanceof BSBGroup ? root.getChildren() : root;
}

function visitWidgets(root: WidgetCollectionRoot, visitor: (widget: BSBWidget) => void): void {
  const visit = (widget: BSBWidget): void => {
    visitor(widget);

    if (widget instanceof BSBGroup) {
      for (const child of widget.getChildren()) {
        visit(child);
      }
      return;
    }

    if (isSliderBank(widget)) {
      for (const child of widget.sliders) {
        visit(child);
      }
    }
  };

  for (const widget of getRootChildren(root)) {
    visit(widget);
  }
}

function nextUniqueWidgetId(existingIds: Set<string>): string {
  let id = generatePrefixedUuid('w');
  while (existingIds.has(id)) {
    id = generatePrefixedUuid('w');
  }
  existingIds.add(id);
  return id;
}

export function collectBsbWidgets(root: WidgetCollectionRoot): BSBWidget[] {
  const widgets: BSBWidget[] = [];
  visitWidgets(root, (widget) => {
    widgets.push(widget);
  });
  return widgets;
}

export function collectBsbWidgetIds(root: WidgetCollectionRoot): string[] {
  return collectBsbWidgets(root)
    .map((widget) => widget.id)
    .filter((id) => id.length > 0);
}

export function findBsbWidgetById(root: BSBGroup, widgetId: string): BSBWidget | null {
  let match: BSBWidget | null = null;

  visitWidgets(root, (widget) => {
    if (match === null && widget.id === widgetId) {
      match = widget;
    }
  });

  return match;
}

export function normalizeBsbWidgetIds(root: BSBGroup): BsbWidgetIdRepair[] {
  const repairs: BsbWidgetIdRepair[] = [];
  const seenIds = new Set<string>();

  visitWidgets(root, (widget) => {
    const previousId = widget.id;
    if (!previousId) {
      const nextId = nextUniqueWidgetId(seenIds);
      widget.id = nextId;
      repairs.push({ widget, reason: 'missing', previousId, nextId });
      return;
    }

    if (seenIds.has(previousId)) {
      const nextId = nextUniqueWidgetId(seenIds);
      widget.id = nextId;
      repairs.push({ widget, reason: 'duplicate', previousId, nextId });
      return;
    }

    seenIds.add(previousId);
  });

  return repairs;
}

export function createUniqueBsbWidgetId(rootOrIds: BSBGroup | Set<string>): string {
  const existingIds =
    rootOrIds instanceof Set ? new Set(rootOrIds) : new Set(collectBsbWidgetIds(rootOrIds));
  return nextUniqueWidgetId(existingIds);
}
