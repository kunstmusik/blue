interface LibraryBreadcrumbsProps {
  parts: readonly string[];
}

export function LibraryBreadcrumbs({ parts }: LibraryBreadcrumbsProps): React.ReactElement {
  return (
    <nav aria-label="Library location" className="min-w-0 truncate text-xs text-app-text-muted">
      <ol className="flex min-w-0 items-center gap-1">
        {parts.map((part, index) => (
          <li key={`${index}:${part}`} className="flex min-w-0 items-center gap-1">
            {index > 0 && <span aria-hidden="true">/</span>}
            <span className="truncate" title={part}>{part}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
