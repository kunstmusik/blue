# Contract: Renderer className Composition Convention

**Feature**: 097-cn-classname-migration | **Audience**: renderer components, reviewers, lint rule
**Kind**: renderer-internal development contract (machine-enforced in part by ESLint, FR-006)

This is the durable interface every renderer component and contributor must honor after the
migration. It replaces the de-facto "any concatenation works" behavior with one composition path.

## 1. Composition entry point

All `className` values built from more than one source (constants, conditionals, caller props)
MUST be composed through `cn()` from `packages/blue-app/src/renderer/lib/cn.ts`
(import alias `@/lib/cn`). Plain static strings (`className="flex"`) need no helper.

```tsx
// before
<div className={`w-full ${FIELD_CLASS} ${disabled ? 'opacity-50' : ''}`} />
// after
<div className={cn('w-full', FIELD_CLASS, disabled && 'opacity-50')} />
```

## 2. Precedence rule for components accepting `className` props

Signature: components that expose a `className` prop MUST apply it last:

```tsx
<div className={cn(BASE_CLASS, conditional, className)} />
```

Guarantee for callers: your utilities deterministically override the component's conflicting
base utilities; omitting `className` yields a clean list with no stray whitespace (FR-002).

## 3. Token semantics (summary; full model in `../data-model.md`)

- Tailwind utilities conflict-resolve, last wins.
- The seven `text-role-*` tokens form one group; a later role replaces an earlier one; roles are
  never stripped by unrelated merges; no raw font sizes or arbitrary `text-[Npx]` (typography
  guidance).
- Custom/BEM classes and unknown classes are opaque: preserved verbatim, never conflict-resolved.
  Do not rely on override behavior between two BEM modifiers.

## 4. Non-class string building is out of contract

Template literals and joins remain correct (and lint-unflagged) for: SVG path data
(`AutomationLineView.tsx`, `bsb/widgets/utils.ts`), error-message text (`stores/library-store.ts`),
keyboard key enumeration (`virtual-keyboard/keyboard-mapping.ts`), and any `style={{ … }}`
dynamic CSS **values**. If a future ambiguity arises ("is this a class list?"), the test is
whether the string feeds a `class`/`className` attribute.

## 5. Enforcement

ESLint (`eslint.config.mjs`, renderer production scope; test files exempt via the existing
exception block):

1. `JSXAttribute[name.name='className'] > JSXExpressionContainer > TemplateLiteral` — error,
   message directs to `cn()`.
2. `JSXAttribute[name.name='className'] JSXExpressionContainer CallExpression[callee.property.name='join']`
   — error, same message.

Known limitation (accepted, research D1): helper functions returning joined class strings are not
JSX-position matches; they are covered by the sweep and the exhaustive search gate in
`../quickstart.md`, not by lint.

## 6. New styling source rule (boundary; full text lives in AGENTS.md)

New component styling uses Tailwind utilities composed with `cn()`. No new BEM blocks in
`renderer/styles/index.css`. Plain CSS remains correct only for the whitelist: `@theme` tokens,
third-party overrides (`.dv-*`, `.cm-*`), keyframes, scrollbars, pseudo-elements. Existing BEM
blocks: retained per the retain list; ported to utilities opportunistically only when a change is
already touching that component (strangler policy — never batch).
