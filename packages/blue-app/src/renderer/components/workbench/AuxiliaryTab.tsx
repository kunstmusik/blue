import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import type {
  IDockviewPanelHeaderProps,
} from 'dockview';
import {
  X,
} from 'lucide-react';
import {
  getGroupInstanceForPanel,
  isAuxiliaryPanelId,
} from './auxiliary-layout';
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

function WorkbenchTabMenu({
  props,
}: {
  props: IDockviewPanelHeaderProps;
}) {
  const panelId = props.api.id;
  const closeAuxiliaryPanel = useWorkbenchStore(
    (state) => state.closeAuxiliaryPanel,
  );
  const maximizeAuxiliaryGroup = useWorkbenchStore(
    (state) => state.maximizeAuxiliaryGroup,
  );
  const restoreAuxiliaryGroup = useWorkbenchStore(
    (state) => state.restoreAuxiliaryGroup,
  );
  const auxiliary = useWorkbenchStore((state) => state.auxiliary);

  const isAuxiliaryPanel = isAuxiliaryPanelId(panelId);
  const instance = getGroupInstanceForPanel(auxiliary, panelId);
  const groupPanels = props.api.group.panels;
  const currentIndex = groupPanels.findIndex((panel) => panel.id === panelId);
  const canCloseOther = groupPanels.length > 1;
  const canShiftLeft = currentIndex > 0;
  const canShiftRight = currentIndex >= 0 && currentIndex < groupPanels.length - 1;
  const isMaximized = instance?.isMaximized ?? props.api.isMaximized();
  const canFloat = !isAuxiliaryPanel && props.api.location.type === 'grid';

  const closePanelById = (id: string) => {
    if (isAuxiliaryPanelId(id)) {
      closeAuxiliaryPanel(id);
      return;
    }

    props.containerApi.getPanel(id)?.api.close();
  };

  const handleClosePanel = () => closePanelById(panelId);

  const handleCloseAll = () => {
    const otherPanels = props.api.group.panels.filter(
      (panel) => panel.id !== panelId,
    );

    for (const panel of otherPanels) {
      closePanelById(panel.id);
    }

    closePanelById(panelId);
  };

  const handleCloseOther = () => {
    for (const panel of props.api.group.panels) {
      if (panel.id !== panelId) {
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
    if (!canFloat) {
      return;
    }

    const panel = props.containerApi.getPanel(panelId);
    if (!panel) {
      return;
    }

    props.containerApi.addFloatingGroup(panel, {
      width: Math.max(420, Math.min(760, props.api.width)),
      height: Math.max(280, Math.min(520, props.api.height)),
      x: 96,
      y: 96,
    });
  };

  const shiftPanel = (delta: -1 | 1) => {
    const panel = props.containerApi.getPanel(panelId);
    const nextIndex = props.api.group.panels.findIndex(
      (candidate) => candidate.id === panelId,
    ) + delta;

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

  return (
    <ContextMenu.Root onOpenChange={handleOpenChange}>
      <ContextMenu.Trigger asChild>
        <div className="workbench-tab-trigger">
          <TabContents
            props={props}
            closeActionOverride={isAuxiliaryPanel ? handleClosePanel : undefined}
          />
        </div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal container={props.api.getWindow().document.body}>
        <ContextMenu.Content
          className="workbench-context-menu"
          sideOffset={6}
          align="start"
        >
          <ContextMenu.Item
            className="workbench-context-menu__item"
            onSelect={handleClosePanel}
          >
            Close
          </ContextMenu.Item>
          <ContextMenu.Item
            className="workbench-context-menu__item"
            onSelect={handleCloseAll}
          >
            Close All
          </ContextMenu.Item>
          <ContextMenu.Item
            className="workbench-context-menu__item"
            disabled={!canCloseOther}
            onSelect={handleCloseOther}
          >
            Close Other
          </ContextMenu.Item>

          <ContextMenu.Separator className="workbench-context-menu__separator" />

          <ContextMenu.Item
            className="workbench-context-menu__item"
            onSelect={handleMaximizeToggle}
          >
            {isMaximized ? 'Restore' : 'Maximize'}
          </ContextMenu.Item>
          <ContextMenu.Item
            className="workbench-context-menu__item"
            disabled={!canFloat}
            onSelect={handleFloat}
          >
            Float
          </ContextMenu.Item>
          <ContextMenu.Item
            className="workbench-context-menu__item"
            disabled
          >
            Dock
          </ContextMenu.Item>

          <ContextMenu.Separator className="workbench-context-menu__separator" />

          <ContextMenu.Item
            className="workbench-context-menu__item"
            disabled={!canShiftLeft}
            onSelect={() => shiftPanel(-1)}
          >
            Shift Left
          </ContextMenu.Item>
          <ContextMenu.Item
            className="workbench-context-menu__item"
            disabled={!canShiftRight}
            onSelect={() => shiftPanel(1)}
          >
            Shift Right
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export default function AuxiliaryTab(props: IDockviewPanelHeaderProps) {
  return <WorkbenchTabMenu props={props} />;
}
