import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Tree, type NodeRendererProps, type NodeApi } from 'react-arborist';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRight, FolderOpen, Folder, FileAudio } from 'lucide-react';

import type {
  EffectsLibraryCategorySnapshot,
  LibraryEffectSnapshot,
} from '../../../../../shared/project-editor';

export interface LibraryTreeNode {
  id: string;
  name: string;
  kind: 'category' | 'effect';
  children?: LibraryTreeNode[];
  effectData?: LibraryEffectSnapshot;
  categoryId?: string;
}

export function snapshotToTreeNodes(
  category: EffectsLibraryCategorySnapshot,
): LibraryTreeNode {
  const children: LibraryTreeNode[] = [];

  for (const sub of category.categories) {
    children.push(snapshotToTreeNodes(sub));
  }

  for (const effect of category.effects) {
    children.push({
      id: effect.libraryEffectId,
      name: effect.name,
      kind: 'effect',
      effectData: effect,
      categoryId: category.categoryId,
    });
  }

  return {
    id: category.categoryId,
    name: category.name,
    kind: 'category',
    categoryId: category.categoryId,
    children,
  };
}

export interface TreeContextActions {
  onAddCategory: (parentId: string) => void;
  onRemoveCategory: (categoryId: string) => void;
  onAddEffect: (parentId: string) => void;
  onCutEffect: (effect: LibraryEffectSnapshot) => void;
  onCopyEffect: (effect: LibraryEffectSnapshot) => void;
  onRemoveEffect: (effectId: string) => void;
  onCutCategory: (categoryId: string) => void;
  onCopyCategory: (categoryId: string) => void;
  onPaste: (targetCategoryId: string) => void;
  onImportIntoCategory: (categoryId: string) => void;
  onExportEffect: (effectId: string) => void;
  canPaste: boolean;
  isRoot: (id: string) => boolean;
  addToMixerLabel: string | null;
  onAddToMixer: (effect: LibraryEffectSnapshot) => void;
}

const TreeActionsContext = createContext<TreeContextActions | null>(null);

function CategoryMenu({
  node,
  actions,
  children,
}: {
  node: NodeApi<LibraryTreeNode>;
  actions: TreeContextActions;
  children: React.ReactNode;
}): React.ReactElement {
  const catId = node.data.categoryId ?? node.data.id;
  const isRoot = actions.isRoot(catId);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="editor-context-menu" collisionPadding={8}>
          <ContextMenu.Item
            className="editor-context-menu__item"
            onSelect={() => actions.onAddCategory(catId)}
          >
            Add Group
          </ContextMenu.Item>
          <ContextMenu.Item
            className="editor-context-menu__item"
            onSelect={() => actions.onRemoveCategory(catId)}
            disabled={isRoot}
          >
            Remove Group
          </ContextMenu.Item>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <ContextMenu.Item
            className="editor-context-menu__item"
            onSelect={() => actions.onAddEffect(catId)}
          >
            Add Effect
          </ContextMenu.Item>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <ContextMenu.Item
            className="editor-context-menu__item"
            onSelect={() => actions.onCutCategory(catId)}
            disabled={isRoot}
          >
            Cut
          </ContextMenu.Item>
          <ContextMenu.Item
            className="editor-context-menu__item"
            onSelect={() => actions.onCopyCategory(catId)}
            disabled={isRoot}
          >
            Copy
          </ContextMenu.Item>
          <ContextMenu.Item
            className="editor-context-menu__item"
            onSelect={() => actions.onPaste(catId)}
            disabled={!actions.canPaste}
          >
            Paste
          </ContextMenu.Item>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <ContextMenu.Item
            className="editor-context-menu__item"
            onSelect={() => actions.onImportIntoCategory(catId)}
          >
            Import from File
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function EffectMenu({
  node,
  actions,
  children,
}: {
  node: NodeApi<LibraryTreeNode>;
  actions: TreeContextActions;
  children: React.ReactNode;
}): React.ReactElement {
  const effect = node.data.effectData;
  if (!effect) return <>{children}</>;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="editor-context-menu" collisionPadding={8}>
          <ContextMenu.Item
            className="editor-context-menu__item"
            onSelect={() => actions.onCutEffect(effect)}
          >
            Cut
          </ContextMenu.Item>
          <ContextMenu.Item
            className="editor-context-menu__item"
            onSelect={() => actions.onCopyEffect(effect)}
          >
            Copy
          </ContextMenu.Item>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <ContextMenu.Item
            className="editor-context-menu__item"
            onSelect={() => actions.onRemoveEffect(effect.libraryEffectId)}
          >
            Remove Effect
          </ContextMenu.Item>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <ContextMenu.Item
            className="editor-context-menu__item"
            onSelect={() => actions.onExportEffect(effect.libraryEffectId)}
          >
            Export...
          </ContextMenu.Item>
          {actions.addToMixerLabel && (
            <>
          <ContextMenu.Separator className="editor-context-menu__separator" />
              <ContextMenu.Item
                className="editor-context-menu__item"
                onSelect={() => actions.onAddToMixer(effect)}
              >
                {actions.addToMixerLabel}
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function Node({
  node,
  style,
  dragHandle,
}: NodeRendererProps<LibraryTreeNode>): React.ReactElement {
  const isCategory = node.data.kind === 'category';
  const isSelected = node.isSelected;
  const actions = useContext(TreeActionsContext);

  const icon = isCategory
    ? (node.isOpen ? <FolderOpen className="h-3.5 w-3.5 flex-none text-yellow-500" /> : <Folder className="h-3.5 w-3.5 flex-none text-yellow-600" />)
    : <FileAudio className="h-3.5 w-3.5 flex-none text-blue-400" />;

  const effectMeta = !isCategory && node.data.effectData
    ? `${node.data.effectData.numIns}in/${node.data.effectData.numOuts}out`
    : null;

  const childCount = isCategory && node.children ? node.children.length : 0;

  const nodeContent = (
    <div
      ref={dragHandle}
      style={style}
      className={[
        'flex items-center gap-1.5 pr-2 text-role-body select-none cursor-pointer',
        isSelected ? 'bg-blue-accent/20 text-gray-100' : 'text-gray-300 hover:bg-white/5',
      ].join(' ')}
      onClick={(e) => {
        node.handleClick(e);
        if (isCategory) {
          node.toggle();
        }
      }}
    >
      {isCategory && (
        <ChevronRight
          className={[
            'h-3 w-3 flex-none transition-transform',
            node.isOpen ? 'rotate-90' : '',
          ].join(' ')}
          onClick={(e) => {
            e.stopPropagation();
            node.toggle();
          }}
        />
      )}
      {!isCategory && <span className="w-3 flex-none" />}
      {icon}
      <span className="min-w-0 truncate">{node.data.name}</span>
      {isCategory && childCount > 0 && (
        <span className="ml-auto flex-none text-role-subheadline text-blue-muted">{childCount}</span>
      )}
      {effectMeta && (
        <span className="ml-auto flex-none text-role-subheadline text-blue-muted">{effectMeta}</span>
      )}
    </div>
  );

  if (!actions) return nodeContent;

  if (isCategory) {
    return (
      <CategoryMenu node={node} actions={actions}>
        {nodeContent}
      </CategoryMenu>
    );
  }

  return (
    <EffectMenu node={node} actions={actions}>
      {nodeContent}
    </EffectMenu>
  );
}

export interface EffectLibraryTreeProps {
  rootNode: LibraryTreeNode;
  selectedId?: string | null;
  onSelectEffect?: (effect: LibraryEffectSnapshot) => void;
  onSelectCategory?: (categoryId: string) => void;
  onRename?: (node: LibraryTreeNode, newName: string) => void;
  onMove?: (dragIds: string[], parentId: string | null, index: number) => void;
  contextActions?: TreeContextActions;
}

export default function EffectLibraryTree({
  rootNode,
  selectedId,
  onSelectEffect,
  onSelectCategory,
  onRename,
  onMove,
  contextActions,
}: EffectLibraryTreeProps): React.ReactElement {
  const treeRef = useRef<NodeApi<LibraryTreeNode> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [treeHeight, setTreeHeight] = useState(600);
  const data = useMemo(() => [rootNode], [rootNode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      setTreeHeight(el.clientHeight || 600);
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleSelect = useCallback(
    (nodes: NodeApi<LibraryTreeNode>[]) => {
      const node = nodes[0];
      if (!node) return;
      if (node.data.kind === 'effect' && node.data.effectData) {
        onSelectEffect?.(node.data.effectData);
      } else if (node.data.kind === 'category' && node.data.categoryId) {
        onSelectCategory?.(node.data.categoryId);
      }
    },
    [onSelectEffect, onSelectCategory],
  );

  const handleRename = useCallback(
    (args: { id: string; name: string; node: NodeApi<LibraryTreeNode> }) => {
      onRename?.(args.node.data, args.name);
    },
    [onRename],
  );

  const handleMove = useCallback(
    (args: { dragIds: string[]; parentId: string | null; index: number }) => {
      onMove?.(args.dragIds, args.parentId, args.index);
    },
    [onMove],
  );

  const handleActivate = useCallback(
    (node: NodeApi<LibraryTreeNode>) => {
      if (node.data.kind === 'effect' && node.data.effectData) {
        onSelectEffect?.(node.data.effectData);
      }
    },
    [onSelectEffect],
  );

  return (
    <div ref={containerRef} className="h-full w-full bg-black">
      <TreeActionsContext.Provider value={contextActions}>
        <Tree<LibraryTreeNode>
          ref={treeRef}
          data={data}
          openByDefault
          width="100%"
          height={treeHeight}
          indent={16}
          rowHeight={26}
          overscanCount={10}
          idAccessor="id"
          childrenAccessor="children"
          selection={selectedId ?? undefined}
          onSelect={handleSelect}
          onRename={handleRename}
          onMove={handleMove}
          onActivate={handleActivate}
          disableDrag={false}
          disableDrop={false}
          disableEdit={false}
          className="effects-library-tree"
        >
          {Node}
        </Tree>
      </TreeActionsContext.Provider>
    </div>
  );
}
