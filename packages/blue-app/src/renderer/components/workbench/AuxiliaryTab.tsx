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
import {
  Maximize2,
  Minimize2,
  PinOff,
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

function AuxiliaryTabMenu({
  props,
}: {
  props: IDockviewPanelHeaderProps;
}) {
  const panelId = props.api.id;
  const closeAuxiliaryPanel = useWorkbenchStore(
    (state) => state.closeAuxiliaryPanel,
  );
  const minimizeAuxiliaryGroup = useWorkbenchStore(
    (state) => state.minimizeAuxiliaryGroup,
  );
  const maximizeAuxiliaryGroup = useWorkbenchStore(
    (state) => state.maximizeAuxiliaryGroup,
  );
  const restoreAuxiliaryGroup = useWorkbenchStore(
    (state) => state.restoreAuxiliaryGroup,
  );
  const auxiliary = useWorkbenchStore((state) => state.auxiliary);

  const instance = getGroupInstanceForPanel(auxiliary, panelId);
  if (!instance) {
    return <TabContents props={props} />;
  }

  const handleClosePanel = () => closeAuxiliaryPanel(panelId);
  const handleCloseGroup = () =>
    minimizeAuxiliaryGroup(instance.groupInstanceId);
  const handleMaximizeToggle = () => {
    if (instance.isMaximized) {
      restoreAuxiliaryGroup(instance.groupInstanceId);
      return;
    }
    maximizeAuxiliaryGroup(instance.groupInstanceId);
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div className="workbench-aux-tab-trigger">
          <TabContents
            props={props}
            closeActionOverride={handleClosePanel}
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
            <X size={14} strokeWidth={1.9} />
            Close
          </ContextMenu.Item>
          <ContextMenu.Item
            className="workbench-context-menu__item"
            onSelect={handleCloseGroup}
          >
            <PinOff size={14} strokeWidth={1.9} />
            Close Group
          </ContextMenu.Item>

          <ContextMenu.Separator className="workbench-context-menu__separator" />

          <ContextMenu.Item
            className="workbench-context-menu__item"
            onSelect={handleMaximizeToggle}
          >
            <Maximize2 size={14} strokeWidth={1.9} />
            {instance.isMaximized ? 'Restore' : 'Maximize'}
          </ContextMenu.Item>
          <ContextMenu.Item
            className="workbench-context-menu__item"
            onSelect={handleClosePanel}
          >
            <Minimize2 size={14} strokeWidth={1.9} />
            Minimize
          </ContextMenu.Item>
          <ContextMenu.Item
            className="workbench-context-menu__item"
            onSelect={handleCloseGroup}
          >
            <PinOff size={14} strokeWidth={1.9} />
            Minimize Group
          </ContextMenu.Item>

          <ContextMenu.Separator className="workbench-context-menu__separator" />

          <ContextMenu.Item
            className="workbench-context-menu__item"
            disabled
          >
            Float
          </ContextMenu.Item>
          <ContextMenu.Item
            className="workbench-context-menu__item"
            disabled
          >
            Float Group
          </ContextMenu.Item>
          <ContextMenu.Item
            className="workbench-context-menu__item"
            disabled
          >
            Dock
          </ContextMenu.Item>
          <ContextMenu.Item
            className="workbench-context-menu__item"
            disabled
          >
            Dock Group
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export default function AuxiliaryTab(props: IDockviewPanelHeaderProps) {
  if (!isAuxiliaryPanelId(props.api.id)) {
    return <TabContents props={props} />;
  }

  return <AuxiliaryTabMenu props={props} />;
}
