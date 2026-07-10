/**
 * Main-process registry for workbench renderer windows (SPEC 055).
 *
 * Tracks main and floating workbench windows, their panel ownership, and routes
 * Window-menu reveal commands so existing panels are focused instead of
 * duplicated. Electron `BrowserWindow` interaction is injected as a handle so
 * the registry stays unit-testable without Electron.
 *
 * Browser-safe at the logic level; this module is imported by the Electron main
 * process only but deliberately avoids importing Electron directly.
 */

import {
  type WorkbenchCloseSource,
  type WorkbenchWindowRole,
} from '../shared/workbench-window-contract';

/**
 * Minimal handle around an OS-level window. In production these wrap an
 * Electron `BrowserWindow`; in tests they are plain stubs.
 */
export interface WorkbenchWindowHandle {
  focus(): void;
  isDestroyed(): boolean;
}

export interface WorkbenchWindowEntry {
  windowId: string;
  role: WorkbenchWindowRole;
  popoutGroupId?: string;
  browserWindowId?: number;
  panelIds: string[];
  activePanelId?: string;
  projectSessionId?: number;
  handle?: WorkbenchWindowHandle;
}

/**
 * Per-panel close eligibility check. Returns the subset of panel ids that may
 * not close and whether a user prompt is required. Injected per window so the
 * registry does not hard-code panel close policy.
 */
export type WorkbenchClosePolicy = (
  panelIds: string[],
) => { blockedPanelIds: string[]; requiresPrompt: boolean };

export interface RegisterWorkbenchWindowOptions {
  role: WorkbenchWindowRole;
  popoutGroupId?: string;
  projectSessionId?: number;
  browserWindowId?: number;
  handle?: WorkbenchWindowHandle;
}

export interface ResolveRevealResult {
  handled: boolean;
  focusedWindowId?: string;
  openedInDefaultMode?: boolean;
}

export interface RequestCloseResult {
  allowed: boolean;
  blockedPanelIds?: string[];
  requiresPrompt?: boolean;
}

export class WorkbenchWindowManager {
  private readonly entries = new Map<string, WorkbenchWindowEntry>();
  private nextId = 1;
  private mainWindowId: string | undefined;

  register(options: RegisterWorkbenchWindowOptions): string {
    const windowId = `wbw-${this.nextId++}`;
    const entry: WorkbenchWindowEntry = {
      windowId,
      role: options.role,
      popoutGroupId: options.popoutGroupId,
      projectSessionId: options.projectSessionId,
      browserWindowId: options.browserWindowId,
      panelIds: [],
      handle: options.handle,
    };
    this.entries.set(windowId, entry);
    if (options.role === 'main' && this.mainWindowId === undefined) {
      this.mainWindowId = windowId;
    }
    return windowId;
  }

  updateOwnership(update: {
    windowId: string;
    role?: WorkbenchWindowRole;
    popoutGroupId?: string;
    panelIds?: string[];
    activePanelId?: string;
    projectSessionId?: number;
  }): void {
    const entry = this.entries.get(update.windowId);
    if (!entry) return;
    if (update.role !== undefined) entry.role = update.role;
    if (update.popoutGroupId !== undefined) {
      entry.popoutGroupId = update.popoutGroupId;
    }
    if (Array.isArray(update.panelIds)) {
      entry.panelIds = [...update.panelIds];
    }
    if (update.activePanelId !== undefined) {
      entry.activePanelId = update.activePanelId;
    }
    if (update.projectSessionId !== undefined) {
      entry.projectSessionId = update.projectSessionId;
    }
  }

  /**
   * Resolves a Window-menu reveal target. Prefers a live owner window (focuses
   * it) over opening a duplicate. Returns `handled: false` when no live owner
   * exists so the caller can route the command to the main workbench renderer.
   */
  resolveReveal(panelId: string): ResolveRevealResult {
    const owner = this.findLiveOwner(panelId);
    if (owner) {
      owner.handle?.focus();
      return { handled: true, focusedWindowId: owner.windowId, openedInDefaultMode: false };
    }
    return { handled: false };
  }

  /**
   * Applies close policy for a close request. Looks up the entry by windowId
   * and cross-checks the requested panelIds against the entry's actual panels.
   * A close is allowed only when no hosted panel blocks it. The caller is
   * responsible for the actual removal once allowed.
   */
  requestClose(
    request: {
      windowId: string;
      panelIds: string[];
      source?: WorkbenchCloseSource;
      policy?: WorkbenchClosePolicy;
    },
  ): RequestCloseResult {
    const entry = this.entries.get(request.windowId);
    // Use the entry's panelIds if available; fall back to the request's list.
    const panelIds = entry
      ? request.panelIds.filter((id) => entry.panelIds.includes(id))
      : request.panelIds;

    const policy = request.policy;
    if (!policy) return { allowed: true };
    const { blockedPanelIds, requiresPrompt } = policy(panelIds);
    if (blockedPanelIds.length > 0) {
      return { allowed: false, blockedPanelIds, requiresPrompt };
    }
    if (requiresPrompt) {
      return { allowed: true, requiresPrompt: true };
    }
    return { allowed: true };
  }

  /**
   * Removes a window from the registry. Called when a window is closed or when
   * {@link pruneDestroyed} detects a destroyed handle.
   */
  dispose(windowId: string): void {
    this.entries.delete(windowId);
    if (this.mainWindowId === windowId) {
      this.mainWindowId = undefined;
    }
  }

  /**
   * Drops any entry whose handle reports destroyed. Safe to call periodically
   * or before reveal/close resolution.
   */
  pruneDestroyed(): void {
    for (const [windowId, entry] of this.entries) {
      if (entry.handle?.isDestroyed()) {
        this.dispose(windowId);
      }
    }
  }

  getMainWindowId(): string | undefined {
    return this.mainWindowId;
  }

  getEntry(windowId: string): WorkbenchWindowEntry | undefined {
    return this.entries.get(windowId);
  }

  getByPopoutGroup(popoutGroupId: string): WorkbenchWindowEntry | undefined {
    for (const entry of this.entries.values()) {
      if (entry.popoutGroupId === popoutGroupId) return entry;
    }
    return undefined;
  }

  getAll(): WorkbenchWindowEntry[] {
    return [...this.entries.values()];
  }

  private findLiveOwner(panelId: string): WorkbenchWindowEntry | undefined {
    for (const entry of this.entries.values()) {
      if (entry.handle?.isDestroyed()) continue;
      if (entry.panelIds.includes(panelId)) return entry;
    }
    return undefined;
  }
}
