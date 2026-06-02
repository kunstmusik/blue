import React from 'react';
import type { TemporaryInstrumentLibrarySnapshot } from '../../../../../shared/project-editor';

interface TemporaryInstrumentLibraryPanelProps {
  library: TemporaryInstrumentLibrarySnapshot;
}

function TemporaryInstrumentLibraryPanel({
  library,
}: TemporaryInstrumentLibraryPanelProps): React.ReactElement {
  return (
    <section
      className="flex h-full min-h-0 flex-col bg-app-surface"
      aria-label="Temporary instrument library"
    >
      <div className="border-b border-blue-border bg-app-surface-strong px-3 py-2 text-body font-semibold uppercase tracking-[0.18em] text-blue-muted">
        Instrument Library
      </div>
      <div className="flex flex-1 items-center justify-center px-4 text-center text-body text-blue-muted">
        {library.message}
      </div>
    </section>
  );
}

export default React.memo(TemporaryInstrumentLibraryPanel);

