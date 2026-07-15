import type { LibraryItemPreview } from '../../../shared/unified-library';

export function LibraryPreview({ preview }: { preview: LibraryItemPreview | null }): React.ReactElement {
  if (!preview) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-app-text-muted">
        Select an item to inspect its preview.
      </div>
    );
  }
  return (
    <section aria-label={`${preview.displayName} preview`} className="h-full overflow-auto p-3">
      <h3 className="text-base font-semibold text-app-text">{preview.displayName}</h3>
      <p className="mt-0.5 text-xs text-app-text-muted">{preview.objectType}</p>
      {preview.supportStatus === 'unsupported' && (
        <div role="alert" className="mt-3 rounded border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-amber-300">
          {preview.supportMessage ?? 'This item contains unsupported nested data. Its original XML is preserved.'}
        </div>
      )}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
        {Object.entries(preview.fields).map(([name, field]) => (
          <div key={name} className="contents">
            <dt className="font-medium capitalize text-app-text-muted">{name}</dt>
            <dd className={field.state === 'available' ? 'text-app-text' : 'italic text-app-text-muted'}>
              {field.state === 'available' ? String(field.value ?? '') : field.reason ?? 'Unavailable'}
            </dd>
          </div>
        ))}
      </dl>
      {(preview.dependencies.itemOwned.length > 0 || preview.dependencies.unresolvedExternal.length > 0) && (
        <div className="mt-4 text-xs text-app-text-muted">
          {preview.dependencies.itemOwned.length > 0 && <p>Includes: {preview.dependencies.itemOwned.join(', ')}</p>}
          {preview.dependencies.unresolvedExternal.length > 0 && <p>Unresolved: {preview.dependencies.unresolvedExternal.join(', ')}</p>}
        </div>
      )}
    </section>
  );
}
