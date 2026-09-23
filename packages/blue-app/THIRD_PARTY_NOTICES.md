# Blue application license notices

Blue application source is GPL-3.0-or-later; the text is `GPL-3.0-or-later.txt` in this folder. Component licenses remain scoped to their respective source or bundled assets.

- The Java helper is a separate process. Blue-owned Java source is EPL-2.0; its shaded JAR and Python resources include the separate licenses described in the installed `Resources/assets/java/THIRD_PARTY_NOTICES.md`.
- PMask is distributed as a separate GPL-2.0-or-later Python library. Its license and source are included in `Resources/assets/java/pythonLib/blue/pmask/`.
- Creative Commons licenses for bundled sample projects are described in `Resources/assets/examples/THIRD_PARTY_NOTICES.md`. CC BY-NC examples remain restricted to noncommercial use.
- `NPM-PRODUCTION-DEPENDENCIES.md` lists the app's locked production npm dependencies by their declared license identifiers, including dependencies pulled through workspace packages. Electron's `LICENSE` and `LICENSES.chromium.html` are copied into the installed licenses directory from the pinned runtime during packaging.
- The static native engine includes libzmq 4.3.5 under MPL-2.0 and Boost.Multiprecision 1.91.0 headers under BSL-1.0; see the matching license files in this folder. [libzmq 4.3.5 source](https://github.com/zeromq/libzmq/tree/v4.3.5).

License texts in the installed licenses directory come from the repository's root `LICENSES/`. Package metadata and the component notices identify which terms apply to each work.

`MIT.txt` in the installed licenses directory carries the Blue-authored MIT notice used by reusable Blue packages. Third-party MIT components retain their own copyright notices and license files alongside their packaged dependencies or in the installed licenses directory.
