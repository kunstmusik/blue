import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { Tree, type NodeApi, type NodeRendererProps } from 'react-arborist';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { Element, Preset, PresetGroup } from '@blue/data';
import {
  Check,
  ChevronRight,
  Folder,
  FolderOpen,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  BsbInterfacePatch,
  PresetGroupSnapshot,
  PresetSnapshot,
} from '../../../../../../shared/project-editor';

export interface PresetsManagerDialogProps {
  presetGroup: PresetGroupSnapshot;
  onBsbInterfacePatch: (patch: BsbInterfacePatch) => void;
  onClose: () => void;
}

export interface PresetTreeNode {
  id: string;
  name: string;
  kind: 'group' | 'preset';
  groupPath: number[];
  presetUniqueId?: string;
  children?: PresetTreeNode[];
}

type PresetClipboard =
  | { kind: 'preset'; item: PresetSnapshot }
  | { kind: 'group'; item: PresetGroupSnapshot };

let presetClipboard: PresetClipboard | null = null;

function clonePresetSnapshot(snapshot: PresetSnapshot): PresetSnapshot {
  return {
    ...snapshot,
    values: snapshot.values ? { ...snapshot.values } : undefined,
  };
}

function clonePresetGroupSnapshot(group: PresetGroupSnapshot): PresetGroupSnapshot {
  return {
    ...group,
    subGroups: group.subGroups.map(clonePresetGroupSnapshot),
    presets: group.presets.map(clonePresetSnapshot),
  };
}

function getPresetGroupSnapshotAtPath(
  root: PresetGroupSnapshot,
  path: readonly number[],
): PresetGroupSnapshot | undefined {
  let current = root;
  for (const index of path) {
    if (!Number.isInteger(index) || index < 0) return undefined;
    const next = current.subGroups[index];
    if (!next) return undefined;
    current = next;
  }
  return current;
}

function findPresetSnapshotById(
  group: PresetGroupSnapshot,
  uniqueId: string,
): PresetSnapshot | undefined {
  const direct = group.presets.find((preset) => preset.uniqueId === uniqueId);
  if (direct) return direct;
  for (const subGroup of group.subGroups) {
    const found = findPresetSnapshotById(subGroup, uniqueId);
    if (found) return found;
  }
  return undefined;
}

function createFreshPresetId(): string {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `preset:${id}`;
}

function createInsertedPresetSnapshot(snapshot: PresetSnapshot): PresetSnapshot {
  return {
    ...clonePresetSnapshot(snapshot),
    uniqueId: createFreshPresetId(),
  };
}

function createInsertedPresetGroupSnapshot(
  snapshot: PresetGroupSnapshot,
  presetIdMap = new Map<string, string>(),
): PresetGroupSnapshot {
  const presets = snapshot.presets.map((preset) => {
    const uniqueId = createFreshPresetId();
    presetIdMap.set(preset.uniqueId, uniqueId);
    return {
      ...clonePresetSnapshot(preset),
      uniqueId,
    };
  });
  const subGroups = snapshot.subGroups.map((subGroup) => (
    createInsertedPresetGroupSnapshot(subGroup, presetIdMap)
  ));
  const currentPresetUniqueId = snapshot.currentPresetUniqueId
    ? presetIdMap.get(snapshot.currentPresetUniqueId)
    : undefined;

  return {
    ...snapshot,
    currentPresetUniqueId,
    currentPresetModified: currentPresetUniqueId
      ? snapshot.currentPresetModified
      : false,
    subGroups,
    presets,
  };
}

function presetToSnapshot(preset: Preset): PresetSnapshot {
  const values: Record<string, string> = {};
  for (const [key, value] of preset.getValuesMap()) values[key] = value;
  return {
    uniqueId: preset.getUniqueId(),
    name: preset.getPresetName(),
    values,
  };
}

function presetGroupToSnapshot(group: PresetGroup): PresetGroupSnapshot {
  const currentPresetUniqueId = group.getCurrentPresetUniqueId();
  return {
    name: group.getPresetGroupName(),
    currentPresetUniqueId: currentPresetUniqueId || undefined,
    currentPresetModified: group.isCurrentPresetModified(),
    subGroups: group.getSubGroups().map(presetGroupToSnapshot),
    presets: group.getPresets().map(presetToSnapshot),
  };
}

function presetFromSnapshot(snapshot: PresetSnapshot): Preset {
  const preset = new Preset();
  preset.setPresetName(snapshot.name);
  preset.setValuesMap(new Map(Object.entries(snapshot.values ?? {})));
  preset.uniqueId = snapshot.uniqueId;
  return preset;
}

function presetGroupFromSnapshot(snapshot: PresetGroupSnapshot): PresetGroup {
  const group = new PresetGroup();
  group.setPresetGroupName(snapshot.name);
  group.setCurrentPresetModified(snapshot.currentPresetModified);
  group.presets = snapshot.presets.map(presetFromSnapshot);
  group.subGroups = snapshot.subGroups.map(presetGroupFromSnapshot);
  if (snapshot.currentPresetUniqueId && group.findPresetByUniqueId(snapshot.currentPresetUniqueId)) {
    group.setCurrentPresetUniqueId(snapshot.currentPresetUniqueId);
  }
  return group;
}

function groupNodeId(path: readonly number[]): string {
  return path.length === 0 ? 'group:root' : `group:${path.join('.')}`;
}

export function buildPresetTree(
  group: PresetGroupSnapshot,
  groupPath: readonly number[] = [],
): PresetTreeNode {
  const path = [...groupPath];
  const children: PresetTreeNode[] = [];

  group.subGroups.forEach((subGroup, index) => {
    children.push(buildPresetTree(subGroup, [...path, index]));
  });

  for (const preset of group.presets) {
    children.push({
      id: `preset:${preset.uniqueId}`,
      name: preset.name,
      kind: 'preset',
      groupPath: path,
      presetUniqueId: preset.uniqueId,
    });
  }

  return {
    id: groupNodeId(path),
    name: group.name,
    kind: 'group',
    groupPath: path,
    children,
  };
}

function isPathWithin(
  path: readonly number[],
  possibleParent: readonly number[],
): boolean {
  return (
    possibleParent.length < path.length &&
    possibleParent.every((index, position) => path[position] === index)
  );
}

function arePathsEqual(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return (
    left.length === right.length &&
    left.every((index, position) => right[position] === index)
  );
}

function findTreeNode(
  node: PresetTreeNode,
  id: string | null,
): PresetTreeNode | undefined {
  if (!id) return undefined;
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findTreeNode(child, id);
    if (found) return found;
  }
  return undefined;
}

interface PresetTreeActions {
  currentPresetUniqueId?: string;
  canPaste: boolean;
  onRename: (node: NodeApi<PresetTreeNode>) => void;
  onRemove: (node: NodeApi<PresetTreeNode>) => void;
  onApply: (presetUniqueId: string) => void;
  onCut: (node: NodeApi<PresetTreeNode>) => void;
  onCopy: (node: NodeApi<PresetTreeNode>) => void;
  onPaste: (node: NodeApi<PresetTreeNode>) => void;
  onImport: (node: NodeApi<PresetTreeNode>) => void | Promise<void>;
  onExport: (node: NodeApi<PresetTreeNode>) => void | Promise<void>;
  onAddFolder: (node: NodeApi<PresetTreeNode>) => void;
}

function PresetNode({
  node,
  style,
  tree,
  dragHandle,
}: NodeRendererProps<PresetTreeNode>): ReactElement {
  const actions = usePresetTreeActions();
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const isGroup = node.data.kind === 'group';
  const isRoot = isGroup && node.data.groupPath.length === 0;
  const isActiveDropTarget = isGroup && node.willReceiveDrop && tree.canDrop();
  const isCurrent =
    !isGroup && node.data.presetUniqueId === actions.currentPresetUniqueId;

  useEffect(() => {
    if (!node.isEditing) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [node.isEditing]);

  const row = (
    <div
      ref={dragHandle}
      style={style}
      data-drop-target={isActiveDropTarget ? 'true' : undefined}
      className={[
        'flex items-center gap-1.5 pr-2 text-role-body select-none cursor-pointer',
        isActiveDropTarget
          ? 'bg-blue-accent/25 text-gray-100 ring-1 ring-inset ring-blue-accent/80'
          : node.isSelected
            ? 'bg-blue-accent/20 text-gray-100'
            : 'text-gray-300 hover:bg-white/5',
      ].join(' ')}
      onClick={(event) => {
        node.handleClick(event);
        if (isGroup) node.toggle();
      }}
      onDoubleClick={() => {
        node.edit();
      }}
      title={isCurrent ? 'Current preset' : undefined}
    >
      {isGroup ? (
        <ChevronRight
          className={[
            'h-3 w-3 flex-none transition-transform',
            node.isOpen ? 'rotate-90' : '',
          ].join(' ')}
          aria-hidden="true"
          onClick={(event) => {
            event.stopPropagation();
            node.toggle();
          }}
        />
      ) : (
        <span className="w-3 flex-none" />
      )}
      {isGroup ? (
        node.isOpen ? (
          <FolderOpen
            className="h-3.5 w-3.5 flex-none text-yellow-500"
            aria-hidden="true"
          />
        ) : (
          <Folder
            className="h-3.5 w-3.5 flex-none text-yellow-600"
            aria-hidden="true"
          />
        )
      ) : (
        <SlidersHorizontal
          className="h-3.5 w-3.5 flex-none text-blue-400"
          aria-hidden="true"
        />
      )}
      {node.isEditing ? (
        <input
          ref={renameInputRef}
          type="text"
          defaultValue={node.data.name}
          className="min-w-0 flex-1 rounded border border-app-accent bg-app-surface px-1 text-role-body text-app-text-strong outline-none"
          onClick={(event) => event.stopPropagation()}
          onBlur={() => node.reset()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              node.reset();
            } else if (event.key === 'Enter') {
              event.preventDefault();
              node.submit(renameInputRef.current?.value ?? '');
            }
          }}
        />
      ) : (
        <span className="min-w-0 truncate">{node.data.name}</span>
      )}
      {isCurrent && (
        <Check
          className="ml-auto h-3.5 w-3.5 flex-none text-blue-accent"
          aria-label="Current preset"
        />
      )}
    </div>
  );

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{row}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="editor-context-menu"
          collisionPadding={8}
        >
          <ContextMenu.Item
            className="editor-context-menu__item"
            disabled={isRoot}
            onSelect={() => actions.onRemove(node)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            Remove
          </ContextMenu.Item>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <ContextMenu.Item
            className="editor-context-menu__item"
            disabled={isRoot}
            onSelect={() => actions.onCut(node)}
          >
            Cut
          </ContextMenu.Item>
          <ContextMenu.Item
            className="editor-context-menu__item"
            onSelect={() => actions.onCopy(node)}
          >
            Copy
          </ContextMenu.Item>
          <ContextMenu.Item
            className="editor-context-menu__item"
            disabled={!isGroup || !actions.canPaste}
            onSelect={() => actions.onPaste(node)}
          >
            Paste
          </ContextMenu.Item>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <ContextMenu.Item
            className="editor-context-menu__item"
            disabled={!isGroup}
            onSelect={() => { void actions.onImport(node); }}
          >
            Import
          </ContextMenu.Item>
          <ContextMenu.Item
            className="editor-context-menu__item"
            onSelect={() => { void actions.onExport(node); }}
          >
            Export
          </ContextMenu.Item>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <ContextMenu.Item
            className="editor-context-menu__item"
            disabled={!isGroup}
            onSelect={() => actions.onAddFolder(node)}
          >
            Add Folder
          </ContextMenu.Item>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          {!isGroup && node.data.presetUniqueId && (
            <ContextMenu.Item
              className="editor-context-menu__item"
              onSelect={() => actions.onApply(node.data.presetUniqueId!)}
            >
              Apply Preset
            </ContextMenu.Item>
          )}
          <ContextMenu.Item
            className="editor-context-menu__item"
            onSelect={() => actions.onRename(node)}
          >
            Rename
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

const PresetTreeActionsContext = createContext<PresetTreeActions | null>(null);

function usePresetTreeActions(): PresetTreeActions {
  const actions = useContext(PresetTreeActionsContext);
  if (!actions) throw new Error('Preset tree actions are not available');
  return actions;
}

export default function PresetsManagerDialog({
  presetGroup,
  onBsbInterfacePatch,
  onClose,
}: PresetsManagerDialogProps): ReactElement {
  const rootNode = useMemo(() => buildPresetTree(presetGroup), [presetGroup]);
  const treeContainerRef = useRef<HTMLDivElement | null>(null);
  const [treeHeight, setTreeHeight] = useState(420);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<PresetClipboard | null>(() => presetClipboard);

  useEffect(() => {
    const element = treeContainerRef.current;
    if (!element) return;

    const measure = () => {
      setTreeHeight(Math.max(180, element.clientHeight || 420));
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (event.target instanceof HTMLInputElement) return;
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const dispatch = useCallback(
    (patch: BsbInterfacePatch) => {
      onBsbInterfacePatch(patch);
    },
    [onBsbInterfacePatch],
  );

  const getClipboardItem = useCallback(
    (node: NodeApi<PresetTreeNode>): PresetClipboard | null => {
      if (node.data.kind === 'group') {
        const group = getPresetGroupSnapshotAtPath(presetGroup, node.data.groupPath);
        return group
          ? { kind: 'group', item: clonePresetGroupSnapshot(group) }
          : null;
      }
      if (!node.data.presetUniqueId) return null;
      const preset = findPresetSnapshotById(presetGroup, node.data.presetUniqueId);
      return preset
        ? { kind: 'preset', item: clonePresetSnapshot(preset) }
        : null;
    },
    [presetGroup],
  );

  const updateClipboard = useCallback((item: PresetClipboard | null) => {
    presetClipboard = item;
    setClipboard(item);
  }, []);

  const handleRename = useCallback(
    (args: { id: string; name: string; node: NodeApi<PresetTreeNode> }) => {
      const name = args.name.trim();
      if (!name || name === args.node.data.name) return;
      if (args.node.data.kind === 'group') {
        dispatch({
          type: 'renamePresetGroup',
          groupPath: args.node.data.groupPath,
          name,
        });
      } else if (args.node.data.presetUniqueId) {
        dispatch({
          type: 'renamePreset',
          presetUniqueId: args.node.data.presetUniqueId,
          name,
        });
      }
    },
    [dispatch],
  );

  const handleRemove = useCallback(
    (node: NodeApi<PresetTreeNode>) => {
      const data = node.data;
      if (data.kind === 'group' && data.groupPath.length === 0) return;
      const label = data.kind === 'group' ? 'folder' : 'preset';
      if (!window.confirm(`Delete ${label} “${data.name}”?`)) return;

      if (data.kind === 'group') {
        dispatch({ type: 'removePresetGroup', groupPath: data.groupPath });
      } else if (data.presetUniqueId) {
        dispatch({ type: 'removePreset', presetUniqueId: data.presetUniqueId });
      }
      setSelectedId(null);
    },
    [dispatch],
  );

  const handleCut = useCallback(
    (node: NodeApi<PresetTreeNode>) => {
      const data = node.data;
      if (data.kind === 'group' && data.groupPath.length === 0) return;
      const item = getClipboardItem(node);
      if (!item) return;
      updateClipboard(item);

      if (data.kind === 'group') {
        dispatch({ type: 'removePresetGroup', groupPath: data.groupPath });
      } else if (data.presetUniqueId) {
        dispatch({ type: 'removePreset', presetUniqueId: data.presetUniqueId });
      }
      setSelectedId(null);
    },
    [dispatch, getClipboardItem, updateClipboard],
  );

  const handleCopy = useCallback(
    (node: NodeApi<PresetTreeNode>) => {
      const item = getClipboardItem(node);
      if (item) updateClipboard(item);
    },
    [getClipboardItem, updateClipboard],
  );

  const handlePaste = useCallback(
    (node: NodeApi<PresetTreeNode>) => {
      if (node.data.kind !== 'group' || !clipboard) return;
      if (clipboard.kind === 'preset') {
        dispatch({
          type: 'addPresetFromSnapshot',
          parentGroupPath: node.data.groupPath,
          preset: createInsertedPresetSnapshot(clipboard.item),
        });
      } else {
        dispatch({
          type: 'addPresetGroupFromSnapshot',
          parentGroupPath: node.data.groupPath,
          group: createInsertedPresetGroupSnapshot(clipboard.item),
        });
      }
    },
    [clipboard, dispatch],
  );

  const handleImport = useCallback(
    async (node: NodeApi<PresetTreeNode>) => {
      if (node.data.kind !== 'group') return;
      try {
        const xml = await window.blueAPI.importPresetFile();
        if (!xml) return;
        const root = Element.parse(xml);
        if (root.getName() === 'preset') {
          dispatch({
            type: 'addPresetFromSnapshot',
            parentGroupPath: node.data.groupPath,
            preset: createInsertedPresetSnapshot(presetToSnapshot(Preset.loadFromXML(root))),
          });
        } else if (root.getName() === 'presetGroup') {
          dispatch({
            type: 'addPresetGroupFromSnapshot',
            parentGroupPath: node.data.groupPath,
            group: createInsertedPresetGroupSnapshot(
              presetGroupToSnapshot(PresetGroup.loadFromXML(root)),
            ),
          });
        } else {
          toast.error('The selected file does not contain a preset or preset folder.');
        }
      } catch (error) {
        toast.error(`Failed to import presets: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [dispatch],
  );

  const handleExport = useCallback(
    async (node: NodeApi<PresetTreeNode>) => {
      const item = getClipboardItem(node);
      if (!item) return;
      try {
        const xml = item.kind === 'preset'
          ? presetFromSnapshot(item.item).saveAsXML().toXml()
          : presetGroupFromSnapshot(item.item).saveAsXML().toXml();
        await window.blueAPI.exportPresetFile(xml, item.item.name);
      } catch (error) {
        toast.error(`Failed to export presets: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [getClipboardItem],
  );

  const handleAddFolder = useCallback(
    (node: NodeApi<PresetTreeNode>) => {
      if (node.data.kind !== 'group') return;
      dispatch({
        type: 'addPresetGroup',
        groupName: 'New Folder',
        parentGroupPath: node.data.groupPath,
      });
    },
    [dispatch],
  );

  const handleDelete = useCallback(
    (args: { ids: string[]; nodes: NodeApi<PresetTreeNode>[] }) => {
      const node = args.nodes[0];
      if (node) handleRemove(node);
    },
    [handleRemove],
  );

  const handleMove = useCallback(
    (args: {
      dragIds: string[];
      dragNodes: NodeApi<PresetTreeNode>[];
      parentId: string | null;
      parentNode: NodeApi<PresetTreeNode> | null;
      index: number;
    }) => {
      const node = args.dragNodes[0];
      const parent = args.parentNode;
      if (!node) return;
      const parentGroupPath =
        parent?.data.kind === 'group'
          ? parent.data.groupPath
          : args.parentId === null
            ? []
            : null;
      if (!parentGroupPath) return;

      if (node.data.kind === 'group') {
        if (
          node.data.groupPath.length === 0 ||
          arePathsEqual(parentGroupPath, node.data.groupPath) ||
          isPathWithin(parentGroupPath, node.data.groupPath)
        )
          return;
        dispatch({
          type: 'movePresetGroup',
          groupPath: node.data.groupPath,
          parentGroupPath,
          targetIndex: args.index,
        });
        return;
      }

      if (node.data.presetUniqueId) {
        dispatch({
          type: 'movePreset',
          presetUniqueId: node.data.presetUniqueId,
          parentGroupPath,
          targetIndex: args.index,
        });
      }
    },
    [dispatch],
  );

  const handleApply = useCallback(
    (presetUniqueId: string) => {
      dispatch({ type: 'applyPreset', presetUniqueId });
    },
    [dispatch],
  );

  const selectedNode = useMemo(
    () => findTreeNode(rootNode, selectedId),
    [rootNode, selectedId],
  );

  const treeActions = useMemo<PresetTreeActions>(
    () => ({
      currentPresetUniqueId: presetGroup.currentPresetUniqueId,
      canPaste: clipboard !== null,
      onRename: (node) => node.edit(),
      onRemove: handleRemove,
      onApply: handleApply,
      onCut: handleCut,
      onCopy: handleCopy,
      onPaste: handlePaste,
      onImport: handleImport,
      onExport: handleExport,
      onAddFolder: handleAddFolder,
    }),
    [
      clipboard,
      handleAddFolder,
      handleApply,
      handleCopy,
      handleCut,
      handleExport,
      handleImport,
      handlePaste,
      handleRemove,
      presetGroup.currentPresetUniqueId,
    ],
  );

  const selectedLabel = selectedNode?.name ?? 'Preset tree';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="presets-manager-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-[min(560px,80vh)] w-full max-w-2xl flex-col rounded-lg border border-app-border/40 bg-app-menu shadow-2xl">
        <div className="flex items-center justify-between border-b border-app-border/30 px-4 py-3">
          <div>
            <h2
              id="presets-manager-title"
              className="text-role-headline text-app-text-bright"
            >
              Presets Manager
            </h2>
            <p className="mt-1 text-role-subheadline text-app-text-muted">
              Drag presets or folders to reorder them or move them into another
              folder.
            </p>
          </div>
          <button
            type="button"
            className="rounded p-1 text-app-text-muted hover:bg-app-hover hover:text-app-text-bright focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-app-accent"
            onClick={onClose}
            aria-label="Close Presets Manager"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-app-border/20 px-3 py-1.5 text-role-subheadline text-app-text-muted">
          <span className="truncate" aria-live="polite">
            Selected: {selectedLabel}
          </span>
          <span className="shrink-0">
            Double-click to rename · Delete key removes
          </span>
        </div>

        <div
          ref={treeContainerRef}
          className="min-h-0 flex-1 overflow-hidden bg-black px-2 py-2"
        >
          <PresetTreeActionsContext.Provider value={treeActions}>
            <Tree<PresetTreeNode>
              data={[rootNode]}
              openByDefault
              width="100%"
              height={treeHeight}
              indent={16}
              rowHeight={26}
              overscanCount={10}
              disableMultiSelection
              idAccessor="id"
              childrenAccessor="children"
              selection={selectedId ?? undefined}
              onSelect={(nodes) => setSelectedId(nodes[0]?.id ?? null)}
              onRename={handleRename}
              onMove={handleMove}
              onDelete={handleDelete}
              disableDrag={(data) =>
                data.kind === 'group' && data.groupPath.length === 0
              }
              disableDrop={({ parentNode, dragNodes }) => {
                const parentGroupPath =
                  parentNode.data.kind === 'group'
                    ? parentNode.data.groupPath
                    : parentNode.data.id === 'ROOT'
                      ? []
                      : null;
                if (!parentGroupPath) return true;
                return dragNodes.some(
                  (dragNode) =>
                    dragNode.data.kind === 'group' &&
                    (dragNode.data.groupPath.length === 0 ||
                      arePathsEqual(parentGroupPath, dragNode.data.groupPath) ||
                      isPathWithin(parentGroupPath, dragNode.data.groupPath)),
                );
              }}
              className="presets-manager-tree"
            >
              {PresetNode}
            </Tree>
          </PresetTreeActionsContext.Provider>
        </div>

        <div className="flex justify-end border-t border-app-border/30 px-4 py-3">
          <button
            type="button"
            className="rounded border border-app-border/40 bg-app-surface px-3 py-1.5 text-role-body text-app-text transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-app-accent"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
