# BlueX7 Tabbed UI Visual Acceptance Matrix

Run these cases at 100% application zoom with the existing Blue typography tokens. Repeat the
layout cases at standard density (DPR 1) and macOS Retina density (DPR >= 2), and at 50%, 100%,
200%, and 300% zoom as required by `docs/typography.md`.

| ID | Viewport / action | Expected result |
|---|---|---|
| V01 | 1280×960, fresh editor | Header and four-tab bar remain visible; Voice & Global is selected; no outer vertical scroll is needed. |
| V02 | 800×600, Voice & Global | Algorithm topology, common controls, operator enables, and LFO remain inside the active panel; any overflow is local to the panel, not the page. |
| V03 | 800×600, Operators / Op 1 | Operator tabs, tuning/sensitivity/scaling controls, envelope graph, and numeric editor are reachable without the unrelated global/pitch/code sections. |
| V04 | Operators, select Op 2 then Op 6 | The selected operator tab and graph/values update; disabled operators show a visible `(Muted)` or equivalent dimmed indicator; no horizontal clipping occurs. |
| V05 | 800×600, Pitch Envelope | PEG graph and all four rate/level stages are visible/reachable within the active panel. |
| V06 | 800×600, Csound & Code / Post Code | The CodeMirror editor grows to the available panel height rather than remaining in the old fixed-height box; syntax highlighting remains active. |
| V07 | Csound & Code / Preview and Bindings | Generated tables/body and binding/diagnostic panes use split or local scrolling regions; switching sub-tabs does not resize the outer editor unexpectedly. |
| V08 | 360×600, top-level tabs | The tab bar is one row, scrolls horizontally as needed, and keeps the active tab visible; labels do not wrap and the editor introduces no unintended horizontal overflow. |
| V09 | Keyboard-only traversal | Focus moves across each tab list with Left/Right; Enter/Space activates; Tab enters the active panel; inactive panels are not keyboard reachable; focus indicators remain visible. |
| V10 | Live playback plus tab/gesture changes | Only active-view controls receive effective-value readback; a newly activated view updates within one 50 ms poll interval; a drag interrupted by a view switch commits once when completed visibly or cancels safely, and Undo/Redo remains intact. |

## Acceptance record

The requester manually reviewed the workflows covered by this matrix on 2026-09-01 and reported
the BlueX7 tabbed UI as working well. Automated browser execution remains environment-limited by
the configured Chrome process exiting with `SIGABRT` before test startup; the limitation is also
recorded in [`quickstart.md`](../quickstart.md).
