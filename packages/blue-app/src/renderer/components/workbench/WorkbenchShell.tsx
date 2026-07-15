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
  type DockviewApi,
} from 'dockview';
import 'dockview/dist/styles/dockview.css';
import AuxiliaryRail from './AuxiliaryRail';
import AuxiliaryHeaderActions from './AuxiliaryHeaderActions';
import AuxiliarySlideout from './AuxiliarySlideout';
import AuxiliaryTab from './AuxiliaryTab';
import DockviewPanel from './DockviewPanel';
import { getPanel } from './panel-registry';
import {
  computeTabCommandState,
  type TabCommandContext,
  type TabCommandKind,
  type TabLocation,
} from './tab-command-state';
import {
  captureAuxiliaryDockedSizesFromApi,
  getAuxiliaryPanelPresentation,
  getAuxiliarySlideoutForEdge,
  getMinimizedTabsForEdge,
  getGroupInstanceForPanel,
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
import { useLayoutSettingsStore } from '../../stores/layout-settings-store';
import { useRenderAndPlayInterceptor } from './panels/audio-player/use-render-and-play';
import type {
  DisplayWorkArea,
  WindowLayoutSettingsSnapshot,
} from '../../../shared/window-layout-settings';

const LAYOUT_STORAGE_KEY = 'blue-workbench-layout';
const AUXILIARY_DRAG_THRESHOLD = 8;

export function selectWorkbenchLayout(
  layoutSnapshot: Pick<WindowLayoutSettingsSnapshot, 'workbench' | 'lastResetAt'> | null | undefined,
  legacyLayout: string | null,
): string | null {
  // A reset marker means the next workbench must be rebuilt from defaults.
  // This also repairs layouts written by an older reset race.
  if (layoutSnapshot?.lastResetAt) {
    return null;
  }

  const canonicalLayout = layoutSnapshot?.workbench?.serializedLayout;
  if (typeof canonicalLayout === 'string') {
    return canonicalLayout;
  }

  return layoutSnapshot?.lastResetAt ? null : legacyLayout;
}

export function removeLegacyWelcomePanel(
  api: Pick<DockviewApi, 'getPanel'>,
): void {
  api.getPanel('WelcomeTopComponent')?.api.close();
}

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

interface HeaderContextMenuState {
  x: number;
  y: number;
  panelId: string;
}

const AUXILIARY_EDGES: AuxiliaryEdge[] = ['left', 'right', 'bottom'];

function isAuxiliaryEdge(value: string | undefined): value is AuxiliaryEdge {
  return value !== undefined && AUXILIARY_EDGES.includes(value as AuxiliaryEdge);
}

/**
 * Reads every Dockview group and reports panel ownership to the main-process
 * workbench window registry so that Window-menu reveal commands can locate
 * which window owns a given panel (SPEC 055 US6, FR-024/FR-025).
 *
 * Grid panels are reported as owned by the main window. Popout groups are
 * reported as owned by their floating window (matched by popoutGroupId).
 */
export function reportOwnership(api: DockviewApi, windowId?: string) {
  const blueAPI =
    typeof window !== 'undefined' ? (window as { blueAPI?: Record<string, (...args: unknown[]) => unknown> }).blueAPI : undefined;
  if (!blueAPI) return;

  try {
    // Report grid panels as owned by the main window.
    const gridPanelIds: string[] = [];
    let activePanelId: string | undefined;

    for (const group of api.groups) {
      if (group.api.location.type === 'popout') continue;

      for (const panel of group.panels) {
        gridPanelIds.push(panel.id);
      }

      if (!activePanelId && group.activePanel) {
        activePanelId = group.activePanel.id;
      }
    }

    blueAPI['updateWorkbenchOwnership']({
      windowId: windowId ?? 'main',
      role: 'main',
      panelIds: gridPanelIds,
      activePanelId,
    });

    // Report each popout group as owned by its floating window. The main
    // process resolves the windowId from the popoutGroupId via the registry.
    for (const group of api.groups) {
      if (group.api.location.type !== 'popout') continue;

      const popoutPanelIds = group.panels.map((p) => p.id);
      const popoutActiveId = group.activePanel?.id;

      blueAPI['updateWorkbenchOwnership']({
        windowId: windowId ?? 'main',
        role: 'floating',
        popoutGroupId: group.id,
        panelIds: popoutPanelIds,
        activePanelId: popoutActiveId,
      });
    }
  } catch {
    // BlueAPI may not be available in test environments; ignore.
  }
}

export default function WorkbenchShell() {
  useRenderAndPlayInterceptor();
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
  const workbenchWindowIdRef = useRef<string | undefined>(undefined);
  const layoutHydratedRef = useRef(false);
  const suppressLayoutPersistenceRef = useRef(false);
  const pendingDockviewSizeSnapshotRef =
    useRef<AuxiliaryDockedSizeSnapshot | null>(null);
  const pendingManualDragSizeSnapshotRef =
    useRef<AuxiliaryDockedSizeSnapshot | null>(null);
  const pendingDragRef = useRef<PendingAuxiliaryDrag | null>(null);
  const activeDragRef = useRef<ActiveAuxiliaryDrag | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveAuxiliaryDrag | null>(null);
  const [headerContextMenu, setHeaderContextMenu] =
    useState<HeaderContextMenuState | null>(null);

  const disposeListeners = useCallback(() => {
    for (const disposable of listenersRef.current) {
      disposable.dispose();
    }
    listenersRef.current = [];
  }, []);

  const persistLayout = useCallback(() => {
    if (
      !layoutHydratedRef.current ||
      suppressLayoutPersistenceRef.current
    ) {
      return;
    }

    const layout = useWorkbenchStore.getState().saveLayout();
    if (!layout) return;

    // Keep the legacy localStorage key in sync so existing users do not lose
    // their layout on the first launch with the new app-wide store. The
    // canonical source is the app-wide layout settings; this mirror is a
    // best-effort fallback only.
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
    } catch {
      // localStorage may be unavailable in private mode; ignore.
    }

    // Persist the workbench envelope through the canonical app-wide store.
    void useLayoutSettingsStore.getState().updateWorkbenchLayout(layout);
  }, []);

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      disposeListeners();
      layoutHydratedRef.current = false;
      setApi(event.api);

      void (async () => {
        const layoutStore = useLayoutSettingsStore.getState();
        if (!layoutStore.layout) {
          await layoutStore.load();
        }

        const blueAPI =
          typeof window !== 'undefined'
            ? (window as {
                blueAPI?: Record<string, (...args: unknown[]) => unknown>;
              }).blueAPI
            : undefined;
        let displayWorkAreas: DisplayWorkArea[] | undefined;
        try {
          displayWorkAreas = (await blueAPI?.['getDisplayWorkAreas']?.()) as
            | DisplayWorkArea[]
            | undefined;
        } catch {
          // Keep the renderer viewport fallback when the main process is
          // unavailable during tests or early startup.
        }

        // Prefer the canonical app-wide workbench layout; fall back to legacy
        // localStorage so existing users see their saved workspace on first
        // launch with the new contract.
        const layoutSnapshot = useLayoutSettingsStore.getState().layout;
        const fallbackLegacyLayout = (() => {
          try {
            return localStorage.getItem(LAYOUT_STORAGE_KEY);
          } catch {
            return null;
          }
        })();
        useWorkbenchStore
          .getState()
          .loadLayout(
            selectWorkbenchLayout(layoutSnapshot, fallbackLegacyLayout),
            displayWorkAreas,
          );
        removeLegacyWelcomePanel(event.api);
        useWorkbenchStore.getState().syncAuxiliaryLayout();

        reportOwnership(event.api, workbenchWindowIdRef.current);

        // Confirm renderer-side registration with the main-process registry.
        // The main window is already registered by createWindow() in main.ts;
        // this call ensures the renderer receives its canonical windowId for
        // future ownership updates.
        if (blueAPI) {
          try {
            const result = await blueAPI['registerWorkbenchWindow']({ role: 'main' }) as { windowId?: string } | undefined;
            if (result?.windowId) {
              workbenchWindowIdRef.current = result.windowId;
              reportOwnership(event.api, result.windowId);
            }
          } catch {
            // BlueAPI may not be available in test environments; ignore.
          }
        }

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
            reportOwnership(event.api, workbenchWindowIdRef.current);
          }),
          event.api.onDidActivePanelChange(() => {
            useWorkbenchStore.getState().syncAuxiliaryLayout();
            persistLayout();
            reportOwnership(event.api, workbenchWindowIdRef.current);
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
            reportOwnership(event.api, workbenchWindowIdRef.current);
          }),
        ];

        layoutHydratedRef.current = true;
        persistLayout();
      })();
    },
    [disposeListeners, movePanelToEdge, persistLayout, setApi],
  );

  useEffect(() => {
    function handleBeforeUnload() {
      persistLayout();
    }

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Apply optimistic Reset Windows broadcast: clear the local snapshot, ask
    // the workbench to drop its layout, and let the canonical reset IPC
    // resolve separately through the layout store.
    const blueAPI = typeof window !== 'undefined' ? window.blueAPI : undefined;
    const ipc = blueAPI as unknown as {
      onWindowLayoutReset?: (cb: () => void) => () => void;
    } | undefined;
    const unsubscribeReset = ipc?.onWindowLayoutReset?.(() => {
      suppressLayoutPersistenceRef.current = true;
      try {
        useLayoutSettingsStore.getState().applyReset();
        try {
          localStorage.removeItem(LAYOUT_STORAGE_KEY);
        } catch {
          // localStorage may be unavailable in private mode; ignore.
        }
        useWorkbenchStore.getState().resetLayout();
      } finally {
        suppressLayoutPersistenceRef.current = false;
        persistLayout();
      }
    });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unsubscribeReset?.();
    };
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

    function handleContextMenu(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest('.dv-tab')) {
        return;
      }

      const header = target.closest<HTMLElement>('.dv-tabs-and-actions-container');
      if (!header) {
        return;
      }

      const { api } = useWorkbenchStore.getState();
      const group = api?.groups.find((candidate) =>
        (candidate as { element?: HTMLElement }).element?.contains(header),
      );
      const panelId = group?.activePanel?.id ?? group?.panels[0]?.id;
      if (!group || !panelId) {
        return;
      }

      event.preventDefault();
      group.activePanel?.api.setActive();
      group.focus();
      setHeaderContextMenu({ x: event.clientX, y: event.clientY, panelId });
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
    shell.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', clearDragState);
    window.addEventListener('blur', clearDragState);

    return () => {
      shell.removeEventListener('pointerdown', handlePointerDown, true);
      shell.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', clearDragState);
      window.removeEventListener('blur', clearDragState);
    };
  }, [moveAuxiliaryEdge, movePanelToEdge]);

  useEffect(() => {
    return () => {
      layoutHydratedRef.current = false;
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

      {headerContextMenu ? (
        <WorkbenchHeaderContextMenu
          menu={headerContextMenu}
          onClose={() => setHeaderContextMenu(null)}
        />
      ) : null}
    </div>
  );
}

function WorkbenchHeaderContextMenu({
  menu,
  onClose,
}: {
  menu: HeaderContextMenuState;
  onClose: () => void;
}) {
  const api = useWorkbenchStore((s) => s.api);
  const auxiliary = useWorkbenchStore((s) => s.auxiliary);
  const closeGroup = useWorkbenchStore((s) => s.closeGroup);
  const floatGroup = useWorkbenchStore((s) => s.floatGroup);
  const dockGroup = useWorkbenchStore((s) => s.dockGroup);
  const minimizeAuxiliaryGroup = useWorkbenchStore((s) => s.minimizeAuxiliaryGroup);
  const newDocumentTabGroup = useWorkbenchStore((s) => s.newDocumentTabGroup);
  const collapseDocumentTabGroup = useWorkbenchStore((s) => s.collapseDocumentTabGroup);

  useEffect(() => {
    const close = () => onClose();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  const panel = api?.getPanel(menu.panelId);
  if (!api || !panel) {
    return null;
  }

  const descriptor = getPanel(menu.panelId);
  const groupPanelIds = panel.group.panels.map((candidate) => candidate.id);
  const dockviewLocation = panel.api.location.type;
  const auxiliaryPresentation = isAuxiliaryPanelId(menu.panelId)
    ? getAuxiliaryPanelPresentation(auxiliary, menu.panelId)
    : undefined;
  const location: TabLocation =
    dockviewLocation === 'popout' || dockviewLocation === 'floating'
      ? 'floating'
      : (auxiliaryPresentation ?? 'docked');
  const dockedEditorGroupCount = api.groups.filter(
    (group) =>
      group.api.location.type !== 'popout' &&
      group.panels.some((candidate) => (getPanel(candidate.id)?.mode ?? 'editor') === 'editor'),
  ).length;
  const commandContext: TabCommandContext = {
    panelId: menu.panelId,
    groupId: panel.group.id,
    groupPanelIds,
    activePanelId: panel.group.activePanel?.id ?? menu.panelId,
    location,
    mode: descriptor?.mode ?? 'editor',
    isAuxiliary: isAuxiliaryPanelId(menu.panelId),
    isClosable: descriptor?.isClosable ?? true,
    isFloatable: descriptor?.isFloatable ?? true,
    isCloneable: false,
    isMaximized: panel.api.isMaximized(),
    dockedEditorGroupCount,
    siblingClosable: (panelId) => getPanel(panelId)?.isClosable ?? true,
    siblingFloatable: (panelId) => getPanel(panelId)?.isFloatable ?? true,
  };
  const commandState = computeTabCommandState(commandContext);

  const groupSurfaceDisabled: ReadonlySet<TabCommandKind> = new Set([
    'close',
    'close-other',
    'maximize',
    'restore',
    'minimize',
    'float',
    'dock',
    'shift-left',
    'shift-right',
    'move',
    'clone',
    'new-document-tab-group',
  ]);

  const runCommand = (kind: TabCommandKind) => {
    onClose();
    switch (kind) {
      case 'close-all':
      case 'close-group':
        return closeGroup(menu.panelId);
      case 'float-group':
        return floatGroup(menu.panelId);
      case 'dock-group':
        return dockGroup(menu.panelId);
      case 'minimize-group': {
        const instance = getGroupInstanceForPanel(auxiliary, menu.panelId);
        if (instance) {
          return minimizeAuxiliaryGroup(instance.groupInstanceId);
        }
        return;
      }
      case 'collapse-document-tab-group':
        return collapseDocumentTabGroup(menu.panelId);
      case 'new-document-tab-group':
        return newDocumentTabGroup(menu.panelId);
      default:
        return;
    }
  };

  return (
    <div
      className="workbench-context-menu"
      role="menu"
      style={{ position: 'fixed', left: menu.x, top: menu.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {commandState.commands.map((command, index) => {
        const previousKind = commandState.commands[index - 1]?.kind;
        const showSeparator = index > 0 && headerGroupOf(previousKind) !== headerGroupOf(command.kind);
        const enabled = command.enabled && !groupSurfaceDisabled.has(command.kind);
        return (
          <div key={command.kind}>
            {showSeparator ? (
              <div className="workbench-context-menu__separator" aria-hidden="true" />
            ) : null}
            <button
              type="button"
              role="menuitem"
              className="workbench-context-menu__item"
              data-disabled={!enabled ? '' : undefined}
              disabled={!enabled}
              onClick={() => runCommand(command.kind)}
            >
              {command.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function headerGroupOf(kind: TabCommandKind | undefined): string {
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
