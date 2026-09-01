import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

export interface BlueX7TabItem<T extends string = string> {
  key: T;
  label: React.ReactNode;
  badge?: React.ReactNode;
  ariaLabel?: string;
  title?: string;
  testId?: string;
}

export interface BlueX7TabListProps<T extends string = string> {
  instanceId?: string;
  ariaLabel: string;
  tabs: readonly BlueX7TabItem<T>[];
  activeTab: T;
  onSelectTab: (tab: T) => void;
  className?: string;
  tabClassName?: (tab: BlueX7TabItem<T>, isActive: boolean) => string;
}

export function BlueX7TabList<T extends string = string>({
  instanceId: providedInstanceId,
  ariaLabel,
  tabs,
  activeTab,
  onSelectTab,
  className = '',
  tabClassName,
}: BlueX7TabListProps<T>): React.ReactElement {
  const generatedId = useId().replace(/:/g, '');
  const instanceId = providedInstanceId ?? generatedId;

  const [focusedKey, setFocusedKey] = useState<T>(activeTab);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // When activeTab changes from outside, sync focusedKey if not actively navigating
  useEffect(() => {
    setFocusedKey(activeTab);
  }, [activeTab]);

  const activeIndex = tabs.findIndex((t) => t.key === activeTab);

  // Scroll active tab into view when active tab changes
  useEffect(() => {
    if (activeIndex >= 0 && tabRefs.current[activeIndex]) {
      const el = tabRefs.current[activeIndex];
      if (typeof el?.scrollIntoView === 'function') {
        el.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
        });
      }
    }
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const tabCount = tabs.length;
      if (tabCount === 0) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIndex = (index + 1) % tabCount;
        const nextTab = tabs[nextIndex];
        if (nextTab) {
          setFocusedKey(nextTab.key);
          const el = tabRefs.current[nextIndex];
          el?.focus();
          if (typeof el?.scrollIntoView === 'function') {
            el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          }
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIndex = (index - 1 + tabCount) % tabCount;
        const prevTab = tabs[prevIndex];
        if (prevTab) {
          setFocusedKey(prevTab.key);
          const el = tabRefs.current[prevIndex];
          el?.focus();
          if (typeof el?.scrollIntoView === 'function') {
            el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          }
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const currentTab = tabs[index];
        if (currentTab) {
          onSelectTab(currentTab.key);
        }
      }
    },
    [tabs, onSelectTab],
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex flex-row flex-nowrap items-center gap-1 overflow-x-auto min-w-0 scrollbar-thin ${className}`}
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.key === activeTab;
        const isFocused = tab.key === focusedKey;
        const tabId = `${instanceId}-tab-${tab.key}`;
        const panelId = `${instanceId}-panel-${tab.key}`;

        const defaultClasses = isActive
          ? 'bg-blue-accent text-white font-medium shadow-sm'
          : 'bg-blue-surface/60 text-blue-muted hover:bg-blue-surface hover:text-gray-100';

        const customClasses = tabClassName ? tabClassName(tab, isActive) : defaultClasses;

        return (
          <button
            key={tab.key}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            id={tabId}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={panelId}
            aria-label={tab.ariaLabel}
            tabIndex={isFocused ? 0 : -1}
            title={tab.title}
            data-testid={tab.testId}
            className={`flex items-center gap-1.5 shrink-0 rounded px-3 py-1.5 text-role-body transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 ${customClasses}`}
            onClick={() => {
              setFocusedKey(tab.key);
              onSelectTab(tab.key);
            }}
            onKeyDown={(e) => handleKeyDown(e, idx)}
          >
            <span>{tab.label}</span>
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}
