import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useScoreSelectionStore } from '../../../stores/score-selection-store';
import { useProjectStore } from '../../../stores/project-store';
import { useLibraryEditorStore } from '../../../stores/library-editor-store';
import type {
  ScoreObjectEditorDocumentSnapshot,
  ScorePatch,
} from '../../../../shared/project-editor';
import { resolveEditorComponent } from './score-object/editor-registry';
import { applyPatchToDocument } from './score-object/score-object-document-reducer';
export { applyPatchToDocument };

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center bg-blue-bg px-4 text-center text-blue-muted">
      <div className="text-role-body">{message}</div>
    </div>
  );
}

export default function ScoreObjectEditorPanel(): React.ReactElement {
  const loaded = useProjectStore((s) => s.loaded);
  const score = useProjectStore((s) => s.score);
  const projectUdos = useProjectStore((s) => s.projectUdos);
  const lastScorePatch = useProjectStore((s) => s.lastScorePatch);
  const applyProjectDocumentPatch = useProjectStore((s) => s.applyProjectDocumentPatch);
  const flushPendingPatches = useProjectStore((s) => s.flushPendingPatches);
  const selectedObjectIds = useScoreSelectionStore((s) => s.selectedObjectIds);
  const selectedObjectTarget = useScoreSelectionStore((s) => s.selectedObjectTarget);
  const [document, setDocument] = useState<ScoreObjectEditorDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedObjectId = useMemo(() => {
    if (selectedObjectIds.size !== 1) return null;
    return [...selectedObjectIds][0];
  }, [selectedObjectIds]);

  const selectedRow = useMemo(() => {
    if (!selectedObjectId) return null;
    for (const lg of score.layerGroups) {
      for (const layer of lg.layers) {
        const found = layer.items.find((item) => item.objectId === selectedObjectId);
        if (found) return found;
      }
    }
    return null;
  }, [selectedObjectId, score]);

  const editorTarget = useMemo(() => {
    // Timeline replacements (freeze/unfreeze) keep the stable objectId/location
    // while changing the concrete object type. Prefer the refreshed row target
    // over the selection store's pre-replacement target.
    if (selectedRow?.editorTarget) return selectedRow.editorTarget;
    return selectedObjectTarget;
  }, [selectedObjectTarget, selectedRow]);
  const editorTargetKey = editorTarget ? JSON.stringify(editorTarget) : null;
  const libraryEditorSession = useLibraryEditorStore((state) => {
    const libraryId = editorTarget?.library?.libraryId;
    if (!libraryId) return undefined;
    return Object.values(state.sessions).find(
      (session) =>
        session.key.scope !== 'user' &&
        session.key.locator.kind === 'soundObject' &&
        session.key.locator.libraryId === libraryId,
    );
  });
  const previousLibrarySessionState = useRef<{ sessionId: string; dirty: boolean } | null>(null);

  const audioClipEditorPreview = useProjectStore((s) =>
    selectedObjectId ? (s.audioClipEditorPreviewByObjectId[selectedObjectId] ?? null) : null,
  );

  useEffect(() => {
    if (!loaded || !selectedObjectId) {
      setDocument(null);
      return;
    }
    if (!editorTarget) {
      setDocument(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    window.blueAPI
      .getScoreObjectEditorDocument({ target: editorTarget })
      .then((doc) => {
        if (!cancelled) {
          setDocument(doc);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDocument(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loaded, selectedObjectId, editorTargetKey]);

  useEffect(() => {
    if (document?.editor.kind !== 'polyObject') return;
    if (!selectedObjectId || !loaded) return;
    if (!editorTarget) return;
    let cancelled = false;
    void (async () => {
      try {
        await flushPendingPatches();
        const doc = await window.blueAPI.getScoreObjectEditorDocument({ target: editorTarget });
        if (!cancelled) setDocument(doc);
      } catch {
        if (!cancelled) setDocument(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    document?.editor.kind,
    loaded,
    selectedObjectId,
    editorTargetKey,
    lastScorePatch,
    flushPendingPatches,
  ]);

  useEffect(() => {
    const previous = previousLibrarySessionState.current;
    previousLibrarySessionState.current = libraryEditorSession
      ? { sessionId: libraryEditorSession.sessionId, dirty: libraryEditorSession.dirty }
      : null;
    if (
      !libraryEditorSession ||
      previous?.sessionId !== libraryEditorSession.sessionId ||
      !previous.dirty ||
      libraryEditorSession.dirty ||
      !editorTarget
    )
      return;

    let cancelled = false;
    void (async () => {
      try {
        await flushPendingPatches();
        const doc = await window.blueAPI.getScoreObjectEditorDocument({ target: editorTarget });
        if (!cancelled) setDocument(doc);
      } catch {
        if (!cancelled) setDocument(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editorTargetKey, flushPendingPatches, libraryEditorSession?.dirty]);

  useEffect(() => {
    if (!audioClipEditorPreview) {
      return;
    }

    setDocument((current) => {
      if (!current || current.editor.kind !== 'audioClip') {
        return current;
      }

      return applyPatchToDocument(current, {
        type: 'updateTypeSpecificEditor',
        target: current.target,
        patch: audioClipEditorPreview,
      });
    });
  }, [audioClipEditorPreview]);

  const handlePatch = useCallback(
    (patch: ScorePatch): void => {
      applyProjectDocumentPatch({ score: patch });
      setDocument((current) => (current ? applyPatchToDocument(current, patch) : current));
    },
    [applyProjectDocumentPatch],
  );

  if (!loaded) {
    return <EmptyState message="No project loaded" />;
  }

  if (selectedObjectIds.size === 0) {
    return <EmptyState message="No score object selected" />;
  }

  if (selectedObjectIds.size > 1) {
    return <EmptyState message="Multiple objects selected" />;
  }

  if (loading && !document) {
    return <EmptyState message="Loading..." />;
  }

  if (!document) {
    return <EmptyState message="No editor available" />;
  }

  const EditorComponent = resolveEditorComponent(document.editor);

  return (
    <div className="flex flex-col h-full bg-blue-bg">
      <div className="flex-1 overflow-hidden">
        <EditorComponent document={document} projectUdos={projectUdos} onPatch={handlePatch} />
      </div>
    </div>
  );
}
