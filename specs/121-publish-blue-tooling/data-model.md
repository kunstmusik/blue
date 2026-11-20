# Data Model for Publishing Blue’s Node Tools and Agent Skill

The feature introduces release metadata and sample artifacts. Project XML, persistent app settings, and libraries keep their existing formats.

| Entity | Fields and relationships | Owner and validation |
| --- | --- | --- |
| Tooling release | Shared npm version, immutable Git tag and full commit, intended npm channel, two package artifacts, corresponding skill path | Maintainer owns the release decision. Both packages agree with the tagged version and source. Registry versions and the release Git tag are immutable. |
| Package artifact | Public package name, version, npm archive, SHA-512 integrity, archive inventory, consumer smoke results by platform | Build job creates and retains one archive for each package. Publisher uses the same bytes that passed verification. Archives contain resolvable runtime dependencies, required resources, and applicable notices. |
| Registry publication | Package name and version, registry integrity, current dist-tag | npm stores each package independently. Existing matching integrity counts as published. A mismatching integrity blocks that version. |
| Skill | Skill name, description, source revision, compatible npm version, workflow references and optional assets | Git owns source. The installer copies or links from a released Git ref into the user’s workspace. Each local reference resolves from the installed skill directory. |
| Blue project and saved copy | Native input and output paths, canonical `.blue` XML, `BlueData` model, load diagnostics | Caller owns disk access. `BlueData` owns the in-memory model. Failed loads produce diagnostics and leave the original intact. The walkthrough writes a separate copy and reloads it. |
| Csound document | Output path, selected mode, generated CSD text | CLI owns the generated file. Compilation failure preserves any existing output. The source project remains unchanged. |

## Release states

Each package moves from **packed** to **verified** to **published**, with the source revision and archive identity carried through each step. Once both archives pass the consumer matrix, either can publish. The pair becomes **confirmed** when both expected versions, integrity values, and dist-tags match the registry and the tagged skill passes its workflow check. If publishing stops after one package, resume with the retained archive for the missing package. If uploaded bytes differ, stop that release and create a new version. A terminal failure retains the evidence needed to diagnose the failed stage.
