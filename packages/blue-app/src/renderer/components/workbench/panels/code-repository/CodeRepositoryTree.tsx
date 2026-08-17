import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { ChevronRight, FileCode, Folder, FolderOpen } from 'lucide-react';
import { Tree, type NodeRendererProps } from 'react-arborist';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { CODE_REPOSITORY_ROOT_ID, collectDescendantIds } from '@blue/data';
import type { CodeRepositoryNode } from '@blue/data';

export interface CodeRepositoryTreeMove {
  readonly dragIds: readonly string[];
  readonly parentId: string;
  readonly index: number;
}

interface CodeRepositoryTreeProps {
  readonly root: CodeRepositoryNode;
  readonly selectedId: string | null;
  readonly onSelect: (nodeId: string) => void;
  readonly onRename: (nodeId: string, name: string) => void;
  readonly onMove: (move: CodeRepositoryTreeMove) => void;
  readonly onAddGroup: (parentId: string) => void;
  readonly onAddSnippet: (parentId: string) => void;
  readonly onDelete: (nodeId: string) => void;
}

interface RepoTreeNode {
  readonly id: string;
  readonly name: string;
  readonly kind: CodeRepositoryNode['kind'];
  readonly children?: RepoTreeNode[];
}

interface CodeRepositoryTreeActions {
  readonly onSelect: (nodeId: string) => void;
  readonly onAddGroup: (parentId: string) => void;
  readonly onAddSnippet: (parentId: string) => void;
  readonly onDelete: (nodeId: string) => void;
}

const TreeActionsContext = createContext<CodeRepositoryTreeActions | null>(null);

function toRepoTree(node: CodeRepositoryNode): RepoTreeNode {
  return {
    id: node.id,
    name: node.name,
    kind: node.kind,
    ...(node.children ? { children: node.children.map(toRepoTree) } : {}),
  };
}

function RepositoryNodeMenu({
  node,
  actions,
  children,
}: {
  readonly node: NodeRendererProps<RepoTreeNode>['node'];
  readonly actions: CodeRepositoryTreeActions;
  readonly children: React.ReactNode;
}): React.ReactElement {
  const isContainer = node.data.kind === 'root' || node.data.kind === 'group';
  const isRoot = node.data.kind === 'root';

  return (
    <ContextMenu.Root
      onOpenChange={(open) => {
        if (open) {
          // A context-menu action should target the row that was opened, even
          // when another row was selected before the right-click.
          node.select();
          actions.onSelect(node.id);
        }
      }}
    >
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="editor-context-menu" collisionPadding={8}>
          {isContainer && (
            <>
              <ContextMenu.Item
                className="editor-context-menu__item"
                onSelect={() => actions.onAddGroup(node.id)}
              >
                Add Group
              </ContextMenu.Item>
              {!isRoot && (
                <ContextMenu.Item
                  className="editor-context-menu__item"
                  onSelect={() => actions.onDelete(node.id)}
                >
                  Remove Group
                </ContextMenu.Item>
              )}
              <ContextMenu.Item
                className="editor-context-menu__item"
                onSelect={() => actions.onAddSnippet(node.id)}
              >
                Add Code Snippet
              </ContextMenu.Item>
            </>
          )}
          {node.data.kind === 'snippet' && (
            <ContextMenu.Item
              className="editor-context-menu__item"
              onSelect={() => actions.onDelete(node.id)}
            >
              Remove Code Snippet
            </ContextMenu.Item>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function NodeRenderer({ node, style, dragHandle }: NodeRendererProps<RepoTreeNode>): React.ReactElement {
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const actions = useContext(TreeActionsContext);
  const isContainer = node.data.kind === 'root' || node.data.kind === 'group';
  const isSelected = node.isSelected;
  const isRoot = node.data.kind === 'root';
  const icon = isContainer ? (
    node.isOpen ? (
      <FolderOpen aria-hidden="true" className="h-3.5 w-3.5 flex-none text-yellow-500" />
    ) : (
      <Folder aria-hidden="true" className="h-3.5 w-3.5 flex-none text-yellow-600" />
    )
  ) : (
    <FileCode aria-hidden="true" className="h-3.5 w-3.5 flex-none text-blue-400" />
  );
  useEffect(() => {
    if (!node.isEditing) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [node.isEditing]);
  const nodeContent = (
    <div
      ref={dragHandle}
      style={style}
      className={[
        'flex items-center gap-1.5 pr-2 text-body select-none cursor-pointer',
        isSelected ? 'bg-app-accent/20 text-app-text-bright' : 'text-app-text hover:bg-app-hover',
      ].join(' ')}
      onClick={(e) => {
        node.handleClick(e);
        if (isContainer) node.toggle();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (!isRoot) node.edit();
      }}
    >
      {isContainer && (
        <ChevronRight
          aria-hidden="true"
          className={['h-3 w-3 flex-none transition-transform', node.isOpen ? 'rotate-90' : ''].join(' ')}
        />
      )}
      {!isContainer && <span className="w-3 flex-none" />}
      {icon}
      {node.isEditing ? (
        <input
          ref={renameInputRef}
          type="text"
          name="codeRepositoryItemName"
          autoComplete="off"
          defaultValue={node.data.name}
          aria-label="Rename code repository item"
          className="min-w-0 flex-1 rounded border border-app-accent bg-app-surface px-1 text-body text-app-text-strong outline-none"
          onClick={(event) => event.stopPropagation()}
          onBlur={() => node.reset()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              node.reset();
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const nextName = renameInputRef.current?.value.trim() ?? '';
              if (nextName.length > 0) node.submit(nextName);
            }
          }}
        />
      ) : (
        <span className="min-w-0 truncate">{node.data.name}</span>
      )}
      {isRoot && <span className="ml-auto flex-none text-tiny text-app-text-muted">root</span>}
    </div>
  );

  if (!actions) return nodeContent;
  return (
    <RepositoryNodeMenu node={node} actions={actions}>
      {nodeContent}
    </RepositoryNodeMenu>
  );
}

export default function CodeRepositoryTree({
  root,
  selectedId,
  onSelect,
  onRename,
  onMove,
  onAddGroup,
  onAddSnippet,
  onDelete,
}: CodeRepositoryTreeProps): React.ReactElement {
  const treeData = useMemo(() => [toRepoTree(root)], [root]);

  const handleMove = (args: { dragIds: string[]; parentId: string | null; index: number }) => {
    if (!args.parentId) return;
    for (const dragId of args.dragIds) {
      if (dragId === CODE_REPOSITORY_ROOT_ID) return;
      // Reject moving a node into itself or one of its descendants.
      const descendants = new Set(collectDescendantIds(root, dragId));
      if (descendants.has(args.parentId)) return;
    }
    onMove({
      dragIds: args.dragIds,
      parentId: args.parentId,
      index: args.index,
    });
  };

  const actions = useMemo<CodeRepositoryTreeActions>(
    () => ({ onSelect, onAddGroup, onAddSnippet, onDelete }),
    [onAddGroup, onAddSnippet, onDelete, onSelect],
  );

  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-tiny text-app-text-muted">Right-click an item for actions. Double-click to rename.</p>
      <TreeActionsContext.Provider value={actions}>
        <div className="min-h-0 flex-1 overflow-auto rounded bg-black p-1">
          <Tree<RepoTreeNode>
            data={treeData}
            openByDefault
            width="100%"
            height={480}
            indent={16}
            rowHeight={24}
            overscanCount={10}
            idAccessor="id"
            childrenAccessor="children"
            selection={selectedId ?? undefined}
            onSelect={(nodes) => {
              if (nodes[0]) onSelect(nodes[0].id);
            }}
            onRename={(props) => {
              if (props.id !== CODE_REPOSITORY_ROOT_ID && props.name.trim().length > 0) {
                onRename(props.id, props.name.trim());
              }
            }}
            onMove={handleMove}
            disableDrag={(data) => data.kind === 'root'}
            disableDrop={(args) => args.parentNode.data.kind === 'snippet'}
          >
            {NodeRenderer}
          </Tree>
        </div>
      </TreeActionsContext.Provider>
    </div>
  );
}
