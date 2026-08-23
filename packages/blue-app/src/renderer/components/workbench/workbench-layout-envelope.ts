import type { SerializedDockview } from 'dockview';
import {
  normalizeFloatingOriginMap,
  type DockingOrigin,
} from '../../../shared/workbench-window-contract';
import {
  cloneAuxiliaryLayoutState,
  createDefaultAuxiliaryLayoutState,
  type AuxiliaryLayoutState,
} from './auxiliary-layout-model';
import {
  isAuxiliaryLayoutStateV5,
  isLegacyStoredWorkbenchLayoutV2,
  isLegacyStoredWorkbenchLayoutV3,
  isLegacyStoredWorkbenchLayoutV4,
  isLegacyStoredWorkbenchLayoutV5,
  isLegacyStoredWorkbenchLayoutV6,
  isRecord,
  isSerializedDockview,
  normalizeStoredAuxiliaryLayoutState,
  upgradeV2ToV5,
  upgradeV3ToV5,
  upgradeV4ToV5,
} from './auxiliary-layout-migrations';

export interface StoredWorkbenchLayout {
  version: 7;
  dockview: SerializedDockview;
  auxiliary: AuxiliaryLayoutState;
  /**
   * Supplemental Blue-specific dock-back metadata keyed by Dockview popout
   * group id. Added in envelope version 6 (SPEC 055). Absent on layouts
   * migrated from version <= 5.
   */
  floatingOrigins?: Record<string, DockingOrigin>;
  /**
   * Panel-level placement captured by Close. This lets the Window menu reopen
   * a TopComponent in its prior auxiliary mode/edge rather than its default.
   */
  closedPanelOrigins?: Record<string, DockingOrigin>;
  updatedAt?: string;
}

function isStoredWorkbenchLayoutV7(value: unknown): value is StoredWorkbenchLayout {
  return (
    isRecord(value) &&
    value.version === 7 &&
    isSerializedDockview(value.dockview) &&
    isAuxiliaryLayoutStateV5(value.auxiliary)
  );
}

export function createStoredWorkbenchLayout(
  dockview: SerializedDockview,
  auxiliary: AuxiliaryLayoutState,
  options: {
    floatingOrigins?: Record<string, DockingOrigin>;
    closedPanelOrigins?: Record<string, DockingOrigin>;
    updatedAt?: string;
  } = {},
): StoredWorkbenchLayout {
  return {
    version: 7,
    dockview,
    auxiliary: cloneAuxiliaryLayoutState(auxiliary),
    ...(options.floatingOrigins && Object.keys(options.floatingOrigins).length > 0
      ? { floatingOrigins: { ...options.floatingOrigins } }
      : {}),
    ...(options.closedPanelOrigins && Object.keys(options.closedPanelOrigins).length > 0
      ? { closedPanelOrigins: { ...options.closedPanelOrigins } }
      : {}),
    ...(typeof options.updatedAt === 'string' ? { updatedAt: options.updatedAt } : {}),
  };
}

export function parseStoredWorkbenchLayout(serialized: string | null): {
  dockview?: SerializedDockview;
  auxiliary: AuxiliaryLayoutState;
  floatingOrigins?: Record<string, DockingOrigin>;
  closedPanelOrigins?: Record<string, DockingOrigin>;
} {
  const fallback = createDefaultAuxiliaryLayoutState();

  if (!serialized) {
    return { auxiliary: fallback };
  }

  try {
    const parsed = JSON.parse(serialized) as unknown;

    if (isStoredWorkbenchLayoutV7(parsed)) {
      return {
        dockview: parsed.dockview,
        auxiliary: normalizeStoredAuxiliaryLayoutState(parsed.auxiliary),
        ...(parsed.floatingOrigins && Object.keys(parsed.floatingOrigins).length > 0
          ? {
              floatingOrigins: normalizeFloatingOriginMap(parsed.floatingOrigins),
            }
          : {}),
        ...(parsed.closedPanelOrigins && Object.keys(parsed.closedPanelOrigins).length > 0
          ? {
              closedPanelOrigins: normalizeFloatingOriginMap(parsed.closedPanelOrigins),
            }
          : {}),
      };
    }

    if (isLegacyStoredWorkbenchLayoutV6(parsed)) {
      return {
        dockview: parsed.dockview,
        auxiliary: normalizeStoredAuxiliaryLayoutState(parsed.auxiliary),
        ...(parsed.floatingOrigins && Object.keys(parsed.floatingOrigins).length > 0
          ? {
              floatingOrigins: normalizeFloatingOriginMap(parsed.floatingOrigins),
            }
          : {}),
      };
    }

    if (isLegacyStoredWorkbenchLayoutV5(parsed)) {
      return {
        dockview: parsed.dockview,
        auxiliary: normalizeStoredAuxiliaryLayoutState(parsed.auxiliary),
      };
    }

    if (isLegacyStoredWorkbenchLayoutV4(parsed)) {
      return {
        dockview: parsed.dockview,
        auxiliary: normalizeStoredAuxiliaryLayoutState(upgradeV4ToV5(parsed.auxiliary)),
      };
    }

    if (isLegacyStoredWorkbenchLayoutV3(parsed)) {
      return {
        dockview: parsed.dockview,
        auxiliary: normalizeStoredAuxiliaryLayoutState(upgradeV3ToV5(parsed.auxiliary)),
      };
    }

    if (isLegacyStoredWorkbenchLayoutV2(parsed)) {
      return {
        dockview: parsed.dockview,
        auxiliary: normalizeStoredAuxiliaryLayoutState(upgradeV2ToV5(parsed.auxiliary)),
      };
    }

    if (isSerializedDockview(parsed)) {
      return {
        dockview: parsed,
        auxiliary: fallback,
      };
    }
  } catch {
    return { auxiliary: fallback };
  }

  return { auxiliary: fallback };
}
