/**
 * Pure renderer helper that computes Java Blue/NetBeans-style tab context-menu
 * command state for the tab that opened the menu (SPEC 055 US3, FR-011..FR-017).
 *
 * Keeping this pure (no React, no Dockview imports) makes every enablement
 * combination straightforward to unit-test without rendering.
 *
 * See: specs/055-window-float-dock-parity/contracts/tab-command-contract.md
 */

import type { WorkbenchPanelMode } from '../../../shared/workbench-menu';

export type TabLocation = 'docked' | 'floating' | 'minimized' | 'slideout' | 'maximized';

export type TabCommandKind =
  | 'close'
  | 'close-all'
  | 'close-other'
  | 'close-group'
  | 'maximize'
  | 'restore'
  | 'float'
  | 'float-group'
  | 'dock'
  | 'dock-group'
  | 'minimize'
  | 'minimize-group'
  | 'shift-left'
  | 'shift-right'
  | 'move'
  | 'move-group'
  | 'size-group'
  | 'clone'
  | 'new-document-tab-group'
  | 'collapse-document-tab-group';

export interface TabCommandDescriptor {
  kind: TabCommandKind;
  label: string;
  enabled: boolean;
  reasonDisabled?: string;
}

export interface TabCommandContext {
  panelId: string;
  groupId: string;
  groupPanelIds: string[];
  activePanelId: string;
  location: TabLocation;
  mode: WorkbenchPanelMode;
  isAuxiliary: boolean;
  isClosable: boolean;
  isFloatable: boolean;
  isCloneable?: boolean;
  isMaximized: boolean;
  dockedEditorGroupCount?: number;
  /**
   * Per-sibling closability used by Close All / Close Other scope checks. When
   * omitted, every sibling is assumed closable.
   */
  siblingClosable?: (panelId: string) => boolean;
  /**
   * Per-sibling floatability used by group Float checks. When omitted, every
   * sibling is assumed floatable.
   */
  siblingFloatable?: (panelId: string) => boolean;
}

export interface TabCommandState {
  contextPanelId: string;
  contextGroupId: string;
  location: TabLocation;
  commands: TabCommandDescriptor[];
  canClose: boolean;
  canCloseAll: boolean;
  canCloseOther: boolean;
  canCloseGroup: boolean;
  canFloat: boolean;
  canFloatGroup: boolean;
  canDock: boolean;
  canDockGroup: boolean;
  canMinimize: boolean;
  canMinimizeGroup: boolean;
  canShiftLeft: boolean;
  canShiftRight: boolean;
  canMove: boolean;
  canMoveGroup: boolean;
  canSizeGroup: boolean;
  canMaximize: boolean;
  canRestore: boolean;
  canClone: boolean;
  canNewDocumentTabGroup: boolean;
  canCollapseDocumentTabGroup: boolean;
}

const LABELS: Record<TabCommandKind, string> = {
  close: 'Close',
  'close-all': 'Close All',
  'close-other': 'Close Other',
  'close-group': 'Close Group',
  maximize: 'Maximize',
  restore: 'Restore',
  float: 'Float',
  'float-group': 'Float Group',
  dock: 'Dock',
  'dock-group': 'Dock Group',
  minimize: 'Minimize',
  'minimize-group': 'Minimize Group',
  'shift-left': 'Shift Left',
  'shift-right': 'Shift Right',
  move: 'Move',
  'move-group': 'Move Group',
  'size-group': 'Size Group',
  clone: 'Clone',
  'new-document-tab-group': 'New Document Tab Group',
  'collapse-document-tab-group': 'Collapse Document Tab Group',
};

function siblingIsClosable(context: TabCommandContext, panelId: string): boolean {
  return context.siblingClosable ? context.siblingClosable(panelId) : true;
}

function siblingIsFloatable(context: TabCommandContext, panelId: string): boolean {
  return context.siblingFloatable ? context.siblingFloatable(panelId) : true;
}

/**
 * Computes the command list and enablement for the tab that opened the menu.
 * NetBeans keeps Float/Dock and Float Group/Dock Group visible together, with
 * enablement flipping by current location.
 */
export function computeTabCommandState(context: TabCommandContext): TabCommandState {
  const isFloating = context.location === 'floating';
  const isEditor = context.mode === 'editor';
  const isViewLike = !isEditor;

  const currentIndex = context.groupPanelIds.indexOf(context.panelId);
  const canShiftLeft = currentIndex > 0;
  const canShiftRight = currentIndex >= 0 && currentIndex < context.groupPanelIds.length - 1;

  const canClose = context.isClosable;
  const closableSiblingIds = context.groupPanelIds.filter(
    (id) => id !== context.panelId && siblingIsClosable(context, id),
  );
  const anyClosableInGroup = context.groupPanelIds.some((id) =>
    id === context.panelId ? context.isClosable : siblingIsClosable(context, id),
  );
  const canCloseOther = closableSiblingIds.length > 0;
  const canCloseAll = anyClosableInGroup;
  const canCloseGroup = anyClosableInGroup;

  const allGroupPanelsFloatable = context.groupPanelIds.every((id) =>
    id === context.panelId ? context.isFloatable : siblingIsFloatable(context, id),
  );
  const canFloat = !isFloating && context.isFloatable;
  const canFloatGroup = !isFloating && context.groupPanelIds.length > 0 && allGroupPanelsFloatable;

  // Dock-back always falls back to the panel default mode when the origin is
  // invalid, so it is enabled whenever a group is floating.
  const canDock = isFloating;
  const canDockGroup = isFloating && context.groupPanelIds.length > 0;
  const canMinimize = isViewLike && context.isAuxiliary && context.location === 'docked';
  const canMinimizeGroup = canMinimize;

  const canMaximize = context.location === 'docked' && !context.isMaximized;
  const canRestore = context.isMaximized || context.location === 'maximized';
  const canMove =
    isViewLike && context.isAuxiliary && context.location === 'docked' && !context.isMaximized;
  const canMoveGroup = canMove && context.groupPanelIds.length > 0;
  const canSizeGroup = canMove && context.location === 'docked' && !context.isMaximized;
  const canClone = context.isCloneable === true;
  const canNewDocumentTabGroup =
    isEditor && context.location === 'docked' && context.groupPanelIds.length > 1;
  const canCollapseDocumentTabGroup =
    isEditor && context.location === 'docked' && (context.dockedEditorGroupCount ?? 1) > 1;

  const commands: TabCommandDescriptor[] = [];
  const push = (kind: TabCommandKind, enabled: boolean, reasonDisabled?: string): void => {
    commands.push({
      kind,
      label: LABELS[kind],
      enabled,
      ...(reasonDisabled ? { reasonDisabled } : {}),
    });
  };

  push('close', canClose, canClose ? undefined : 'Panel is not closable');
  if (isEditor) {
    push('close-all', canCloseAll, canCloseAll ? undefined : 'No closable panels in this group');
    push('close-other', canCloseOther, canCloseOther ? undefined : 'No closable sibling panels');
  } else {
    push(
      'close-group',
      canCloseGroup,
      canCloseGroup ? undefined : 'No closable panels in this group',
    );
  }

  if (canMaximize) push('maximize', true);
  if (canRestore) push('restore', true);
  if (isViewLike) {
    push('minimize', canMinimize, canMinimize ? undefined : 'Panel cannot be minimized here');
    push(
      'minimize-group',
      canMinimizeGroup,
      canMinimizeGroup ? undefined : 'Group cannot be minimized here',
    );
  }

  push(
    'float',
    canFloat,
    canFloat
      ? undefined
      : isFloating
        ? 'Panel is already floating'
        : 'This panel type cannot be floated',
  );
  push(
    'float-group',
    canFloatGroup,
    canFloatGroup
      ? undefined
      : isFloating
        ? 'Group is already floating'
        : 'One or more panels cannot be floated',
  );
  push('dock', canDock, canDock ? undefined : 'Panel is already docked');
  push('dock-group', canDockGroup, canDockGroup ? undefined : 'Group is already docked');

  if (isViewLike) {
    push('move', canMove, canMove ? undefined : 'Panel must be docked to move between edges');
  }

  push('shift-left', canShiftLeft, canShiftLeft ? undefined : 'Already the first tab');
  push('shift-right', canShiftRight, canShiftRight ? undefined : 'Already the last tab');
  if (isViewLike) {
    push(
      'move-group',
      canMoveGroup,
      canMoveGroup ? undefined : 'Group must be docked to move between edges',
    );
    push(
      'size-group',
      canSizeGroup,
      canSizeGroup ? undefined : 'Group cannot be resized in this presentation',
    );
  }

  push('clone', canClone, canClone ? undefined : 'Panel is not cloneable');
  if (isEditor) {
    push(
      'new-document-tab-group',
      canNewDocumentTabGroup,
      canNewDocumentTabGroup ? undefined : 'No sibling document tab to split from',
    );
    push(
      'collapse-document-tab-group',
      canCollapseDocumentTabGroup,
      canCollapseDocumentTabGroup ? undefined : 'No other document tab group to collapse into',
    );
  }

  return {
    contextPanelId: context.panelId,
    contextGroupId: context.groupId,
    location: context.location,
    commands,
    canClose,
    canCloseAll,
    canCloseOther,
    canCloseGroup,
    canFloat,
    canFloatGroup,
    canDock,
    canDockGroup,
    canMinimize,
    canMinimizeGroup,
    canShiftLeft,
    canShiftRight,
    canMove,
    canMoveGroup,
    canSizeGroup,
    canMaximize,
    canRestore,
    canClone,
    canNewDocumentTabGroup,
    canCollapseDocumentTabGroup,
  };
}

/**
 * Command-group boundaries for separator rendering. The UI inserts a separator
 * before each new group when iterating the ordered `commands` list.
 */
export const TAB_COMMAND_SEPARATOR_AFTER: readonly TabCommandKind[] = [
  'close-other',
  'close-group',
  'dock-group',
  'float-group',
  'restore',
  'maximize',
  'minimize-group',
  'size-group',
];
