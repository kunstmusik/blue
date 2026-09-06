# Renderer Accessibility Contract

## Scope

This contract governs the application-owned UI listed in [remediation-inventory.md](remediation-inventory.md) across Blue Electron renderer entry points and hosted popout windows. It is a bounded remediation contract, not a claim of whole-application WCAG conformance. Project-authored colors, score-object colors, BSB font/color data, imported content, and native operating-system dialogs are outside this feature's normalization scope; that project boundary is not itself a WCAG exception.

## Color and Contrast

1. Normal application text must measure at least 4.5:1 against every intended rendered background.
2. Qualifying large text must measure at least 3:1.
3. Visual information required to identify an active component or its state, required parts of graphical objects, and author-supplied focus indicators must measure at least 3:1 against the applicable adjacent color or colors, where WCAG 1.4.11 applies.
4. Threshold values are not rounded up.
5. Every semantic fill containing text must declare a passing on-fill foreground; passing as a foreground on a dark surface does not imply that the reverse pairing passes.
6. Disabled, decorative, user-authored, and platform-native exceptions must be explicit and must not hide operable or information-bearing application UI.
7. State meaning may use color, but color must not be the only visual cue. Where the state is programmatically determinable, it must also be exposed through the appropriate semantic state.

For Blue's approved typography catalog, only the 26 px Large Title role qualifies for the 3:1 large-text floor; all other roles use the 4.5:1 normal-text floor. Governed new or changed pairs target at least 4.75:1 for normal text and 3.25:1 for applicable large text/non-text information so rounding, compositing, and future surface adjustments do not leave a threshold-edge design.

## Focus and Keyboard

1. Every keyboard-operable control has a visible `:focus-visible` treatment.
2. Generic focus suppression is permitted only for a documented, non-operable programmatic-focus shell that presents an explicit alternative focus state.
3. When a component receives keyboard focus, the component must not be entirely hidden due to author-created content.
4. All in-scope functionality, including pointer drag adjustment, is operable through a keyboard interface without requiring specific timing, except where the underlying function depends on the path of movement rather than merely its endpoints.
5. Follow Playback uses `Command+Shift+F` on macOS and `Control+Shift+F` on Windows/Linux. Any future global shortcut based only on letters, punctuation, numbers, or symbols must be turnable off or remappable to include Control, Alt, or Command/Meta; a component-scoped character shortcut may instead be active only while that component has focus.
6. One-dimensional value controls use ArrowRight/ArrowUp for one step up, ArrowLeft/ArrowDown for one step down, PageUp/PageDown for ten steps, and Home/End for the range bounds. Values clamp to the authored range; absent a discrete resolution, one step is 1% of that range.

## Names, Roles, Values, and States

1. Each form/value control exposes a meaningful accessible name.
2. Custom sliders expose slider role, minimum, maximum, current value, and a human-readable value where the numeric value alone is ambiguous.
3. Toggles expose pressed/selected state.
4. Icon-only controls changed within the remediation inventory expose a name; decorative icons are hidden from assistive technology.
5. Important dynamic status/error updates use an appropriate live announcement without duplicating routine synchronous feedback.

## Modal Behavior

A true application modal must:

1. expose `dialog` or `alertdialog`, `aria-modal`, and an accessible title;
2. place initial focus deterministically inside the modal;
3. contain forward and reverse tab navigation while open;
4. treat Escape/backdrop/window-close paths as safe cancellation when dismissal is allowed;
5. restore focus to the connected opener on close; and
6. use the hosting window's document for focus and portal behavior;
7. use approved host portals or host surfaces for panel content, host-window positioning/dismissal, realm-safe target checks, portaled-event isolation, and cleanup; and
8. include a two-document regression when a panel-hosted modal or popup is corrected.

Non-modal surfaces and wrappers must not claim modal semantics.

Host/system confirmations remain routed through `showNativeConfirmation`. Contextual confirmations use `ConfirmationDialog`; destructive confirmations are fail-closed, expose destructive intent, and initially focus Cancel.

## Compatibility

- No accessibility remediation may mutate saved project colors, fonts, XML, CSD output, or audio behavior.
- Automatic foreground selection may improve legibility at render time without changing the stored project-authored value.
- Existing semantic typography roles and the 11 px application-owned text floor remain authoritative.

## Required Evidence

- Automated governed-pair contrast results.
- Focused tests for shared label, dialog, toggle, shortcut, and slider behavior.
- Browser-rendered keyboard/focus validation for representative custom controls.
- Manual matrix for main window and hosted popout at 100%, 200%, and 300% zoom.
