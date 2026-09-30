# Current Blue 3 screenshots

Captured 2026-09-30 from a normally launched macOS arm64 Blue package, using
Playwright Electron and isolated disposable user data. The package contains the
manual-validation repairs through M33; source baseline is commit
`7985f4e072aaacc4ff4d7e0450a9b302e6dc4213` plus the integration worktree changes.
These are actual rendered UI captures, with no Java-era images reused.

| Asset                     | View and sample data                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `score-timeline.png`      | Transport, ruler/snap, root Score and three named GenericScore phrases.                         |
| `orchestra.png`           | Arrangement and a Generic Instrument named Sine lead, with a short oscili/blueMixerOut example. |
| `mixer.png`               | Expanded Mixer showing the example instrument and Master strips.                                |
| `piano-roll.png`          | Expanded PianoRoll editor with a short six-note melody and amplitude field.                     |
| `pattern-object.png`      | Expanded PatternObject editor with two named rows and a four-beat pulse/accent grid.            |
| `soundobject-library.png` | Project SoundObjects panel and a linked Shared phrase placement on the Score.                   |
| `blue-live.png`           | Live Space with two sample cells, a saved set, tempo and repeat controls.                       |
| `settings-realtime.png`   | Settings sidebar and the top of Realtime Render, with empty engine/library overrides.           |

Only sample musical content and factory/default settings are shown. Views are
cropped to useful controls or maximized through the normal workbench commands;
no controls or text have been drawn into the captures. Panel dimensions and
platform appearance can vary. Windows/Linux UI validation remains deferred.

To update an image, build the current application, launch it with disposable
user data, open a small sample project, and use Window commands to open the
named panel. Enlarge editor panels so their controls are readable. Capture the
actual window or relevant region, inspect it, and update the associated chapter
caption and alternative text. Clean-render the book and check every local
image both under `file://` and in installed package resources.
