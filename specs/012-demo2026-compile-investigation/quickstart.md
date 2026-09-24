# Quickstart: Demo2026 Compile Investigation — Closed

**Status**: Closed — `~/work/blue/demo2026/01.blue` now compiles and matches the Java reference `01.csd` byte-for-byte (2026-04-18)

## Primary References

- Spec directory: `specs/012-demo2026-compile-investigation/`
- Current project summary: [`STATUS.md`](/Users/stevenyi/work/blue-electron/STATUS.md)
- Project under test: `~/work/blue/demo2026/01.blue`
- Java reference artifact: `~/work/blue/demo2026/01.csd`
- Java implementation roots: `~/work/nbprojects/blue/blue-core`, `~/work/nbprojects/blue/blue-ui-core`

## Java-First Rule For Future Issues

When a parity, rendering, XML-compatibility, or formatting issue appears in the TypeScript port:

1. Find the owning Java class or render path first.
2. Compare XML tag names, timing semantics, string formatting, and section ordering before changing TypeScript.
3. Validate any suspected fix against the Java-generated artifact, especially `~/work/blue/demo2026/01.csd`.
4. Only keep a TypeScript-side divergence if it is intentional and documented.

This rule is now also captured in `AGENTS.md` and `CLAUDE.md`.

## Final Validation Workflow

### 1. Rebuild The Data Layer

```bash
pnpm --filter @blue/data build
```

### 2. Run The Test Suite

Default `vitest` worker pools may intermittently fail in this shell environment with `EAGAIN`. Use the single-worker form when needed:

```bash
pnpm --filter @blue/data test -- --maxWorkers=1
```

### 3. Regenerate Demo2026 And Check The Exact Diff

```bash
node -e "const fs=require('fs'); const {BlueData}=require('./packages/blue-data/dist/cjs/index.js'); (async()=>{ const xml=fs.readFileSync('/Users/stevenyi/work/blue/demo2026/01.blue','utf8'); const data=await BlueData.loadFromString(xml); fs.writeFileSync('/tmp/01_generated.csd', data.toCSD(), 'utf8'); })();"
diff -u /Users/stevenyi/work/blue/demo2026/01.csd /tmp/01_generated.csd | wc -l
```

Expected result: `0`

### 4. Optional Standalone csound Check

```bash
csound -n -o /dev/null -m135 /tmp/01_generated.csd
```

If standalone `csound` validation is used from this repo context, ensure the required opcode environment is configured, including `OPCODE7DIR64` when applicable.

## Final Outcome

- normal `blue-electron` playback/render path works for `01.blue`
- standalone `csound -n` validation succeeds
- generated demo2026 output matches the Java reference `01.csd` byte-for-byte
- self-contained regression coverage protects score scheduling and sound object timing;
  automated tests no longer read the developer-local Demo2026 project (removed 2026-09-24)
