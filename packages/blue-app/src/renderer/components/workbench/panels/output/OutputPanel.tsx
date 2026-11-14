import { useRef, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { Clipboard, MousePointerClick, Trash2 } from 'lucide-react';
import { useOutputStore } from '../../../../stores/output-store';
import { PopoutContextMenuPortal } from '../../../../hooks/host-portals';
import { useHostDocument } from '../../../../hooks/use-host-document';
import { cn } from '../../../../lib/cn';
import { PROJECT_MESSAGES_TAB } from '../../../../../shared/xml-diagnostics';

const OUTPUT_VIRTUALIZE_THRESHOLD = 100;
const OUTPUT_DEFAULT_LINE_HEIGHT = 18;
const OUTPUT_FALLBACK_VIEWPORT_LINES = 30;
const OUTPUT_OVERSCAN_LINES = 20;

function measureLogLine(text: string, measure: (text: string) => number, tabWidth: number): number {
  if (!text.includes('\t')) return measure(text);

  let width = 0;
  const runs = text.split('\t');
  for (const [index, run] of runs.entries()) {
    if (index > 0 && tabWidth > 0) {
      let nextStop = (Math.floor(width / tabWidth) + 1) * tabWidth;
      // CSS advances another stop when the next stop is less than half a space away.
      if (nextStop - width < measure(' ') / 2) nextStop += tabWidth;
      width = nextStop;
    }
    width += measure(run);
  }
  return width;
}

export default function OutputPanel() {
  const tabs = useOutputStore((s) => s.tabs);
  const tabOrder = useOutputStore((s) => s.tabOrder);
  const activeTabId = useOutputStore((s) => s.activeTabId);
  const selectTab = useOutputStore((s) => s.selectTab);
  const resetTab = useOutputStore((s) => s.resetTab);
  const hostDocument = useHostDocument();

  const activeTab = activeTabId ? tabs[activeTabId] : null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const hasSelectionRef = useRef(false);
  const allLinesSelectedRef = useRef(false);
  const [selectionMode, setSelectionMode] = useState<'manual' | 'all' | null>(null);
  const [scrollTopState, setScrollTopState] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [measuredLineHeight, setMeasuredLineHeight] = useState(OUTPUT_DEFAULT_LINE_HEIGHT);
  const [longestLineText, setLongestLineText] = useState('');
  const widthMeasurements = useRef<{
    document: Document;
    font: string;
    tabSize: string;
    context: CanvasRenderingContext2D | null;
    widths: WeakMap<object, number>;
  } | null>(null);

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

  // Project Messages uses wrapping multi-line rows (variable heights), so only
  // uniform-height log tabs use fixed-row virtualization.
  const isVirtualized =
    activeTabId !== PROJECT_MESSAGES_TAB && lines.length > OUTPUT_VIRTUALIZE_THRESHOLD;
  // Native selection needs the selected text nodes and any rows the range can extend into.
  const cullRows = isVirtualized && selectionMode !== 'manual';
  const lineHeight = measuredLineHeight > 0 ? measuredLineHeight : OUTPUT_DEFAULT_LINE_HEIGHT;
  const effectiveViewportHeight =
    viewportHeight > 0 ? viewportHeight : lineHeight * OUTPUT_FALLBACK_VIEWPORT_LINES;

  const { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight } = useMemo(() => {
    if (!cullRows) {
      return {
        startIndex: 0,
        endIndex: lines.length,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      };
    }
    const maxScrollTop = Math.max(0, lines.length * lineHeight - effectiveViewportHeight);
    const clampedScrollTop = Math.max(0, Math.min(scrollTopState, maxScrollTop));
    const start = Math.max(0, Math.floor(clampedScrollTop / lineHeight) - OUTPUT_OVERSCAN_LINES);
    const visibleCount =
      Math.ceil(effectiveViewportHeight / lineHeight) + OUTPUT_OVERSCAN_LINES * 2;
    const end = Math.min(lines.length, start + visibleCount);
    return {
      startIndex: start,
      endIndex: end,
      topSpacerHeight: start * lineHeight,
      bottomSpacerHeight: Math.max(0, (lines.length - end) * lineHeight),
    };
  }, [cullRows, lines.length, lineHeight, effectiveViewportHeight, scrollTopState]);

  const visibleLines = useMemo(
    () => (cullRows ? lines.slice(startIndex, endIndex) : lines),
    [cullRows, lines, startIndex, endIndex],
  );

  // Preserve scrollWidth when long log lines scroll out of the virtualized
  // window so Chromium does not clamp horizontal scrollLeft during scrolling.
  useLayoutEffect(() => {
    const lineElement = scrollRef.current?.querySelector(
      '.output-panel__line:not([data-output-width-sentinel])',
    );
    if (!isVirtualized || !lineElement) return;
    const doc = lineElement.ownerDocument;
    const view = doc.defaultView;
    if (!view) return;
    const style = view.getComputedStyle(lineElement);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const tabSize = style.tabSize;
    let cache = widthMeasurements.current;
    if (!cache || cache.document !== doc || cache.font !== font || cache.tabSize !== tabSize) {
      const context =
        typeof view.CanvasRenderingContext2D === 'function'
          ? doc.createElement('canvas').getContext('2d')
          : null;
      if (context) context.font = font;
      cache = { document: doc, font, tabSize, context, widths: new WeakMap() };
      widthMeasurements.current = cache;
    }
    const { context, widths } = cache;
    const measure = (value: string) => context?.measureText(value).width ?? value.length;
    const tabSizeValue = Number.parseFloat(tabSize);
    const tabWidth = Number.isFinite(tabSizeValue)
      ? tabSize.endsWith('px')
        ? tabSizeValue
        : tabSizeValue * measure(' ')
      : 8 * measure(' ');
    let maxText = '';
    let maxWidth = 0;
    for (const line of lines) {
      let width = widths.get(line);
      if (width === undefined) {
        width = measureLogLine(line.text, measure, tabWidth);
        widths.set(line, width);
      }
      if (width > maxWidth) {
        maxWidth = width;
        maxText = line.text;
      }
    }
    setLongestLineText(maxText);
  }, [hostDocument, isVirtualized, lines]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const updateMeasurements = () => {
      setViewportHeight(el.clientHeight);
      const view = el.ownerDocument.defaultView;
      if (view) {
        const computed = Number.parseFloat(view.getComputedStyle(el).lineHeight);
        if (Number.isFinite(computed) && computed > 0) {
          setMeasuredLineHeight(computed);
          return;
        }
      }
      const firstLine = el.querySelector<HTMLElement>(
        '.output-panel__line:not([data-output-width-sentinel])',
      );
      if (firstLine && firstLine.offsetHeight > 0) {
        setMeasuredLineHeight(firstLine.offsetHeight);
      }
    };
    updateMeasurements();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateMeasurements);
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeTabId, lines.length]);

  // Track document selection state for auto-scroll pausing and Copy enable/disable
  const handleSelectionChange = useCallback(() => {
    if (!hostDocument) return;
    const selection = hostDocument.getSelection();
    const isWithin =
      !!selection &&
      !selection.isCollapsed &&
      (scrollRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer) ?? false);
    hasSelectionRef.current = isWithin;
    if (!isWithin) allLinesSelectedRef.current = false;
    setSelectionMode(isWithin ? (allLinesSelectedRef.current ? 'all' : 'manual') : null);
  }, [hostDocument]);

  useEffect(() => {
    if (!hostDocument) return undefined;
    hostDocument.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      hostDocument.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange, hostDocument]);

  // Reset per-tab scroll and selection state when switching tabs.
  useEffect(() => {
    const sel = hostDocument?.getSelection();
    if (sel && !sel.isCollapsed && scrollRef.current && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (scrollRef.current.contains(range.commonAncestorContainer)) {
        sel.removeAllRanges();
      }
    }
    hasSelectionRef.current = false;
    allLinesSelectedRef.current = false;
    setSelectionMode(null);
    autoScrollRef.current = activeTabId !== PROJECT_MESSAGES_TAB;
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
    setScrollTopState(0);
  }, [activeTabId, hostDocument]);

  // Stream output follows new lines; a compatibility report starts at its
  // first message so reviewing it does not begin halfway through a warning.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || hasSelectionRef.current) return;
    if (activeTabId === PROJECT_MESSAGES_TAB || lines.length === 0) {
      el.scrollTop = 0;
      setScrollTopState(0);
    } else if (autoScrollRef.current) {
      const targetScrollTop = isVirtualized
        ? Math.max(0, lines.length * lineHeight - effectiveViewportHeight)
        : el.scrollHeight;
      el.scrollTop = targetScrollTop;
      setScrollTopState(el.scrollTop);
    }
  }, [activeTab, activeTabId, isVirtualized, lines.length, lineHeight, effectiveViewportHeight]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // A scroll may arrive before the browser dispatches selectionchange.
    if (isVirtualized && !allLinesSelectedRef.current) handleSelectionChange();
    const { scrollTop, scrollHeight, clientHeight } = el;
    setScrollTopState(scrollTop);
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40;
  }, [handleSelectionChange, isVirtualized]);

  const errorColor = activeTab?.colorOverrides.error ?? '#ff6b6b';
  const outputColor = activeTab?.colorOverrides.output ?? '#d4d4d4';

  const tabEntries = useMemo(
    () => tabOrder.map((id) => tabs[id]).filter((t) => t && !t.isClosed),
    [tabOrder, tabs],
  );

  // Context menu actions
  const handleCopy = useCallback(() => {
    const sel = hostDocument?.getSelection();
    if (!(isVirtualized && allLinesSelectedRef.current) && (!sel || sel.isCollapsed)) return;
    const text =
      isVirtualized && allLinesSelectedRef.current
        ? lines.map((line) => line.text).join('\n')
        : (sel?.toString() ?? '');
    if (typeof window !== 'undefined' && window.blueAPI?.writeClipboardText) {
      void window.blueAPI.writeClipboardText(text);
    } else if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
    }
  }, [hostDocument, isVirtualized, lines]);

  const handleSelectAll = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || !hostDocument) return;
    allLinesSelectedRef.current = true;
    const range = hostDocument.createRange();
    const sentinel = scrollEl.querySelector('[data-output-width-sentinel="true"]');
    if (sentinel && sentinel.parentNode === scrollEl) {
      range.setStart(scrollEl, 0);
      range.setEndBefore(sentinel);
    } else {
      range.selectNodeContents(scrollEl);
    }
    const sel = hostDocument.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    const active = Boolean(sel && !sel.isCollapsed);
    hasSelectionRef.current = active;
    setSelectionMode(active ? 'all' : null);
  }, [hostDocument]);

  const handleCopyEvent = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (isVirtualized && allLinesSelectedRef.current && e.clipboardData) {
        e.preventDefault();
        e.clipboardData.setData('text/plain', lines.map((line) => line.text).join('\n'));
      }
    },
    [isVirtualized, lines],
  );

  const handleClear = useCallback(() => {
    if (activeTabId) {
      allLinesSelectedRef.current = false;
      hasSelectionRef.current = false;
      setSelectionMode(null);
      resetTab(activeTabId);
    }
  }, [activeTabId, resetTab]);

  // Keyboard shortcuts on the scroll container
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (
        !mod &&
        (e.key === 'Escape' ||
          e.key.startsWith('Arrow') ||
          e.key === 'Home' ||
          e.key === 'End' ||
          e.key === 'PageUp' ||
          e.key === 'PageDown')
      ) {
        allLinesSelectedRef.current = false;
        return;
      }
      if (mod && e.shiftKey && (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End')) {
        allLinesSelectedRef.current = false;
        return;
      }
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
                tab.id === activeTabId && 'output-panel__tab--active',
              )}
            >
              {tab.name}
            </button>
          ))}
        </div>
        {activeTabId && (
          <button onClick={handleClear} className="output-panel__toolbar-btn" title="Clear output">
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
            onCopy={handleCopyEvent}
            onMouseDown={(e) => {
              if (e.button === 0) {
                allLinesSelectedRef.current = false;
              }
            }}
            className="output-panel__scroll"
            tabIndex={0}
          >
            {lines.length === 0 ? (
              <div className="output-panel__empty">No output.</div>
            ) : (
              <>
                {topSpacerHeight > 0 && (
                  <div style={{ height: topSpacerHeight }} aria-hidden="true" />
                )}
                {visibleLines.map((line) => (
                  <div
                    key={line.id}
                    className={cn(
                      'output-panel__line min-h-lh',
                      activeTabId === PROJECT_MESSAGES_TAB && 'whitespace-pre-wrap! wrap-anywhere',
                    )}
                  >
                    <span
                      style={{
                        color: line.type === 'stderr' ? errorColor : outputColor,
                      }}
                    >
                      {line.text}
                    </span>
                  </div>
                ))}
                {bottomSpacerHeight > 0 && (
                  <div style={{ height: bottomSpacerHeight }} aria-hidden="true" />
                )}
                {isVirtualized && longestLineText.length > 0 && (
                  <div
                    className="output-panel__line pointer-events-none select-none"
                    style={{
                      width: 'max-content',
                      height: 0,
                      minHeight: 0,
                      overflow: 'hidden',
                      visibility: 'hidden',
                    }}
                    aria-hidden="true"
                    data-output-width-sentinel="true"
                  >
                    <span>{longestLineText}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </ContextMenu.Trigger>

        <PopoutContextMenuPortal>
          <ContextMenu.Content className="workbench-context-menu">
            <ContextMenu.Item
              className="workbench-context-menu__item"
              disabled={selectionMode === null}
              onSelect={handleCopy}
            >
              <Clipboard size={14} strokeWidth={1.9} />
              Copy
            </ContextMenu.Item>

            <ContextMenu.Item className="workbench-context-menu__item" onSelect={handleSelectAll}>
              <MousePointerClick size={14} strokeWidth={1.9} />
              Select All
            </ContextMenu.Item>

            <ContextMenu.Separator className="workbench-context-menu__separator" />

            <ContextMenu.Item className="workbench-context-menu__item" onSelect={handleClear}>
              <Trash2 size={14} strokeWidth={1.9} />
              Clear
            </ContextMenu.Item>
          </ContextMenu.Content>
        </PopoutContextMenuPortal>
      </ContextMenu.Root>
    </div>
  );
}
