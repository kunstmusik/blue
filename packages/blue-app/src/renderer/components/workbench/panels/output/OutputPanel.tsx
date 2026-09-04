import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { Clipboard, MousePointerClick, Trash2 } from 'lucide-react';
import { useOutputStore } from '../../../../stores/output-store';
import { PopoutContextMenuPortal } from '../../../../hooks/host-portals';
import { useHostDocument } from '../../../../hooks/use-host-document';
import { cn } from '../../../../lib/cn';

export default function OutputPanel() {
  const tabs = useOutputStore((s) => s.tabs);
  const tabOrder = useOutputStore((s) => s.tabOrder);
  const activeTabId = useOutputStore((s) => s.activeTabId);
  const selectTab = useOutputStore((s) => s.selectTab);
  const resetTab = useOutputStore((s) => s.resetTab);

  const activeTab = activeTabId ? tabs[activeTabId] : null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const hasSelectionRef = useRef(false);
  const [hasSelection, setHasSelection] = useState(false);

  const lines = useMemo(() => {
    if (!activeTab) {
      return [];
    }

    if (!activeTab.pendingText) {
      return activeTab.lines;
    }

    return [
      ...activeTab.lines,
      {
        id: activeTab.lineCounter + 1,
        text: activeTab.pendingText,
        type: activeTab.pendingType ?? 'stdout',
      },
    ];
  }, [activeTab]);

  // Track document selection state for auto-scroll pausing and Copy enable/disable
  const hostDocument = useHostDocument();
  useEffect(() => {
    function handleSelectionChange() {
      if (!hostDocument) return;
      const sel = hostDocument.getSelection();
      if (!sel || sel.isCollapsed || !scrollRef.current) {
        hasSelectionRef.current = false;
        setHasSelection(false);
        return;
      }
      // Check if the selection is within our scroll container
      const range = sel.getRangeAt(0);
      const isWithin = scrollRef.current.contains(range.commonAncestorContainer);
      hasSelectionRef.current = isWithin && !sel.isCollapsed;
      setHasSelection(hasSelectionRef.current);
    }

    if (!hostDocument) return undefined;
    hostDocument.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      hostDocument.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [hostDocument]);

  // Auto-scroll to bottom when new lines arrive, unless user scrolled away or has selection
  useEffect(() => {
    if (autoScrollRef.current && !hasSelectionRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines.length, activeTab?.pendingText]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40;
  }, []);

  const errorColor = activeTab?.colorOverrides.error ?? '#ff6b6b';
  const outputColor = activeTab?.colorOverrides.output ?? '#d4d4d4';

  const tabEntries = useMemo(
    () => tabOrder.map((id) => tabs[id]).filter((t) => t && !t.isClosed),
    [tabOrder, tabs],
  );

  // Context menu actions
  const handleCopy = useCallback(() => {
    const sel = hostDocument?.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString();
    if (typeof window !== 'undefined' && window.blueAPI?.writeClipboardText) {
      void window.blueAPI.writeClipboardText(text);
    } else if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
    }
  }, [hostDocument]);

  const handleSelectAll = useCallback(() => {
    if (!scrollRef.current || !hostDocument) return;
    const range = hostDocument.createRange();
    range.selectNodeContents(scrollRef.current);
    const sel = hostDocument.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [hostDocument]);

  const handleClear = useCallback(() => {
    if (activeTabId) {
      resetTab(activeTabId);
    }
  }, [activeTabId, resetTab]);

  // Keyboard shortcuts on the scroll container
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleSelectAll();
      }
    },
    [handleClear, handleSelectAll],
  );

  return (
    <div className="output-panel">
      <div className="output-panel__tabs">
        <div className="output-panel__tabs-scroll">
          {tabEntries.map((tab) => (
            <button
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              className={cn(
                'output-panel__tab',
                tab.id === activeTabId && 'output-panel__tab--active'
              )}
            >
              {tab.name}
            </button>
          ))}
        </div>
        {activeTabId && (
          <button
            onClick={handleClear}
            className="output-panel__toolbar-btn"
            title="Clear output"
          >
            Clear
          </button>
        )}
      </div>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            className="output-panel__scroll"
            tabIndex={0}
          >
            {lines.length === 0 ? (
              <div className="output-panel__empty">No output.</div>
            ) : (
              lines.map((line) => (
                <div key={line.id} className="output-panel__line">
                  <span
                    style={{
                      color:
                        line.type === 'stderr' ? errorColor : outputColor,
                    }}
                  >
                    {line.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </ContextMenu.Trigger>

        <PopoutContextMenuPortal>
          <ContextMenu.Content
            className="workbench-context-menu"
            sideOffset={6}
            align="start"
          >
            <ContextMenu.Item
              className="workbench-context-menu__item"
              disabled={!hasSelection}
              onSelect={handleCopy}
            >
              <Clipboard size={14} strokeWidth={1.9} />
              Copy
            </ContextMenu.Item>

            <ContextMenu.Item
              className="workbench-context-menu__item"
              onSelect={handleSelectAll}
            >
              <MousePointerClick size={14} strokeWidth={1.9} />
              Select All
            </ContextMenu.Item>

            <ContextMenu.Separator className="workbench-context-menu__separator" />

            <ContextMenu.Item
              className="workbench-context-menu__item"
              onSelect={handleClear}
            >
              <Trash2 size={14} strokeWidth={1.9} />
              Clear
            </ContextMenu.Item>
          </ContextMenu.Content>
        </PopoutContextMenuPortal>
      </ContextMenu.Root>
    </div>
  );
}
