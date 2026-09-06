# Remediation Inventory

## Baseline Audit Counts (2026-09-05)

- **Renderer Theme Failures (unapproved)**: 25 occurrences
  - Arbitrary utilities: 9 (packages/blue-app/src/renderer/components/CommitNumberInput.tsx: 7, packages/blue-app/src/renderer/components/workbench/panels/score/ScoreOverlayLines.tsx: 1, packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx: 1)
  - Raw CSS colors: 2 (packages/blue-app/src/renderer/styles/index.css: 2)
  - Static inline colors: 4 (packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveSpaceTab.tsx: 2, packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLineView.tsx: 2)
  - Undefined theme aliases: 10 (packages/blue-app/src/renderer/components/workbench/panels/audio-player/AudioPlayerMetadata.tsx: 4, packages/blue-app/src/renderer/components/workbench/panels/audio-player/AudioPlayerPanel.tsx: 2, packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/FileBackedScoreObjectEditor.tsx: 2, packages/blue-app/src/renderer/components/workbench/panels/tools/file-manager/FileManagerRootRenameDialog.tsx: 1, packages/blue-app/src/renderer/components/workbench/panels/repl-console/ReplConsolePanel.tsx: 1)
- **Approved Theme Exceptions**: 31 occurrences across 9 syntax token rules in `packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx`

## Post-User Story 1 Audit Counts (2026-09-05)

- **Renderer Theme Failures (unapproved)**: 1 occurrence
  - Arbitrary utilities: 0 (all 9 remediated: `CommitNumberInput.tsx`, `ScoreOverlayLines.tsx`, `TrackLayerGroupCanvas.tsx`)
  - Raw CSS colors: 0 (both remediated in `styles/index.css`)
  - Static inline colors: 0 (all 4 remediated: `LiveSpaceTab.tsx`, `AutomationLineView.tsx`)
  - Undefined theme aliases: 0 (all 10 remediated across `AudioPlayerMetadata.tsx`, `AudioPlayerPanel.tsx`, `FileBackedScoreObjectEditor.tsx`, `FileManagerRootRenameDialog.tsx`, `ReplConsolePanel.tsx`)
  - Contrast failures: 0 (all governed pairs meet >= 4.75:1 normal text / >= 3.25:1 non-text)
  - Prohibited focus suppression: 1 (`[tabindex]:focus, [tabindex]:focus-visible { outline: none; }` scheduled for Phase 4 / T022)
- **Approved Theme Exceptions**: 31 occurrences across 9 syntax token rules in `packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx` (comment foreground raised to `#8ca0a0` meeting WCAG 2.2 AA floor).
- **Explicit tabIndex occurrences**: 24 production component/view files (27 renderer files total including hooks/stylesheet):
  - `components/CommitNumberInput.tsx`
  - `components/dialogs/ConfirmationDialog.tsx`
  - `components/dialogs/use-dialog-focus.ts`
  - `components/instruments/blue-x7/algorithm-svg.tsx`
  - `components/instruments/blue-x7/envelope-editor.tsx`
  - `components/instruments/blue-x7/tab-list.tsx`
  - `components/libraries/LibraryDropMarker.tsx`
  - `components/libraries/LibraryTree.tsx`
  - `components/workbench/panels/ScorePanel.tsx`
  - `components/workbench/panels/blue-live/LiveSpaceTab.tsx`
  - `components/workbench/panels/mixer/ChannelStrip.tsx`
  - `components/workbench/panels/orchestra/ArrangementPanel.tsx`
  - `components/workbench/panels/orchestra/PythonInstrumentEditor.tsx`
  - `components/workbench/panels/output/OutputPanel.tsx`
  - `components/workbench/panels/score-object/editors/ClojureObjectEditor.tsx`
  - `components/workbench/panels/score-object/editors/CodeBackedScoreObjectEditor.tsx`
  - `components/workbench/panels/score-object/editors/JMaskEditor.tsx`
  - `components/workbench/panels/score-object/editors/JavaScriptObjectEditor.tsx`
  - `components/workbench/panels/score-object/editors/ObjectBuilderScoreObjectEditor.tsx`
  - `components/workbench/panels/score-object/editors/PianoRollEditor.tsx`
  - `components/workbench/panels/score-object/editors/TrackerScoreObjectEditor.tsx`
  - `components/workbench/panels/score/PatternLayerHeader.tsx`
  - `components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx`
  - `components/workbench/panels/udo/UdoTable.tsx`
  - `components/workbench/panels/virtual-keyboard/PianoCanvas.tsx`
  - `hooks/use-keyboard-shortcut-scope.ts`
  - `styles/index.css`
- **Outline-suppression occurrences**:
  - Global suppression in `styles/index.css` (lines 97-106 for `[tabindex]` and `button[role='separator']`)
  - In-component `outline-none` / `focus:outline-none` across 26 production files (e.g. `BSBPresetBar.tsx`, `BSBDropdownWidget.tsx`, `BSBSubChannelDropdownWidget.tsx`, `ScoreToolbar.tsx`, `PatternLayerHeader.tsx`, `compactFieldStyles.ts`, `MeterEntryDialog.tsx`, `MeterMapEditorDialog.tsx`, `TempoPointDialog.tsx`, `MarkersBar.tsx`, `TrackLayerGroupCanvas.tsx`, `PatternsLayerGroupCanvas.tsx`, `ScoreTimeCanvas.tsx`, `arrangement-columns.tsx`, etc.)
- **Numeric Control Instances**: 85 tags across 31 production files:
  - `components/CommitNumberInput.tsx`: 1
  - `components/settings/SettingsField.tsx`: 2
  - `components/effect-editor/EffectEditorPanel.tsx`: 2
  - `components/instruments/blue-x7/operator-panel.tsx`: 13
  - `components/instruments/blue-x7/pitch-envelope-panel.tsx`: 2
  - `components/instruments/blue-x7/common-panel.tsx`: 3
  - `components/instruments/blue-x7/lfo-panel.tsx`: 4
  - `components/workbench/panels/VirtualKeyboardPanel.tsx`: 3
  - `components/workbench/panels/MixerPanel.tsx`: 1
  - `components/workbench/panels/blue-live/LiveSpaceTab.tsx`: 2
  - `components/workbench/panels/shared/line-editor/LineDefinitionTable.tsx`: 2
  - `components/workbench/panels/shared/line-editor/EditableLineCanvas.tsx`: 2
  - `components/workbench/panels/score/ShiftObjectsDialog.tsx`: 1
  - `components/workbench/panels/score/MeterMapEditorDialog.tsx`: 1
  - `components/workbench/panels/score/TempoMapEditorDialog.tsx`: 1
  - `components/workbench/panels/score/TempoPointDialog.tsx`: 2
  - `components/workbench/panels/score/MeterEntryDialog.tsx`: 1
  - `components/workbench/panels/orchestra/bsb/FontChooserDialog.tsx`: 1
  - `components/workbench/panels/orchestra/bsb/BSBGridSettingsPanel.tsx`: 2
  - `components/workbench/panels/orchestra/bsb/BSBPropertySheet.tsx`: 2
  - `components/workbench/panels/score-object/editors/ZakLineObjectEditor.tsx`: 2
  - `components/workbench/panels/score-object/editors/TrackerScoreObjectEditor.tsx`: 5
  - `components/workbench/panels/score-object/editors/TrackerObjectEditor.tsx`: 1
  - `components/workbench/panels/score-object/editors/PatternObjectEditor.tsx`: 2
  - `components/workbench/panels/score-object/editors/JMaskEditor.tsx`: 1
  - `components/workbench/panels/score-object/editors/jmask/generator-editors.tsx`: 7
  - `components/workbench/panels/score-object/editors/jmask/modifier-editors.tsx`: 2
  - `components/workbench/panels/score-object/editors/jmask/TableEditor.tsx`: 3
  - `components/workbench/panels/score-object/editors/jmask/probability-editors.tsx`: 10
  - `components/workbench/panels/score-object/editors/pianoroll/PianoRollPropertiesEditor.tsx`: 1
  - `components/workbench/panels/score-object/editors/pianoroll/FieldDefinitionsEditor.tsx`: 3
- **Modal Candidates**: 33 production dialog/modal candidate files:
  - `components/dialogs/ConfirmationDialog.tsx`
  - `components/instruments/blue-x7/algorithm-dialog.tsx`
  - `components/instruments/blue-x7/sysex-import-dialog.tsx`
  - `components/libraries/LibraryImportDialog.tsx`
  - `components/libraries/LibrarySessionDialog.tsx`
  - `components/libraries/LibraryTransferDialog.tsx`
  - `components/workbench/panels/FreezeOperationDialog.tsx`
  - `components/workbench/panels/GeneratedCsdModal.tsx`
  - `components/workbench/panels/MidiImportDialog.tsx`
  - `components/workbench/panels/MissingAudioAssetsModal.tsx`
  - `components/workbench/panels/RenderToDiskDialog.tsx`
  - `components/workbench/panels/code-repository/AddToCodeRepositoryDialog.tsx`
  - `components/workbench/panels/code-repository/CodeRepositoryDialog.tsx`
  - `components/workbench/panels/code-repository/CodeRepositoryEditorModal.tsx`
  - `components/workbench/panels/operation-dialog-shared.tsx`
  - `components/workbench/panels/orchestra/GeneratedInstrumentModal.tsx`
  - `components/workbench/panels/orchestra/bsb/FontChooserDialog.tsx`
  - `components/workbench/panels/orchestra/bsb/PresetsManagerDialog.tsx`
  - `components/workbench/panels/score-object/editors/GeneratedScoreModal.tsx`
  - `components/workbench/panels/score-object/editors/pianoroll/PianoRollRulerConfigDialog.tsx`
  - `components/workbench/panels/score-object/note-processors/NoteProcessorChainDialog.tsx`
  - `components/workbench/panels/score-object/note-processors/NoteProcessorCodeModal.tsx`
  - `components/workbench/panels/score/LayerRemovalConfirmationDialog.tsx`
  - `components/workbench/panels/score/MeterEntryDialog.tsx`
  - `components/workbench/panels/score/MeterMapEditorDialog.tsx`
  - `components/workbench/panels/score/RulerConfigDialog.tsx`
  - `components/workbench/panels/score/ScoreManagerDialog.tsx`
  - `components/workbench/panels/score/ShiftObjectsDialog.tsx`
  - `components/workbench/panels/score/TempoMapEditorDialog.tsx`
  - `components/workbench/panels/score/TempoPointDialog.tsx`
  - `components/workbench/panels/tools/CsoundRCEditorModal.tsx`
  - `components/workbench/panels/tools/FTableConverterModal.tsx`
  - `components/workbench/panels/tools/file-manager/FileManagerRootRenameDialog.tsx`

## Theme and Contrast

- Resolve or explicitly classify all current `pnpm audit:renderer-theme` failures: 9 arbitrary utilities, 2 raw CSS colors, 4 static inline colors, and 10 undefined aliases.
- Revalidate all 31 existing approved exceptions and fail on stale or malformed entries.
- Govern at minimum: muted/subtle text on intended surfaces; accent used as text; text on accent/success/warning fills; CodeMirror comments; essential input/control boundaries; and author-supplied focus indicators.
- CSS token values remain sourced from `styles/index.css`; executable pair names and minimum ratios live in one planned machine-readable module consumed by the audit.

## Focus Classification

### Production `tabIndex` Occurrences (24 component files + 2 hooks + 1 stylesheet)

| File | Classification | Rationale & Remediation |
|---|---|---|
| `components/CommitNumberInput.tsx` | Operable control | Editable numeric input control; must provide visible focus indicator with `cn()`. |
| `components/dialogs/ConfirmationDialog.tsx` | Operable control | Dialog action buttons (Cancel, Confirm); focus traps require visible focus. |
| `components/dialogs/use-dialog-focus.ts` | Wrapper/helper | Focus management hook containing tab loops; must use realm-safe checks. |
| `components/instruments/blue-x7/algorithm-svg.tsx` | Operable control | Interactive SVG operator nodes; must show focused outline/ring. |
| `components/instruments/blue-x7/envelope-editor.tsx` | Operable control | Breakpoint canvas editor with keyboard interaction; visible focus ring. |
| `components/instruments/blue-x7/tab-list.tsx` | Operable control | Tab navigation items; roving tabIndex with visible focus indicator. |
| `components/libraries/LibraryDropMarker.tsx` | Non-operable programmatic shell | Drop indicator with tabIndex={-1}; non-interactive pointer/drop feedback. |
| `components/libraries/LibraryTree.tsx` | Operable control | Interactive tree items; roving tabIndex with visible focus styling. |
| `components/workbench/panels/ScorePanel.tsx` | Non-operable programmatic shell / Operable controls | Shell captures shortcuts (shell rule); M/S buttons require visible focus. |
| `components/workbench/panels/blue-live/LiveSpaceTab.tsx` | Operable control | Grid cell buttons and tab items; visible focus state. |
| `components/workbench/panels/mixer/ChannelStrip.tsx` | Operable control | Range slider fader and strip buttons; visible focus state. |
| `components/workbench/panels/orchestra/ArrangementPanel.tsx` | Non-operable programmatic shell | Table panel container focusing for keyboard shortcuts. |
| `components/workbench/panels/orchestra/PythonInstrumentEditor.tsx` | Non-operable programmatic shell | Code editor container focusing for keyboard shortcuts. |
| `components/workbench/panels/output/OutputPanel.tsx` | Non-operable programmatic shell | Scrollable text container with tabIndex={0} for scrolling. |
| `components/workbench/panels/score-object/editors/ClojureObjectEditor.tsx` | Non-operable programmatic shell | Editor container capturing shortcut focus. |
| `components/workbench/panels/score-object/editors/CodeBackedScoreObjectEditor.tsx` | Non-operable programmatic shell | Editor container capturing shortcut focus. |
| `components/workbench/panels/score-object/editors/JMaskEditor.tsx` | Non-operable programmatic shell | Editor container capturing shortcut focus. |
| `components/workbench/panels/score-object/editors/JavaScriptObjectEditor.tsx` | Non-operable programmatic shell | Editor container capturing shortcut focus. |
| `components/workbench/panels/score-object/editors/ObjectBuilderScoreObjectEditor.tsx` | Non-operable programmatic shell | Editor container capturing shortcut focus. |
| `components/workbench/panels/score-object/editors/PianoRollEditor.tsx` | Non-operable programmatic shell | Canvas container capturing shortcut focus. |
| `components/workbench/panels/score-object/editors/TrackerScoreObjectEditor.tsx` | Operable control | Cell grid navigation with roving tabIndex; visible cell focus. |
| `components/workbench/panels/score/PatternLayerHeader.tsx` | Non-operable programmatic shell / Operable controls | Layer row shell; M/S buttons and name input require visible focus. |
| `components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx` | Non-operable programmatic shell | Canvas viewport capturing shortcuts; alternative focus border. |
| `components/workbench/panels/udo/UdoTable.tsx` | Operable control | Interactive table rows; keyboard navigation with visible focus. |
| `components/workbench/panels/virtual-keyboard/PianoCanvas.tsx` | Operable control | Musical piano keys; visible active/focus indication. |
| `hooks/use-keyboard-shortcut-scope.ts` | Wrapper/helper | Scopes keyboard shortcut listeners to focused DOM subtree. |
| `styles/index.css` | Stylesheet | Global focus rules; remove blanket `[tabindex]` outline reset. |

### Outline-Suppression Occurrences

1. **Global `[tabindex]` and `separator` suppression in `styles/index.css`**:
   - Classification: Prohibited global suppression to remove. Replace with specific non-operable shell class and ensure all operable controls keep or add `:focus-visible` styling.
2. **Radix UI dropdowns and menus** (`BSBPresetBar.tsx`, `BSBDropdownWidget.tsx`, `ScoreToolbar.tsx`, `MarkersBar.tsx`):
   - Classification: Operable control with `outline-none` accompanied by `data-[highlighted]` and `focus-visible:ring-2`.
3. **Dialog fields and compact inputs** (`compactFieldStyles.ts`, `MeterEntryDialog.tsx`, `MeterMapEditorDialog.tsx`, `TempoPointDialog.tsx`, `arrangement-columns.tsx`):
   - Classification: Operable control with `outline-none` accompanied by `focus-visible:border-app-accent` and `focus-visible:ring-1`.
4. **Canvas viewports** (`TrackLayerGroupCanvas.tsx`, `PatternsLayerGroupCanvas.tsx`, `ScoreTimeCanvas.tsx`):
   - Classification: Non-operable programmatic-focus shell with alternative focus border.

## Settings and Numeric Controls

- Fix the shared `components/settings/SettingsField.tsx` association seam.
- Review all 85 current tags across `CommitNumberInput`, `CommitNumberField`, `LiveNumberInput`, and `DraftNumberInput`; prove a label association or explicit accessible name at each call site.
- Include the settings, effect-editor, track-instrument-editor, score, mixer, Live Space, JMask, piano-roll, tracker, BSB property, and BlueX7 call-site families returned by the inventory search.

## Dialog and Modal Classification

Classification of the 33 production dialog/modal candidate files:

| File | Classification | Opener & Dismissal | Host / Context |
|---|---|---|---|
| `components/dialogs/ConfirmationDialog.tsx` | True modal (contextual confirmation) | Fail-closed (Cancel default), Escape/backdrop cancel | Contextual in-app dialog |
| `components/instruments/blue-x7/algorithm-dialog.tsx` | True modal | Escape/close button, opener restoration | Panel-hosted modal |
| `components/instruments/blue-x7/sysex-import-dialog.tsx` | True modal | Escape/cancel, opener restoration | Panel-hosted modal |
| `components/libraries/LibraryImportDialog.tsx` | True modal | Escape/cancel, opener restoration | Workbench modal |
| `components/libraries/LibrarySessionDialog.tsx` | True modal | Escape/cancel, opener restoration | Workbench modal |
| `components/libraries/LibraryTransferDialog.tsx` | True modal | Escape/cancel, opener restoration | Workbench modal |
| `components/workbench/panels/FreezeOperationDialog.tsx` | True modal | Progress/dismiss, opener restoration | Workbench modal |
| `components/workbench/panels/GeneratedCsdModal.tsx` | True modal | Close action, opener restoration | Workbench modal |
| `components/workbench/panels/MidiImportDialog.tsx` | True modal | Escape/cancel, opener restoration | Workbench modal |
| `components/workbench/panels/MissingAudioAssetsModal.tsx` | True modal | Resolve/cancel, opener restoration | Workbench modal |
| `components/workbench/panels/RenderToDiskDialog.tsx` | True modal | Escape/cancel, opener restoration | Workbench modal |
| `components/workbench/panels/code-repository/AddToCodeRepositoryDialog.tsx` | True modal | Escape/cancel, opener restoration | Workbench modal |
| `components/workbench/panels/code-repository/CodeRepositoryDialog.tsx` | True modal | Escape/cancel, opener restoration | Workbench modal |
| `components/workbench/panels/code-repository/CodeRepositoryEditorModal.tsx` | True modal | Escape/cancel, opener restoration | Workbench modal |
| `components/workbench/panels/operation-dialog-shared.tsx` | Wrapper/helper | Shared dialog container layout/header/footer | Shared helper |
| `components/workbench/panels/orchestra/GeneratedInstrumentModal.tsx` | True modal | Close action, opener restoration | Workbench modal |
| `components/workbench/panels/orchestra/bsb/FontChooserDialog.tsx` | True modal | Escape/cancel, opener restoration | Panel-hosted modal |
| `components/workbench/panels/orchestra/bsb/PresetsManagerDialog.tsx` | True modal | Escape/cancel, opener restoration | Panel-hosted modal |
| `components/workbench/panels/score-object/editors/GeneratedScoreModal.tsx` | True modal | Close action, opener restoration | Workbench modal |
| `components/workbench/panels/score-object/editors/pianoroll/PianoRollRulerConfigDialog.tsx` | True modal | Escape/cancel, opener restoration | Panel-hosted modal |
| `components/workbench/panels/score-object/note-processors/NoteProcessorChainDialog.tsx` | True modal | Escape/cancel, opener restoration | Panel-hosted modal |
| `components/workbench/panels/score-object/note-processors/NoteProcessorCodeModal.tsx` | True modal | Close action, opener restoration | Panel-hosted modal |
| `components/workbench/panels/score/LayerRemovalConfirmationDialog.tsx` | True modal (contextual confirmation) | Fail-closed, Cancel-first, Escape cancel | Contextual confirmation |
| `components/workbench/panels/score/MeterEntryDialog.tsx` | True modal | Escape/cancel, opener restoration | Panel-hosted modal |
| `components/workbench/panels/score/MeterMapEditorDialog.tsx` | True modal | Escape/cancel, opener restoration | Panel-hosted modal |
| `components/workbench/panels/score/RulerConfigDialog.tsx` | True modal | Escape/cancel, opener restoration | Panel-hosted modal |
| `components/workbench/panels/score/ScoreManagerDialog.tsx` | True modal | Escape/cancel, opener restoration | Panel-hosted modal |
| `components/workbench/panels/score/ShiftObjectsDialog.tsx` | True modal | Escape/cancel, opener restoration | Panel-hosted modal |
| `components/workbench/panels/score/TempoMapEditorDialog.tsx` | True modal | Escape/cancel, opener restoration | Panel-hosted modal |
| `components/workbench/panels/score/TempoPointDialog.tsx` | True modal | Escape/cancel, opener restoration | Panel-hosted modal |
| `components/workbench/panels/tools/CsoundRCEditorModal.tsx` | True modal | Close action, opener restoration | Workbench modal |
| `components/workbench/panels/tools/FTableConverterModal.tsx` | True modal | Escape/cancel, opener restoration | Workbench modal |
| `components/workbench/panels/tools/file-manager/FileManagerRootRenameDialog.tsx` | True modal | Escape/cancel, opener restoration | Workbench modal |

True panel-hosted modals must use the host document and receive the two-document regression required by `docs/popout-popup-conventions.md`. Host/system confirmations and contextual confirmations retain their mandated ownership split.

## Value Widgets and Toggles

- Mixer fader in `components/workbench/panels/mixer/ChannelStrip.tsx`.
- BSB value families: `BSBKnobWidget`, `BSBHSliderWidget`, `BSBVSliderWidget`, `BSBHSliderBankWidget`, `BSBVSliderBankWidget`, and `BSBXYControllerWidget`.
- Score Mute/Solo controls in `ScorePanel.tsx` and `score/PatternLayerHeader.tsx`.
- Follow Playback shortcut in `hooks/use-keyboard-shortcuts.ts` and its discoverable UI/tests.

## Dynamic Status Surfaces

- Shared Sonner toast behavior.
- `components/settings/MidiSettings.tsx`.
- `components/settings/RealtimeRenderSettings.tsx`.
- `components/workbench/panels/blue-live/LiveSpaceTab.tsx`.
- `components/workbench/panels/repl-console/ReplConsolePanel.tsx`.
- Score Mute/Solo state in the two files above.

Each visually presented state requires a visible non-color cue. Important asynchronous updates also require the appropriate programmatic announcement.

## Renderer Hosts

- React entries: `main.tsx`, `settings-main.tsx`, `about-main.tsx`, `effect-editor.tsx`, and `track-instrument-editor.tsx`.
- Scriptless host: `popout.html`, validated through panel-hosted two-document tests.

## Explicit Exclusions

- Normalizing or rewriting project-authored colors or fonts.
- Full application WCAG conformance certification beyond this inventory.
- WCAG AAA as a release gate.
- A general shortcut preference system.
- Unrelated layout redesign or wholesale palette migration without a measured failure.
