# Contract: BlueX7 SysEx Selection and Import

## Main/Preload Operation

`selectBlueX7SysexFile(): Promise<BlueX7SysexReadResult>`

The operation accepts no native path from the renderer.

### Results

- `{ status: 'canceled' }`
- `{ status: 'selected', fileName: string, bytes: ArrayBuffer }`
- `{ status: 'error', code: 'read-failed' | 'unsupported-size' | 'invalid-request', message: string }`

### Main-process guarantees

1. Own the native dialog to `BrowserWindow.fromWebContents(event.sender)` when possible, falling back to the main window.
2. Permit regular files and display an appropriate SysEx/all-files filter.
3. Read only the selected path and return no native path.
4. Reject sizes other than exactly 163 or 4,104 bytes before transferring content.
5. Convert filesystem/permission/short-read failures into an actionable typed result.
6. Do not inspect or mutate any project, Track, or library instrument.

## Portable Decode Operation

`decodeBlueX7Sysex(bytes: Uint8Array): DecodedBlueX7Sysex`

### Validation

- exact supported length;
- Yamaha F0/F7 framing and manufacturer byte;
- canonical single/bank type and count header, allowing the device/channel nibble where Yamaha permits;
- all payload data is 7-bit;
- Yamaha checksum is valid;
- all reads/indexes are in bounds;
- decoded values satisfy Java-mapped domains, with explicitly oracle-accepted packed values retained.

Failure throws/returns a typed semantic error and never produces a partial voice.

### Mapping compatibility

- Payload starts at absolute byte 6.
- Operators are reversed from file order into logical operator 1–6 order.
- Single voice uses six 21-byte operator blocks, global offsets 132–150, forces six operator enable flags true, and ignores the source name for instrument metadata.
- Bank uses 32 128-byte slots, six 17-byte operator blocks per slot, global offsets 102–117 within each slot, retains current operator enable flags, and exposes ten-byte source names only for selection.
- Packed masks/shifts and detune transform match the Java oracle, including legacy-looking shifts, unless a separately approved parity correction changes the contract.

## Renderer Import Flow

1. Capture the current editor context identity.
2. Invoke selection/read.
3. On cancel/error, show nothing or a recoverable message and dispatch no patch.
4. Decode into a detached value.
5. For a single voice, show confirmation; for a bank, list exactly 32 stable `01`–`32` entries with safe names and await one selection.
6. Reconfirm that editor context identity still matches.
7. Overlay decoded modeled fields according to single/bank enable semantics while retaining current identity metadata, post code, and unknown XML ownership.
8. Dispatch exactly one `replaceVoice` patch and record one local undo entry.

Closing or canceling either confirmation dialog dispatches no patch. Duplicate, padded, blank, or non-printable names remain distinguishable by the stable slot number.

## Atomicity and Ownership

- Decoding never receives a mutable target instrument.
- Main never chooses a bank slot and never commits a patch.
- Renderer temporary state is disposable.
- Orchestra/Track/library mutation happens only through the shared editor patch contract.
- Library import changes only the current draft until Save.
- A stale Track or changed editor target causes the candidate to be discarded or explicitly reconfirmed, never applied silently.
