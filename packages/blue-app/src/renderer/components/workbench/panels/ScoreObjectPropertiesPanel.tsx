import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useScoreSelectionStore } from '../../../stores/score-selection-store';
import { useProjectStore } from '../../../stores/project-store';
import type {
  ScoreObjectEditorDocumentSnapshot,
  ScoreObjectEditorTargetSnapshot,
  ScorePatch,
} from '../../../../shared/project-editor';
import { createScoreObjectPropertiesTarget } from '../../../../shared/project-editor';
import ScoreObjectPropertiesForm from './score-object/ScoreObjectPropertiesForm';

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center bg-blue-bg px-4 text-center text-blue-muted">
      <div className="text-sm">{message}</div>
    </div>
  );
}

function applyPatchToDocument(
  doc: ScoreObjectEditorDocumentSnapshot,
  patch: ScorePatch,
): ScoreObjectEditorDocumentSnapshot {
  if (patch.type === 'updateSharedProperties') {
    const shared = { ...doc.shared };
    if (patch.patch.name !== undefined) shared.name = patch.patch.name;
    if (patch.patch.backgroundColor !== undefined) shared.backgroundColor = patch.patch.backgroundColor;
    if (patch.patch.startTime !== undefined) {
      shared.startTime = { ...shared.startTime, value: patch.patch.startTime.value, timeBase: patch.patch.startTime.timeBase };
    }
    if (patch.patch.subjectiveDuration !== undefined) {
      shared.subjectiveDuration = { ...shared.subjectiveDuration, value: patch.patch.subjectiveDuration.value, timeBase: patch.patch.subjectiveDuration.timeBase };
    }
    if (patch.patch.startTime !== undefined || patch.patch.subjectiveDuration !== undefined) {
      const start = patch.patch.startTime?.value ?? shared.startTime.value;
      const dur = patch.patch.subjectiveDuration?.value ?? shared.subjectiveDuration.value;
      shared.endTimeDisplay = (start + dur).toFixed(4);
    }
    return { ...doc, shared };
  }
  if (patch.type === 'updateSoundObjectBehavior') {
    const shared = { ...doc.shared };
    if (patch.patch.timeBehavior !== undefined) shared.timeBehavior = patch.patch.timeBehavior;
    if (patch.patch.repeatPoint !== undefined) shared.repeatPoint = patch.patch.repeatPoint
      ? { value: patch.patch.repeatPoint.value, timeBase: patch.patch.repeatPoint.timeBase, displayText: '' }
      : null;
    return { ...doc, shared };
  }
  if (patch.type === 'replaceNoteProcessorChain') {
    const shared = { ...doc.shared, noteProcessorChain: patch.chain };
    return { ...doc, shared };
  }
  return doc;
}

function sameLocation(
  a: ScoreObjectEditorTargetSnapshot['location'] | undefined,
  b: ScoreObjectEditorTargetSnapshot['location'] | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.rootGroupIndex !== b.rootGroupIndex) return false;
  if (a.layerIndex !== b.layerIndex || a.objectIndex !== b.objectIndex) return false;
  if (a.containerPath.length !== b.containerPath.length) return false;
  for (let i = 0; i < a.containerPath.length; i++) {
    const segmentA = a.containerPath[i];
    const segmentB = b.containerPath[i];
    if (segmentA.layerIndex !== segmentB.layerIndex || segmentA.objectIndex !== segmentB.objectIndex) {
      return false;
    }
  }
  return true;
}

function sameTarget(
  a: ScoreObjectEditorTargetSnapshot | null | undefined,
  b: ScoreObjectEditorTargetSnapshot | null | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.ownerKind !== b.ownerKind) return false;
  if (a.displayContext !== b.displayContext) return false;
  if (a.blueLive || b.blueLive) {
    return a.blueLive?.liveObjectId === b.blueLive?.liveObjectId;
  }
  if (sameLocation(a.location, b.location)) return true;
  if (sameLocation(a.sourceInstanceLocation, b.sourceInstanceLocation)) return true;
  if (a.library && b.library) {
    return a.library.libraryId === b.library.libraryId && a.library.libraryIndex === b.library.libraryIndex;
  }
  return false;
}

export default function ScoreObjectPropertiesPanel(): React.ReactElement {
  const loaded = useProjectStore((s) => s.loaded);
  const score = useProjectStore((s) => s.score);
  const meterMap = useProjectStore((s) => s.transport?.meterMap);
  const lastScorePatch = useProjectStore((s) => s.lastScorePatch);
  const applyProjectDocumentPatch = useProjectStore((s) => s.applyProjectDocumentPatch);
  const flushPendingPatches = useProjectStore((s) => s.flushPendingPatches);
  const selectedObjectIds = useScoreSelectionStore((s) => s.selectedObjectIds);
  const selectedObjectTarget = useScoreSelectionStore((s) => s.selectedObjectTarget);
  const liveSharedProperties = useScoreSelectionStore((s) => s.liveSharedProperties) ?? {};
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
    if (selectedObjectTarget) return selectedObjectTarget;
    return selectedRow?.editorTarget ?? null;
  }, [selectedObjectTarget, selectedRow]);
  const propertiesTarget = useMemo(() => (
    editorTarget ? createScoreObjectPropertiesTarget(editorTarget) : null
  ), [editorTarget]);
  const propertiesTargetKey = propertiesTarget ? JSON.stringify(propertiesTarget) : null;

  const primaryTimeDisplay = score.timeState.primaryTimeDisplay;
  const selectedLiveShared = selectedObjectId ? liveSharedProperties[selectedObjectId] : undefined;

  useEffect(() => {
    if (!loaded || !selectedObjectId) {
      setDocument(null);
      return;
    }
    if (!propertiesTarget) {
      setDocument(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    flushPendingPatches().then(() => {
      if (cancelled) return;
      return window.blueAPI.getScoreObjectEditorDocument({ target: propertiesTarget }).then((doc) => {
        if (!cancelled) {
          setDocument(doc);
          setLoading(false);
        }
      }).catch(() => {
        if (!cancelled) {
          setDocument(null);
          setLoading(false);
        }
      });
    });
    return () => { cancelled = true; };
  }, [loaded, selectedObjectId, propertiesTargetKey, primaryTimeDisplay, meterMap, flushPendingPatches]);

  useEffect(() => {
    if (!propertiesTarget || !lastScorePatch) return;
    if (
      (lastScorePatch.type === 'updateSharedProperties'
        || lastScorePatch.type === 'updateSoundObjectBehavior'
        || lastScorePatch.type === 'replaceNoteProcessorChain')
      && sameTarget(lastScorePatch.target, propertiesTarget)
    ) {
      setDocument((prev) => (prev ? applyPatchToDocument(prev, lastScorePatch) : prev));
    }
  }, [propertiesTargetKey, lastScorePatch]);

  useEffect(() => {
    if (!selectedLiveShared) return;
    setDocument((prev) => {
      if (!prev) return prev;
      const start = selectedLiveShared.startBeats ?? prev.shared.startTime.value;
      const duration = selectedLiveShared.durationBeats ?? prev.shared.subjectiveDuration.value;
      if (
        Math.abs(prev.shared.startTime.value - start) < 1e-6
        && Math.abs(prev.shared.subjectiveDuration.value - duration) < 1e-6
      ) {
        return prev;
      }
      return {
        ...prev,
        shared: {
          ...prev.shared,
          startTime: { ...prev.shared.startTime, value: start },
          subjectiveDuration: { ...prev.shared.subjectiveDuration, value: duration },
          endTimeDisplay: (start + duration).toFixed(4),
        },
      };
    });
  }, [selectedLiveShared?.startBeats, selectedLiveShared?.durationBeats]);

  const handlePatch = useCallback((patch: ScorePatch): void => {
    applyProjectDocumentPatch({ score: patch });
    if (document) {
      setDocument(applyPatchToDocument(document, patch));
    }
  }, [applyProjectDocumentPatch, document]);

  if (!loaded) {
    return <EmptyState message="No project loaded" />;
  }

  if (selectedObjectIds.size === 0) {
    return <EmptyState message="No score object selected" />;
  }

  if (selectedObjectIds.size > 1) {
    return <EmptyState message="Multiple objects selected" />;
  }

  if (loading) {
    return <EmptyState message="Loading..." />;
  }

  if (!document) {
    return <EmptyState message="No properties available" />;
  }

  return (
    <div className="flex flex-col h-full bg-blue-bg">
      <div className="flex-1 overflow-y-auto">
        <ScoreObjectPropertiesForm
          document={document}
          onPatch={handlePatch}
        />
      </div>
    </div>
  );
}
