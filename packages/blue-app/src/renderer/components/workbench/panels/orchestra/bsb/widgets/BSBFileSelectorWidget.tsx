import React from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import WidgetWrapper from './WidgetWrapper';
import { getWidgetDisplaySize } from './utils';
import type { BSBWidgetComponentProps } from './widget-component-props';

type BSBFileSelectorWidgetProps = BSBWidgetComponentProps;

function BSBFileSelectorWidget({
  node,
  isSelected,
  editEnabled,
  onWidgetSelect,
  onBsbInterfacePatch,
  resizeMeta,
  gridSnapEnabled,
  gridSnapWidth,
  gridSnapHeight,
  selectedWidgetIds,
  getWidgetPosition,
  onWidgetAction,
}: BSBFileSelectorWidgetProps): React.ReactElement {
  const fileName = typeof node.properties.fileName === 'string' ? node.properties.fileName : '';
  const textFieldWidth = Math.max(10, (typeof node.properties.textFieldWidth === 'number' ? node.properties.textFieldWidth : 100));
  const displaySize = getWidgetDisplaySize(node);

  const commitFileName = (nextFileName: string): void => {
    onBsbInterfacePatch?.({
      type: 'updateWidgetProperties',
      widgetId: node.id,
      properties: { fileName: nextFileName },
    });
  };

  const openBrowseDialog = async (): Promise<void> => {
    const selectedPath = await window.blueAPI.openBsbFileSelector(fileName || undefined);
    if (selectedPath) {
      commitFileName(selectedPath);
    }
  };

  const handleBrowse = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    await openBrowseDialog();
  };

  const handleClear = (event: Event): void => {
    event.stopPropagation();
    commitFileName('');
  };

  const handleCopyToMedia = async (event: Event): Promise<void> => {
    event.stopPropagation();
    const copiedPath = await window.blueAPI.copyBsbFileSelectorToMediaFolder(fileName || undefined);
    if (copiedPath) {
      commitFileName(copiedPath);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const droppedFile = event.dataTransfer.files[0];
    let droppedPath = droppedFile ? (droppedFile as File & { path?: string }).path ?? droppedFile.name : '';

    if (!droppedPath) {
      const uriList = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain');
      if (uriList.startsWith('file://')) {
        droppedPath = decodeURI(uriList.substring(7).trim());
      } else {
        droppedPath = uriList.trim();
      }
    }

    if (!droppedPath) {
      return;
    }

    const selectedPath = await window.blueAPI.setBsbFileSelectorPath(droppedPath);
    if (selectedPath) {
      commitFileName(selectedPath);
    }
  };

  return (
    <WidgetWrapper node={node} isSelected={isSelected} editEnabled={editEnabled} onWidgetSelect={onWidgetSelect} displayWidth={displaySize.width} displayHeight={displaySize.height} resizeMeta={resizeMeta} gridSnapEnabled={gridSnapEnabled} gridSnapWidth={gridSnapWidth} gridSnapHeight={gridSnapHeight} onBsbInterfacePatch={onBsbInterfacePatch} selectedWidgetIds={selectedWidgetIds} getWidgetPosition={getWidgetPosition} onWidgetAction={onWidgetAction}>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            className="flex h-full w-full items-stretch overflow-hidden rounded border border-blue-border/40 bg-blue-surface/30"
            onContextMenu={(event) => event.stopPropagation()}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDrop={handleDrop}
          >
            <div
              className="flex h-full items-center overflow-hidden bg-app-bsb-input px-1.5 text-role-body text-app-text"
              style={{ width: textFieldWidth }}
              title={fileName || '(none)'}
            >
              <span className="truncate">{fileName || '(none)'}</span>
            </div>
            <button
              type="button"
              className="flex shrink-0 items-center justify-center border-l border-blue-border/40 text-role-callout text-blue-muted hover:text-gray-200"
              onClick={handleBrowse}
              onMouseDown={(event) => event.stopPropagation()}
              style={{ width: 30 }}
            >
              ...
            </button>
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="editor-context-menu">
            <ContextMenu.Item className="editor-context-menu__item" onSelect={() => { void openBrowseDialog(); }}>
              Browse...
            </ContextMenu.Item>
            <ContextMenu.Item className="editor-context-menu__item" onSelect={handleClear}>
              Clear
            </ContextMenu.Item>
            <ContextMenu.Item className="editor-context-menu__item" onSelect={handleCopyToMedia}>
              Copy to Media Folder
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    </WidgetWrapper>
  );
}

export default React.memo(BSBFileSelectorWidget);
