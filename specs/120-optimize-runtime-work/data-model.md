# Internal transient state

- Poll generation: bridge-owned opaque token or null; at most one outstanding request
  per generation. Clear invalidates authority. Old completions never clear new tokens.
- Structural transaction: detached candidate, isolated graph delta, change/acceptance
  flags. Canonical source remains the before-state; no second root is returned/retained.
- Captured graph: node/object maps keyed by transient IDs. Alignment remaps IDs and every
  encoded reference consistently. No persisted identity or public IPC change.
- Automation definition: immutable prepared ordered-time flag, owned by native control
  thread. Runtime cursor is an upper-bound endpoint in [1,size] for ordered definitions.
  Definition replacement invalidates or revalidates cursor; unordered scan stays intact.
