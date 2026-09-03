import type {
  ProjectDocumentPatch,
  ScoreLayerGroupSnapshot,
  ScoreRowObjectSnapshot,
  ScoreObjectEditorTargetSnapshot,
} from '../../../../shared/project-editor';

export interface ScoreColorPatchPair {
  forward: ProjectDocumentPatch;
  inverse: ProjectDocumentPatch;
}

/**
 * Build forward and inverse patches to set selected score objects to their containing layer's background color.
 * Returns null if the selection is empty or all selected items already match their layer color.
 */
export function buildSetSelectionToLayerColorPatch(args: {
  selection: ScoreRowObjectSnapshot[];
  layerGroups: ScoreLayerGroupSnapshot[];
}): ScoreColorPatchPair | null {
  const { selection, layerGroups } = args;
  if (!Array.isArray(selection) || selection.length === 0) {
    return null;
  }

  // Create a map from layer address to layer background color
  const layerColorByGroupAndIndex = new Map<string, number>();
  for (const group of layerGroups) {
    for (let li = 0; li < group.layers.length; li++) {
      const layer = group.layers[li];
      if (layer && layer.backgroundColor !== undefined) {
        layerColorByGroupAndIndex.set(`${group.groupId}:${li}`, layer.backgroundColor);
        layerColorByGroupAndIndex.set(`${layer.layerId}`, layer.backgroundColor);
      }
    }
  }

  const forwardUpdates: Array<{ target: ScoreObjectEditorTargetSnapshot; backgroundColor: number }> = [];
  const inverseUpdates: Array<{ target: ScoreObjectEditorTargetSnapshot; backgroundColor: number }> = [];

  for (const item of selection) {
    if (!item || !item.editorTarget) continue;

    // Find layer color for this item
    let layerColor: number | undefined;
    if (item.editorTarget.patternSource) {
      layerColor = layerColorByGroupAndIndex.get(item.editorTarget.patternSource.layerId);
    } else if (item.editorTarget.location) {
      const loc = item.editorTarget.location;
      // Search by location layerIndex
      const group = layerGroups[loc.rootGroupIndex];
      if (group) {
        const layer = group.layers[loc.layerIndex];
        layerColor = layer?.backgroundColor;
      }
      if (layerColor === undefined && loc.layerId) {
        layerColor = layerColorByGroupAndIndex.get(loc.layerId);
      }
    }

    if (layerColor === undefined) continue;

    if (item.backgroundColor !== layerColor) {
      forwardUpdates.push({
        target: item.editorTarget,
        backgroundColor: layerColor,
      });
      inverseUpdates.push({
        target: item.editorTarget,
        backgroundColor: item.backgroundColor,
      });
    }
  }

  if (forwardUpdates.length === 0) {
    return null;
  }

  return {
    forward: {
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates: forwardUpdates,
      },
    },
    inverse: {
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates: inverseUpdates,
      },
    },
  };
}

/**
 * Build forward and inverse patches to apply a layer's background color to all items on that layer.
 * Returns null if the layer has no items or all items already match the layer color.
 */
export function buildApplyLayerColorToAllClipsPatch(args: {
  groupId: string;
  layerIndex: number;
  layerGroups: ScoreLayerGroupSnapshot[];
}): ScoreColorPatchPair | null {
  const { groupId, layerIndex, layerGroups } = args;
  const group = layerGroups.find((g) => g.groupId === groupId);
  if (!group) return null;

  const layer = group.layers[layerIndex];
  if (!layer || layer.backgroundColor === undefined) return null;

  const layerColor = layer.backgroundColor;
  const forwardUpdates: Array<{ target: ScoreObjectEditorTargetSnapshot; backgroundColor: number }> = [];
  const inverseUpdates: Array<{ target: ScoreObjectEditorTargetSnapshot; backgroundColor: number }> = [];

  // If pattern layer with sourceObject
  if (group.groupType === 'patterns') {
    const patternLayer = layer as any;
    if (patternLayer.sourceObject && patternLayer.sourceObject.backgroundColor !== layerColor) {
      const target: ScoreObjectEditorTargetSnapshot = {
        selectionId: patternLayer.sourceObject.objectId,
        selectedObjectType: patternLayer.sourceObject.objectType ?? 'GenericScore',
        editorObjectType: patternLayer.sourceObject.objectType ?? 'GenericScore',
        ownerKind: 'timeline',
        displayContext: 'timeline',
        patternSource: {
          groupId,
          layerId: layer.layerId,
          sourceObjectId: patternLayer.sourceObject.objectId,
        },
      };
      forwardUpdates.push({ target, backgroundColor: layerColor });
      inverseUpdates.push({ target, backgroundColor: patternLayer.sourceObject.backgroundColor });
    }
  } else {
    for (const item of layer.items) {
      if (!item || !item.editorTarget) continue;
      if (item.backgroundColor !== layerColor) {
        forwardUpdates.push({
          target: item.editorTarget,
          backgroundColor: layerColor,
        });
        inverseUpdates.push({
          target: item.editorTarget,
          backgroundColor: item.backgroundColor,
        });
      }
    }
  }

  if (forwardUpdates.length === 0) {
    return null;
  }

  return {
    forward: {
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates: forwardUpdates,
      },
    },
    inverse: {
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates: inverseUpdates,
      },
    },
  };
}
