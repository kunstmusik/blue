import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  DockviewReact,
  DockviewReadyEvent,
} from 'dockview';
import 'dockview/dist/styles/dockview.css';
import AuxiliaryRail from './AuxiliaryRail';
import AuxiliaryHeaderActions from './AuxiliaryHeaderActions';
import AuxiliarySlideout from './AuxiliarySlideout';
import AuxiliaryTab from './AuxiliaryTab';
import DockviewPanel from './DockviewPanel';
import {
  captureAuxiliaryDockedSizesFromApi,
  getAuxiliarySlideoutForEdge,
  getMinimizedTabsForEdge,
  isAuxiliaryPanelId,
  logAuxiliaryDockedSizeDebug,
  shouldPreventAuxiliaryPanelDrop,
  type AuxiliaryDockedSizeSnapshot,
  type AuxiliaryEdge,
} from './auxiliary-layout';
import {
  getAuxiliaryEdgeDropTarget,
  getAuxiliaryEdgeFromBounds,
  getAuxiliaryEdgeFromGroupElement,
} from './auxiliary-drag';
import { useDocumentMouseDownOutside } from '../../hooks/use-document-mousedown-outside';
import { useWorkbenchStore } from '../../stores/workbench-store';

const LAYOUT_STORAGE_KEY = 'blue-workbench-layout';
const AUXILIARY_DRAG_THRESHOLD = 8;

interface PendingAuxiliaryDrag {
  kind: 'edge' | 'panel';
  groupInstanceId?: string;
  panelId?: string;
  sourceEdge: AuxiliaryEdge;
  startX: number;
  startY: number;
}

interface ActiveAuxiliaryDrag extends PendingAuxiliaryDrag {
  targetEdge?: AuxiliaryEdge;
}

const AUXILIARY_EDGES: AuxiliaryEdge[] = ['left', 'right', 'bottom'];

function isAuxiliaryEdge(value: string | undefined): value is AuxiliaryEdge {
  return value !== undefined && AUXILIARY_EDGES.includes(value as AuxiliaryEdge);
}

export default function WorkbenchShell() {
  const auxiliary = useWorkbenchStore((s) => s.auxiliary);
  const toggleAuxiliaryPanel = useWorkbenchStore((s) => s.toggleAuxiliaryPanel);
  const dockAuxiliaryPanel = useWorkbenchStore((s) => s.dockAuxiliaryPanel);
  const hideAllAuxiliarySlideouts = useWorkbenchStore(
    (s) => s.hideAllAuxiliarySlideouts,
  );
  const resizeAuxiliarySlideout = useWorkbenchStore(
    (s) => s.resizeAuxiliarySlideout,
  );
  const closeAuxiliaryPanel = useWorkbenchStore((s) => s.closeAuxiliaryPanel);
  const restoreAuxiliaryGroup = useWorkbenchStore((s) => s.restoreAuxiliaryGroup);
  const moveAuxiliaryEdge = useWorkbenchStore((s) => s.moveAuxiliaryEdge);
  const movePanelToEdge = useWorkbenchStore((s) => s.movePanelToEdge);
  const setApi = useWorkbenchStore((s) => s.setApi);
  const leftTabs = getMinimizedTabsForEdge(auxiliary, 'left');
  const rightTabs = getMinimizedTabsForEdge(auxiliary, 'right');
  const bottomTabs = getMinimizedTabsForEdge(auxiliary, 'bottom');
  const leftSlideout = getAuxiliarySlideoutForEdge(auxiliary, 'left');
  const rightSlideout = getAuxiliarySlideoutForEdge(auxiliary, 'right');
  const bottomSlideout = getAuxiliarySlideoutForEdge(auxiliary, 'bottom');
  const shellRef = useRef<HTMLDivElement | null>(null);
  const listenersRef = useRef<Array<{ dispose: () => void }>>([]);
  const pendingDockviewSizeSnapshotRef =
    useRef<AuxiliaryDockedSizeSnapshot | null>(null);
  const pendingManualDragSizeSnapshotRef =
    useRef<AuxiliaryDockedSizeSnapshot | null>(null);
  const pendingDragRef = useRef<PendingAuxiliaryDrag | null>(null);
  const activeDragRef = useRef<ActiveAuxiliaryDrag | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveAuxiliaryDrag | null>(null);

  const disposeListeners = useCallback(() => {
    for (const disposable of listenersRef.current) {
      disposable.dispose();
    }
    listenersRef.current = [];
  }, []);

  const persistLayout = useCallback(() => {
    const layout = useWorkbenchStore.getState().saveLayout();
    if (layout) {
      localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
    }
  }, []);

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      disposeListeners();
      setApi(event.api);
      useWorkbenchStore.getState().loadLayout(
        localStorage.getItem(LAYOUT_STORAGE_KEY),
      );
      useWorkbenchStore.getState().syncAuxiliaryLayout();

      listenersRef.current = [
        event.api.onWillDragGroup((dragEvent) => {
          if (
            dragEvent.group.panels.some((panel) => isAuxiliaryPanelId(panel.id))
          ) {
            dragEvent.nativeEvent.preventDefault();
          }
        }),
        event.api.onWillDrop((dropEvent) => {
          const transfer = dropEvent.getData();

          if (transfer?.panelId && isAuxiliaryPanelId(transfer.panelId)) {
            pendingDockviewSizeSnapshotRef.current =
              captureAuxiliaryDockedSizesFromApi(
                event.api,
                useWorkbenchStore.getState().auxiliary,
              );
            logAuxiliaryDockedSizeDebug('shell.onWillDrop snapshot', event.api, {
              snapshot: pendingDockviewSizeSnapshotRef.current,
              state: useWorkbenchStore.getState().auxiliary,
              meta: {
                panelId: transfer.panelId,
                dropKind: dropEvent.kind,
                targetGroupId: dropEvent.group?.id,
              },
            });
          }

          if (
            shouldPreventAuxiliaryPanelDrop(
              transfer?.panelId,
              dropEvent.group?.id,
              dropEvent.kind,
            )
          ) {
            dropEvent.preventDefault();
          }
        }),
        event.api.onDidLayoutChange(() => {
          useWorkbenchStore.getState().syncAuxiliaryLayout();
          persistLayout();
        }),
        event.api.onDidActivePanelChange(() => {
          useWorkbenchStore.getState().syncAuxiliaryLayout();
          persistLayout();
        }),
        event.api.onDidDrop(() => {
          pendingDockviewSizeSnapshotRef.current = null;
        }),
        event.api.onDidMovePanel(({ panel, from }) => {
          if (!isAuxiliaryPanelId(panel.id) || panel.group.id === from.id) {
            return;
          }

          const shell = shellRef.current;
          const mainElement = shell?.querySelector<HTMLElement>(
            '.workbench-shell__main',
          );

          const targetEdge =
            getAuxiliaryEdgeFromGroupElement(panel.group.element) ??
            (mainElement
              ? getAuxiliaryEdgeFromBounds(
                  mainElement.getBoundingClientRect(),
                  panel.group.element.getBoundingClientRect(),
                )
              : undefined);

          if (!targetEdge) {
            pendingDockviewSizeSnapshotRef.current = null;
            return;
          }

          const preservedDockedSizes =
            pendingDockviewSizeSnapshotRef.current ?? undefined;
          logAuxiliaryDockedSizeDebug('shell.onDidMovePanel before store move', event.api, {
            snapshot: preservedDockedSizes,
            state: useWorkbenchStore.getState().auxiliary,
            meta: {
              panelId: panel.id,
              fromGroupId: from.id,
              toGroupId: panel.group.id,
              targetEdge,
            },
          });
          pendingDockviewSizeSnapshotRef.current = null;
          movePanelToEdge(panel.id, targetEdge, preservedDockedSizes);
        }),
      ];

      persistLayout();
    },
    [disposeListeners, movePanelToEdge, persistLayout, setApi],
  );

  useEffect(() => {
    function handleBeforeUnload() {
      persistLayout();
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [persistLayout]);

  useEffect(() => {
    if (useWorkbenchStore.getState().api) {
      persistLayout();
    }
  }, [auxiliary, persistLayout]);

  const isAuxiliaryOverlayTarget = useCallback((target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    return Boolean(
      element?.closest('[data-auxiliary-slideout="true"]')
      || element?.closest('[data-auxiliary-rail="true"]'),
    );
  }, []);

  useDocumentMouseDownOutside({
    enabled: Boolean(leftSlideout || rightSlideout || bottomSlideout),
    isInside: isAuxiliaryOverlayTarget,
    onMouseDownOutside: () => hideAllAuxiliarySlideouts(),
  });

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    function clearDragState() {
      pendingDragRef.current = null;
      activeDragRef.current = null;
      pendingManualDragSizeSnapshotRef.current = null;
      setActiveDrag(null);
    }

    function snapshotDockedSizes() {
      const { api, auxiliary } = useWorkbenchStore.getState();
      if (!api) {
        return;
      }

      pendingManualDragSizeSnapshotRef.current = captureAuxiliaryDockedSizesFromApi(
        api,
        auxiliary,
      );
      logAuxiliaryDockedSizeDebug('shell.manualDrag snapshot', api, {
        snapshot: pendingManualDragSizeSnapshotRef.current,
        state: auxiliary,
      });
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (!target || target.closest('[data-aux-drag-ignore="true"]')) {
        return;
      }

      const slideoutHandle = target.closest<HTMLElement>(
        '[data-aux-slideout-drag-handle="true"]',
      );
      if (slideoutHandle) {
        const panelId = slideoutHandle.dataset.auxPanelId;
        const sourceEdge = slideoutHandle.dataset.auxEdge;

        if (panelId && isAuxiliaryEdge(sourceEdge)) {
          snapshotDockedSizes();
          pendingDragRef.current = {
            kind: 'panel',
            panelId,
            sourceEdge,
            startX: event.clientX,
            startY: event.clientY,
          };
        }
        return;
      }

      const groupElement = target.closest<HTMLElement>('[data-aux-edge]');
      const inHeader = target.closest('.dv-tabs-and-actions-container');
      const onTab = target.closest('.dv-tab');
      const tabCount = Number(groupElement?.dataset.auxGroupTabCount ?? '0');
      const allowFromTab = tabCount === 1;

      if (groupElement && inHeader && (!onTab || allowFromTab)) {
        const sourceEdge = groupElement.dataset.auxEdge;

        if (isAuxiliaryEdge(sourceEdge)) {
          snapshotDockedSizes();
          pendingDragRef.current = {
            kind: 'edge',
            sourceEdge,
            startX: event.clientX,
            startY: event.clientY,
          };
        }
      }
    }

    function handlePointerMove(event: PointerEvent) {
      const pending = pendingDragRef.current;
      if (!pending) {
        return;
      }

      const distance = Math.hypot(
        event.clientX - pending.startX,
        event.clientY - pending.startY,
      );

      if (distance < AUXILIARY_DRAG_THRESHOLD) {
        return;
      }

      const bounds = shell.getBoundingClientRect();
      const targetEdge = getAuxiliaryEdgeDropTarget(bounds, {
        x: event.clientX,
        y: event.clientY,
      });

      setActiveDrag((current) => {
        const next: ActiveAuxiliaryDrag = {
          ...pending,
          targetEdge,
        };

        if (
          current &&
          current.kind === next.kind &&
          current.groupInstanceId === next.groupInstanceId &&
          current.panelId === next.panelId &&
          current.sourceEdge === next.sourceEdge &&
          current.targetEdge === next.targetEdge
        ) {
          return current;
        }

        activeDragRef.current = next;
        return next;
      });
    }

    function handlePointerUp() {
      const completed = activeDragRef.current;

      if (
        completed &&
        completed.targetEdge &&
        completed.targetEdge !== completed.sourceEdge
      ) {
        const preservedDockedSizes =
          pendingManualDragSizeSnapshotRef.current ?? undefined;
        const { api, auxiliary } = useWorkbenchStore.getState();
        if (api) {
          logAuxiliaryDockedSizeDebug('shell.manualDrag before store move', api, {
            snapshot: preservedDockedSizes,
            state: auxiliary,
            meta: {
              kind: completed.kind,
              panelId: completed.panelId,
              sourceEdge: completed.sourceEdge,
              targetEdge: completed.targetEdge,
            },
          });
        }
        if (completed.kind === 'edge') {
          moveAuxiliaryEdge(
            completed.sourceEdge,
            completed.targetEdge,
            preservedDockedSizes,
          );
        } else if (completed.kind === 'panel' && completed.panelId) {
          movePanelToEdge(
            completed.panelId,
            completed.targetEdge,
            preservedDockedSizes,
          );
        }
      }

      clearDragState();
    }

    shell.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', clearDragState);
    window.addEventListener('blur', clearDragState);

    return () => {
      shell.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', clearDragState);
      window.removeEventListener('blur', clearDragState);
    };
  }, [moveAuxiliaryEdge, movePanelToEdge]);

  useEffect(() => {
    return () => {
      disposeListeners();
      setApi(null);
    };
  }, [disposeListeners, setApi]);

  return (
    <div
      ref={shellRef}
      className="workbench-shell"
      style={
        {
          '--workbench-left-rail-width': leftTabs.length > 0 ? '40px' : '0px',
          '--workbench-right-rail-width': rightTabs.length > 0 ? '40px' : '0px',
          '--workbench-bottom-rail-height':
            bottomTabs.length > 0 ? '36px' : '0px',
        } as CSSProperties
      }
      data-aux-dragging={activeDrag ? 'true' : undefined}
    >
      <div
        className="workbench-shell__main dv-dockview-theme-abyss"
        style={{
          backgroundColor: 'var(--dv-paneview-active-border-color)',
        }}
      >
        <div className="workbench-shell__dockview">
          <DockviewReact
            onReady={onReady}
            components={{ default: DockviewPanel }}
            defaultTabComponent={AuxiliaryTab}
            rightHeaderActionsComponent={AuxiliaryHeaderActions}
            hideBorders={false}
          />
        </div>
      </div>

      {leftSlideout ? (
        <AuxiliarySlideout
          slideout={leftSlideout}
          onClose={() => {
            closeAuxiliaryPanel(leftSlideout.panelId);
          }}
          onDock={() => dockAuxiliaryPanel(leftSlideout.panelId)}
          onResize={(size) => resizeAuxiliarySlideout(leftSlideout.panelId, size)}
        />
      ) : null}

      {rightSlideout ? (
        <AuxiliarySlideout
          slideout={rightSlideout}
          onClose={() => {
            closeAuxiliaryPanel(rightSlideout.panelId);
          }}
          onDock={() => dockAuxiliaryPanel(rightSlideout.panelId)}
          onResize={(size) =>
            resizeAuxiliarySlideout(rightSlideout.panelId, size)
          }
        />
      ) : null}

      {bottomSlideout ? (
        <AuxiliarySlideout
          slideout={bottomSlideout}
          onClose={() => {
            closeAuxiliaryPanel(bottomSlideout.panelId);
          }}
          onDock={() => dockAuxiliaryPanel(bottomSlideout.panelId)}
          onResize={(size) =>
            resizeAuxiliarySlideout(bottomSlideout.panelId, size)
          }
        />
      ) : null}

      {activeDrag ? (
        <>
          <div
            className={[
              'workbench-aux-edge-drop-target',
              'workbench-aux-edge-drop-target--left',
              activeDrag.targetEdge === 'left' ? 'is-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden="true"
          />
          <div
            className={[
              'workbench-aux-edge-drop-target',
              'workbench-aux-edge-drop-target--right',
              activeDrag.targetEdge === 'right' ? 'is-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden="true"
          />
          <div
            className={[
              'workbench-aux-edge-drop-target',
              'workbench-aux-edge-drop-target--bottom',
              activeDrag.targetEdge === 'bottom' ? 'is-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden="true"
          />
        </>
      ) : null}

      {leftTabs.length > 0 ? (
        <AuxiliaryRail
          edge="left"
          tabs={leftTabs}
          onSelect={toggleAuxiliaryPanel}
          onRestoreGroup={() => restoreAuxiliaryGroup(leftTabs[0]!.groupInstanceId)}
        />
      ) : null}

      {rightTabs.length > 0 ? (
        <AuxiliaryRail
          edge="right"
          tabs={rightTabs}
          onSelect={toggleAuxiliaryPanel}
          onRestoreGroup={() => restoreAuxiliaryGroup(rightTabs[0]!.groupInstanceId)}
        />
      ) : null}

      {bottomTabs.length > 0 ? (
        <AuxiliaryRail
          edge="bottom"
          tabs={bottomTabs}
          onSelect={toggleAuxiliaryPanel}
          onRestoreGroup={() => restoreAuxiliaryGroup(bottomTabs[0]!.groupInstanceId)}
        />
      ) : null}

      {leftTabs.length > 0 && rightTabs.length > 0 ? (
        <div className="workbench-shell__corner" aria-hidden="true" />
      ) : null}

      {leftTabs.length > 0 && bottomTabs.length > 0 ? (
        <div className="workbench-shell__corner workbench-shell__corner--left-bottom" aria-hidden="true" />
      ) : null}

      {rightTabs.length > 0 && bottomTabs.length > 0 ? (
        <div className="workbench-shell__corner workbench-shell__corner--right-bottom" aria-hidden="true" />
      ) : null}
    </div>
  );
}
