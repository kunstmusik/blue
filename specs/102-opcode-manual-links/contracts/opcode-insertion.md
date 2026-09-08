# Contract: Opcode Insertion and Help

## Resolver input

The pure resolver receives current document text, caret/replacement offsets, and one normalized opcode definition when the user accepts an autocomplete or opcode-menu item.

## Required outcomes

| Current context | Opcode shape | Insertion outcome |
|---|---|---|
| After assignment or inside expression/call | Has callable inputs | `name(required inputs)` with editable placeholders |
| Authored classic output prefix | Has inputs | `name required inputs`, preserving authored prefix |
| Empty/ambiguous statement start | One output | Editable output assignment to modern call |
| Empty/ambiguous statement start | Multiple outputs | Editable multi-output assignment to modern call |
| Statement start | Void/output sink | Modern call with required inputs and no invented output |
| Any | Declaration/special or unusable metadata | Name only |

## Invariants

- Resolve against the document at application time.
- Never duplicate an authored output or assignment.
- Never rewrite authored classic code.
- Include required inputs only; optional documentation brackets remain help text.
- Use ordered snippet tab stops for generated placeholders.
- If context or metadata is unsafe beyond the defined statement-start default, insert only the name.
- Autocomplete and opcode-menu insertion use the same resolver.
- UDO completion remains name-only with existing source precedence and de-duplication.
- Score-only mode does not offer orchestra opcode completion or its opcode menu.
- Prefix matching is case-insensitive without changing boost ordering.

## Generated help contract

Compact help displays available catalog title, summary, modern/classic syntax, category, example, and status/deprecation. Missing fields produce no empty headings. When `manualId` is valid, help exposes Open Manual through the typed navigation contract.

Interactive help nodes are created in the editor tooltip's hosting document. Context menus use existing host-document portals and realm-safe helpers. Manual actions do not dispatch editor changes.

## Verification matrix

Application-result tests cover assignment, classic output, nested expression, blank statement, void, multiple output, declaration, optional arguments, malformed/continued syntax, context changed after popup creation, mixed-case filtering, score gating, explicit completion invocation, UDO de-duplication, and UDO name-only insertion.
