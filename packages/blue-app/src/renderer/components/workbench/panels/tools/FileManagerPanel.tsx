import React, { useCallback, useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";
import type { FileManagerRootSnapshot } from "../../../../../../shared/file-manager";
import { emitPendingAudioFile } from "../audio-player/audio-player-bus";
import { emitPendingSoundFontFile } from "./soundfont-viewer-bus";
import { isAudioFilePlayerSourcePath } from "../audio-player/audio-player-formats";
import { useWorkbenchStore } from "../../../../stores/workbench-store";
import FileManagerTree from "./file-manager/FileManagerTree";

/**
 * File Manager workbench panel (SPEC 076). Loads the main-owned root list
 * (platform roots, home, and valid favorites) and hosts the lazy filesystem
 * tree. All filesystem access flows through the typed preload bridge;
 * favorites persist through the existing typed program-settings bridge.
 */
export default function FileManagerPanel(): React.ReactElement {
  const [roots, setRoots] = useState<FileManagerRootSnapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootsRef = useRef<FileManagerRootSnapshot[] | null>(null);
  rootsRef.current = roots;

  const loadRoots = useCallback(async () => {
    try {
      const nextRoots = await window.blueAPI.getFileManagerRoots();
      setRoots(nextRoots);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void loadRoots();
  }, [loadRoots]);

  const addFavorite = useCallback(
    async (path: string) => {
      const validation = await window.blueAPI.validateFileManagerDirectory({
        path,
      });
      if (!validation.ok || !validation.normalizedPath) {
        toast.error(
          validation.message ?? "Selected path is not a valid directory.",
        );
        return;
      }
      const candidate = validation.normalizedPath;
      const settings = await window.blueAPI.getProgramSettings();
      const favorites = settings.appSpecific.fileManagerFavorites;
      const duplicatesRoot = (rootsRef.current ?? []).some(
        (root) => root.path === candidate || root.id === candidate,
      );
      // No duplicate favorites: skip silently when the directory is already a
      // static or favorite root.
      if (favorites.includes(candidate) || duplicatesRoot) return;

      const result = await window.blueAPI.saveProgramSettings({
        ...settings,
        appSpecific: {
          ...settings.appSpecific,
          fileManagerFavorites: [...favorites, candidate],
        },
      });
      if (!result.ok) {
        toast.error(
          "Could not save the favorite. Program settings were not changed.",
        );
        return;
      }
      await loadRoots();
    },
    [loadRoots],
  );

  const removeFavorite = useCallback(
    async (path: string, rootId: string) => {
      const settings = await window.blueAPI.getProgramSettings();
      const remaining = settings.appSpecific.fileManagerFavorites.filter(
        (entry) => entry !== path && entry !== rootId,
      );
      if (remaining.length === settings.appSpecific.fileManagerFavorites.length)
        return;

      const result = await window.blueAPI.saveProgramSettings({
        ...settings,
        appSpecific: {
          ...settings.appSpecific,
          fileManagerFavorites: remaining,
        },
      });
      if (!result.ok) {
        toast.error(
          "Could not save the favorite. Program settings were not changed.",
        );
        return;
      }
      await loadRoots();
    },
    [loadRoots],
  );

  const renameRoot = useCallback(
    async (rootId: string, rootPath: string, newLabel: string) => {
      const settings = await window.blueAPI.getProgramSettings();
      const currentLabels = {
        ...(settings.appSpecific.fileManagerRootLabels ?? {}),
      };
      const trimmed = newLabel.trim();
      if (trimmed.length > 0) {
        currentLabels[rootId] = trimmed;
        currentLabels[rootPath] = trimmed;
      } else {
        delete currentLabels[rootId];
        delete currentLabels[rootPath];
      }

      const result = await window.blueAPI.saveProgramSettings({
        ...settings,
        appSpecific: {
          ...settings.appSpecific,
          fileManagerRootLabels: currentLabels,
        },
      });
      if (!result.ok) {
        toast.error(
          "Could not save root label. Program settings were not changed.",
        );
        return;
      }
      await loadRoots();
    },
    [loadRoots],
  );

  /**
   * Double-clicking a file opens the matching tool on demand. A
   * player-supported audio file is authorized in main first (the audio stream
   * protocol serves only authorized files and answers everything else with
   * 403), then routed to the Audio File Player pending-file bus, which loads
   * and autoplays it — the same path used by render-and-play. An .sf2 file is
   * routed to the SoundFont Viewer pending-file bus for inspection. Anything
   * else does nothing.
   */
  const openFile = useCallback(async (path: string) => {
    if (path.toLowerCase().endsWith(".sf2")) {
      useWorkbenchStore.getState().openPanel("SoundFontViewerTopComponent");
      emitPendingSoundFontFile(path);
      return;
    }
    if (!isAudioFilePlayerSourcePath(path)) return;
    let authorized = false;
    try {
      authorized = await window.blueAPI.authorizeAudioFile(path);
    } catch {
      authorized = false;
    }
    if (!authorized) {
      toast.error(`Could not open audio file: ${path}`);
      return;
    }
    useWorkbenchStore.getState().openPanel("AudioFilePlayerTopComponent");
    emitPendingAudioFile(path);
  }, []);

  return (
    <div className="flex h-full flex-col bg-app-bg">
      <div className="flex items-center justify-end border-b border-app-border/40 px-2 py-1">
        <button
          type="button"
          aria-label="Refresh roots"
          title="Refresh roots"
          className="rounded p-1 text-app-text-muted transition-colors hover:bg-app-hover hover:text-app-text-bright"
          onClick={() => void loadRoots()}
        >
          <RotateCw aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-1 bg-black">
        {error !== null && (
          <p role="alert" className="px-1 py-2 text-ui text-red-400">
            Could not load roots: {error}
          </p>
        )}
        {error === null && roots === null && (
          <p className="px-1 py-2 text-ui text-app-text-muted">
            Loading roots…
          </p>
        )}
        {error === null && roots !== null && roots.length === 0 && (
          <p className="px-1 py-2 text-ui text-app-text-muted">
            No filesystem roots available.
          </p>
        )}
        {error === null && roots !== null && roots.length > 0 && (
          <FileManagerTree
            roots={roots}
            onAddFavorite={addFavorite}
            onRemoveFavorite={removeFavorite}
            onRenameRoot={renameRoot}
            onOpenFile={openFile}
          />
        )}
      </div>
    </div>
  );
}
