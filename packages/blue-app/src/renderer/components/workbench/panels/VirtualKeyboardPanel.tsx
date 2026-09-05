import { useCallback, useMemo, type KeyboardEvent, type ReactElement } from 'react';
import { useProjectStore } from '../../../stores/project-store';
import { useBlueLiveStore } from '../../../stores/blue-live-store';
import { useMidiRoutingStore } from '../../../stores/midi-routing-store';
import { getMidiNoteFromComputerKey } from './virtual-keyboard/keyboard-mapping';
import { useVirtualKeyboardState } from './virtual-keyboard/useVirtualKeyboardState';
import { PianoCanvas, KEY_OFFSET, isWhiteKey } from './virtual-keyboard/PianoCanvas';
import {
  releaseAllVirtualKeyboardSources,
  routeVirtualKeyboardNote,
} from '../../../hooks/use-midi-input-service';
import { AppSelect } from '../../AppSelect';
import CommitNumberInput from '../../CommitNumberInput';
import { cn } from '../../../lib/cn';

function clampMidiNote(note: number): number {
  return Math.min(127, Math.max(0, Math.trunc(note)));
}

export default function VirtualKeyboardPanel(): ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const running = useBlueLiveStore((state) => state.running);
  // Spec 067: shared routing mode + focus authority for hardware and Virtual Keyboard.
  const routingMode = useMidiRoutingStore((state) => state.mode);
  const focusedTarget = useMidiRoutingStore((state) => state.focusedTarget);
  const setRoutingMode = useMidiRoutingStore((state) => state.setMode);
  const {
    channel,
    octave,
    velocity,
    velocityOverride,
    pressedNotes,
    isFocused,
    setChannel,
    setOctave,
    setVelocity,
    setVelocityOverride,
    setFocused,
    hasPressedNote,
    pressNote,
    releaseNote,
    clearPressedNotes,
  } = useVirtualKeyboardState();

  const pressedKeyIndices = useMemo(() => {
    const set = new Set<number>();
    for (const entry of pressedNotes) {
      const idx = entry.midiNote - KEY_OFFSET;
      if (idx >= 0 && idx < 88) {
        set.add(idx);
      }
    }
    return set;
  }, [pressedNotes]);

  const sendTrigger = useCallback(
    async (
      type: 'noteOn' | 'noteOff',
      midiNote: number,
      source: 'mouse' | 'computer',
    ): Promise<boolean> => {
      if (!loaded || !running) return false;
      const requestVelocity = velocityOverride ? velocity : 127;
      try {
        // SPEC 058: route through the shared renderer note router so hardware
        // and Virtual Keyboard inputs follow identical mapping and held-note
        // cleanup behavior.
        const result = await routeVirtualKeyboardNote({
          type,
          midiNote: clampMidiNote(midiNote),
          velocity: requestVelocity,
          channel,
          source,
          timestamp: performance.now(),
        });
        if (!result.accepted) return false;
      } catch {
        return false;
      }
      if (type === 'noteOn') {
        pressNote(clampMidiNote(midiNote), source);
      } else {
        releaseNote(clampMidiNote(midiNote), source);
      }
      return true;
    },
    [channel, loaded, pressNote, releaseNote, running, velocity, velocityOverride],
  );

  const releaseAllPressedNotes = useCallback(async () => {
    if (!loaded || !running) {
      clearPressedNotes();
      return;
    }
    try {
      // Release Virtual Keyboard source's held notes through the shared router
      // so engine-level note-offs are emitted deterministically.
      const sentByRouter = await releaseAllVirtualKeyboardSources();
      if (!sentByRouter) {
        await window.blueAPI?.sendBlueLiveAllNotesOff?.();
      }
    } finally {
      clearPressedNotes();
    }
  }, [clearPressedNotes, loaded, running]);

  const handleNoteOn = useCallback(
    (keyIndex: number) => {
      const midiNote = keyIndex + KEY_OFFSET;
      if (!hasPressedNote(midiNote, 'mouse')) {
        void sendTrigger('noteOn', midiNote, 'mouse');
      }
    },
    [hasPressedNote, sendTrigger],
  );

  const handleNoteOff = useCallback(
    (keyIndex: number) => {
      const midiNote = keyIndex + KEY_OFFSET;
      if (hasPressedNote(midiNote, 'mouse')) {
        void sendTrigger('noteOff', midiNote, 'mouse');
      }
    },
    [hasPressedNote, sendTrigger],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLCanvasElement>) => {
      if (!loaded || !running) return;

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (event.shiftKey) {
          setChannel(channel + 1);
        } else {
          setOctave(octave + 1);
        }
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (event.shiftKey) {
          setChannel(channel - 1);
        } else {
          setOctave(octave - 1);
        }
        return;
      }

      const note = getMidiNoteFromComputerKey(event.key, octave);
      if (note === null) return;
      if (event.repeat || hasPressedNote(note, 'computer')) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      void sendTrigger('noteOn', note, 'computer');
    },
    [channel, hasPressedNote, loaded, octave, running, sendTrigger, setChannel, setOctave],
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent<HTMLCanvasElement>) => {
      const note = getMidiNoteFromComputerKey(event.key, octave);
      if (note === null) return;
      event.preventDefault();
      if (hasPressedNote(note, 'computer')) {
        void sendTrigger('noteOff', note, 'computer');
      }
    },
    [hasPressedNote, octave, sendTrigger],
  );

  const handleBlur = useCallback(() => {
    setFocused(false);
    void releaseAllPressedNotes();
  }, [releaseAllPressedNotes, setFocused]);

  const displayChannel = channel + 1;

  // Spec 067: focus target status text, never conveyed by color alone. Rejected
  // notes add no routing error message here.
  const focusedTargetLabel = focusedTarget
    ? focusedTarget.kind === 'track'
      ? `Track: ${focusedTarget.displayName}`
      : `Orchestra: ${focusedTarget.assignmentId} — ${focusedTarget.displayName}`
    : 'No focused instrument';

  return (
    <div className="flex h-full flex-col bg-blue-bg text-app-text">
      <div className="flex flex-none items-center gap-2 border-b border-blue-border bg-app-surface-strong/90 px-3 py-2 text-role-body">
        <label
          className="flex items-center gap-1.5 text-app-text"
          title="Routing mode applies to hardware MIDI and the Virtual Keyboard"
        >
          <span className="text-role-body text-blue-muted">Routing</span>
          <AppSelect
            className="rounded border border-blue-border bg-blue-bg px-1.5 py-1 text-role-body text-app-text outline-none focus:border-blue-accent"
            value={routingMode}
            onValueChange={(value) => setRoutingMode(value === 'channel' ? 'channel' : 'focus')}
            options={[
              { value: 'focus', label: 'Focused Target' },
              { value: 'channel', label: 'Direct Channel' },
            ]}
            aria-label="MIDI routing mode"
          />
        </label>

        {routingMode === 'focus' ? (
          <span
            className="text-role-body text-blue-muted"
            role="status"
            aria-live="polite"
            aria-label={`Focused target: ${focusedTargetLabel}`}
          >
            {focusedTargetLabel}
          </span>
        ) : (
          <label className="flex items-center gap-1.5 text-app-text">
            <span className="text-role-body text-blue-muted">Channel</span>
            <CommitNumberInput
              min={1}
              max={16}
              step={1}
              className="w-12 rounded border border-blue-border bg-blue-bg px-1.5 py-1 text-center text-role-body text-app-text outline-none focus:border-blue-accent"
              value={displayChannel}
              onChange={(val) => setChannel(val - 1)}
              resolveValue={(text) => Number.parseInt(text, 10) || 1}
            />
          </label>
        )}

        <label className="flex items-center gap-1.5 text-gray-100">
          <input
            type="checkbox"
            checked={velocityOverride}
            onChange={(e) => setVelocityOverride(e.target.checked)}
            title="Enable Velocity Override"
          />
          <span className="text-role-body text-blue-muted">Velocity</span>
          <CommitNumberInput
            min={0}
            max={127}
            step={1}
            disabled={!velocityOverride}
            className={cn(
              'w-14 rounded border border-blue-border bg-blue-bg px-1.5 py-1 text-center text-role-body outline-none focus:border-blue-accent',
              velocityOverride ? 'text-gray-100' : 'text-blue-muted opacity-50',
            )}
            value={velocity}
            onChange={(val) => setVelocity(val)}
            resolveValue={(text) => Number.parseInt(text, 10) || 0}
          />
        </label>

        <label className="flex items-center gap-1.5 text-gray-100">
          <span className="text-role-body text-blue-muted">Octave</span>
          <CommitNumberInput
            min={0}
            max={7}
            step={1}
            className="w-12 rounded border border-blue-border bg-blue-bg px-1.5 py-1 text-center text-role-body text-gray-100 outline-none focus:border-blue-accent"
            value={octave}
            onChange={(val) => setOctave(val)}
            resolveValue={(text) => Number.parseInt(text, 10) || 0}
          />
        </label>

        <button
          type="button"
          className="ml-auto rounded border border-blue-border bg-blue-surface px-3 py-1 text-role-body text-gray-100 transition hover:border-blue-accent disabled:opacity-50"
          onClick={() => void releaseAllPressedNotes()}
          disabled={!loaded}
        >
          All Notes Off
        </button>
      </div>

      <PianoCanvas
        pressedKeys={pressedKeyIndices}
        onNoteOn={handleNoteOn}
        onNoteOff={handleNoteOff}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        focused={isFocused}
      />
    </div>
  );
}
