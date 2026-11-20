# npm Package Contracts

## Data library

- Distribution name is `@kunstmusik/blue-data`. The workspace package remains `@blue/data`.
- The package root supports named ESM imports, CommonJS loading, and matching TypeScript declarations on Node 22 or newer. The browser bundler uses the portable ESM output. The two Node loading modes share model identity.
- Document `BlueData`, `readProjectXml`, the XML diagnostic/result types, commonly edited model types, timing primitives, and the runtime initialization and compilation entry points needed by the examples. The existing workspace test-support subpaths are for repository tests. Consumer examples use documented package-root exports.
- Node callers read and write native file paths with their filesystem APIs. A load report is either a result with `BlueData` and available diagnostics or a failure with diagnostics. This feature preserves current warnings, rejection, serialization normalization, and significant project data. The example writes a different file and verifies it by reloading.
- XML inspection and serialization do not execute project code. Explain QuickJS initialization for JavaScript generation and host injection for Java-backed generation. Cover the CLI as the complete host workflow for user projects with relative assets or scripts.
- The archive contains the emitted runtime, declarations, README and applicable licenses, notices, and attribution. Generated test files are excluded. Normal installation resolves public runtime dependencies.

## CLI

- Distribution name is `@kunstmusik/blue-cli`. The workspace package and installed command retain `blue-cli`. On-demand use is `npx @kunstmusik/blue-cli compile -p project.blue -o project.csd`.
- `compile` accepts `-p/--project` and `-o/--output`. Its default is disk-render CSD generation. `--realtime` and `--bluelive` select the other modes and are mutually exclusive.
- A successful compile writes a CSD and leaves the source project unchanged. Load or compilation failure exits nonzero with a diagnostic and preserves existing output. The CLI rejects a source file used as output.
- The release targets Node 22 or newer on macOS arm64, Windows x64, and Linux x64. Java-backed generation uses Java 17 or newer via `JAVA_HOME` or `PATH`. Plain compilation requires neither Java nor Csound. Csound is used to turn a generated CSD into audio.
- Compilation can execute project on-load scripts, score generators and external score commands. The CLI handles project-relative resources using existing behavior. The archive includes the existing Java helper and resources, sources, and notices. The package manager installs QuickJS and native ZeroMQ for the consumer platform.

## Publication

Both archives use the same version and source revision. The build ties the archives to `npm-v<version>`, validates the package names and versions, records archive inventories and SHA-512 integrity, and retains the tested bytes. Stable versions use `latest` and prereleases use `next`. An absent package version is published from its retained archive. If an expected version already exists, verify its integrity and intended tag. A different integrity stops the release. Verify both registry records and the matching skill before announcing.
