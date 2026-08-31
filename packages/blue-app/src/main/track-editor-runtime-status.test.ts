import { describe, expect, it, vi } from 'vitest';
import type { TrackInstrumentEditorRequest } from '../shared/project-editor';
import {
  TRACK_INSTRUMENT_RUNTIME_STATUS_CHANGED_CHANNEL,
} from '../shared/track-instrument-editor-contract';
import { createTrackEditorRuntimeStatusCoordinator } from './track-editor-runtime-status';

const request: TrackInstrumentEditorRequest = {
  track: {
    rootGroupId: 'group-1',
    trackId: 'track-1',
    projectSessionId: 3,
    projectRevision: 4,
  },
};

function makeSubscriber() {
  return {
    once: vi.fn(),
    send: vi.fn(),
  };
}

describe('Track editor runtime status coordinator', () => {
  it('starts inactive and publishes only changed activity with increasing sequences', () => {
    const coordinator = createTrackEditorRuntimeStatusCoordinator();
    const subscriber = makeSubscriber();
    coordinator.subscribe(subscriber, request);

    expect(coordinator.getStatus(subscriber, request)).toEqual({
      sequence: 0,
      playbackRunning: false,
      blueLiveRunning: false,
    });
    expect(coordinator.publish({ playbackRunning: false, blueLiveRunning: false })).toEqual({
      sequence: 0,
      playbackRunning: false,
      blueLiveRunning: false,
    });
    expect(coordinator.publish({ playbackRunning: true, blueLiveRunning: false })).toEqual({
      sequence: 1,
      playbackRunning: true,
      blueLiveRunning: false,
    });
    expect(coordinator.publish({ playbackRunning: true, blueLiveRunning: true })).toEqual({
      sequence: 2,
      playbackRunning: true,
      blueLiveRunning: true,
    });
    expect(subscriber.send).toHaveBeenNthCalledWith(
      1,
      TRACK_INSTRUMENT_RUNTIME_STATUS_CHANGED_CHANNEL,
      { sequence: 1, playbackRunning: true, blueLiveRunning: false },
    );
    expect(subscriber.send).toHaveBeenNthCalledWith(
      2,
      TRACK_INSTRUMENT_RUNTIME_STATUS_CHANGED_CHANNEL,
      { sequence: 2, playbackRunning: true, blueLiveRunning: true },
    );
  });

  it('removes destroyed and explicitly unsubscribed senders', () => {
    const coordinator = createTrackEditorRuntimeStatusCoordinator();
    const subscriber = makeSubscriber();
    coordinator.subscribe(subscriber, request);
    const destroyed = subscriber.once.mock.calls[0]?.[1] as (() => void) | undefined;
    destroyed?.();
    coordinator.publish({ playbackRunning: true, blueLiveRunning: false });
    expect(subscriber.send).not.toHaveBeenCalled();

    const secondSubscriber = makeSubscriber();
    coordinator.subscribe(secondSubscriber, request);
    coordinator.unsubscribe(secondSubscriber, request);
    coordinator.publish({ playbackRunning: false, blueLiveRunning: false });
    expect(secondSubscriber.send).not.toHaveBeenCalled();
  });

  it('drops a sender when delivery fails without affecting other senders', () => {
    const coordinator = createTrackEditorRuntimeStatusCoordinator();
    const failedSubscriber = makeSubscriber();
    const healthySubscriber = makeSubscriber();
    failedSubscriber.send.mockImplementation(() => {
      throw new Error('destroyed');
    });
    coordinator.subscribe(failedSubscriber, request);
    coordinator.subscribe(healthySubscriber, request);

    coordinator.publish({ playbackRunning: true, blueLiveRunning: false });
    coordinator.publish({ playbackRunning: false, blueLiveRunning: false });

    expect(failedSubscriber.send).toHaveBeenCalledTimes(1);
    expect(healthySubscriber.send).toHaveBeenCalledTimes(2);
  });

  it('does not let an old binding remove a newer binding for the same sender', () => {
    const coordinator = createTrackEditorRuntimeStatusCoordinator();
    const subscriber = makeSubscriber();
    const nextRequest: TrackInstrumentEditorRequest = {
      track: { ...request.track, trackId: 'track-2' },
    };

    coordinator.subscribe(subscriber, request);
    const oldDestroyed = subscriber.once.mock.calls[0]?.[1] as (() => void) | undefined;
    coordinator.subscribe(subscriber, nextRequest);
    oldDestroyed?.();
    coordinator.publish({ playbackRunning: true, blueLiveRunning: false });

    expect(subscriber.send).toHaveBeenCalledOnce();
    expect(coordinator.getStatus(subscriber, request)).toBeNull();
    expect(coordinator.getStatus(subscriber, nextRequest)).not.toBeNull();
  });
});