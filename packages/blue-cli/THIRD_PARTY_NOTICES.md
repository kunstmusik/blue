# Third-party notices

The Blue CLI bundle includes code from `@blue/data`, which incorporates Google msfa lookup tables under Apache-2.0. It also bundles `@rgrove/parse-xml` 4.2.3 under ISC. See `LICENSES/Apache-2.0.txt`, `LICENSES/ISC.txt`, and `dist/attribution/` for license texts and attribution details.

The CLI's Blue-authored code is MIT. The CLI JavaScript bundle declares `MIT AND Apache-2.0 AND ISC`. Its runtime dependency `quickjs-emscripten` 0.32.0 and the associated QuickJS support packages are MIT and installed separately by npm.

The CLI distribution also ships the Blue Java helper as a separate process.
Its Java source is EPL-2.0 and is included under `dist/java/source`. The shaded
JAR and script libraries have mixed licenses. Component versions, notices and
license texts are in `dist/java/THIRD_PARTY_NOTICES.md` and `dist/java/licenses`.
The Python libraries are distributed as source with their existing license files.
The package license field refers to this notice because it covers these distinct
distribution scopes.

The separately installed `zeromq` Node dependency uses MIT and MPL-2.0 licenses
and supplies its own license files. It transports authenticated requests to the
Java process.
