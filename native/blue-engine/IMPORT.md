# Blue Engine Import Provenance

Blue Engine is maintained here as ordinary monorepo source. Its prior Git
history remains in the former standalone repository for archaeology only.

| Item | Value |
|---|---|
| Source repository | `/Users/stevenyi/work/csound/blue-engine` |
| Source branch | `main` |
| Upstream base | `3c8d78f4c5781b14ab6b6c328aab0e59c1be3f8a` |
| Imported checkpoint | `6d59daa180cd6474d4fe181918539695d5512101` |
| Import date | 2026-07-28 |

The source repository was clean and resolved to the imported checkpoint
immediately before copying. The import used the committed tree and excluded
the standalone `.git` directory, build trees, dependency caches, editor
metadata, generated output, and the superseded standalone CI workflow.

Before import, default and performance-tracking builds passed all seven CTest
tests. The automation shrink regression also passed with AddressSanitizer and
performance tracking enabled. The default executable contained no performance
tracking diagnostic strings, confirming that optional profiling was compiled
out.
