import type { ScorePathSegment } from './types';

interface Props {
  segments: ScorePathSegment[];
  onNavigateToSegment: (index: number) => void;
  onNavigateToRoot: () => void;
}

export default function ScorePathBar({ segments, onNavigateToSegment, onNavigateToRoot }: Props) {
  return (
    <div className="flex items-center h-7 px-2 bg-blue-surface border-b border-blue-border/40 text-role-body gap-1 overflow-x-auto">
      {segments.map((segment, i) => (
        <span key={segment.groupId ?? 'root'} className="flex items-center gap-1 whitespace-nowrap">
          {i > 0 && <span className="text-blue-muted">/</span>}
          <button
            className={`px-1 py-0.5 rounded hover:bg-blue-hover text-blue-text ${
              i === segments.length - 1 ? 'font-medium bg-blue-surface/80' : 'text-blue-muted'
            }`}
            onClick={() => (i === 0 ? onNavigateToRoot() : onNavigateToSegment(i))}
          >
            {segment.label}
          </button>
        </span>
      ))}
    </div>
  );
}
