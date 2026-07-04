# Data Model: Missing Audio Asset Check On Project Load

**Feature**: Missing Audio Asset Check On Project Load
**Branch**: `053-missing-audio-assets`
**Created**: 2026-07-02

## Entities

### AudioFile Reference

Represents one AudioFile score-object file path stored in the currently loaded project.

**Fields**:

- `originalPath`: Stored AudioFile path string from the project.
- `scoreLocation`: Internal location of the AudioFile score object, used by implementation tests and mutation traversal.
- `resolvedPath`: Filesystem path when the reference is found; absent when missing.

**Validation Rules**:

- Empty or blank paths are ignored for missing-file detection.
- Matching for replacement is exact on the stored `originalPath`.
- References outside AudioFile score objects are out of scope.

**Relationships**:

- Belongs to one loaded project.
- Many AudioFile references may share the same `originalPath`.
- May be updated by one Replacement Mapping.

### Missing Audio File

Represents a unique unresolved AudioFile path found during project-open scanning.

**Fields**:

- `originalPath`: Unique missing path string shown to the user.
- `replacementPath`: Optional selected replacement path, initially empty.

**Validation Rules**:

- One row per unique `originalPath`.
- Rows with empty replacement values do not produce mappings.
- Rows whose replacement equals `originalPath` do not produce mappings.

**Relationships**:

- Derived from one or more AudioFile References.
- May produce one Replacement Mapping when confirmed.

### Replacement Mapping

Represents a user-approved update from a missing original path to a replacement file.

**Fields**:

- `originalPath`: Missing AudioFile path to replace.
- `selectedPath`: Path chosen by the user in the modal.
- `storedPath`: Path after project-relative normalization.

**Validation Rules**:

- `originalPath` must match a missing row in the active session.
- `selectedPath` must be non-empty and different from `originalPath`.
- If `selectedPath` is inside the project directory, `storedPath` is project-relative.
- If `selectedPath` is outside the project directory, `storedPath` remains as chosen.
- If no project directory is available, `storedPath` remains as chosen.

**Relationships**:

- Created by one Missing File Resolution Session.
- Applies to every AudioFile Reference whose stored path exactly equals `originalPath`.

### Missing File Resolution Session

Represents one modal repair opportunity created after opening a project with missing AudioFile references.

**Fields**:

- `sessionId`: Unique identifier for this missing-file session.
- `projectSessionId`: Current project session id when the scan was created.
- `projectFilePath`: Current project file path, if available.
- `missingFiles`: Ordered unique Missing Audio File rows.
- `status`: `pending`, `resolved`, `dismissed`, or `stale`.

**Validation Rules**:

- A session can apply mappings only while its `projectSessionId` matches the current project session.
- Confirming with no mappings transitions to `resolved` without changing AudioFile paths.
- Confirming with partial mappings transitions to `resolved` and leaves unmapped paths unchanged.
- Canceling or closing transitions to `dismissed` without changing AudioFile paths.
- Loading another project makes previous pending sessions `stale`.

**Relationships**:

- Created from one loaded project.
- Owns zero or more Missing Audio File rows.
- Produces zero or more Replacement Mappings on confirmation.

## State Transitions

```text
Project Loaded
  -> Scan Finds No Missing AudioFiles
     -> No Session Created
     -> Normal Project Work

Project Loaded
  -> Scan Finds Missing AudioFiles
     -> Session Pending
        -> Confirm With Mappings
           -> Apply Exact-Match Replacements
           -> Refresh Renderer Snapshot
           -> Session Resolved
        -> Confirm With No Mappings
           -> No Path Changes
           -> Session Resolved
        -> Cancel Or Close
           -> No Path Changes
           -> Session Dismissed
        -> Different Project Loads
           -> Session Stale
```

## Persistence

- Missing File Resolution Session state is transient and not persisted.
- Replacement Mapping results mutate existing AudioFile path values in memory.
- Mutated paths persist only through the normal project save flow.
- No new `.blue` XML elements, attributes, or migration rules are added.
