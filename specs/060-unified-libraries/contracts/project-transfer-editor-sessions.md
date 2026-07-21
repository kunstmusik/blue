# Contract: Project Transfer And Library Item Editor Sessions

## Purpose

Define how Unified Libraries composes current-project definitions with app-owned user items, resolves stable identities, validates direct-manipulation targets, performs copies, hosts full type-specific editors, handles conflicts, and migrates workbench state. Nothing in this contract moves project ownership into SQLite or changes `.blue` XML.

## Scope Composition

| Type | Project surface | Libraries source | Target behavior |
|------|-----------------|------------------|-----------------|
| Instrument | Orchestra editor | User Instrument Library | Exact Orchestra row/end drop or Paste target |
| UDO | Reusable project UDO list/editor or Instrument-local UDO editor | User UDO Library | Exact addressed UDO row/end drop or Paste target |
| SoundObject | Separate Project SoundObject Library panel | User SoundObject Library | Explicit Score path/layer/time drop or Paste target |
| Effect | Mixer chains only | User Effect Library | Exact channel/chain/insertion-gap drop or Paste target |

Rules:

- The Libraries panel displays application-owned user libraries only and has no source filter or Current Project section.
- Project Instruments and UDOs remain in their existing dedicated editors, including each Instrument's local UDO editor. Project Shared SoundObjects are exposed by `SoundObjectLibraryTopComponent`, not nested under Libraries.
- A target never appears as a browsable/persisted project library or persistent Libraries-panel mode.
- No project means project scopes and compatible project drop/Paste targets are absent, while user browse/edit/import/export/recovery remains available.
- User-item edits affect future insertions only. Previously inserted independent copies are untracked and unchanged.

## Project Adapter Contract

The main-owned adapter is the sole bridge from Unified Libraries to canonical `BlueData`.

```ts
interface UnifiedLibraryProjectAdapter {
  listSourceChildren(request: ProjectBrowseRequest): ProjectBrowseResult;
  resolveItem(key: ProjectLibraryItemKey): ResolvedProjectLibraryItem;
  previewInsertion(request: LibraryInsertionRequest): LibraryInsertionPreview;
  applyInsertion(request: ConfirmedLibraryInsertionRequest): ProjectMutationReceipt;
  saveEditorDraft(request: ProjectEditorSaveRequest): ProjectMutationReceipt;
  previewDelete(key: ProjectLibraryItemKey): ProjectDeletePreview;
  deleteItem(request: ConfirmedProjectDeleteRequest): ProjectMutationReceipt;
  getUsage(key: ProjectLibraryItemKey): CurrentProjectUsageSnapshot;
}
```

Every method validates the expected `projectSessionId`. Mutating methods use the same canonical project revision/dirty/broadcast path as normal project-document patches. A successful change increments revision, refreshes the shared project snapshot, and participates in the existing save lifecycle.

## Stable Project Locators

### Instruments

```ts
interface InstrumentProjectLocator {
  kind: 'instrument';
  assignmentId: string;
}
```

The assignment ID is the project identity. Reordering the arrangement does not change it. Removal produces missing state; an index is never stored as identity.

### Project UDOs

```ts
interface ProjectUdoLocator {
  kind: 'udo';
  instrumentAssignmentId?: string;
  sessionObjectId: string;
  persistedFingerprint: {
    canonicalHash: string;
    opcodeName: string;
    style: 'CLASSIC' | 'MODERN';
  };
}
```

- Main resolves the owning `OpcodeList` from `instrumentAssignmentId`; omission means the top-level project UDO list. An embedded UDO session identity includes the Instrument assignment so definitions in different lists cannot alias.
- Main assigns `sessionObjectId` to the canonical `OpcodeDefinition` object while a project is loaded; moves retain it.
- Saved Dockview parameters also carry the fingerprint, never a bare index.
- After restart, restore searches the addressed UDO list for a unique canonical match. Exactly one match binds and receives a new session ID; zero yields missing; multiple yields ambiguous. Missing/ambiguous is read-only and never selects the occupant of the old index or another Instrument's local definition.
- After a successful edit/project save, the editor/layout locator updates its fingerprint.

### Project Shared SoundObjects

```ts
interface SharedSoundObjectLocator {
  kind: 'soundObject';
  libraryId: string;
  persistedFingerprint: {
    canonicalHash: string;
    displayName: string;
    objectType: string;
  };
}
```

The implementation must first make `libraryId` a stable project object-reference identity: `SoundObjectLibrary` retains loaded `objRefId` values, assigns a stable Java-compatible ID to new shared definitions, and seeds those IDs into `ObjRefSaveMap` so save/reorder does not renumber them. This reuses the existing Java field and adds no new project XML schema. Restore accepts an ID only when its fingerprint also matches. If a legacy/mismatched ID has exactly one fingerprint candidate, it may recover that definition; otherwise the editor is missing/ambiguous. All `Instance` nodes linked to the resolved ID contribute to usage and deletion consequences.

## Direct-Manipulation Target Contract

A drop or destination Paste is enabled only when all target invariants are true at preview and apply time. Targets exist for the duration of hover/drop or the destination context-menu command; Libraries does not retain a hidden target after the interaction.

### Instrument target

- Requires an open project and current project session.
- Destination is Project Orchestra at an explicit row/end boundary.
- Preview computes dependencies and proposed non-colliding assignment identity.

### UDO target

- Requires an open project and current project session.
- Destination is either the top-level project UDO list or the exact Instrument-local UDO list identified by assignment ID; its explicit insertion index must still be in range.
- Same-name project UDOs are preserved.

### Effect target

```ts
interface EffectInsertionTarget {
  projectSessionId: number;
  channelId: string;
  chain: 'pre' | 'post';
  insertIndex: number;
  targetRevision: string;
}
```

The channel, chain, and insertion boundary must still exist at apply. The mixer exposes this target only as hover/keyboard insertion feedback; project or chain changes invalidate it immediately.

### SoundObject target

```ts
interface SoundObjectInsertionTarget {
  projectSessionId: number;
  rootGroupId: string;
  containerPath: Array<{ layerId: string; objectIdentity: string }>;
  layerId: string;
  startTime: number;
  targetRevision: string;
}
```

The full Score destination is explicit. Pointer geometry or the keyboard paste location is converted to this stable locator before preview. Main resolves the same group/container/layer and current time context before mutation. There is no fallback to the selected layer, root layer, zero time, or neighboring object after a stale target.

## Libraries Interaction Contract

### Compact panel

- Healthy Libraries renders one compact search/type-filter row and the collapsed user-library roots; it does not render a source filter, Current Project section, no-project message, embedded item preview/editor, migration notice, row command strip, target banner, or Insert button.
- One vertical-ellipsis button labeled `Library actions` opens Import XML, Import Java Configuration Directory, Export Current, and Export All. It does not expose Import History or Migration Report. Repository recovery may replace the hierarchy because it is a blocking exceptional state.
- Successful, partial, or skipped migration remains silent while the repository is usable.

### Tree commands and rename

- Rows render identity/navigation content only. Double-clicking the visible name or pressing `F2` starts inline rename; `Enter` commits and `Escape` cancels. Folder disclosure remains independent of name rename.
- Right-click and `Shift+F10`/Context Menu key open the same scoped menu with visible focus. Applicable commands include folder creation, Duplicate, Cut, Copy, Paste, and Delete; invalid commands are omitted or disabled with an accessible explanation. Project panels use those same Copy/Cut/Paste commands rather than a separate project-to-user action.
- Delete uses revision-bound affected-count confirmation. Shared SoundObject deletion additionally follows the linked-instance protocol below.

### Clipboard

```ts
interface LibraryInteractionClipboard {
  mode: 'copy' | 'cut';
  sourceKey: LogicalEditorItemKey | UserLibraryFolderKey;
  sourceRevision: string;
  libraryType: LibraryType;
  sourceScope: LibraryScopeKind;
}
```

The clipboard stores either one stable typed user-or-project Copy reference or one opaque identity for a main-owned detached Cut snapshot, never renderer-visible XML. Library-tree Paste targets the focused folder or focused item's parent; project Paste targets the exact native insertion boundary. Copy creates a deep destination copy with a destination-appropriate identity. Cut captures the complete item or folder subtree, validates and confirms consequences, then removes the source immediately. Paste creates an independent copy from the reusable snapshot and never performs deferred cleanup. A failed capture, declined confirmation, dirty editor, stale source, or failed removal retains the source and prior clipboard. Destination project Paste and destination user Paste use the same source resolution as drop.

### Drag session

```ts
interface LibraryDragPayload {
  dragSessionId: string;
  libraryType: LibraryType;
  sourceScope: LibraryScopeKind;
}
```

`dragSessionId` resolves main-owned source identity/revision state and expires after the gesture. XML is never placed in `DataTransfer`. Destination surfaces provide exact insertion markers, invalid feedback, edge auto-scroll, and Escape cancellation. Main revalidates source revision, support, project session, target revision, dependencies, and shared-copy mode before apply. Cross-owner drag copies and never removes the source; native internal moves such as mixer Effect chain-to-chain drag use the project mutation model.

During browser protected drag mode, a destination may know only that the Blue Library MIME type is present; custom descriptor data can be unreadable until `drop`. An absent descriptor during `dragover` is therefore treated as unknown rather than incompatible. Type compatibility is enforced when the descriptor becomes readable at `drop` and is always enforced again by main.

## Transfer Matrix

### User Instrument → Project Orchestra

1. Ensure whole payload is supported and valid.
2. Resolve/disclose dependencies.
3. Deep-copy the Instrument including owned interface/local UDO data.
4. Clear project automation bindings as required by the copied type.
5. Allocate a non-colliding assignment identity.
6. Add without overwriting any assignment and commit once.

### User UDO → Addressed Project UDO list

1. Ensure whole payload is supported and valid.
2. Create an independent `OpcodeDefinition` copy.
3. Resolve the top-level or Instrument-local destination list and insert at the requested/default position.
4. Keep every existing same-name UDO unchanged.
5. Commit once.

### User Effect → Mixer chain

1. Revalidate channel/chain/index and project session.
2. Ensure whole payload and dependencies are supported.
3. Deep-copy, detach/reset automation/library binding, and force the new chain entry enabled according to native behavior.
4. Allocate a new project chain-entry identity.
5. Insert at the exact position and commit once.

### User SoundObject → Score

1. Revalidate explicit Score path/layer/time and destination time context.
2. Ensure whole object graph is supported; disclose external assets/dependencies.
3. Deep-copy into an independent project object.
4. Convert portable beat duration/time behavior to the destination project context without changing intended musical duration.
5. Allocate project-appropriate identity, insert once, and commit once.

### Project Shared SoundObject → Score

- `Copy Instance`: create an `Instance` referencing the same `libraryId`; editor preview discloses shared behavior.
- `Copy Independent`: deep-copy the resolved definition into the Score with no shared link.
- Neither choice is implicit; UI presents consequences before apply.

Every transfer with exactly one allowed mode and no blocking disclosure applies immediately from its preview token and reports success by toast. Renderer modal state is published only for the explicit Project Shared SoundObject choice or another required blocking decision.

### Project object → User library

- Explicit Save as User Library Copy creates a new UUID and a complete independent payload.
- Project ownership and original identity remain unchanged.
- Instrument/UDO/SoundObject only; Effect instances are not a project source scope.
- Project Shared `Instance` wrappers are not portable as general user items; resolve/copy the definition only through an explicit supported action.

### Dependency failure

Unresolved external project-level dependencies or conflicts block insertion before mutation. The receipt is failure with a report; no hidden dependency, unrelated collection, or partial destination is added.

## Project Shared SoundObject Usage And Delete

Usage is calculated by traversing the current project's score graph for `Instance` references to the shared `libraryId`.

Editor consequence text includes the current linked-instance count. Saving the definition updates every linked instance by shared reference and marks the project dirty.

Delete protocol:

1. Re-resolve the shared definition and linked instances.
2. Return affected counts/locations and a revision-bound confirmation token.
3. If the editor session is dirty, resolve Save/Discard/Cancel first.
4. On confirmation, remove the shared definition and every linked project instance according to the native rule in one canonical project mutation.
5. Notify/finalize the editor as closed. If another surface deletes first, retain a read-only missing editor with any unsaved draft; never rebind it.

## Editor Session Identity

```ts
type LogicalEditorItemKey =
  | `user:${LibraryType}:${nodeId}`
  | `project:${projectSessionId}:${LibraryType}:${stableLocatorKey}`;
```

Main maintains one active `sessionId` per logical key. Tree selection or any existing type-specific entry point gets/focuses that session. Double-click on a tree name is reserved for inline rename. Concurrent windows do not get independent drafts for the same item.

## Dockview Panel Contract

### Static panel

- ID: `LibrariesTopComponent`
- Title: `Libraries`
- Mode/group: `properties` / `properties-main`
- Default edge: right
- Default reset location: right auxiliary group
- Normal startup: follows saved layout; not forced open after intentional close

### Project SoundObject Library panel

- ID: `SoundObjectLibraryTopComponent`
- Title: `SoundObject Library`
- Mode/group: `properties` / `properties-main`
- Default edge: right; closed by default, matching Java Blue
- Contents: canonical Project Shared SoundObjects only
- Selection opens/focuses the existing `Library Item` editor; supported rows provide shared typed Copy/Cut/Paste and drag to Score or matching user folders, plus guarded deletion semantics
- No project renders a compact empty state rather than user-library content

### Dynamic editor panels

- Dockview component key: `libraryItemEditor`
- Runtime panel ID: derived from editor `sessionId`, not item name/index
- Visibility: at most one Library Item panel; opening a different session removes the prior panel before presenting the requested session
- Persistence: session-bound panels are transient and removed during saved-layout restoration; drafts remain in the session service, never in Dockview JSON
- Title: `Library Item` with a dirty marker when required; the retained address/breadcrumb header carries current display name, type, scope, and location
- Unknown/missing session: render a controlled missing/ambiguous state rather than an arbitrary neighbor

### Native editor session behavior

- Exactly one visible Library Item panel is the reusable presentation slot.
- Opening a different item always switches that slot to the item's existing or new session and never adds another Library Item tab.
- The panel hosts the existing controlled Instrument, UDO, Effect, or SoundObject editor under the existing address/breadcrumb header; supported items never fall back to a raw XML textarea.
- Editing sends a main patch, makes the session dirty, and automatically pins the panel.
- Dirty or pinned sessions remain retained by stable identity while another session is visible.
- Opening an already represented logical item reuses its retained session.
- Closing/collapsing/floating Libraries does not close or alter editor sessions.

## Editor Shell Contract

Every Library Item editor shell displays:

- the existing address header with name, object type, scope, breadcrumb, stable missing/conflict status, and dirty/pin state;
- Save and Revert;
- dependency summary;
- current-project usage, with independent historical copies labeled untracked;
- save consequence text:
  - user: affects future insertions only and persists independently;
  - project-owned: mutates current project and requires project Save;
  - project-shared: mutates every linked instance and shows count.

The shell hosts controlled existing type bodies:

- Instrument: interface/code/local UDOs/properties;
- UDO: signature/code/style/documentation/validation;
- Effect: interface/code/I/O configuration and current testing capability;
- SoundObject: existing type-specific editor plus copy/reference controls.

The renderer body receives a session snapshot and emits guarded type-specific patch commands. It does not directly own a mutable `@blue/data` instance or persist XML.

Duplicate/Cut/Copy/Paste/Delete and folder organization belong to the Libraries tree context menu, not to persistent editor or tree-row command bars. Project placement belongs to destination drop/Paste handling, not to the editor header.

## Save, Revert, Conflict, And Missing Rules

### Save

1. Resolve logical item and expected project/store session.
2. Compare current revision/hash with base.
3. If unchanged, validate the complete draft and commit atomically.
4. If changed, return conflict and latest summary. Choices:
   - Reload Latest: discard draft only after explicit selection and reset base;
   - Cancel: retain draft unchanged;
   - Reviewed Overwrite: require current conflict token and explicit confirmation.
5. On success update title/breadcrumb/revision/metadata, clear dirty, and leave explicit pin state unchanged.

Validation failure leaves both last valid saved content and the user's draft intact.

### Revert

- Clean: reload current saved version directly.
- Dirty: prepare confirmation; Cancel keeps draft, Confirm discards it and reloads the current saved version.
- A newer source may make confirmed Revert load latest; this consequence is included in preview.

### Rename/move

Stable identity remains unchanged. All panels/breadcrumbs update from a change event. Invalid names preserve prior saved/draft name, keep inline edit active, and identify the field.

### Delete

- Dirty session: Save/Discard/Cancel first.
- Confirmed delete from its own session: commit, close that session/panel.
- Delete from another surface: session becomes read-only missing; an unsaved draft remains available for review/copy but cannot Save over a missing identity without an explicit new-copy action.

### Close/quit/project lifecycle

- Closing a clean editor closes immediately.
- Closing a dirty editor requires Save, Discard, or Cancel.
- Quit and project close/switch aggregate affected dirty sessions. Save validates/commits each; Discard is explicit; Cancel stops the outer operation.
- User-library dirty sessions may remain open across project close only when they have no project-bound dependency/usage context that makes continuation unsafe; otherwise they participate in the guard.

## Destination Surface Contract

- Orchestra removes `Browse Instruments` and accepts Instrument drops/Paste at explicit table insertion boundaries.
- Top-level and Instrument-local project UDO editors remove `Browse UDO Library` and accept UDO drops/Paste at explicit table insertion boundaries. Their selected rows support Copy/Cut and opaque drag to the user UDO Library through the same typed buffer and project adapter.
- Mixer chains remove `Add Effect from Library…` and accept Effect drops/Paste at explicit pre/post chain gaps.
- Score removes `Browse SoundObjects` and accepts SoundObject drops/Paste at explicit current path/layer/time coordinates.
- Tools/legacy Effects Library may reveal Libraries filtered to Effects for compatibility but creates no insertion target.
- Window menu Libraries reveals/focuses the existing panel wherever docked/minimized/slide-out/maximized/floating; it never duplicates it.
- Every destination provides keyboard context-menu Paste with the same validation/result as drop, so drag-and-drop is not the sole transfer path.

## Workbench/Layout Migration

`SoundObjectLibraryTopComponent` and `LibrariesTopComponent` are separate valid panel identities and may coexist. Stored layouts preserve both IDs across Dockview panels, auxiliary lists/active IDs, minimized/slide-out state, floating origins, and closed origins. The former migration that rewrote SoundObject Library to Libraries is retired; legacy Java-parity layout IDs now resolve to the restored project panel.

Legacy `open-effects-library` commands route to the new panel without target mode. Legacy split keys `effects-library.main` and `orchestra.library` remain parseable for settings downgrade/migration safety but no longer create separate permanent library UI. Dynamic editor restoration uses stable parameters and safe missing states.

## No-Project Workbench Contract

- `WorkbenchShell` remains mounted for the app lifetime.
- The standalone Welcome screen covers the full main surface when there is no project; it is not a Dockview panel.
- Explicitly opening Libraries or another workbench panel dismisses Welcome and reveals the no-project workbench.
- Project-only panels render their existing disabled/empty state or are hidden according to existing rules; they do not block Libraries.
- User browse/search/edit/import/export/recovery works normally.
- Project scopes, usage claims, and project drop/Paste targets are absent/disabled.
- Opening or closing a project changes composition and destination capability without remounting/losing user editor sessions.

## Verification Matrix

Tests must prove:

- each locator survives reordering and never falls back to a stale index;
- Project Shared SoundObject IDs survive save/reopen/reorder, legacy ID fallback binds only a unique fingerprint, and ambiguity is safe;
- stale project sessions/table positions/Effect chains/Score paths reject drop and Paste with zero mutation;
- all four transfer outcomes match independent/shared semantics and remain valid without the user database after project save/reopen;
- shared usage/edit/delete counts and effects are correct;
- duplicate entry points focus one session;
- supported selections render native full editors with the existing address header and never a raw XML textarea;
- 100 selection/pin/close/open changes never show more than one Library Item tab or lose dirty or pinned drafts;
- tree and project context commands have right-click and keyboard parity; one clipboard supports Copy/Cut/Paste in both ownership directions, with guarded capture-before-immediate-remove Cut semantics;
- exact Orchestra/top-level-or-Instrument-local UDO/Mixer/Score markers, invalid feedback, and keyboard Paste use the same main validation service;
- healthy Libraries has one compact ellipsis menu, collapsed user roots, no source/project section, and no persistent banner, history/report command, action strip, row CRUD, Browse, or Insert controls;
- Project SoundObject Library is a separate panel, and both the project UDO top component and Instrument UDO tabs use the reusable UDO list/editor transfer contract;
- validation/conflict/revert/quit/project-switch decisions never silently discard or overwrite;
- external rename/move/delete updates breadcrumb or enters missing state by identity;
- no-project user operations work;
- every saved legacy layout shape converges on one Libraries panel and preserves unrelated panels/groups/windows.
