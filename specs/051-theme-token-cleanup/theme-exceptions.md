# Theme Exceptions

## Theme Role Mapping

| Canonical role | Legacy aliases | Intended usage |
| --- | --- | --- |
| `app-bg` | `blue-bg` | Root app background and large chrome surfaces |
| `app-surface` | `blue-surface` | Standard panels, cards, and inactive tab shells |
| `app-surface-strong` | none yet | Stronger nested panels, headers, and editor chrome |
| `app-surface-raised` | none yet | Raised headers, tab strips, and elevated shell surfaces |
| `app-canvas` | none yet | Deep editor/code/input backgrounds |
| `app-overlay` | none yet | Editor shells, slideouts, and overlay surfaces |
| `app-input` | none yet | Dense text inputs and form controls |
| `app-menu` | none yet | Context menus and compact floating menus |
| `app-field` | none yet | Dialog fields and table-cell inputs |
| `app-hover` | `blue-hover` | Soft hover backgrounds for inactive controls |
| `app-border` | `blue-border` | Default borders, dividers, and separators |
| `app-accent` | `blue-accent` | Active highlights, selected tabs, and primary buttons |
| `app-accent-hover` | `blue-accent-hover`, `blue-hover` | Hover/pressed accent states |
| `app-highlight` | none yet | Menu-item and contextual highlight fills |
| `app-text` | `blue-text` | Default readable foreground text |
| `app-text-bright` | none yet | Bright menu, toast, and emphasis text |
| `app-text-strong` | none yet | Highest-emphasis labels and values |
| `app-text-muted` | `blue-muted` | Secondary labels and helper text |
| `app-text-subtle` | none yet | De-emphasized text and disabled copy |
| `app-warning` | none yet | Warning-state chrome |
| `app-danger` | none yet | Error and destructive-state chrome |

## Approved Exceptions

The audit script reads the JSON array between the markers below. Keep entries exact by `path` and `value` so approved exceptions stay deliberate and reviewable.

<!-- audit-exceptions:start -->
```json
[
	{
		"path": "packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx",
		"value": "#89ddff",
		"kind": "syntax-palette",
		"reason": "CodeMirror syntax token color for operators and punctuation remains language syntax, not app chrome.",
		"ownerSurface": "Selected code editor syntax palette",
		"reviewBy": "permanent"
	},
	{
		"path": "packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx",
		"value": "#82aaff",
		"kind": "syntax-palette",
		"reason": "CodeMirror syntax token color for names and functions remains language syntax, not app chrome.",
		"ownerSurface": "Selected code editor syntax palette",
		"reviewBy": "permanent"
	},
	{
		"path": "packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx",
		"value": "#f78c6c",
		"kind": "syntax-palette",
		"reason": "CodeMirror syntax token color for literals and numbers remains language syntax, not app chrome.",
		"ownerSurface": "Selected code editor syntax palette",
		"reviewBy": "permanent"
	},
	{
		"path": "packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx",
		"value": "#ffcb6b",
		"kind": "syntax-palette",
		"reason": "CodeMirror syntax token color for metadata and types remains language syntax, not app chrome.",
		"ownerSurface": "Selected code editor syntax palette",
		"reviewBy": "permanent"
	},
	{
		"path": "packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx",
		"value": "#c3e88d",
		"kind": "syntax-palette",
		"reason": "CodeMirror syntax token color for strings and attribute values remains language syntax, not app chrome.",
		"ownerSurface": "Selected code editor syntax palette",
		"reviewBy": "permanent"
	},
	{
		"path": "packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx",
		"value": "#c792ea",
		"kind": "syntax-palette",
		"reason": "CodeMirror syntax token color for keywords and attributes remains language syntax, not app chrome.",
		"ownerSurface": "Selected code editor syntax palette",
		"reviewBy": "permanent"
	},
	{
		"path": "packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx",
		"value": "#d6deeb",
		"kind": "syntax-palette",
		"reason": "CodeMirror syntax token color for variables and property names remains language syntax, not app chrome.",
		"ownerSurface": "Selected code editor syntax palette",
		"reviewBy": "permanent"
	},
	{
		"path": "packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx",
		"value": "#637777",
		"kind": "syntax-palette",
		"reason": "CodeMirror syntax token color for comments remains language syntax, not app chrome.",
		"ownerSurface": "Selected code editor syntax palette",
		"reviewBy": "permanent"
	},
	{
		"path": "packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx",
		"value": "#f07178",
		"kind": "syntax-palette",
		"reason": "CodeMirror syntax token color for tag names remains language syntax, not app chrome.",
		"ownerSurface": "Selected code editor syntax palette",
		"reviewBy": "permanent"
	}
]
```
<!-- audit-exceptions:end -->

## Expected Long-Lived Exception Classes

- CodeMirror syntax token colors remain language-syntax semantics rather than app chrome; only surrounding editor chrome should be token-backed.
- BSB widget colors that represent saved project data or Java Blue parity should remain documented exceptions instead of being remapped to app theme roles.
- Score, piano-roll, waveform, and other renderer canvases may keep data-driven colors when the values come from project state or parity logic rather than shared chrome.
- Dockview overrides, scrollbars, pseudo-elements, data-URI hooks, and similar selector-driven third-party integration points should stay in `index.css`, but any retained values there must still flow through theme variables or documented exceptions.