import type { LibraryContextSnapshot } from '../../../shared/unified-library';

interface LibraryTargetBannerProps {
  context: LibraryContextSnapshot;
  onClear: () => void;
}

export function LibraryTargetBanner({ context, onClear }: LibraryTargetBannerProps): React.ReactElement | null {
  const target = context.target;
  if (!target) return null;
  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-2 border-b px-2 py-2 text-xs ${target.valid ? 'border-app-accent/50 bg-app-accent/10' : 'border-red-500/50 bg-red-500/10'}`}
    >
      <span>
        <strong>Destination:</strong> {target.label}
        {!target.valid && ` — ${target.invalidReason ?? 'stale'}`}
      </span>
      <button type="button" className="rounded border border-app-border px-2 py-1" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
