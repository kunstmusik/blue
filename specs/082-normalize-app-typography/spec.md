# Feature Specification: Normalize Application Typography

**Feature Branch**: `082-normalize-app-typography`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "Normalize inconsistent font sizing throughout the application, using Apple macOS Human Interface Guidelines as the strong guide. Review the two supplied AI reports and audit the current codebase before creating the spec. The number and names of Tailwind text styles may be reduced or changed so HIG compliance is clear. Document the resulting design in `docs/typography.md`, and direct agents performing UI work to consult that guide through `AGENTS.md`."

## Clarifications

### Session 2026-08-20

- Q: How should the seven semantic typography roles be technically delivered so legacy and generic text styles are retired? → A: Single semantic token layer — the Tailwind theme exposes exactly the seven role utilities (size + line height), matching CSS custom properties serve non-Tailwind surfaces, the legacy `--text-*` variables are removed, and Tailwind's default numeric text scale and arbitrary `text-[Npx]` values are not used in application code.
- Q: What form must the repeatable typography validation (FR-026, SC-001/002/008) take? → A: A CI-blocking static analysis check plus a documented manual visual acceptance matrix — not fully automated rendered-style measurement.
- Q: Must the visual acceptance matrix be executed on all three operating systems? → A: No — the visual acceptance matrix is executed on macOS at both display densities, automated typography checks run cross-platform in CI, and Windows/Linux visual spot-checks occur only when a geometry regression is suspected.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read Application Controls at Default Zoom (Priority: P1)

A composer using Blue at 100% application zoom can comfortably read menus, buttons, fields, tabs, lists, dialogs, status text, and editor annotations without encountering microscopic application-owned text.

**Why this priority**: The current 8–10 logical-pixel text is the central usability problem. If labels and values are difficult to read at the default scale, every workflow in the application is affected.

**Independent Test**: Open the main application and representative secondary windows at 100% zoom, inspect every application-owned textual element in the acceptance matrix, and verify that each is at least the approved minimum size with no reliance on user zoom for baseline legibility.

**Acceptance Scenarios**:

1. **Given** Blue is at 100% application zoom, **When** the user opens the main toolbar, workbench, Settings, and a modal dialog, **Then** ordinary controls and content use the approved Body role and secondary labels use an approved smaller semantic role no smaller than 11 logical pixels.
2. **Given** a dense editor such as the piano roll, score timeline, mixer, line editor, BlueX7 editor, or SoundFont viewer, **When** the user reads ruler marks, pitch names, field ranges, channel labels, table metadata, or graph annotations, **Then** every application-owned label remains legible at the 11-logical-pixel floor or above.
3. **Given** an empty, loading, warning, or error state whose text has no local size override, **When** it is displayed, **Then** it inherits the Body role instead of an unrelated browser default.

---

### User Story 2 - Recognize a Consistent Information Hierarchy (Priority: P1)

A user can distinguish titles, section headings, normal content, secondary information, and dense annotations because the same semantic typography roles are used consistently throughout every Blue window.

**Why this priority**: Raising only the smallest text would improve legibility but would leave the overlapping custom, generic, and arbitrary scales that currently make sibling panels look unrelated.

**Independent Test**: Compare matching content types across the main workbench, Settings, About, Welcome, dialogs, inspectors, code/output surfaces, and specialized editors; verify that equivalent roles have identical size and line-height metrics and that hierarchy is expressed through the approved roles rather than one-off sizes.

**Acceptance Scenarios**:

1. **Given** two controls with the same semantic purpose in different panels, **When** they are displayed at 100% zoom, **Then** their text uses the same typography role and metrics.
2. **Given** a window title, section title, emphasized heading, body value, secondary label, or dense annotation, **When** it is rendered in any application-owned window, **Then** it maps to the corresponding approved macOS-guided role.
3. **Given** Headline and Body content share the same size, **When** hierarchy is needed, **Then** emphasis is communicated through the role's weight and presentation rather than by introducing another near-duplicate size.
4. **Given** a textual element rendered in a standard control, an editor surface, or a drawn graphic, **When** it represents the same semantic role, **Then** it follows the same approved metrics.

---

### User Story 3 - Keep Dense Workflows Usable After Normalization (Priority: P2)

A composer can continue using compact, information-dense editors after text is normalized, with labels, values, and actions remaining visible, aligned, and reachable.

**Why this priority**: Many current micro sizes are coupled to fixed-height rows and tightly packed widgets. Increasing text without validating geometry could replace a legibility defect with clipping or overlap.

**Independent Test**: Exercise the mixer, piano roll at its supported note-row sizes, score rulers and layer controls, automation and line editors, Blue Synth Builder application controls, BlueX7 panels, and SoundFont tables at representative window sizes and zoom levels; verify that text does not collide, clip, or force essential actions out of reach.

**Acceptance Scenarios**:

1. **Given** the piano roll is using its smallest supported note-row height, **When** a pitch label cannot fit without collision, **Then** the interface uses a non-destructive density response such as selective label display rather than shrinking the text below the approved floor.
2. **Given** a mixer channel strip, compact table row, badge, or readout, **When** normalized text needs more room, **Then** the containing layout accommodates it without clipping the text or overlapping adjacent controls.
3. **Given** the user changes application zoom anywhere from 50% through 300%, **When** they perform representative essential actions, **Then** the typography changes do not introduce unreachable controls or irreversible content loss.
4. **Given** a long path, localized-length label, numeric value, or user-entered name, **When** space is constrained, **Then** the existing wrapping, scrolling, or intentional truncation behavior remains usable and text is not made smaller to force a fit.

---

### User Story 4 - Preserve Authored Content and Prevent Regression (Priority: P3)

A project author retains every project-specific font choice, while maintainers and coding agents have a documented design reference that prevents new application chrome from reintroducing arbitrary or sub-floor text sizes.

**Why this priority**: Blue Synth Builder and related project content deliberately store user-selected font sizes. Application normalization must not alter canonical project data, but it also needs an enforceable boundary so inconsistency does not return.

**Independent Test**: Round-trip projects containing minimum, typical, and maximum user-authored font sizes; confirm exact preservation, verify that the typography guide fully describes the approved design, confirm that repository guidance directs UI work to the guide, then introduce a test application-owned label below the floor or outside the semantic catalog and verify that the typography regression check rejects it.

**Acceptance Scenarios**:

1. **Given** a project contains a user-selected or imported font size below 11, **When** the project is loaded, displayed, saved, and reopened, **Then** the authored value and its project meaning remain unchanged.
2. **Given** an application-owned Blue Synth Builder toolbar, readout, or editor label, **When** it is normalized, **Then** it follows the application typography catalog even though nearby project-authored content may use a user-selected size.
3. **Given** a future application change introduces visible text below 11 logical pixels, a retired role, or an unapproved one-off size, **When** validation runs, **Then** the change fails with enough context to identify the offending application-owned text.
4. **Given** a non-text symbol or icon uses a size outside the text catalog, **When** validation runs, **Then** it may remain as a documented non-text exception and is not mistaken for user-facing typography.
5. **Given** a maintainer needs to select or review an application typography role, **When** they open `docs/typography.md`, **Then** they can find the approved metrics, role-selection guidance, scope boundaries, exceptions, and validation expectations without consulting the implementation history.
6. **Given** a coding agent begins UI work anywhere in the repository, **When** it reads `AGENTS.md`, **Then** it is explicitly directed to consult `docs/typography.md` and keep the UI change aligned with the typography guide.

### Edge Cases

- Application zoom below 100% intentionally scales the complete interface; the 11-logical-pixel minimum is defined at 100% Actual Size and is not converted into a physical-pixel minimum at every user-selected zoom.
- Retina, standard-density, and externally scaled displays can rasterize the same logical size differently; the semantic metrics remain stable while legibility is verified on both high- and standard-density displays.
- Text drawn inside a graphic surface may not inherit surrounding text styles and must still follow the same semantic role catalog.
- Fixed-height regions such as mixer chain lists, piano-roll ruler rows, small badges, and Blue Synth Builder readouts must accommodate the approved line height without clipping.
- Very short rows may omit lower-priority annotations when they cannot fit, but interactive labels, editable values, and essential state must not disappear solely to preserve density.
- Disabled, muted, warning, selected, and hover states must preserve the intended hierarchy without making information-bearing small text unreadable through low contrast or opacity.
- Textual glyphs used only as icons, such as a multiplication sign used as a close control, are sized as control graphics rather than body text but still require an accessible name.
- User-entered names, code, output, paths, and generated values retain their appropriate monospaced or proportional family while receiving the semantic size for their role.
- User-authored Blue Synth Builder labels, groups, dropdowns, knobs, and imported legacy styling remain project data even when their chosen size is below the application-owned text floor.
- Empty, loading, diagnostic, and recovery states across every renderer entry point must not fall back to an unintended default size.
- A future change to typography roles, metrics, scope boundaries, or exceptions must update the typography guide in the same change so repository guidance never points to stale design rules.
- The `AGENTS.md` typography reference must remain a valid repository-relative path even when UI work is unrelated to font sizing, because typography can be affected incidentally by layout and component changes.

## Requirements *(mandatory)*

### Approved Typography Roles

Blue MUST use the smallest sufficient subset of Apple macOS built-in text styles for application-owned text. Sizes and line heights are logical display units at 100% application zoom.

| Role | Size / line height | Default emphasis | Blue usage |
|------|--------------------|------------------|------------|
| Large Title | 26 / 32 | Regular, with stronger emphasis when needed | Welcome or About application identity only |
| Title 2 | 17 / 22 | Regular or bold | Major window, dialog, and top-level panel titles |
| Title 3 | 15 / 20 | Regular or semibold | Section titles and prominent inspector groups |
| Headline | 13 / 16 | Bold | Compact headings and column/group headings |
| Body | 13 / 16 | Regular, semibold for emphasis | Default controls, menus, inputs, lists, tables, code, and output |
| Callout | 12 / 15 | Regular or semibold | Secondary labels, shortcuts, badges, helper text, and compact controls |
| Subheadline | 11 / 14 | Regular or semibold | Dense canvas, ruler, timeline, mixer, and graph annotations only |

This catalog has seven semantic roles but only six distinct size steps because Headline and Body intentionally share metrics. Title 1 and the 10-point Footnote/Caption roles are not part of Blue's active catalog: current application surfaces do not require Title 1, and the 11-point Subheadline role establishes the application-owned readability floor.

### Functional Requirements

- **FR-001**: The application MUST use the approved role catalog for all application-owned visible text in the main workbench and every application-owned secondary window.
- **FR-002**: Application-owned text without a more specific semantic assignment MUST inherit the 13/16 Body role in every application-owned window and view.
- **FR-003**: No application-owned visible text MAY render below 11 logical pixels at 100% application zoom.
- **FR-004**: Typography assignments MUST be based on semantic purpose rather than the dimensions of a particular component or the desire to force text into an undersized container.
- **FR-005**: The overlapping legacy custom roles, generic size labels, and one-off numeric sizes MUST be replaced on user-facing textual content by the approved semantic role vocabulary.
- **FR-006**: Retired micro-size roles MUST no longer be available for new application-owned text, and existing occurrences MUST be migrated to an approved role.
- **FR-007**: Headline and Body MUST share the same size and line height; headings that use the Headline role MUST derive hierarchy through emphasis rather than a near-duplicate numeric size.
- **FR-008**: Each approved role MUST use its specified default line height unless a documented single-line control or graphic requires a tighter line box that remains unclipped and vertically centered.
- **FR-009**: Text rendered in standard controls, editor surfaces, and drawn graphics MUST follow the same size floor and semantic role mappings.
- **FR-010**: Enabled text that conveys information or identifies an action MUST meet a contrast ratio of at least 4.5:1 against its rendered background. Small secondary text MUST NOT depend on opacity below 50% to communicate hierarchy.
- **FR-011**: Disabled and inactive states MUST remain visibly distinct without using size reduction, and state MUST NOT be communicated by low contrast alone.
- **FR-012**: The normalized catalog MUST apply to menus, toolbars, tabs, rails, dialogs, settings, inspectors, tables, trees, code/output surfaces, welcome/about/error states, score editors, orchestra editors, mixer controls, Blue Live, BlueX7, SoundFont tools, and application-owned Blue Synth Builder controls.
- **FR-013**: Dense layouts MUST be adjusted, allowed to grow, selectively reduce nonessential annotation frequency, wrap, scroll, or intentionally truncate before application-owned text is reduced below its approved role.
- **FR-014**: The piano roll, score rulers, automation/line canvases, mixer channel strips, compact field rows, tracker, BlueX7 envelopes, SoundFont tables, and Blue Synth Builder readouts MUST receive focused visual validation because their text is coupled to fixed or minimum geometry.
- **FR-015**: Normalization MUST preserve the existing application zoom range, Actual Size behavior, and shared multi-window zoom behavior.
- **FR-016**: At every supported application zoom value, users MUST remain able to reach zoom controls and complete representative essential actions in the main workbench, Settings, and an application-owned editor.
- **FR-017**: User-authored or imported font sizes that are part of project content MUST remain outside the application typography catalog and MUST retain their exact supported values and rendering meaning.
- **FR-018**: Application-owned controls surrounding user-authored project content MUST still use the approved application role catalog.
- **FR-019**: The feature MUST NOT modify `.blue` XML meaning, stored Blue Synth Builder font properties, program settings, document state, generated Csound, or engine behavior.
- **FR-020**: Monospaced content MUST retain an appropriate monospaced family while using the semantic size and line height assigned to its role.
- **FR-021**: Non-text icons and decorative glyphs are exempt from the typography size catalog only when they have no textual reading role; interactive graphic controls MUST retain accessible names.
- **FR-022**: The feature MUST retain the existing application font-family decision; replacing Roboto or changing platform-specific font-family selection is outside this sizing normalization.
- **FR-023**: The normalized hierarchy MUST remain consistent on macOS, Windows, and Linux, with Apple macOS HIG serving as the primary role and metric guide rather than introducing platform-specific size scales. The visual acceptance matrix (SC-004, SC-009) is executed on macOS at both required display densities; automated typography validation runs cross-platform in CI; Windows and Linux visual spot-checks are performed only when a geometry regression is suspected.
- **FR-024**: Visual acceptance MUST cover both a high-density display and a standard-density or equivalently emulated display at 100% application zoom.
- **FR-025**: A repeatable typography inventory MUST identify every application-owned size assignment, semantic role, directly drawn text size, and approved exception.
- **FR-026**: Repeatable validation MUST reject retired application roles, application-owned sizes below the 11-logical-pixel floor, and unapproved arbitrary text sizes while excluding persisted user-authored font values and documented non-text graphics.
- **FR-027**: Existing interaction, project editing, save/reopen, window, focus, and keyboard behavior MUST remain unchanged except where layout must adapt to the normalized text metrics.
- **FR-028**: The completed typography design MUST be documented in `docs/typography.md` as the canonical repository guide. The guide MUST include the HIG rationale and logical-unit mapping, the approved role catalog and metrics, role-selection guidance, application-owned versus project-authored boundaries, contrast and opacity rules, drawn-text guidance, dense-layout and zoom expectations, approved exceptions, examples and anti-patterns, and validation instructions.
- **FR-029**: The repository's `AGENTS.md` MUST explicitly direct coding agents performing UI work to consult `docs/typography.md` before choosing or changing typography and to keep UI changes consistent with that guide.
- **FR-030**: Any future change to approved typography roles, metrics, boundaries, or exception policy MUST update `docs/typography.md` in the same change, and the `AGENTS.md` reference MUST remain valid.
- **FR-031**: The approved roles MUST be delivered as a single semantic token layer: the Tailwind theme exposes exactly the seven role utilities with their specified size and line-height metrics, equivalent CSS custom properties serve non-Tailwind surfaces such as the global stylesheet, dockview theming, and SVG attributes, and the legacy `--text-nano`, `--text-micro`, `--text-tiny`, `--text-ui`, `--text-body`, and `--text-content` variables are removed once migration is complete. Tailwind's default numeric text-scale utilities and arbitrary `text-[Npx]` values MUST NOT be used for application-owned text.
- **FR-032**: The repeatable validation of FR-026 MUST be implemented as a CI-blocking static analysis check over application source that recognizes text-size assignments in Tailwind class names, CSS rules and custom properties, inline styles, SVG font-size attributes, and canvas/drawn-text font declarations, failing on retired roles, sizes below the 11-logical-pixel floor, and unapproved arbitrary values, with a documented exception allowlist for persisted user-authored font values and approved non-text graphics. Rendered-style metric confirmation (SC-003) and geometry/visual acceptance (SC-004, SC-009) MUST be executed as a documented manual visual acceptance matrix; full rendered-style automation of every window type is not required.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Apple Human Interface Guidelines typography for macOS is the primary reference: Large Title 26/32, Title 2 17/22, Title 3 15/20, Headline and Body 13/16, Callout 12/15, and Subheadline 11/14. Apple's general design guidance recommends text of at least 11 points for typical viewing. Chromium's unzoomed CSS pixels and device-independent pixels are equivalent at 100% browser zoom, so these HIG logical metrics are mapped one-to-one rather than converting 13 points to approximately 17.3 CSS pixels. Java Blue was also reviewed as historical density evidence: its compact score, piano-roll, mixer, and Blue Synth Builder annotations generally use 10–11 point fonts.
- **Compatibility Requirements**: Existing `.blue` project content and its user-authored font choices MUST round-trip unchanged. Application zoom remains an app-wide program setting with its existing 50%–300% range. Existing editor behavior, project mutations, generated artifacts, and cross-platform window behavior remain compatible.
- **Intentional Divergences**: Blue intentionally uses an 11-logical-pixel application-owned floor even where Java Blue used 10-point compact labels, prioritizing current macOS readability guidance and standard-density legibility. Existing 8–10 logical-pixel application chrome is intentionally enlarged. The active Blue catalog omits macOS Title 1 and 10-point Footnote/Caption roles to keep the scale small and to avoid reintroducing a 10-point application tier.
- **State Ownership**: This feature introduces no new durable state. Typography roles are presentation rules. The main-process project document remains the canonical owner of project-authored font values, and the existing program-settings owner remains responsible for application zoom.

### Key Entities

- **Typography Role**: A semantic presentation role with a defined logical size, line height, default emphasis, and intended information purpose.
- **Application-Owned Text**: Text supplied by Blue's interface to label, explain, display, or control application behavior; it must use the approved catalog.
- **Project-Authored Text Style**: A font choice stored in or imported into a Blue project, including Blue Synth Builder font values; it is preserved as canonical project content and is not coerced into the application catalog.
- **Typography Exception**: A documented case that is not user-facing text, such as an icon glyph, or that is canonical user-authored content; exceptions remain visible to inventory and review rather than silently bypassing validation.
- **Typography Guide**: The canonical `docs/typography.md` design reference that explains the approved catalog, selection rules, compatibility boundary, exceptions, and validation expectations for maintainers and coding agents.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An inventory of production application-owned text reports zero visible text below 11 logical pixels at 100% application zoom.
- **SC-002**: One hundred percent of application-owned textual size assignments use one of the seven approved semantic roles; documented project-authored content and non-text graphic exceptions are reported separately.
- **SC-003**: Rendered-style measurements across every application-owned window type confirm the exact approved role metrics, including a 13/16 default Body baseline, 12/15 Callout, 11/14 Subheadline, and the approved title sizes at 100% zoom.
- **SC-004**: A visual acceptance matrix covering the main toolbar, workbench tabs and rails, menus, Settings, Welcome, About, dialogs, inspectors, code/output views, mixer, score timeline, piano roll, automation/line editor, tracker, Blue Live, BlueX7, SoundFont viewer, and application-owned Blue Synth Builder controls shows zero unintended text clipping, overlap, or loss of essential labels at representative supported window sizes.
- **SC-005**: One hundred percent of enabled, information-bearing text samples in the acceptance matrix meet or exceed 4.5:1 contrast against their rendered backgrounds.
- **SC-006**: At 50%, 100%, 200%, and 300% application zoom, users can reach zoom controls and complete one representative essential action in the main workbench, Settings, and an application-owned editor without typography-related content loss.
- **SC-007**: Project round-trip fixtures covering minimum, typical, and maximum supported user-authored font sizes retain 100% of their font values and unrelated project data.
- **SC-008**: The typography inventory reports zero retired micro-role usages and zero unapproved arbitrary sizes on application-owned text, while all documented user-content and non-text exceptions pass.
- **SC-009**: Visual checks on at least one high-density and one standard-density or equivalently emulated display show the same semantic hierarchy and no unreadable application-owned labels at 100% zoom.
- **SC-010**: All focused typography, application-window, settings, editor, project round-trip, and application zoom regression checks pass with no new functional failures.
- **SC-011**: `docs/typography.md` documents 100% of the approved roles and exact metrics and contains every guidance category required by FR-028, with no contradiction between the guide and the delivered application behavior.
- **SC-012**: `AGENTS.md` contains a clear UI-work instruction linking to `docs/typography.md`, and the referenced path resolves successfully from the repository root.

## Assumptions

- Apple macOS HIG is the primary guide for role names, logical sizes, line heights, and hierarchy; the same catalog is used cross-platform so Blue retains one coherent interface.
- HIG point sizes and Electron's unzoomed CSS sizes are treated as equivalent logical display units for this feature. The physical CSS rule that 1 point equals 1.333 CSS pixels is not used to inflate macOS interface metrics.
- The 11-logical-pixel floor applies to application-owned text at the 100% Actual Size setting. Users may intentionally scale the whole interface below 100% using the existing zoom preference.
- The existing Roboto-based proportional family and established monospaced families remain in use. Font-family selection, variable-font adoption, and wholesale weight redesign are outside scope.
- The supplied `FONT_SIZING_REPORT_GLM.md` and `gemini_font_sizing_research_report.md` are research inputs, not normative instructions. Their shared findings about micro text and overlapping scales are accepted; the claim that a 13-point macOS body must become approximately 17.3 CSS pixels is rejected for Electron's logical display context.
- Java Blue is a compatibility reference for persisted project fonts and a historical density reference, but its 10-point application labels do not override the chosen 11-point macOS-guided floor.
- Existing intentional ellipsis, wrapping, and scrolling may remain when they preserve access to the full value through established interactions such as tooltips, focus, or scrolling.
- No new user-facing font-size preference is introduced; the existing application zoom feature remains the user control for overall UI scale.
- `docs/typography.md` becomes the durable, human-readable typography design authority after this feature is delivered; this specification remains the requirements and acceptance baseline for the initial normalization.
- The `AGENTS.md` instruction applies to all UI work, not only changes explicitly described as typography work, because layout and component changes can unintentionally alter typography compliance.
