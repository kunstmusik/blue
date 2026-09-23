# Third-party notices

This file summarizes third-party material distributed with Blue. Full license texts and source notices are preserved beside the applicable package or in `LICENSES/`. The desktop installer includes corresponding copies under `Resources/licenses`, `Resources/assets/java`, and `Resources/assets/examples`.

## BlueX7 modern renderer

Google Mobile Synthesis FM (msfa) lookup tables, Copyright 2012 Google Inc., are incorporated in `@blue/data`'s BlueX7 modern orchestra and generated TypeScript under Apache-2.0. The exact tables and source files are listed in [the renderer attribution](packages/blue-data/resources/blue-x7-modern/ATTRIBUTION.md); the license text is in `LICENSES/Apache-2.0.txt`.

## Java helper and Python resources

The shipped Java helper is a shaded JAR. Blue-owned Java source is EPL-2.0; bundled components retain their own terms. The build dependency tree currently includes:

- Clojure 1.12.0, `spec.alpha` 0.5.238, `core.specs.alpha` 0.4.74, Pomegranate 1.1.0, and dynapath 1.0.0 under EPL-1.0.
- JeroMQ 0.6.0 under MPL-2.0; jnacl 1.0.0, Copyright (c) 2011 Neil Alexander T., under BSD-2-Clause.
- Jackson 2.21.5 / 2.21 under Apache-2.0.
- Maven Resolver 1.0.3–1.1.1, Maven 3.5.3, Plexus, Guava 20.0, Apache Commons, and Apache HttpComponents under their upstream Apache-2.0 terms; jsoup 1.7.2 (Copyright 2009–2013 Jonathan Hedley) and SLF4J 1.6.2 (Copyright 2004–2008 QOS.ch) under MIT.
- Jython 2.7.4 under the Python Software Foundation/Jython licenses. The full text is `LICENSES/Jython-LICENSE.txt`.
- Blue's legacy `orchestra` Python library and third-party PMask remain GPL-2.0-or-later. PMask is Copyright 2000 Maurizio Umberto Puxeddu and is packaged as a separate Python library for user scripts; Blue's production Java and TypeScript code do not import or link it. wxPython/PyCrust-derived `introspect.py` remains under the wxWindows Library Licence 3.1.

The JAR contains some upstream license and notice resources under `META-INF/` and `licenses/`; the external notice and license files are included so shaded resource-name collisions do not hide component terms.

## Native engine

- libzmq 4.3.5 is statically linked from the pinned vcpkg baseline and is under MPL-2.0. Its source is [zeromq/libzmq](https://github.com/zeromq/libzmq).
- Boost.Multiprecision 1.91.0 and its Boost header dependencies are under BSL-1.0. Its source is [Boost](https://www.boost.org/).
- Csound is a runtime requirement loaded dynamically. Blue's native release artifacts do not bundle Csound.

Full license texts are in the root `LICENSES/` and the app's `Resources/licenses` directory.

## JavaScript dependencies

The exact production npm dependency graph and declared license identifiers are recorded in [the current inventory](docs/dependency-license-inventory.md), including dependencies pulled through workspace packages. Package license files remain with their dependencies in the application. `@blue/data` uses `@rgrove/parse-xml` (ISC) and `quickjs-emscripten` plus its support packages (MIT); `@blue/engine-client` uses `zeromq` 6.8.0 (MIT AND MPL-2.0). Electron 39.8.10's Electron and Chromium license files are copied from the pinned runtime into `Resources/licenses` during packaging.

## Bundled example projects

The `.blue` and generated `.csd` files for these Dave Seidel works carry the stated Creative Commons terms independently of Blue's source-code license:

| Work                                                                                                       | License         |
| ---------------------------------------------------------------------------------------------------------- | --------------- |
| The Gemini Nebula                                                                                          | CC BY 2.0       |
| Timewave Canon                                                                                             | CC BY 2.5       |
| Owllight; Palimpsest; Aurora; Second Sleep; Unstill Light; Herald of Water, Herald of Air; Drift Study III | CC BY 3.0       |
| Gyre                                                                                                       | CC BY-NC 3.0    |
| Triune [disquiet0062-lifeofsine]                                                                           | CC BY-NC-SA 3.0 |

The original project notes include the author and license URLs. Blue's root code license does not replace those terms. Creative Commons BY-NC material is limited to noncommercial use under its license. See [Creative Commons' FAQ](https://creativecommons.org/faq/).

Examples without a separate license notice were distributed under the original Blue project's GPL-2.0-or-later grant; those prior permissions remain. This release also licenses Blue-authored code under GPL-3.0-or-later by default. Specific third-party and Creative Commons notices continue to apply to their works.
