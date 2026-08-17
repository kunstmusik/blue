import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { BreadcrumbSegment } from './file-manager-tree-state';

interface BreadcrumbBarProps {
  breadcrumb: BreadcrumbSegment[];
  onNavigateToRoots: () => void;
  onNavigateToSegment: (index: number) => void;
}

export function FileManagerBreadcrumb({
  breadcrumb,
  onNavigateToRoots,
  onNavigateToSegment,
}: BreadcrumbBarProps): React.ReactElement {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-none items-center gap-1 border-b border-app-border/40 bg-app-surface/40 px-2 py-1 text-ui text-app-text-muted overflow-x-auto"
    >
      <button
        type="button"
        className="flex items-center gap-1 text-app-text-muted hover:text-app-text-bright hover:underline cursor-pointer flex-none font-medium"
        onClick={onNavigateToRoots}
      >
        Roots
      </button>
      {breadcrumb.map((segment, idx) => {
        const isLast = idx === breadcrumb.length - 1;
        return (
          <React.Fragment key={segment.id}>
            <ChevronRight className="h-3 w-3 flex-none text-app-text-muted/60" aria-hidden="true" />
            {isLast ? (
              <span className="font-semibold text-app-text-bright truncate" title={segment.path}>
                {segment.name}
              </span>
            ) : (
              <button
                type="button"
                className="text-app-text-muted hover:text-app-text-bright hover:underline cursor-pointer flex-none truncate max-w-[140px]"
                title={segment.path}
                onClick={() => onNavigateToSegment(idx)}
              >
                {segment.name}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
