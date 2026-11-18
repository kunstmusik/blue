import { describe, expect, it, beforeEach } from 'vite-plus/test';
import { useBlueLiveStore } from '../stores/blue-live-store';

describe('Blue Live status store', () => {
  beforeEach(() => {
    useBlueLiveStore.getState().reset();
  });

  it('starts with idle status', () => {
    const state = useBlueLiveStore.getState();
    expect(state.status).toBe('idle');
    expect(state.running).toBe(false);
    expect(state.sessionId).toBe(0);
    expect(state.initialized).toBe(false);
  });

  it('sets status from snapshot', () => {
    useBlueLiveStore.getState().setStatusFromSnapshot({
      status: 'running',
      running: true,
      message: 'Blue Live running',
      sessionId: 1,
      projectRevision: 42,
    });

    const state = useBlueLiveStore.getState();
    expect(state.status).toBe('running');
    expect(state.running).toBe(true);
    expect(state.message).toBe('Blue Live running');
    expect(state.sessionId).toBe(1);
    expect(state.projectRevision).toBe(42);
    expect(state.initialized).toBe(true);
  });

  it('resets to initial state', () => {
    useBlueLiveStore.getState().setStatusFromSnapshot({
      status: 'running',
      running: true,
      message: 'running',
      sessionId: 5,
    });
    useBlueLiveStore.getState().reset();

    const state = useBlueLiveStore.getState();
    expect(state.status).toBe('idle');
    expect(state.running).toBe(false);
    expect(state.sessionId).toBe(0);
    expect(state.initialized).toBe(false);
  });

  it('handles error status', () => {
    useBlueLiveStore.getState().setStatusFromSnapshot({
      status: 'error',
      running: false,
      message: 'Engine failed',
      sessionId: 2,
    });

    const state = useBlueLiveStore.getState();
    expect(state.status).toBe('error');
    expect(state.running).toBe(false);
    expect(state.message).toBe('Engine failed');
  });

  it('handles stopping status', () => {
    useBlueLiveStore.getState().setStatusFromSnapshot({
      status: 'stopping',
      running: false,
      sessionId: 3,
    });

    const state = useBlueLiveStore.getState();
    expect(state.status).toBe('stopping');
    expect(state.running).toBe(false);
  });
});
