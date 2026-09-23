# Licensing

Copyright in Blue-authored code remains with its authors. Unless a component or file has a more specific notice below, Blue-authored source code, documentation, scripts, and build inputs in this repository are licensed under **GNU GPL-3.0-or-later**. The license text is in [LICENSE](LICENSE).

## Package scope

| Scope | License for Blue-authored code | Additional terms in the distributed component |
| --- | --- | --- |
| Repository default, including `packages/blue-app` | GPL-3.0-or-later | Third-party assets and dependencies retain their own terms. |
| `packages/blue-data` | MIT | The BlueX7 modern orchestra and generated TypeScript include Google msfa lookup tables under Apache-2.0. The artifact therefore declares `MIT AND Apache-2.0`; see [the package notices](packages/blue-data/THIRD_PARTY_NOTICES.md). |
| `packages/blue-cli` | MIT | The CLI bundle includes Apache-2.0 Google msfa tables and `@rgrove/parse-xml` under ISC; the artifact declares `MIT AND Apache-2.0 AND ISC`. |
| `packages/blue-engine-client` | MIT | `zeromq` is an external runtime dependency under its own MIT and MPL-2.0 terms. |
| `native/blue-engine` | MIT | The release executable statically links libzmq 4.3.5 (MPL-2.0) and uses Boost.Multiprecision 1.91.0 headers (BSL-1.0). Csound is loaded at runtime and is not bundled by this project. |
| Blue-owned Java source in `packages/blue-java` | EPL-2.0 | The shaded JAR contains separately licensed dependencies and Python resources; the JAR is a mixed-license distribution. See [Java runtime notices](packages/blue-app/assets/java/THIRD_PARTY_NOTICES.md). |
| `packages/blue-java/src/main/resources/jython/pythonLib/blue/orchestra` | GPL-2.0-or-later | This legacy Python library retains its existing notices. |
| `packages/blue-java/src/main/resources/jython/pythonLib/blue/pmask` | GPL-2.0-or-later | Third-party PMask code, Copyright 2000 Maurizio Umberto Puxeddu; its license text is `COPYING` in that directory. It is packaged as a separate Python library for user Jython scripts; Blue production Java and TypeScript code do not import or link it. |
| `packages/blue-java/src/main/resources/jython/pythonLib/blue/jythonconsole/introspect.py` | wxWindows Library Licence 3.1 | Derived from Patrick K. O'Brien's PyCrust/wxPython introspection module. The license text is `COPYING` in the same directory. |
| `packages/blue-app/assets/examples` and root `examples` | GPL-3.0-or-later by default for Blue-authored content; unmarked legacy files also retain their earlier GPL-2.0-or-later grant | Files with their own Creative Commons notices remain under those specific terms. See the included `THIRD_PARTY_NOTICES.md` in each examples directory. |

The package `license` fields describe the Blue-owned code or the packaged artifact expression identified above. They do not relicense third-party files. Dependencies shipped in the application keep the licenses supplied with their own packages. Shared license texts live in the root `LICENSES/` and are copied directly into the application's `Resources/licenses` at packaging. Independently published npm packages include their own required license files.

## Release checks

The CI or release operator should regenerate the npm dependency inventory with `pnpm licenses list --json -P --filter @blue/app` and the production workspace-package filters (`@blue/data` and `@blue/engine-client`), inspect the shaded Java JAR and staged native engine, and verify that each macOS, Windows, and Linux installer contains the applicable license texts and notices. Recheck the list when dependencies, bundled examples, or native build inputs change.

Creative Commons BY-NC examples require separate permission for commercial distribution. Before relying on the GPL/EPL separation in a commercial distribution, obtain legal review of the app and Java process boundary.
