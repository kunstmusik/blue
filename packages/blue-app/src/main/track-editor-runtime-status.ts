import type { WebContents } from 'electron';
import type { TrackInstrumentEditorRequest } from '../shared/project-editor';
import {
  isTrackInstrumentEditorRequest,
  TRACK_INSTRUMENT_RUNTIME_STATUS_CHANGED_CHANNEL,
  type TrackInstrumentRuntimeStatus,
} from '../shared/track-instrument-editor-contract';

export type TrackEditorRuntimeStatusSubscriber = Pick<WebContents, 'once' | 'send'>;

export interface TrackEditorRuntimeStatusDependencies {
  isAuthorized?: (
    subscriber: WebContents,
    request: TrackInstrumentEditorRequest,
  ) => boolean;
}

export interface TrackEditorRuntimeStatusCoordinator {
  getStatus: (
    subscriber: TrackEditorRuntimeStatusSubscriber,
    request: TrackInstrumentEditorRequest,
  ) => TrackInstrumentRuntimeStatus | null;
  subscribe: (
    subscriber: TrackEditorRuntimeStatusSubscriber,
    request: TrackInstrumentEditorRequest,
  ) => TrackInstrumentRuntimeStatus | null;
  unsubscribe: (
    subscriber: TrackEditorRuntimeStatusSubscriber,
    request?: TrackInstrumentEditorRequest,
  ) => void;
  publish: (
    activity: Pick<TrackInstrumentRuntimeStatus, 'playbackRunning' | 'blueLiveRunning'>,
  ) => TrackInstrumentRuntimeStatus;
  resetSubscriptions: () => void;
  dispose: () => void;
}

function getBindingKey(request: TrackInstrumentEditorRequest): string {
  return `${request.track.projectSessionId}:${request.track.rootGroupId}:${request.track.trackId}`;
}

export function createTrackEditorRuntimeStatusCoordinator(
  dependencies: TrackEditorRuntimeStatusDependencies = {},
): TrackEditorRuntimeStatusCoordinator {
  let status: TrackInstrumentRuntimeStatus = {
    sequence: 0,
    playbackRunning: false,
    blueLiveRunning: false,
  };
  let nextBindingGeneration = 0;
  const subscribers = new Map<
    TrackEditorRuntimeStatusSubscriber,
    { bindingKey: string; generation: number; request: TrackInstrumentEditorRequest }
  >();
  const isAuthorized = dependencies.isAuthorized ?? (() => true);

  const isCurrentBinding = (
    subscriber: TrackEditorRuntimeStatusSubscriber,
    request: TrackInstrumentEditorRequest,
  ): boolean => {
    const binding = subscribers.get(subscriber);
    return binding === undefined || binding.bindingKey === getBindingKey(request);
  };

  const removeBinding = (
    subscriber: TrackEditorRuntimeStatusSubscriber,
    generation?: number,
  ): void => {
    const binding = subscribers.get(subscriber);
    if (binding && (generation === undefined || binding.generation === generation)) {
      subscribers.delete(subscriber);
    }
  };

  const canAccess = (
    subscriber: TrackEditorRuntimeStatusSubscriber,
    request: TrackInstrumentEditorRequest,
  ): boolean => {
    if (!isTrackInstrumentEditorRequest(request)) return false;
    return isAuthorized(subscriber as WebContents, request);
  };

  return {
    getStatus: (subscriber, request) => {
      if (!canAccess(subscriber, request) || !isCurrentBinding(subscriber, request)) {
        return null;
      }
      return status;
    },

    subscribe: (subscriber, request) => {
      if (!canAccess(subscriber, request)) return null;

      const bindingKey = getBindingKey(request);
      const existing = subscribers.get(subscriber);
      if (existing?.bindingKey === bindingKey) return status;

      const generation = ++nextBindingGeneration;
      subscribers.set(subscriber, { bindingKey, generation, request });
      subscriber.once('destroyed', () => removeBinding(subscriber, generation));
      return status;
    },

    unsubscribe: (subscriber, request) => {
      if (!request || isCurrentBinding(subscriber, request)) {
        removeBinding(subscriber);
      }
    },

    publish: (activity) => {
      if (
        status.playbackRunning === activity.playbackRunning
        && status.blueLiveRunning === activity.blueLiveRunning
      ) {
        return status;
      }

      status = {
        sequence: status.sequence + 1,
        playbackRunning: activity.playbackRunning,
        blueLiveRunning: activity.blueLiveRunning,
      };

      for (const [subscriber, binding] of subscribers) {
        if (!isAuthorized(subscriber as WebContents, binding.request)) {
          subscribers.delete(subscriber);
          continue;
        }
        try {
          subscriber.send(TRACK_INSTRUMENT_RUNTIME_STATUS_CHANGED_CHANNEL, status);
        } catch {
          subscribers.delete(subscriber);
        }
      }
      return status;
    },

    resetSubscriptions: () => {
      subscribers.clear();
    },

    dispose: () => {
      subscribers.clear();
    },
  };
}