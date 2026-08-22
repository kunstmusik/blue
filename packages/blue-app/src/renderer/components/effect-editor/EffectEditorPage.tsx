import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  EffectEditorRequest,
  EffectEditorSnapshot,
  EffectEditablePatch,
  UdoDefinitionSnapshot,
} from '../../../shared/project-editor';
import EffectEditorPanel from './EffectEditorPanel';

function closeWindow(): void {
  window.close();
}

function parseRequestFromLocation(): { request: EffectEditorRequest; mode: 'interface' | 'edit' } | null {
  const params = new URLSearchParams(window.location.search);
  const effectId = params.get('effectId');
  const ownerType = params.get('ownerType');
  const mode = params.get('mode') === 'interface' ? 'interface' : 'edit';

  if (!effectId || (ownerType !== 'project' && ownerType !== 'library')) {
    return null;
  }

  const baseRequest: EffectEditorRequest = {
    effectId,
    ownerType,
  };

  if (ownerType === 'project') {
    const channelId = params.get('channelId');
    const chain = params.get('chain');
    const entryId = params.get('entryId');
    if (channelId && (chain === 'pre' || chain === 'post') && entryId) {
      baseRequest.projectRef = { channelId, chain, entryId };
    }
  } else {
    const libraryEffectId = params.get('libraryEffectId');
    if (libraryEffectId) {
      baseRequest.libraryRef = { libraryEffectId };
    }
  }

  return { request: baseRequest, mode };
}

export default function EffectEditorPage(): React.ReactElement {
  const parsed = useMemo(() => parseRequestFromLocation(), []);
  const request = parsed?.request ?? null;
  const mode = parsed?.mode ?? 'edit';
  const isProjectEffect = request?.ownerType === 'project';
  const [snapshot, setSnapshot] = useState<EffectEditorSnapshot | null>(null);
  // Live project UDO projection for project effects; updated by the main
  // process when project globals change while this window stays open (US4).
  const [liveProjectUdos, setLiveProjectUdos] = useState<UdoDefinitionSnapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!request) {
      setError('Missing effect editor request');
      return;
    }

    let cancelled = false;
    void window.blueAPI.getEffectEditorDocument(request).then((loaded) => {
      if (cancelled) return;

      if (!loaded) {
        setError('Unable to load effect editor document');
        return;
      }

      setSnapshot(loaded);
      setLiveProjectUdos(loaded.projectUdos);
      document.title = `${loaded.name || 'Effect'} - ${mode === 'interface' ? 'Interface' : 'Effect Editor'}`;
    });

    return () => {
      cancelled = true;
    };
  }, [request, mode]);

  // Reuse the canonical project-document event. The main process routes it only
  // to project-owned effect windows; library effects never subscribe.
  useEffect(() => {
    if (!isProjectEffect) return;
    return window.blueAPI.onProjectDocumentUpdated((event) => {
      setLiveProjectUdos(event.snapshot.projectUdos);
    });
  }, [isProjectEffect]);

  const snapshotWithLiveUdos = useMemo<EffectEditorSnapshot | null>(() => {
    if (!snapshot) return null;
    if (!isProjectEffect || liveProjectUdos === null) return snapshot;
    return { ...snapshot, projectUdos: liveProjectUdos };
  }, [snapshot, isProjectEffect, liveProjectUdos]);

  const applyPatch = useCallback(
    async (patch: EffectEditablePatch) => {
      if (!request) return;

      const next = await window.blueAPI.updateEffectEditorDocument({
        ...request,
        patch,
      });
      if (next) {
        setSnapshot(next);
        document.title = `${next.name || 'Effect'} - ${mode === 'interface' ? 'Interface' : 'Effect Editor'}`;
      }
    },
    [request, mode],
  );

  useEffect(() => {
    if (request && mode === 'edit') {
      window.blueAPI.openEffectEditor(request).catch(() => {});
    }
  }, [request, mode]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-app-bg px-6 text-role-body text-app-text-muted">
        <div className="flex max-w-md flex-col items-center gap-4 rounded border border-app-border bg-app-surface-strong px-6 py-5 text-center shadow-xl">
          <div>{error}</div>
          <button
            type="button"
            className="rounded border border-app-border bg-app-input px-3 py-1.5 text-role-body text-app-text-strong hover:border-app-accent"
            onClick={closeWindow}
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  if (!snapshotWithLiveUdos || !request) {
    return (
      <div className="flex h-screen items-center justify-center bg-app-bg text-role-body text-app-text-muted">
        Loading effect editor...
      </div>
    );
  }

  if (mode === 'interface') {
    return (
      <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-app-bg text-app-text-strong">
        <EffectEditorPanel
          snapshot={snapshotWithLiveUdos}
          onPatch={applyPatch}
          initialTab="interface"
          interfaceOnly
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-app-bg text-app-text-strong">
      <EffectEditorPanel snapshot={snapshotWithLiveUdos} onPatch={applyPatch} />
    </div>
  );
}
