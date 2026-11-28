# Research — Local MCP access for Blue

## Protocol and client support

**Decision** — Use the stable TypeScript SDK v2 server and Node adapter on one Streamable HTTP endpoint. Use current sessionless protocol and resource subscriptions plus the SDK's stateless handshake-era compatibility for reads and calls. Current-generation clients receive live subscription updates. Other clients re-read resources. Confirm negotiation against the pinned SDK fixtures.

**Rationale** — SDK v2 provides a Fetch-compatible handler, a Node HTTP adapter, stream ownership, and current resource notifications. A local HTTP endpoint attaches to the running app. The stateless compatibility path avoids maintaining a second stream lifecycle.

**Alternatives considered** — SDK v1, a sessionful legacy transport alongside v2, and a stdio proxy. V1 covers only the older protocol, adding a sessionful legacy path expands lifecycle and test scope, and a proxy adds installation and credential management.

Sources: [Current Streamable HTTP protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http), [SDK HTTP adapter](https://ts.sdk.modelcontextprotocol.io/v2/serving/http.html), [legacy clients](https://ts.sdk.modelcontextprotocol.io/v2/serving/legacy-clients), [notification handling](https://ts.sdk.modelcontextprotocol.io/v2/servers/notifications.html), [SDK testing](https://ts.sdk.modelcontextprotocol.io/v2/testing.html).

## Settings and credentials

**Decision** — Keep credential access in main. Persist protected ciphertext through the platform credential API where it can protect the value. Where secure storage is unavailable, use a clearly indicated session-only token. Check backend behavior with the linked Electron version on each OS. During rotation, synchronously revoke the current epoch, close streams, persist the replacement when possible, and accept it only after provisioning. If provisioning cannot be completed, report an unavailable state or explicitly provision a session-only token. An invalidated disk credential must be cleared durably before it can be replaced by a session-only credential, so restart cannot restore a revoked token.

**Rationale** — This keeps a stable credential for normal restarts and preserves local use without persisting plaintext. A temporarily locked provider must yield a recoverable unavailable state if a saved credential exists. Status, telemetry, and renderer preferences carry no token. Explicit Copy actions write the credential or snippet to the clipboard in main.

**Alternatives considered** — Plaintext settings and always-ephemeral tokens. The former weakens local secret protection, and the latter requires routine client reconfiguration.

Source: [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage/).

## Client configurations

**Decision** — Provide Cursor and VS Code JSON and local Codex TOML. Cursor uses `mcpServers.blue.url` and `headers.Authorization`. VS Code uses `servers.blue`, `type: "http"`, `url`, and `headers.Authorization`; use a secret input prompt. Local Codex uses `[mcp_servers.blue]`, `url`, and `bearer_token_env_var`; the credential is copied separately. Validate actual product and host versions before claiming support. Use MCP Inspector as a local test client.

**Rationale** — Each documented direct client has a practical loopback and bearer-header path. Claude Desktop remote connectors run through Anthropic's service. Direct loopback HTTP with custom headers did not have a verified first-party Claude Desktop setup when this design was reviewed.

**Alternatives considered** — One universal JSON format and a Claude-specific proxy. Clients use distinct syntax and sometimes different execution hosts. A proxy remains future work.

Sources: [Cursor MCP](https://cursor.com/docs/mcp), [VS Code MCP configuration](https://code.visualstudio.com/docs/agents/reference/mcp-configuration), [Codex MCP](https://developers.openai.com/codex/mcp), [Claude connector types](https://support.claude.com/en/articles/11725091-when-to-use-desktop-and-web-connectors), [Inspector CLI](https://github.com/modelcontextprotocol/inspector/blob/main/clients/cli/README.md).

## History and publication

**Decision** — Use the current `ProjectSession` receipt and `ProjectHistory` queue. Force strict revision matching and test the document, revision, state ID, and current grant inside the queued operation after any required settlement. Reuse typed patches, a narrow structural adapter for new assignment IDs, and existing publication and reconciliation callbacks.

**Rationale** — Existing commits can rebase some operations when supplied with patch preconditions. MCP clients edit an explicitly inspected version. The guard must run at the ordered commit seam, because an admission-time check can go stale while history waits for a renderer barrier. Publish project notifications from commits, undo/redo, activation/close, and save checkpoints that change path or dirty state.

**Alternatives considered** — Direct arrangement mutation and renderer-mediated edits. Direct mutation bypasses history preparation. Renderer mediation adds a second authority and depends on window availability.

Evidence: `project-history.ts` (`commitInternal`, ordered mutations, settlement, structural commits), `project-session.ts`, `main.ts`, `project-runtime-reconciliation.ts`.

## CSD, playback, and render

**Decision** — Generate disk-profile CSD from detached, receipt-bound data only when the existing generation path can be entered without on-load hooks, interpreter work, or unapproved dependency reads. Gate timeline playback with local approval before project-authored execution. Reuse one-shot render ownership but expose render only for a positively verified initial project profile and vetted options, with publication from private staging and an atomic no-replace operation.

**Rationale** — `prepareCsdGeneration` may run on-load code and generation can call score interpreters, tuning dependencies, and audio layout preflight. Existing instrument edits can yield a restart-required outcome without executing their new code. Existing playback can retry or automatically loop, so authorization must still hold for each deferred start. Existing render can pass free-form disk settings and starts a Csound process without filesystem confinement. A safe target path controls only the designated artifact. The initial render profile must admit a representative dependency-free sine project, and deny any generated content or option outside its proven bounded subset. If that proof or atomic native publication is unavailable, refuse execution.

**Alternatives considered** — Calling UI handlers directly, regex-based denylisting of executable constructs, and relying on a separate engine process as confinement. Each leaves gaps in authorization, code activation, or output guarantees. General-purpose runtime sandboxing is beyond this phase.

Evidence: `main.ts` playback/CSD paths, `csd-generation.ts`, `render-freeze-coordinator.ts`, `render-to-disk.ts`, and `disk-render-command.ts`. Java Blue revision `3ca3f405`, `GenerateCsdToScreenAction` and `CSDRender` under `blue-ui-core`, establish the existing disk-profile screen behavior. Use existing fixtures and the local reference `~/work/blue/demo2026/01.csd` where appropriate. Csound's file-open hook reports opened files and does not authorize access. [Csound API](https://csound.com/docs/api/csound_8h.html).

## License and packaging

**Decision** — Plan app-main runtime dependencies `@modelcontextprotocol/server` 2.4.0 and `@modelcontextprotocol/node` 2.1.2, and Zod 4.6.7. SDK core resolves through the runtime packages. Use SDK client 2.4.0 for tests only. Validate exact resolutions and registry contents before locking or distributing. Use Node supported by each package, and pin Inspector separately for manual validation.

**Rationale** — Published SDK v2 package metadata declares Apache-2.0. The shipped license retains the original MIT copyright alongside Apache-2.0. Zod's published license is MIT. These terms are compatible with the GPL-3.0-or-later app scope when the notices are retained. The planned bridge and settings code is original and adopts no Java or third-party source.

**Alternatives considered** — V1's dependency shape and a bespoke JSON-RPC implementation. Neither changes the need to verify notices and transitive dependencies. The official SDK supplies protocol maintenance and test surfaces.

Before packaging, review the full production closure, including Hono dependencies brought in by the Node adapter, regenerate the npm inventory, retain full publisher licenses and any NOTICE files, update app notices and release inputs as needed, and inspect the installed artifacts. Apply the repo's release check and platform matrix.

### Verified resolutions and shipped license files (2026-11-26)

Checked against `registry.npmjs.org` and the installed package contents under pnpm 12.8.1. No license identifier differs from the decision above. The research had not pinned the transitive versions; the resolved ones are recorded here.

| Package | Resolved | Declared | Shipped license file and notice |
| --- | --- | --- | --- |
| `@modelcontextprotocol/server` | 2.4.0 (direct) | Apache-2.0 | One `LICENSE`, no `NOTICE` |
| `@modelcontextprotocol/core` | 2.4.0 (exact, via server) | Apache-2.0 | Same `LICENSE` text, no `NOTICE` |
| `@modelcontextprotocol/node` | 2.1.2 (direct) | Apache-2.0 | Same `LICENSE` text, no `NOTICE` |
| `zod` | 4.6.7 (direct) | MIT | `LICENSE`, Copyright (c) 2025 Colin McDonnell |
| `hono` | 4.13.22 (via node adapter) | MIT | `LICENSE`, Copyright (c) 2021 - present, Yusuke Wada and Hono contributors |
| `@hono/node-server` | 2.1.11 (via node adapter) | MIT | `LICENSE`, Copyright (c) 2022 - present, Yusuke Wada and Hono contributors |
| `@modelcontextprotocol/client` | 2.4.0 (dev only, tests) | Apache-2.0 | Not distributed |

The three SDK `LICENSE` files are byte-identical. Each is a composite: a preamble describing the MIT to Apache-2.0 licensing transition, the full Apache License 2.0 text, the retained `MIT License` notice for `Copyright (c) 2024-2025 Model Context Protocol a Series of LF Projects, LLC`, and a note limiting CC-BY-4.0 to documentation. Because no package ships a `NOTICE` file, Apache-2.0 section 4(d) adds no notice obligation. The packaging step must ship this composite file unaltered rather than the repository's generic `Apache-2.0.txt`, so the retained MIT notice stays with it.

`hono` carries in-file MIT headers in three published files: `dist/types/jsx/intrinsic-elements.d.ts` (Copyright (c) Meta Platforms, Inc. and affiliates) and `dist/helper/css/common.js` with its `dist/cjs` copy (MIT License, Copyright (c) 2019 Cristian Bote). `@hono/node-server` loads only `hono/utils/mime` and `hono/ws`, so Blue does not execute the CSS helper. These notices stay in place inside the package.

The dev-only closure reachable from the test client is 13 packages: Apache-2.0 (`@modelcontextprotocol/client` and `core` 2.4.0), MIT (cross-spawn 7.0.6, eventsource 3.0.7, eventsource-parser 3.1.1, jose 6.2.18, path-key 3.1.1, pkce-challenge 5.0.2, shebang-command 2.0.0, shebang-regex 3.0.0, zod 4.6.7) and ISC (isexe 2.0.0, which 2.0.2). Its devDependency placement keeps it out of the production inventory.

Built form: the SDK packages publish dual CommonJS and ES modules with top-level `main` and `types` fields. The app main process (`module: CommonJS`, `moduleResolution: node`) resolves and requires the `.cjs` builds without a build-configuration change. Electron 44.9.1 bundles Node 24.22.0 and the packages require Node 20 or later. `require` of `@modelcontextprotocol/server` and `@modelcontextprotocol/node` succeeded under Electron's bundled runtime, and the main type-check reported zero errors before and after importing them.

Sources: [App license rules](../../LICENSING.md), [app notices](../../packages/blue-app/THIRD_PARTY_NOTICES.md), [SDK releases](https://github.com/modelcontextprotocol/typescript-sdk/releases), [SDK license](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/LICENSE), [server metadata](https://registry.npmjs.org/@modelcontextprotocol/server/2.4.0), [Node adapter metadata](https://registry.npmjs.org/@modelcontextprotocol/node/2.1.2), [Zod license](https://github.com/colinhacks/zod/blob/main/LICENSE).
