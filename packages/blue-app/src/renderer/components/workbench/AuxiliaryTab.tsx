import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import type { IDockviewPanelHeaderProps } from 'dockview';
import { ChevronRight, X } from 'lucide-react';
import {
  getAuxiliaryPanelPresentation,
  getGroupInstanceForPanel,
  isAuxiliaryPanelId,
  type AuxiliaryEdge,
  type AuxiliaryGroupSizeAction,
} from './auxiliary-layout';
import { getPanel } from './panel-registry';
import {
  computeTabCommandState,
  type TabCommandKind,
  type TabCommandContext,
  type TabLocation,
} from './tab-command-state';
import { useWorkbenchStore } from '../../stores/workbench-store';

function useTitle(api: IDockviewPanelHeaderProps['api']) {
  const [title, setTitle] = useState(api.title);

  useEffect(() => {
    const disposable = api.onDidTitleChange((event) => {
      setTitle(event.title);
    });

    if (title !== api.title) {
      setTitle(api.title);
    }

    return () => {
      disposable.dispose();
    };
  }, [api, title]);

  return title;
}

function usePanelActive(api: IDockviewPanelHeaderProps['api']) {
  const [isActive, setIsActive] = useState(api.isActive && api.isGroupActive);

  useEffect(() => {
    const updateActiveState = () => {
      setIsActive(api.isActive && api.isGroupActive);
    };

    const activeDisposable = api.onDidActiveChange(updateActiveState);
    const activeGroupDisposable = api.onDidActiveGroupChange(updateActiveState);

    updateActiveState();

    return () => {
      activeDisposable.dispose();
      activeGroupDisposable.dispose();
    };
  }, [api]);

  return isActive;
}

function TabContents({
  props,
  closeActionOverride,
}: {
  props: IDockviewPanelHeaderProps;
  closeActionOverride?: () => void;
}) {
  const title = useTitle(props.api);
  const isActive = usePanelActive(props.api);
  const isMiddleMouseButton = useRef(false);

  const onClose = useCallback(
    (event: ReactPointerEvent | ReactMouseEvent) => {
      event.preventDefault();
      if (closeActionOverride) {
        closeActionOverride();
      } else {
        props.api.close();
      }
    },
    [closeActionOverride, props.api],
  );

  const onBtnPointerDown = useCallback((event: ReactPointerEvent) => {
    event.preventDefault();
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    isMiddleMouseButton.current = event.button === 1;
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isMiddleMouseButton.current && event.button === 1) {
        isMiddleMouseButton.current = false;
        onClose(event);
      }
    },
    [onClose],
  );

  const onPointerLeave = useCallback(() => {
    isMiddleMouseButton.current = false;
  }, []);

  return (
    <div
      data-testid="dockview-dv-default-tab"
      data-workbench-active-tab={isActive ? 'true' : undefined}
      className="dv-default-tab"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      <span className="dv-default-tab-content">{title}</span>
      <div
        className="dv-default-tab-action"
        data-aux-drag-ignore="true"
        onPointerDown={onBtnPointerDown}
        onClick={onClose}
      >
        <X size={10} strokeWidth={2.1} />
      </div>
    </div>
  );
}

function WorkbenchTabMenu({ props }: { props: IDockviewPanelHeaderProps }) {
  const panelId = props.api.id;
  const closeAuxiliaryPanel = useWorkbenchStore((state) => state.closeAuxiliaryPanel);
  const maximizeAuxiliaryGroup = useWorkbenchStore((state) => state.maximizeAuxiliaryGroup);
  const restoreAuxiliaryGroup = useWorkbenchStore((state) => state.restoreAuxiliaryGroup);
  const minimizeAuxiliaryPanel = useWorkbenchStore((state) => state.minimizeAuxiliaryPanel);
  const minimizeAuxiliaryGroup = useWorkbenchStore((state) => state.minimizeAuxiliaryGroup);
  const closePanel = useWorkbenchStore((state) => state.closePanel);
  const closeGroup = useWorkbenchStore((state) => state.closeGroup);
  const floatPanel = useWorkbenchStore((state) => state.floatPanel);
  const floatGroup = useWorkbenchStore((state) => state.floatGroup);
  const dockPanel = useWorkbenchStore((state) => state.dockPanel);
  const dockGroup = useWorkbenchStore((state) => state.dockGroup);
  const movePanelToEdge = useWorkbenchStore((state) => state.movePanelToEdge);
  const moveGroupToEdge = useWorkbenchStore((state) => state.moveGroupToEdge);
  const resizeAuxiliaryGroup = useWorkbenchStore((state) => state.resizeAuxiliaryGroup);
  const newDocumentTabGroup = useWorkbenchStore((state) => state.newDocumentTabGroup);
  const collapseDocumentTabGroup = useWorkbenchStore((state) => state.collapseDocumentTabGroup);
  const auxiliary = useWorkbenchStore((state) => state.auxiliary);

  const isAuxiliaryPanel = isAuxiliaryPanelId(panelId);
  const instance = getGroupInstanceForPanel(auxiliary, panelId);
  const groupPanels = props.api.group.panels;
  const groupPanelIds = groupPanels.map((panel) => panel.id);
  const activePanelId = (props.api.group.activePanel?.id as string | undefined) ?? panelId;

  const dockviewLocation = props.api.location.type;
  const auxiliaryPresentation = isAuxiliaryPanel
    ? getAuxiliaryPanelPresentation(auxiliary, panelId)
    : undefined;
  const location: TabLocation =
    dockviewLocation === 'popout' || dockviewLocation === 'floating'
      ? 'floating'
      : (auxiliaryPresentation ?? 'docked');
  const isMaximized =
    location === 'maximized' || instance?.isMaximized === true || props.api.isMaximized();

  const descriptor = getPanel(panelId);
  const isPanelClosable = (id: string) => getPanel(id)?.isClosable ?? true;
  const isPanelFloatable = (id: string) => getPanel(id)?.isFloatable ?? true;
  const dockedEditorGroupCount = props.containerApi.groups.filter(
    (group) =>
      group.api.location.type !== 'popout' &&
      group.panels.some((panel) => (getPanel(panel.id)?.mode ?? 'editor') === 'editor'),
  ).length;
  const commandContext: TabCommandContext = {
    panelId,
    groupId: props.api.group.id,
    groupPanelIds,
    activePanelId,
    location,
    mode: descriptor?.mode ?? 'editor',
    isAuxiliary: isAuxiliaryPanel,
    isClosable: descriptor?.isClosable ?? true,
    isFloatable: descriptor?.isFloatable ?? true,
    isCloneable: false,
    isMaximized,
    dockedEditorGroupCount,
    siblingClosable: isPanelClosable,
    siblingFloatable: isPanelFloatable,
  };
  const commandState = computeTabCommandState(commandContext);

  const closePanelById = (id: string) => {
    if (!isPanelClosable(id)) {
      return;
    }

    if (isAuxiliaryPanelId(id)) {
      closeAuxiliaryPanel(id);
      return;
    }

    closePanel(id);
  };

  const handleClosePanel = () => closePanelById(panelId);

  const handleCloseAll = () => {
    const otherPanels = props.api.group.panels.filter(
      (panel) => panel.id !== panelId && isPanelClosable(panel.id),
    );

    for (const panel of otherPanels) {
      closePanelById(panel.id);
    }

    closePanelById(panelId);
  };

  const handleCloseOther = () => {
    for (const panel of props.api.group.panels) {
      if (panel.id !== panelId && isPanelClosable(panel.id)) {
        closePanelById(panel.id);
      }
    }
  };

  const handleMaximizeToggle = () => {
    if (instance) {
      if (instance.isMaximized) {
        restoreAuxiliaryGroup(instance.groupInstanceId);
        return;
      }

      maximizeAuxiliaryGroup(instance.groupInstanceId);
      return;
    }

    if (props.api.isMaximized()) {
      props.api.exitMaximized();
      return;
    }

    props.api.maximize();
  };

  const handleFloat = () => {
    // NetBeans Float detaches only the selected TopComponent; Float Group is a
    // separate mode-level command.
    floatPanel(panelId);
  };

  const shiftPanel = (delta: -1 | 1) => {
    const panel = props.containerApi.getPanel(panelId);
    const nextIndex =
      props.api.group.panels.findIndex((candidate) => candidate.id === panelId) + delta;

    if (!panel || nextIndex < 0 || nextIndex >= props.api.group.panels.length) {
      return;
    }

    panel.api.moveTo({
      group: props.api.group,
      index: nextIndex,
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      return;
    }

    props.api.setActive();
    props.api.group.focus();
  };

  const runCommand = (kind: TabCommandKind) => {
    switch (kind) {
      case 'close':
        return handleClosePanel();
      case 'close-all':
        return handleCloseAll();
      case 'close-other':
        return handleCloseOther();
      case 'close-group':
        return closeGroup(panelId);
      case 'maximize':
      case 'restore':
        return handleMaximizeToggle();
      case 'minimize':
        return minimizeAuxiliaryPanel(panelId);
      case 'minimize-group':
        if (instance) {
          return minimizeAuxiliaryGroup(instance.groupInstanceId);
        }
        return;
      case 'float':
        return handleFloat();
      case 'float-group':
        return floatGroup(panelId);
      case 'shift-left':
        return shiftPanel(-1);
      case 'shift-right':
        return shiftPanel(1);
      case 'dock':
        return dockPanel(panelId);
      case 'dock-group':
        // Returns the floating group to the workbench using the stored
        // DockingOrigin, falling back to the default mode (SPEC 055 US2).
        return dockGroup(panelId);
      case 'new-document-tab-group':
        return newDocumentTabGroup(panelId);
      case 'collapse-document-tab-group':
        return collapseDocumentTabGroup(panelId);
      case 'clone':
      case 'move':
      case 'move-group':
      case 'size-group':
        return;
    }
  };

  return (
    <ContextMenu.Root onOpenChange={handleOpenChange}>
      <ContextMenu.Trigger asChild>
        <div className="workbench-tab-trigger">
          <TabContents
            props={props}
            // Route every tab-close affordance through the store. Calling the
            // Dockview panel API directly skips the close-origin capture that
            // lets Window-menu reopening restore the prior placement.
            closeActionOverride={handleClosePanel}
          />
        </div>
      </ContextMenu.Trigger>

      {/* Tab renderers mount outside DockviewPanel's HostDocumentContext
          provider, so the dockview panel API is the authoritative host window
          source here. Panel CONTENT must instead use PopoutContextMenuPortal
          (see docs/popout-popup-conventions.md). */}
      <ContextMenu.Portal container={props.api.getWindow().document.body}>
        <ContextMenu.Content className="workbench-context-menu" sideOffset={6} align="start">
          {commandState.commands.map((command, index) => {
            const previousKind = commandState.commands[index - 1]?.kind;
            const showSeparator = index > 0 && groupOf(previousKind) !== groupOf(command.kind);

            if (command.kind === 'move' || command.kind === 'move-group') {
              return (
                <EdgeCommandSubmenu
                  key={command.kind}
                  label={command.label}
                  enabled={command.enabled}
                  showSeparator={showSeparator}
                  currentEdge={instance?.edge}
                  onSelect={(edge) => {
                    if (command.kind === 'move') {
                      movePanelToEdge(panelId, edge);
                    } else if (instance) {
                      moveGroupToEdge(instance.groupInstanceId, edge);
                    }
                  }}
                />
              );
            }

            if (command.kind === 'size-group') {
              return (
                <SizeCommandSubmenu
                  key={command.kind}
                  label={command.label}
                  enabled={command.enabled}
                  showSeparator={showSeparator}
                  onSelect={(action) => {
                    if (instance) {
                      resizeAuxiliaryGroup(instance.groupInstanceId, action);
                    }
                  }}
                />
              );
            }

            return (
              <CommandMenuItem
                key={command.kind}
                label={command.label}
                enabled={command.enabled}
                showSeparator={showSeparator}
                onSelect={() => runCommand(command.kind)}
              />
            );
          })}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

const AUXILIARY_EDGE_OPTIONS: readonly {
  edge: AuxiliaryEdge;
  label: string;
}[] = [
  { edge: 'left', label: 'Left' },
  { edge: 'right', label: 'Right' },
  { edge: 'bottom', label: 'Bottom' },
];

function EdgeCommandSubmenu({
  label,
  enabled,
  showSeparator,
  currentEdge,
  onSelect,
}: {
  label: string;
  enabled: boolean;
  showSeparator: boolean;
  currentEdge?: AuxiliaryEdge;
  onSelect: (edge: AuxiliaryEdge) => void;
}) {
  return (
    <ContextMenu.Sub>
      {showSeparator ? (
        <ContextMenu.Separator className="workbench-context-menu__separator" />
      ) : null}
      <ContextMenu.SubTrigger
        className="workbench-context-menu__item workbench-context-menu__subtrigger"
        disabled={!enabled}
      >
        <span>{label}</span>
        <ChevronRight size={14} aria-hidden="true" />
      </ContextMenu.SubTrigger>
      <ContextMenu.SubContent className="workbench-context-menu" sideOffset={4}>
        {AUXILIARY_EDGE_OPTIONS.map((option) => (
          <ContextMenu.Item
            key={option.edge}
            className="workbench-context-menu__item"
            disabled={!enabled || option.edge === currentEdge}
            onSelect={() => onSelect(option.edge)}
          >
            {option.label}
          </ContextMenu.Item>
        ))}
      </ContextMenu.SubContent>
    </ContextMenu.Sub>
  );
}

const AUXILIARY_SIZE_OPTIONS: readonly {
  action: AuxiliaryGroupSizeAction;
  label: string;
}[] = [
  { action: 'increase', label: 'Larger' },
  { action: 'decrease', label: 'Smaller' },
  { action: 'reset', label: 'Reset' },
];

function SizeCommandSubmenu({
  label,
  enabled,
  showSeparator,
  onSelect,
}: {
  label: string;
  enabled: boolean;
  showSeparator: boolean;
  onSelect: (action: AuxiliaryGroupSizeAction) => void;
}) {
  return (
    <ContextMenu.Sub>
      {showSeparator ? (
        <ContextMenu.Separator className="workbench-context-menu__separator" />
      ) : null}
      <ContextMenu.SubTrigger
        className="workbench-context-menu__item workbench-context-menu__subtrigger"
        disabled={!enabled}
      >
        <span>{label}</span>
        <ChevronRight size={14} aria-hidden="true" />
      </ContextMenu.SubTrigger>
      <ContextMenu.SubContent className="workbench-context-menu" sideOffset={4}>
        {AUXILIARY_SIZE_OPTIONS.map((option) => (
          <ContextMenu.Item
            key={option.action}
            className="workbench-context-menu__item"
            disabled={!enabled}
            onSelect={() => onSelect(option.action)}
          >
            {option.label}
          </ContextMenu.Item>
        ))}
      </ContextMenu.SubContent>
    </ContextMenu.Sub>
  );
}

function CommandMenuItem({
  label,
  enabled,
  showSeparator,
  onSelect,
}: {
  label: string;
  enabled: boolean;
  showSeparator: boolean;
  onSelect: () => void;
}) {
  return (
    <>
      {showSeparator ? (
        <ContextMenu.Separator className="workbench-context-menu__separator" />
      ) : null}
      <ContextMenu.Item
        className="workbench-context-menu__item"
        disabled={!enabled}
        onSelect={onSelect}
      >
        {label}
      </ContextMenu.Item>
    </>
  );
}

function groupOf(kind: TabCommandKind | undefined): string {
  switch (kind) {
    case 'close':
    case 'close-all':
    case 'close-other':
    case 'close-group':
      return 'close';
    case 'maximize':
    case 'restore':
    case 'minimize':
    case 'minimize-group':
      return 'maximize';
    case 'float':
    case 'float-group':
    case 'dock':
    case 'dock-group':
      return 'float';
    case 'shift-left':
    case 'shift-right':
    case 'move':
    case 'move-group':
    case 'size-group':
      return 'shift';
    case 'clone':
    case 'new-document-tab-group':
    case 'collapse-document-tab-group':
      return 'document';
    default:
      return 'other';
  }
}

export default function AuxiliaryTab(props: IDockviewPanelHeaderProps) {
  return <WorkbenchTabMenu props={props} />;
}
