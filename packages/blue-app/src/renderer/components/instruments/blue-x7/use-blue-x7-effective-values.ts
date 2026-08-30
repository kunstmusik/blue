/**
 * useBlueX7EffectiveValues — disposable effective-value display state for an
 * open BlueX7 editor (Spec 092, FR-014).
 *
 * Polls only the editor's visible controls through the main process at the
 * requested rate (default 20 Hz), keeps at most one request in flight, and
 * accepts a response only while the session and owner still match the open
 * editor: late or stale responses are discarded and never fall through to
 * another instance. The returned values are read-only display state — they
 * are never dispatched as project patches, never written into fixed values,
 * automation points, or undo history.
 */
import { useEffect, useRef, useState } from 'react';
import type {
  BlueX7EffectiveValuesResult,
  BlueX7RuntimeTarget,
} from '../../../../shared/project-editor/contract';

export interface BlueX7EffectiveValuesOptions {
  target: BlueX7RuntimeTarget | null;
  projectSessionId: number | null;
  /** Visible controls only (maximum 151). */
  parameterIds: readonly string[];
  /** Poll only while the editor is live (playback or Blue Live running). */
  enabled: boolean;
  /** Sampling rate; FR-014 requires at least 20 Hz. Defaults to 20. */
  pollHz?: number;
}

export interface BlueX7EffectiveValuesState {
  /** parameterId -> current engine-effective value. */
  values: ReadonlyMap<string, number>;
  /** True when the last poll reported an explicit unavailable result. */
  unavailable: boolean;
  /** Monotonic engine sequence of the last accepted snapshot (0 = none). */
  engineSequence: number;
}

const EMPTY_STATE: BlueX7EffectiveValuesState = {
  values: new Map(),
  unavailable: false,
  engineSequence: 0,
};

function requestIdentity(
  target: BlueX7RuntimeTarget | null,
  projectSessionId: number | null,
): string {
  if (!target || projectSessionId === null) return 'none';
  if (target.assignmentId !== undefined) {
    return `${projectSessionId}:arrangement:${target.assignmentId}`;
  }
  return `${projectSessionId}:track:${target.track.rootGroupId}:${target.track.trackId}`;
}

export function useBlueX7EffectiveValues(
  options: BlueX7EffectiveValuesOptions,
): BlueX7EffectiveValuesState {
  const { target, projectSessionId, parameterIds, enabled, pollHz = 20 } = options;
  const [state, setState] = useState<BlueX7EffectiveValuesState>(EMPTY_STATE);
  const inFlightRef = useRef(false);
  const identityRef = useRef(requestIdentity(target, projectSessionId));
  identityRef.current = requestIdentity(target, projectSessionId);
  const parameterIdsRef = useRef(parameterIds);
  parameterIdsRef.current = parameterIds;

  useEffect(() => {
    if (!enabled || !target || projectSessionId === null || parameterIds.length === 0) {
      inFlightRef.current = false;
      setState(EMPTY_STATE);
      return;
    }

    let disposed = false;
    const intervalMs = Math.max(5, Math.round(1000 / Math.max(1, pollHz)));

    const poll = async (): Promise<void> => {
      if (disposed || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const result: BlueX7EffectiveValuesResult = await window.blueAPI.getBlueX7EffectiveValues({
          target,
          projectSessionId,
          parameterIds: [...parameterIdsRef.current],
        });
        if (disposed) return;
        // Late-response rejection: accept only while the session and owner
        // still match this open editor.
        if (identityRef.current !== requestIdentity(target, projectSessionId)) return;
        if (!result.ok) {
          setState((previous) => ({
            values: previous.values,
            unavailable: true,
            engineSequence: previous.engineSequence,
          }));
          return;
        }
        setState({
          values: new Map(result.values.map((entry) => [entry.parameterId, entry.value])),
          unavailable: false,
          engineSequence: result.engineSequence,
        });
      } catch {
        if (!disposed) {
          setState((previous) => ({ ...previous, unavailable: true }));
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), intervalMs);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      inFlightRef.current = false;
    };
  }, [enabled, target, projectSessionId, parameterIds.length, pollHz]);

  return state;
}
