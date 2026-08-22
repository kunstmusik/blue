import * as ContextMenu from '@radix-ui/react-context-menu';
import type { EditorView } from '@codemirror/view';
import { ChevronRight } from 'lucide-react';
import React, { useMemo, type MutableRefObject, type ReactNode } from 'react';

import {
  copySelectionToClipboard,
  cutSelectionToClipboard,
  getSelectedText,
  pasteClipboardText,
  type CsoundEditorClipboardBridge,
  insertTextAtSelection,
} from './csound-editor-actions';
import type {
  CsoundEditorCommandItem,
  CsoundEditorDisabledItem,
  CsoundEditorInsertionItem,
  CsoundEditorMenuItem,
  CsoundEditorSeparatorItem,
  CsoundEditorSubmenuItem,
} from './editor-adapter-types';

interface CsoundEditorContextMenuProps {
  children: ReactNode;
  editorViewRef: MutableRefObject<EditorView | null>;
  menuItems: CsoundEditorMenuItem[];
  clipboardBridge?: CsoundEditorClipboardBridge;
  onEvaluateCode?: () => void;
  onAddToCodeRepository?: (selectedText: string) => void;
}

function getPortalContainer(): HTMLElement | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }

  return document.body;
}

function isSubmenuItem(item: CsoundEditorMenuItem): item is CsoundEditorSubmenuItem {
  return item.kind === 'submenu';
}

function isCommandItem(item: CsoundEditorMenuItem): item is CsoundEditorCommandItem {
  return item.kind === 'command';
}

function isInsertionItem(item: CsoundEditorMenuItem): item is CsoundEditorInsertionItem {
  return item.kind === 'insertion';
}

function isDisabledItem(item: CsoundEditorMenuItem): item is CsoundEditorDisabledItem {
  return item.kind === 'disabled';
}

function isSeparatorItem(item: CsoundEditorMenuItem): item is CsoundEditorSeparatorItem {
  return item.kind === 'separator';
}

function getMenuItemClassName(disabled?: boolean): string {
  return ['editor-context-menu__item', disabled ? 'editor-context-menu__item--disabled' : '']
    .filter(Boolean)
    .join(' ');
}

function renderMenuItem(
  item: CsoundEditorMenuItem,
  editorViewRef: MutableRefObject<EditorView | null>,
  clipboardBridge: CsoundEditorClipboardBridge | undefined,
  onEvaluateCode?: () => void,
  onAddToCodeRepository?: (selectedText: string) => void,
): ReactNode {
  if (isSeparatorItem(item)) {
    return <ContextMenu.Separator key={item.id} className="editor-context-menu__separator" />;
  }

  if (isSubmenuItem(item)) {
    const portalContainer = getPortalContainer();

    return (
      <ContextMenu.Sub key={item.id}>
        <ContextMenu.SubTrigger
          className={[getMenuItemClassName(item.disabled), 'editor-context-menu__subtrigger'].filter(Boolean).join(' ')}
          disabled={item.disabled}
          title={item.disabledReason}
        >
          <span>{item.label}</span>
          <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 opacity-60" />
        </ContextMenu.SubTrigger>
        {portalContainer ? (
          <ContextMenu.Portal container={portalContainer}>
            <ContextMenu.SubContent
              className="editor-context-menu editor-context-menu--submenu"
              sideOffset={6}
              alignOffset={-4}
            >
              {item.items.map((childItem) => renderMenuItem(childItem, editorViewRef, clipboardBridge, onEvaluateCode, onAddToCodeRepository))}
            </ContextMenu.SubContent>
          </ContextMenu.Portal>
        ) : null}
      </ContextMenu.Sub>
    );
  }

  if (isDisabledItem(item)) {
    return (
      <ContextMenu.Item
        key={item.id}
        className={getMenuItemClassName(true)}
        disabled
        title={item.disabledReason}
      >
        {item.label}
      </ContextMenu.Item>
    );
  }

  if (isInsertionItem(item)) {
    const handleSelect = () => {
      const editorView = editorViewRef.current;
      if (!editorView || item.disabled) {
        return;
      }

      insertTextAtSelection(editorView, item.insertText);
    };

    return (
      <ContextMenu.Item
        key={item.id}
        className={getMenuItemClassName(item.disabled)}
        disabled={item.disabled}
        title={item.disabledReason}
        onSelect={handleSelect}
      >
        {item.label}
      </ContextMenu.Item>
    );
  }

  if (isCommandItem(item)) {
    const handleSelect = () => {
      const editorView = editorViewRef.current;
      if (!editorView || item.disabled) {
        return;
      }

      switch (item.command) {
        case 'cut':
          void cutSelectionToClipboard(editorView, clipboardBridge);
          break;
        case 'copy':
          void copySelectionToClipboard(editorView, clipboardBridge);
          break;
        case 'paste':
          void pasteClipboardText(editorView, clipboardBridge);
          break;
        case 'evaluate-code':
          onEvaluateCode?.();
          break;
        case 'add-to-code-repository': {
          const selectedText = getSelectedText(editorView.state);
          if (selectedText.length > 0) {
            onAddToCodeRepository?.(selectedText);
          }
          break;
        }
      }
    };

    return (
      <ContextMenu.Item
        key={item.id}
        className={getMenuItemClassName(item.disabled)}
        disabled={item.disabled}
        title={item.disabledReason}
        onSelect={handleSelect}
      >
        <span>{item.label}</span>
        {item.shortcutLabel ? (
          <span className="editor-context-menu__shortcut">{item.shortcutLabel}</span>
        ) : null}
      </ContextMenu.Item>
    );
  }

  return null;
}

export default function CsoundEditorContextMenu({
  children,
  editorViewRef,
  menuItems,
  clipboardBridge,
  onEvaluateCode,
  onAddToCodeRepository,
}: CsoundEditorContextMenuProps): React.ReactElement {
  const portalContainer = useMemo(() => getPortalContainer(), []);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>

      {portalContainer ? (
        <ContextMenu.Portal container={portalContainer}>
          <ContextMenu.Content
            className="editor-context-menu"
            sideOffset={6}
          >
            {menuItems.map((item) => renderMenuItem(item, editorViewRef, clipboardBridge, onEvaluateCode, onAddToCodeRepository))}
          </ContextMenu.Content>
        </ContextMenu.Portal>
      ) : null}
    </ContextMenu.Root>
  );
}
