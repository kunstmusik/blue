# Feature Specification: Follow Score Playback and Page Scrolling

**Feature Branch**: `079-follow-score-playback`

**Created**: 2026-08-18

**Status**: Complete — manual acceptance passed; automated validation recorded (2026-08-18)

**Input**: User description: Update the Follow Score playback system so playback uses page-style scrolling, manual horizontal navigation suspends follow, the `F` key re-engages it, and renderer, toolbar, and native menu state remain synchronized. Preserve playback preferences across playback lifecycle resets.

## Clarifications

### Session 2026-08-18

- Q: When the playhead reaches the right edge of the visible page, how far does the viewport advance and where does the playhead land? → A: Java Blue parity — the viewport jumps instantly so the playhead position becomes the new left edge (advance distance equals the playhead's distance past the current left edge, which may be less than a full viewport width); vertical viewport position is preserved. Reference: `ScoreTopComponent.updateRenderTimePointer()` in `blue-ui-core`.
- Q: When playback stops, what happens to the active/suspended follow state and its indicators? → A: Playback stop ends the session: the session's follow state (including suspension) is discarded and the toolbar and native menu revert to the saved follow preference. The next session's start is governed by the follow-on-start setting (Java Blue's "Enable follow playback on render start"): when enabled, follow starts active; when disabled, follow starts from the saved follow preference without being forcibly enabled.
- Q: Should Follow Score reposition the viewport when the playhead moves while playback is stopped or paused (e.g., dragging the time cursor or scrubbing)? → A: No — follow scrolling (page advance and catch-up) runs only while playback is active. While stopped or paused, manual playhead moves never trigger follow scrolling. Matches Java Blue, where follow is driven by render-time updates guarded by the RENDERING state.
- Q: Should horizontal zoom changes or window resizes suspend Follow Score during playback? → A: No — zoom, resize, and other view-scale changes are not navigation and never suspend follow. If a scale change pushes the playhead off-screen during active playback with follow enabled, normal catch-up (FR-004) applies.
- Q: When the user explicitly toggles Follow Score (toolbar, native menu, or F) during active playback, is the saved preference written immediately? → A: Yes — explicit toggles always write the saved follow preference immediately, even during playback (Java parity: `FollowScorePlaybackAction` writes and saves `PlaybackSettings`). Only automatic suspension from manual navigation remains session-only state.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Follow playback by score pages (Priority: P1)

When reviewing a long score during playback, the user wants the current playhead to remain discoverable without the score continuously sliding underneath it. Follow mode keeps the current score page still while the playhead travels across it, then advances the view when the playhead reaches the visible page boundary.

**Why this priority**: This is the primary value of Follow Score and removes the current rubber-band behavior that makes the timeline difficult to read.

**Independent Test**: Start playback in a project whose score is wider than the viewport with follow enabled. Observe several page boundaries without using any navigation controls.

**Acceptance Scenarios**:

1. **Given** playback is active, the root score timeline is visible, and follow is enabled, **when** the playhead advances within the visible page, **then** the horizontal viewport remains stationary while the playhead remains visible.
2. **Given** the playhead is approaching the right edge of the visible page, **when** it reaches or passes that edge, **then** the viewport advances once, instantly, so the playhead position becomes the leading (left) edge of the viewport, with the vertical viewport position preserved.
3. **Given** follow is enabled and playback begins, resumes from a new start, seeks, or wraps to a position outside the current viewport, **when** the new playhead position is available, **then** the viewport catches up to the playhead before normal page following continues.
4. **Given** an automatic page advance is occurring, **when** the timeline and its time header update together, **then** the automatic update is not interpreted as a user navigation action and follow remains enabled.

### User Story 2 - Browse freely during playback (Priority: P1)

While playback continues, the user wants to inspect an earlier or later part of the score without being pulled back to the playhead. Any deliberate horizontal timeline navigation suspends Follow Score for the active playback session and makes that suspension visible immediately.

**Why this priority**: Free inspection and editing during playback is essential for a score editor; automatic snap-back currently prevents it.

**Independent Test**: Start playback with follow enabled, manually move the horizontal timeline position, and continue playback for several seconds without re-enabling follow.

**Acceptance Scenarios**:

1. **Given** playback is active and follow is enabled, **when** the user horizontally scrolls the score with a wheel or trackpad, drags the horizontal scrollbar, or navigates horizontally through the time ruler, **then** follow is suspended, the toolbar `F` control becomes inactive, and the viewport stays at the user-selected position while playback continues.
2. **Given** follow has been suspended by a user navigation action, **when** additional playback clock updates or loop-position changes occur, **then** the viewport does not snap back automatically.
3. **Given** playback is stopped or follow is already inactive, **when** the user manually scrolls the timeline, **then** the action does not change the follow state.
4. **Given** the user scrolls only vertically through the score layers, **when** no horizontal viewport position changes, **then** follow remains unchanged.
5. **Given** playback is active and follow is enabled, **when** the user changes horizontal zoom or resizes the window, **then** follow remains enabled (no suspension), and normal catch-up applies if the playhead is pushed outside the visible page.

### User Story 3 - Re-engage follow with an explicit control (Priority: P2)

When the user is ready to return to the active playhead, they want one predictable action that catches the score up and resumes page following. The toolbar control, native Project menu item, and unmodified `F` shortcut provide equivalent ways to do that.

**Why this priority**: Suspension is useful only if returning to the playhead is quick and discoverable.

**Independent Test**: Suspend follow during playback, then re-enable it separately through the toolbar, native menu, and keyboard shortcut.

**Acceptance Scenarios**:

1. **Given** playback is active and follow is inactive, **when** the user clicks the toolbar `F` control, chooses the native follow menu item, or presses unmodified `F`, **then** follow becomes active and the viewport immediately catches up to the current playhead.
2. **Given** follow has just been re-enabled during playback, **when** the playhead advances beyond the current page boundary, **then** page-style following resumes without requiring another user action.
3. **Given** no project is loaded, **when** the user attempts to use the toolbar control, native menu item, or `F` shortcut, **then** the follow action is unavailable and no playback state changes.
4. **Given** focus is inside an input, textarea, select control, content-editable surface, code editor, or context menu, **when** the user presses `F`, **then** the character or control interaction remains available and follow is not toggled. Repeated keydown events from key auto-repeat must not toggle follow repeatedly.

### User Story 4 - Keep follow preferences and controls consistent (Priority: P2)

The user expects Follow Score to behave consistently across the toolbar, native menu, playback starts, and project/session lifecycle. A temporary suspension while browsing must not be mistaken for a change to the saved preference that controls whether a new playback session starts in follow mode.

**Why this priority**: Inconsistent controls and lifecycle resets make the feature feel unreliable and can cause users to lose their preferred workflow.

**Independent Test**: Toggle follow from every supported control, suspend it during playback, stop and restart playback, and close/reopen project state while observing both controls and playback behavior.

**Acceptance Scenarios**:

1. **Given** the current follow state changes through the toolbar, native menu, `F` shortcut, or automatic suspension, **when** the change is applied, **then** the toolbar indicator and native menu checkmark show the same state within the same user interaction.
2. **Given** the saved follow-on-start preference is enabled and follow was suspended during an earlier playback session, **when** the user starts a new playback session from a stopped state, **then** follow is re-enabled and the viewport catches up to the new playhead position.
3. **Given** playback is active and the engine reaches a loop boundary or performs an internal restart, **when** the playback session has not ended, **then** a prior user suspension is not cleared solely because the engine position restarted.
4. **Given** the saved follow-on-start preference is disabled, **when** a new playback session starts, **then** the current follow state is not forcibly enabled.
5. **Given** playback state is reset, a project is closed, or another runtime lifecycle reset occurs, **when** the follow controls are shown again, **then** the currently hydrated app-wide follow preferences are preserved rather than replaced with hard-coded defaults.
6. **Given** follow was suspended (or active) during playback, **when** playback stops, **then** the session's follow state is discarded, and the toolbar and native menu revert to showing the saved follow preference; when the follow-on-start setting is enabled, the next playback session begins with follow active.

### Edge Cases

- If the playhead is already outside the viewport when follow is enabled, the first follow action catches up immediately rather than waiting for the next page boundary.
- If the playhead jumps backward because of a seek or loop wrap, follow moves the viewport to the new playhead position and then resumes page-style behavior; it does not leave the playhead off-screen.
- If the score is shorter than the viewport or the playhead reaches the end of the score, follow does not attempt to scroll beyond the available horizontal range.
- If the user scrolls the timeline while an automatic follow update is being applied, the user-initiated position wins and follow is suspended rather than immediately reclaiming the viewport.
- If the time header and score body can be scrolled independently, horizontal navigation in either surface suspends follow and both surfaces remain aligned afterward.
- If playback fails to start, stops during startup, or enters an error state, the follow preference is not silently changed; only a confirmed new playback session may apply the follow-on-start rule.
- Follow behavior applies to the root score timeline. Navigating into a nested score view must not cause the root timeline’s follow logic to fight the nested view.
- If the playhead moves while playback is stopped or paused (e.g., dragging the time cursor or scrubbing), follow does not scroll the viewport; the user's manual viewport position is respected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product MUST provide a single Follow Score state that is represented consistently by the toolbar `F` control and the native Project menu checkbox whenever a project is loaded.
- **FR-002**: When playback is active, the root score timeline is visible, and Follow Score is enabled, the product MUST keep the viewport stationary while the playhead remains within the current visible page.
- **FR-003**: When the playhead reaches or passes the visible page’s right boundary while Follow Score is enabled, the product MUST advance the viewport instantly so the playhead position becomes the leading (left) edge of the viewport (matching Java Blue’s `ScoreTopComponent` behavior), advancing by the distance the playhead has traveled past the current left edge and preserving the vertical viewport position.
- **FR-004**: When playback starts, resumes at a new start position, or an active playback session seeks or wraps to a playhead position outside the current viewport while Follow Score is enabled, the product MUST reposition the viewport so the playhead is visible before continuing normal page following. Follow scrolling (page advance and catch-up) MUST NOT occur while playback is stopped or paused; manual playhead moves in those states never trigger viewport repositioning.
- **FR-005**: The product MUST suspend Follow Score when the user performs horizontal navigation in the score timeline, time header, horizontal scrollbar, or time ruler during active playback while Follow Score is enabled.
- **FR-006**: Suspending Follow Score MUST update the visible follow indicator immediately and MUST NOT stop, pause, restart, or otherwise alter audio playback.
- **FR-007**: The product MUST distinguish user-initiated horizontal navigation from automatic viewport movement caused by Follow Score so that automatic movement does not suspend itself.
- **FR-008**: The product MUST leave Follow Score unchanged for vertical-only scrolling, manual horizontal navigation while playback is stopped, manual navigation while Follow Score is already inactive, and view-scale changes such as horizontal zoom or viewport-size (window) changes.
- **FR-009**: The toolbar control, native menu item, and unmodified `F` shortcut MUST each toggle the same Follow Score state, and every explicit toggle MUST write the saved follow preference immediately, including during active playback; only automatic suspension on manual navigation remains session-only. Enabling Follow Score during active playback MUST immediately catch the viewport up to the current playhead when a playhead is available.
- **FR-010**: The `F` shortcut MUST be ignored when no project is loaded, when a modifier key is used, during key auto-repeat, or when the keyboard event originates from a text-entry, code-editing, content-editable, selection, or context-menu surface.
- **FR-011**: Every Follow Score state change, including explicit toggles and automatic suspension, MUST synchronize the toolbar indicator and native menu checkmark without leaving one surface stale.
- **FR-012**: The saved follow-on-start preference MUST re-enable Follow Score only when a new playback session begins from a stopped state; it MUST NOT re-enable Follow Score merely because an active session loops, seeks, or internally restarts.
- **FR-013**: The product MUST preserve the saved follow and follow-on-start preferences across playback-store/runtime resets, project close/open lifecycle transitions, and failed playback starts. A temporary suspension during playback MUST remain a session state separate from the saved follow-on-start preference.
- **FR-014**: Follow preferences MUST remain application settings and MUST NOT add transient viewport or playback-session state to the `.blue` project document.
- **FR-015**: When no project is loaded, follow controls MUST be disabled or unavailable and the product MUST NOT attempt follow scrolling.
- **FR-016**: When a playback session ends (playback stops), the product MUST discard the session's follow state (including suspension) and the toolbar and native menu indicators MUST revert to the saved follow preference within the same user interaction. When a new playback session begins, the follow-on-start setting (Java Blue's "Enable follow playback on render start") MUST govern the starting state: enabled → Follow Score starts active; disabled → Follow Score starts from the saved follow preference without being forcibly enabled.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue’s `ScoreTopComponent` moves the score viewport when the playhead crosses the visible right edge, catches the viewport to the render time when follow is enabled, and applies the follow-on-start preference at render initiation. Java Blue’s toolbar and Project menu both reflect the saved `PlaybackSettings` values. First-party DAW documentation also consistently treats manual timeline navigation as a suspension of automatic following; relevant references include the [Ableton Live Arrangement View manual](https://www.ableton.com/en/manual/arrangement-view/), the [Cubase Suspend Auto-Scroll documentation](https://www.steinberg.help/r/cubase-pro/15.0/en/cubase_nuendo/topics/playback/playback_suspend_autoscroll_when_editing_c.html), and the [REAPER User Guide](https://www.reaper.fm/userguide/ReaperUserGuide736c.pdf).
- **Compatibility Requirements**: Existing score content, playback transport, timing, editing, project XML, and audio behavior MUST remain unchanged. Follow and follow-on-start remain app-wide playback settings; transient viewport position and playback-session suspension remain runtime state. Existing toolbar and native menu labels remain available with the new synchronized behavior.
- **Intentional Divergences**: The updated system intentionally adds automatic suspension on manual horizontal navigation and an unmodified `F` keyboard shortcut to improve score-browsing UX. It intentionally uses page-style advancement rather than continuously repositioning the playhead within a moving lead window.
- **State Ownership**: The program-settings store owns durable follow and follow-on-start preferences. The playback session owns the active follow/suspended state and playback lifecycle. Explicit toggles through the toolbar, native menu, or `F` shortcut write the program-settings preference immediately; only automatic suspension on manual navigation modifies session state alone. The score view owns its transient viewport position. The native menu mirrors the active follow state through an explicit synchronization path; none of these runtime values are written into `.blue` project data.

### Key Entities *(include if feature involves data)*

- **Follow Preferences**: Application-level settings containing the user’s preferred Follow Score state and whether a new playback session should re-enable it.
- **Playback Follow Session**: The runtime state for the current playback session, including whether follow is active or temporarily suspended by user navigation.
- **Score Viewport**: The visible horizontal region of the root score timeline and its aligned time header.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a long-score playback test with at least 10 successive page-boundary crossings, the viewport remains stationary between boundaries and makes no more than one automatic horizontal advance per crossing; the playhead remains visible after every advance.
- **SC-002**: In 10 consecutive tests, a user-initiated horizontal navigation while follow is active suspends Follow Score and updates both visible indicators within 100 milliseconds, with no subsequent automatic snap-back during the remainder of that playback session unless the user explicitly re-enables follow.
- **SC-003**: In 10 consecutive re-engagement tests, clicking the toolbar, choosing the native menu item, or pressing unmodified `F` makes the current playhead visible within 100 milliseconds and restores page-style following.
- **SC-004**: In 100% of keyboard-scope tests, pressing `F` in a text input, code editor, content-editable surface, select control, or context menu does not toggle Follow Score or suppress the intended text/control interaction.
- **SC-005**: In 10 lifecycle tests, a user suspension remains suspended through loop and internal playback-position restarts, while a stopped-to-playing start re-enables follow exactly when the saved follow-on-start preference is enabled.
- **SC-006**: In 100% of preference-reset tests, runtime cleanup and project lifecycle transitions preserve the hydrated follow preferences and leave project XML unchanged.

## Completion Evidence

Implementation and local validation were closed on 2026-08-18. The focused SPEC 079
regression suites passed with 264 tests passing and 2 skipped. The repository-wide
`pnpm test` passed, including 339 `@blue/app` test files with 3,253 passing tests and
2 skipped, native engine socket/integration coverage, package tests, and repository
script tests. `pnpm lint`, the main/preload/renderer Electron builds, and
`git diff --check` also passed.

Manual acceptance was user-confirmed through the scenarios in [quickstart.md](quickstart.md);
the reported result was good with no defects observed. The unrelated
`MISSING_FEATURE_GPT.md` remains untracked and is excluded from the feature commit.

Java parity was reviewed for pointer-x page advancement, catch-up, and vertical
preservation. The intentional divergence remains documented: follow-on-start is applied
to the active session without changing the saved follow preference, as required by FR-016.

## Assumptions

- Follow Score v1 applies to the root score timeline; nested score views retain their existing navigation behavior unless a later feature explicitly gives them independent follow state.
- “New playback session” means a confirmed transition from stopped/idle into playback. Loop boundaries, seeks, and engine position restarts inside an active session do not count as new sessions.
- Manual navigation means a user-caused horizontal position change in the score body, time header, scrollbar, or ruler. Vertical-only scrolling is not treated as a Follow suspension.
- The toolbar and native menu use the existing Follow Score controls and labels; this feature changes their state behavior and adds the keyboard shortcut without introducing a second user preference.
- Default preference values remain the project’s existing defaults unless already-saved application settings provide different values.
- If no active playhead exists when Follow is enabled, the state changes immediately and viewport catch-up begins when a valid playback position becomes available.
