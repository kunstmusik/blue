# blue-data Agent Guidance

## Public API documentation

- Add or update TSDoc at the declaration whenever you add or change a supported public export,
  public member, constructor overload, or type used in a public signature. Keep the comment
  aligned with the behavior callers observe.
- Use a concise summary. Document units, indexing, valid ranges, defaults, special values,
  diagnostics, mutation, ownership, and runtime requirements where callers need them.
- Use `@param name - Description.` for non-obvious inputs and `@returns` for result semantics
  such as sentinel values, identity, or ownership. Use `@throws` for caller-relevant failure
  conditions. A clear summary is enough for straightforward accessors.
- Keep new signature types discoverable in the reference. Use
  [Supporting types](docs/supporting-types.ts) when a type appears in the public API without its
  own package-root export.
- Run `pnpm --filter @blue/data docs:api` from the repository root before handing off public API
  changes. The strict build checks documentation coverage, referenced types, and links. Review
  the comments for accuracy as well. See the [README](README.md#api-reference) for the output path.
