import React from 'react';
import type { ClojureLibraryEntrySnapshot } from '../../../../../shared/project-editor';
import type { ProjectDocumentCommitMetadata } from '../../../../../shared/project-history';
import { APP_INSPECTOR_LABEL_TEXT_CLASS } from '../shared/compactFieldStyles';
import { InputBase } from './ProjectPropertyFields';
import type { ClojureProjectTabProps } from './types';
import { cn } from '../../../../lib/cn';
import { useProjectStore } from '../../../../stores/project-store';
import { ClojureConflictControls } from './ClojureConflictControls';

const BUTTON_CLASSES =
  'rounded-md border border-app-border bg-app-surface px-3 py-2 text-role-body font-medium text-app-text-strong transition hover:border-app-accent hover:text-app-text-strong disabled:cursor-not-allowed disabled:opacity-45';

function createDefaultEntry(): ClojureLibraryEntrySnapshot {
  return {
    entryId: `draft-clj-lib-${crypto.randomUUID()}`,
    dependencyCoordinates: 'org/library-name',
    version: '1.0.0',
  };
}

function cloneEntries(entries: ClojureLibraryEntrySnapshot[]): ClojureLibraryEntrySnapshot[] {
  return entries.map((entry) => ({ ...entry }));
}

export default function ClojureProjectTab({
  disabled,
  clojureProject,
  updateClojureProject,
}: ClojureProjectTabProps): React.ReactElement {
  const conflicts = useProjectStore((state) => state.clojureFieldConflicts);
  const clojureProjectRef = React.useRef(clojureProject);
  clojureProjectRef.current = clojureProject;

  const updateEntries = (
    libraryEntries: ClojureLibraryEntrySnapshot[],
    metadata?: ProjectDocumentCommitMetadata,
  ): void => {
    const nextProject = { libraryEntries };
    // Keep target lookup current before React delivers the parent render; an
    // unmount cleanup after removal must not re-add the removed entry.
    clojureProjectRef.current = nextProject;
    void updateClojureProject(nextProject, metadata);
  };

  const handleEntryChange = (
    entryId: string,
    patch: Partial<ClojureLibraryEntrySnapshot>,
    metadata?: ProjectDocumentCommitMetadata,
  ): void => {
    const currentEntries = clojureProjectRef.current.libraryEntries;
    const index = currentEntries.findIndex((entry) => entry.entryId === entryId);
    if (index < 0) return;

    const libraryEntries = cloneEntries(currentEntries);
    const currentEntry = libraryEntries[index];
    if (!currentEntry) return;
    libraryEntries[index] = {
      ...currentEntry,
      ...patch,
    };
    updateEntries(libraryEntries, metadata);
  };

  const handleAddEntry = (): void => {
    updateEntries(
      [...cloneEntries(clojureProjectRef.current.libraryEntries), createDefaultEntry()],
      { phase: 'single' },
    );
  };

  const handleRemoveEntry = (index: number): void => {
    updateEntries(
      clojureProjectRef.current.libraryEntries.filter((_, entryIndex) => entryIndex !== index),
      { phase: 'single' },
    );
  };

  const handleMoveEntry = (from: number, to: number): void => {
    const currentEntries = clojureProjectRef.current.libraryEntries;
    if (to < 0 || to >= currentEntries.length) {
      return;
    }

    const libraryEntries = cloneEntries(currentEntries);
    const [entry] = libraryEntries.splice(from, 1);
    if (!entry) {
      return;
    }
    libraryEntries.splice(to, 0, entry);
    updateEntries(libraryEntries, { phase: 'single' });
  };

  return (
    <div className="space-y-5">
      <ClojureConflictControls />
      <div className="flex flex-col gap-3 rounded-xl border border-app-border bg-gradient-to-b from-app-surface to-app-overlay px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-role-body font-medium text-app-text-strong">Project Libraries</div>
          <div className="mt-1 text-role-body text-app-text-muted">
            Dependencies listed here are loaded by the project-level Clojure plugin before
            evaluation and render.
          </div>
        </div>
        <button
          type="button"
          className={BUTTON_CLASSES}
          disabled={disabled}
          onClick={handleAddEntry}
        >
          Add Library
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-app-border bg-app-overlay">
        <div
          className={cn(
            'hidden grid-cols-[minmax(0,1.5fr)_180px_182px] gap-3 border-b border-app-border/80 bg-app-surface px-4 py-3 lg:grid',
            APP_INSPECTOR_LABEL_TEXT_CLASS,
          )}
        >
          <span>Library Coordinates</span>
          <span>Version</span>
          <span>Actions</span>
        </div>

        {clojureProject.libraryEntries.length === 0 ? (
          <div className="px-4 py-8 text-role-body text-app-text-muted">
            No Clojure libraries configured for this project.
          </div>
        ) : (
          <div className="divide-y divide-app-border/70">
            {clojureProject.libraryEntries.map((entry, index) => (
              <div
                key={entry.entryId}
                className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1.5fr)_180px_182px] lg:items-start"
              >
                <div className="space-y-2">
                  <div className={cn('lg:hidden', APP_INSPECTOR_LABEL_TEXT_CLASS)}>
                    Library Coordinates
                  </div>
                  <InputBase
                    disabled={
                      disabled ||
                      conflicts.some(
                        (conflict) =>
                          conflict.entryId === entry.entryId &&
                          conflict.field === 'dependencyCoordinates',
                      )
                    }
                    historyScope="project"
                    fieldId={`clojure-library:${entry.entryId}:coordinates`}
                    label="Edit Clojure Library Coordinates"
                    value={entry.dependencyCoordinates}
                    onChange={(dependencyCoordinates, metadata) =>
                      handleEntryChange(entry.entryId, { dependencyCoordinates }, metadata)
                    }
                    className="font-mono text-role-body"
                    placeholder="org.clojure/data.json"
                  />
                </div>
                <div className="space-y-2">
                  <div className={cn('lg:hidden', APP_INSPECTOR_LABEL_TEXT_CLASS)}>Version</div>
                  <InputBase
                    disabled={
                      disabled ||
                      conflicts.some(
                        (conflict) =>
                          conflict.entryId === entry.entryId && conflict.field === 'version',
                      )
                    }
                    historyScope="project"
                    fieldId={`clojure-library:${entry.entryId}:version`}
                    label="Edit Clojure Library Version"
                    value={entry.version}
                    onChange={(version, metadata) =>
                      handleEntryChange(entry.entryId, { version }, metadata)
                    }
                    className="font-mono text-role-body"
                    placeholder="1.0.0"
                  />
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button
                    type="button"
                    className={BUTTON_CLASSES}
                    disabled={disabled || index === 0}
                    onClick={() => handleMoveEntry(index, index - 1)}
                  >
                    Move Up
                  </button>
                  <button
                    type="button"
                    className={BUTTON_CLASSES}
                    disabled={disabled || index === clojureProject.libraryEntries.length - 1}
                    onClick={() => handleMoveEntry(index, index + 1)}
                  >
                    Move Down
                  </button>
                  <button
                    type="button"
                    className={BUTTON_CLASSES}
                    disabled={disabled}
                    onClick={() => handleRemoveEntry(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
