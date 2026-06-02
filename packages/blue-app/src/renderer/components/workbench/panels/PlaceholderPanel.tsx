import type { PanelDescriptor } from '../panel-registry';

interface PlaceholderPanelProps {
  descriptor: PanelDescriptor;
  showHeader?: boolean;
}

export default function PlaceholderPanel({
  descriptor,
  showHeader = true,
}: PlaceholderPanelProps) {
  return (
    <div className="flex flex-col h-full bg-blue-bg">
      {showHeader ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-surface border-b border-blue-border">
          <span className="text-sm font-medium text-gray-300">
            {descriptor.icon || '📋'} {descriptor.title}
          </span>
          <span className="text-body text-blue-muted ml-auto">{descriptor.mode}</span>
        </div>
      ) : null}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-blue-muted">
          <p className="text-sm">[{descriptor.id}]</p>
          <p className="text-body mt-1">Placeholder — to be implemented</p>
        </div>
      </div>
    </div>
  );
}
