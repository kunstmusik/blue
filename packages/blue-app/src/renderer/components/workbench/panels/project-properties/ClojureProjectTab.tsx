import React from 'react';
import type { ClojureLibraryEntrySnapshot } from '../../../../../shared/project-editor';
import { APP_INSPECTOR_LABEL_TEXT_CLASS } from '../shared/compactFieldStyles';
import { InputBase } from './ProjectPropertyFields';
import type { ClojureProjectTabProps } from './types';

const BUTTON_CLASSES =
  'rounded-md border border-app-border bg-app-surface px-3 py-2 text-role-body font-medium text-app-text-strong transition hover:border-app-accent hover:text-app-text-strong disabled:cursor-not-allowed disabled:opacity-45';

let nextDraftClojureLibraryEntryId = 1;

function createDefaultEntry(): ClojureLibraryEntrySnapshot {
  return {
    entryId: `draft-clj-lib-${nextDraftClojureLibraryEntryId++}`,
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
  const updateEntries = (libraryEntries: ClojureLibraryEntrySnapshot[]): void => {
    void updateClojureProject({ libraryEntries });
  };

  const handleEntryChange = (
    index: number,
    patch: Partial<ClojureLibraryEntrySnapshot>,
  ): void => {
    const libraryEntries = cloneEntries(clojureProject.libraryEntries);
    libraryEntries[index] = {
      ...libraryEntries[index],
      ...patch,
    };
    updateEntries(libraryEntries);
  };

  const handleAddEntry = (): void => {
    updateEntries([...cloneEntries(clojureProject.libraryEntries), createDefaultEntry()]);
  };

  const handleRemoveEntry = (index: number): void => {
    updateEntries(
      clojureProject.libraryEntries.filter((_, entryIndex) => entryIndex !== index),
    );
  };

  const handleMoveEntry = (from: number, to: number): void => {
    if (to < 0 || to >= clojureProject.libraryEntries.length) {
      return;
    }

    const libraryEntries = cloneEntries(clojureProject.libraryEntries);
    const [entry] = libraryEntries.splice(from, 1);
    if (!entry) {
      return;
    }
    libraryEntries.splice(to, 0, entry);
    updateEntries(libraryEntries);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-app-border bg-gradient-to-b from-app-surface to-app-overlay px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-role-body font-medium text-app-text-strong">Project Libraries</div>
          <div className="mt-1 text-role-body text-app-text-muted">
            Dependencies listed here are loaded by the project-level Clojure plugin before evaluation and render.
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
        <div className={`hidden grid-cols-[minmax(0,1.5fr)_180px_182px] gap-3 border-b border-app-border/80 bg-app-surface px-4 py-3 lg:grid ${APP_INSPECTOR_LABEL_TEXT_CLASS}`}>
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
                  <div className={`lg:hidden ${APP_INSPECTOR_LABEL_TEXT_CLASS}`}>
                    Library Coordinates
                  </div>
                  <InputBase
                    disabled={disabled}
                    value={entry.dependencyCoordinates}
                    onChange={(dependencyCoordinates) =>
                      handleEntryChange(index, { dependencyCoordinates })
                    }
                    className="font-mono text-role-body"
                    placeholder="org.clojure/data.json"
                  />
                </div>
                <div className="space-y-2">
                  <div className={`lg:hidden ${APP_INSPECTOR_LABEL_TEXT_CLASS}`}>
                    Version
                  </div>
                  <InputBase
                    disabled={disabled}
                    value={entry.version}
                    onChange={(version) => handleEntryChange(index, { version })}
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