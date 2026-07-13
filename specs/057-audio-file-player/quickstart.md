# Quickstart: Verify Audio File Player

## Automated checks

```bash
cd packages/blue-app
pnpm exec vitest run --config vitest.config.ts \
  src/main/audio-stream-protocol.test.ts \
  src/shared/render-freeze-contract.test.ts \
  src/renderer/components/workbench/panels/audio-player/
pnpm exec tsc --noEmit -p tsconfig.main.json
pnpm exec tsc --noEmit -p tsconfig.preload.json
pnpm build:renderer
```

## Manual checks

1. Start Blue and open **Window → Properties → Audio File Player**.
2. Confirm the empty black waveform viewport contains one `No File Selected`
   message, with disabled icon controls below it.
3. Choose a WAV, AIFF, MP3, OGG, FLAC, or another supported file.
4. Confirm the waveform is continuous, the metadata populates, and all time
   fields use `MM:SS.SSS`.
5. Use Play/Pause, enable Repeat, and click/drag the waveform to seek.
6. Run **Render to Disk and Play**; confirm the player opens with the render
   and attempts in-app playback, reporting a clear error if the platform
   denies autoplay.
7. Run **Render to Disk and Open**; confirm the normal external Open behavior
   is preserved.
