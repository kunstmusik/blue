# Feature Specification: Stabilize Tree Drag and Drop

**Feature Branch**: `084-stabilize-tree-dnd`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Prevent competing HTML5 drag-and-drop backends when workbench panels move, allow all interactive tree surfaces to coexist safely, and preserve unaffected panel instances instead of rebuilding the entire auxiliary layout."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Move a populated tool panel safely (Priority: P1)

As a user arranging the workbench, I can move Libraries or another auxiliary tool to the left, right, or bottom edge without an error, an application fallback, or loss of the content already shown in that tool.

**Why this priority**: Moving Libraries currently exposes a renderer failure that interrupts a normal workspace action. Restoring reliable panel movement is the minimum viable outcome.

**Independent Test**: Populate Libraries and File Manager, move Libraries from its current edge to each other supported edge, and verify that both panels remain usable without an error notification or recovery screen.

**Acceptance Scenarios**:

1. **Given** Libraries is populated and File Manager has populated roots, **when** the user moves Libraries to the left edge, **then** Libraries appears on the left and no duplicate drag-and-drop backend error occurs.
2. **Given** an auxiliary panel has local selection, expansion, or scroll state, **when** a different panel moves to another edge, **then** the unaffected panel retains that state and is not visibly reloaded.
3. **Given** a panel is moved repeatedly among the left, right, and bottom edges, **when** each move completes, **then** all populated tree surfaces remain interactive and each requested placement is retained.
4. **Given** panel movement cannot complete, **when** the operation fails, **then** the previous layout remains usable and the application does not enter a renderer-wide fallback state.

---

### User Story 2 - Use multiple interactive trees together (Priority: P1)

As a user, I can keep File Manager open while opening another tree-based surface, such as Code Repository or Presets Manager, without those surfaces competing for drag-and-drop ownership.

**Why this priority**: Panel movement is one manifestation of a broader ownership conflict. Multiple tree surfaces are valid application states and must coexist reliably.

**Independent Test**: Keep File Manager populated, open each other interactive tree surface in turn and in supported combinations, and exercise selection, expansion, rename, and drag/drop without a renderer error.

**Acceptance Scenarios**:

1. **Given** File Manager is mounted, **when** Code Repository opens, **then** both trees remain visible or available and usable without a drag-and-drop ownership error.
2. **Given** File Manager is mounted, **when** Presets Manager opens and closes repeatedly, **then** both surfaces continue to support their existing interactions after every cycle.
3. **Given** two supported tree surfaces are mounted in the same application document, **when** either surface begins and completes a supported drag, **then** the drag is handled once by the intended surface.
4. **Given** a tree surface is shown in a separate supported application window, **when** the main and secondary windows are used concurrently, **then** drag-and-drop ownership in one window does not disable or conflict with ownership in the other.

---

### User Story 3 - Preserve workbench sessions during layout changes (Priority: P2)

As a user with several tools open, I can rearrange one panel without unrelated panels restarting, repeating their initial data loads, losing focus unexpectedly, or flashing through loading states.

**Why this priority**: Avoiding broad panel reconstruction removes the trigger for this failure and protects other transient editor state from similar lifecycle defects.

**Independent Test**: Instrument or observe mounted auxiliary panels, move one panel, and verify that only the panel or group whose placement changes undergoes the minimum lifecycle transition required for the move.

**Acceptance Scenarios**:

1. **Given** unrelated auxiliary panels are mounted, **when** one panel changes edge, **then** unaffected panels keep the same live session and do not repeat initialization work.
2. **Given** an unaffected panel contains a focused control or expanded tree path, **when** another panel moves, **then** its expansion and scroll state remain unchanged and focus is preserved unless the moved panel must receive focus.
3. **Given** a minimized, maximized, docked, or slideout panel is not the movement target, **when** another panel moves, **then** its presentation and size remain unchanged.

---

### User Story 4 - Prevent ownership regressions (Priority: P2)

As a maintainer adding or changing an interactive tree, I have one documented ownership rule and automated coverage that prevents a new tree from creating a competing drag-and-drop domain.

**Why this priority**: The failure is easy to miss in isolated component tests because it requires multiple mounted surfaces and a real lifecycle transition.

**Independent Test**: Add a representative second tree through the supported application seam and verify that automated tests detect competing ownership or unnecessary reconstruction.

**Acceptance Scenarios**:

1. **Given** a new interactive tree surface is introduced, **when** it adopts the application tree integration contract, **then** it coexists with every existing tree surface in the same document.
2. **Given** panel movement tests run, **when** Libraries moves while File Manager is populated, **then** the test exercises real mounted UI lifecycle behavior rather than layout-state stubs alone.
3. **Given** the tree ownership policy is violated, **when** the regression suite runs, **then** at least one focused test fails before release.

### Edge Cases

- A panel is moved while a drag is active; the move must either complete safely after the drag ends or fail without leaving stale drag state.
- A tree is still loading its initial data when another panel moves or another tree opens.
- A tree has no rows, one row, or a very large expanded hierarchy when its containing panel or a neighboring panel moves.
- A tree-based modal closes at the same time an auxiliary panel is reconstructed or moved.
- A panel moves out of or back into a seeded auxiliary group while another tree panel is minimized or displayed as a slideout.
- A workbench layout restored from an older saved envelope contains several tree-based panels on different edges.
- A secondary or floating window closes while it owns an active drag operation.
- Development hot reload replaces a tree component; subsequent panel movement must not leave stale drag ownership that survives a clean component remount.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST enforce one coordinated drag-and-drop ownership domain for all participating tree surfaces mounted in the same application document.
- **FR-002**: Separate application documents or supported windows MUST receive independent drag-and-drop ownership so closing, reloading, or dragging in one document cannot corrupt another document's interactions.
- **FR-003**: Every existing interactive tree surface, including File Manager, Code Repository, Presets Manager, and any active effects-library tree, MUST adopt the coordinated ownership policy or receive an explicit documented non-participating disposition.
- **FR-004**: Opening, closing, remounting, or displaying two or more participating tree surfaces MUST NOT produce a competing-backend error, renderer-wide fallback, or loss of interaction.
- **FR-005**: Existing native drag behavior used by Libraries and existing supported file, preset, repository, and effect drag/drop workflows MUST remain available after ownership is coordinated.
- **FR-006**: Moving an auxiliary panel or group MUST update only the affected placement and MUST NOT destroy and recreate unrelated live auxiliary panel sessions.
- **FR-007**: Unaffected auxiliary panels MUST preserve selection, expansion, scroll position, transient editor state, presentation mode, and configured size across another panel's move.
- **FR-008**: A failed or interrupted panel move MUST leave the last valid workbench layout operational and MUST clear any pending movement or drag state.
- **FR-009**: The workbench MUST continue to support moving individual panels and groups among the left, right, and bottom edges, including docked, minimized, slideout, and maximized presentations already supported by the application.
- **FR-010**: Regression coverage MUST mount real tree components together and MUST exercise the actual workbench panel-movement lifecycle with populated Libraries and File Manager; layout-state stubs alone are insufficient acceptance evidence.
- **FR-011**: Regression coverage MUST include repeated open/close and move cycles, cancellation or interruption of an active drag, and independent ownership across supported application documents or windows.
- **FR-012**: The feature MUST document the ownership rule and the supported integration path for future interactive tree surfaces.
- **FR-013**: The implementation MUST NOT require a wholesale replacement of existing tree functionality unless planning demonstrates that coordinated ownership cannot satisfy FR-001 through FR-012 without unacceptable compatibility risk.
- **FR-014**: The feature MUST NOT change project data, library database contents, program settings semantics, or serialized workbench layout meaning except where a backward-compatible layout migration is proven necessary during planning.

### Existing Behavior & Data Compatibility

- **Reference Behavior**: Java Blue is not the reference for renderer drag-and-drop ownership. The compatibility baseline is the current Blue Electron behavior for tree interactions and auxiliary panel placement, excluding the duplicate-backend failure and broad reconstruction side effects identified by this feature.
- **Compatibility Requirements**: Existing Libraries, File Manager, Code Repository, Presets Manager, and effects-library interactions must retain their current user-visible selection, rename, expansion, drag/drop, keyboard, and context-menu behavior. Existing saved workbench layouts must continue to restore without user reset.
- **Intentional Divergences**: Unrelated auxiliary panels will no longer restart during another panel's movement. This is an intentional correction of lifecycle behavior, not a change to panel placement semantics.
- **State Ownership**: Drag ownership, active drags, panel component sessions, focus, selection, expansion, and scroll positions are renderer-session state. The workbench layout remains the canonical owner of persisted panel placement and sizing. No affected state enters `.blue` project XML or library storage.

### Key Entities

- **Tree Interaction Surface**: A visible or hidden-mounted tree that supports selection and may support rename, expansion, or drag/drop.
- **Drag Ownership Domain**: The coordinated interaction scope shared by participating trees within one application document and isolated from other documents.
- **Auxiliary Panel Session**: The live renderer session for a workbench tool, including transient selection, focus, expansion, scroll, and loading state.
- **Panel Placement Transition**: A requested change to one panel or group while preserving the last valid placement and unrelated panel sessions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Libraries can be moved consecutively through left, right, and bottom placements for 20 cycles while File Manager is populated, with zero renderer errors and zero failed placements.
- **SC-002**: Every supported pair of existing interactive tree surfaces can be opened together for 10 open/close cycles with zero competing-ownership errors.
- **SC-003**: Moving one panel causes zero additional initialization calls for every unrelated mounted auxiliary panel in the acceptance test fixture.
- **SC-004**: Unaffected tree selection, expansion, and scroll state match their pre-move values after 100% of tested panel transitions.
- **SC-005**: Existing saved layouts covering docked, minimized, slideout, maximized, derived-singleton, and seeded-group presentations restore successfully and preserve their prior placement semantics.
- **SC-006**: Automated regression tests fail when a second uncoordinated drag ownership domain is introduced into the same document or when panel movement reconstructs an unrelated instrumented panel.

## Assumptions

- Existing tree dependencies may remain in use; dependency removal is not required to solve the ownership defect.
- A coordinated integration layer is preferable to independently configured drag ownership for each tree because cross-surface coexistence is a supported application state.
- Workbench popouts or secondary windows may have distinct documents and therefore require isolated ownership lifetimes.
- The existing serialized workbench layout format should remain unchanged unless implementation research proves that preserving panel instances requires a backward-compatible metadata addition.
- Optimizing or redesigning tree visuals, tree data models, and unrelated drag payload formats is outside this feature.
- The library database recovery and build-tool resolution issues discovered alongside this defect are separate follow-up work and are not part of this specification.
