// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MidiInputService } from '../services/midi-input-service';
import {
  FakeMidiAccess,
  FakeMidiInput,
  createFakeRequestMidiAccess,
} from './helpers/fake-midi-access';
import type {
  MidiInputServiceSnapshot,
  MidiNoteEvent,
  MidiNoteRouteResult,
} from '../../../shared/midi-input';

interface Deps {
  requestAccess: ReturnType<typeof createFakeRequestMidiAccess>;
  now: () => number;
  routeNote: (event: MidiNoteEvent) => Promise<MidiNoteRouteResult>;
  releaseSource: (sourceId: string) => Promise<void>;
  publishSnapshot: (snapshot: MidiInputServiceSnapshot) => void;
}

function makeDeps(access: FakeMidiAccess): { deps: Deps; published: MidiInputServiceSnapshot[]; routed: MidiNoteEvent[]; released: string[] } {
  const published: MidiInputServiceSnapshot[] = [];
  const routed: MidiNoteEvent[] = [];
  const released: string[] = [];
  return {
    deps: {
      requestAccess: createFakeRequestMidiAccess(access),
      now: () => 1,
      routeNote: async (event) => {
        routed.push(event);
        return { accepted: true };
      },
      releaseSource: async (sourceId) => {
        released.push(sourceId);
      },
      publishSnapshot: (snapshot) => {
        published.push(snapshot);
      },
    },
    published,
    routed,
    released,
  };
}

let service: MidiInputService | null = null;

afterEach(async () => {
  if (service) {
    await service.stop();
    service = null;
  }
});

describe('MidiInputService', () => {
  it('enables and opens newly discovered inputs by default', async () => {
    const input = new FakeMidiInput({ id: 'a', name: 'Alpha' });
    const access = new FakeMidiAccess({ inputs: [input] });
    const { deps, published, routed } = makeDeps(access);
    service = new MidiInputService(deps);

    await service.start();
    input.emitMessage([0x90, 60, 100]);
    await Promise.resolve();

    expect(input.connection).toBe('open');
    expect(published.at(-1)?.devices[0]).toMatchObject({
      id: 'a',
      enabled: true,
      connection: 'connected',
    });
    expect(routed).toHaveLength(1);
    expect(routed[0]).toMatchObject({
      type: 'noteOn',
      deviceId: 'a',
      midiNote: 60,
    });
    expect(published.some((snapshot) => (
      snapshot.devices.some((device) => device.id === 'a' && device.connection === 'connecting')
    ))).toBe(true);
  });

  it('keeps duplicate display names distinct by port ID', async () => {
    const first = new FakeMidiInput({ id: 'first', name: 'Controller' });
    const second = new FakeMidiInput({ id: 'second', name: 'Controller' });
    const access = new FakeMidiAccess({ inputs: [first, second] });
    const { deps, published } = makeDeps(access);
    service = new MidiInputService(deps);

    await service.start();

    expect(published.at(-1)?.devices.map((device) => device.id).sort()).toEqual([
      'first',
      'second',
    ]);
    expect(first.connection).toBe('open');
    expect(second.connection).toBe('open');
  });

  it('publishes an unsupported snapshot when requestMIDIAccess is unavailable', async () => {
    const published: MidiInputServiceSnapshot[] = [];
    service = new MidiInputService({
      requestAccess: async () => {
        throw new Error('Web MIDI is not supported by this browser runtime');
      },
      now: () => 1,
      routeNote: async () => ({ accepted: false }),
      releaseSource: async () => {},
      publishSnapshot: (s) => published.push(s),
    });
    await service.start();
    const last = published.at(-1);
    expect(last?.phase).toBe('unsupported');
  });

  it('distinguishes permission denial from other access failures', async () => {
    const published: MidiInputServiceSnapshot[] = [];
    const denied = Object.assign(new Error('MIDI permission denied'), {
      name: 'NotAllowedError',
    });
    service = new MidiInputService({
      requestAccess: async () => { throw denied; },
      now: () => 1,
      routeNote: async () => ({ accepted: false }),
      releaseSource: async () => {},
      publishSnapshot: (snapshot) => published.push(snapshot),
    });
    await service.start();
    expect(published.at(-1)?.phase).toBe('denied');

    await service.stop();
    service = new MidiInputService({
      requestAccess: async () => { throw new Error('MIDI subsystem failed'); },
      now: () => 1,
      routeNote: async () => ({ accepted: false }),
      releaseSource: async () => {},
      publishSnapshot: (snapshot) => published.push(snapshot),
    });
    await service.start();
    expect(published.at(-1)?.phase).toBe('error');
  });

  it('discovers available inputs and merges remembered missing devices', async () => {
    const live = new FakeMidiInput({ id: 'a', name: 'Alpha', manufacturer: 'M', version: '1' });
    const access = new FakeMidiAccess({ inputs: [live] });
    const { deps, published } = makeDeps(access);
    service = new MidiInputService(deps);

    await service.start();
    // Apply a preference with both the live and a missing device.
    await service.reconcile({
      devices: [
        { id: 'a', name: 'Alpha', manufacturer: 'M', version: '1', enabled: true },
        { id: 'missing', name: 'Remembered', manufacturer: '', version: '', enabled: true },
      ],
    });

    const last = published.at(-1)!;
    expect(last.devices).toHaveLength(2);
    const liveRow = last.devices.find((d) => d.id === 'a');
    const missingRow = last.devices.find((d) => d.id === 'missing');
    expect(liveRow?.availability).toBe('available');
    expect(liveRow?.enabled).toBe(true);
    expect(liveRow?.connection).toBe('connected');
    expect(missingRow?.availability).toBe('unavailable');
    expect(missingRow?.connection).toBe('closed');
    // phase is partial because one enabled device is unavailable
    expect(last.phase).toBe('partial');
  });

  it('opens only enabled inputs and closes when disabled', async () => {
    const a = new FakeMidiInput({ id: 'a', name: 'A' });
    const b = new FakeMidiInput({ id: 'b', name: 'B' });
    const access = new FakeMidiAccess({ inputs: [a, b] });
    const { deps } = makeDeps(access);
    service = new MidiInputService(deps);

    await service.start();
    await service.reconcile({
      devices: [
        { id: 'a', name: 'A', manufacturer: '', version: '', enabled: true },
        { id: 'b', name: 'B', manufacturer: '', version: '', enabled: false },
      ],
    });

    expect(a.connection).toBe('open');
    expect(b.connection).toBe('closed');

    // Now disable a — port should close and source released.
    await service.reconcile({
      devices: [
        { id: 'a', name: 'A', manufacturer: '', version: '', enabled: false },
        { id: 'b', name: 'B', manufacturer: '', version: '', enabled: false },
      ],
    });
    expect(a.connection).toBe('closed');
  });

  it('applies the latest preference after an older close finishes', async () => {
    const input = new FakeMidiInput({ id: 'a', name: 'A' });
    const access = new FakeMidiAccess({ inputs: [input] });
    const { deps, published } = makeDeps(access);
    service = new MidiInputService(deps);
    const open = vi.spyOn(input, 'open');
    await service.start();

    let finishClose: (() => void) | null = null;
    let closeCalls = 0;
    input.close = vi.fn(async () => {
      closeCalls += 1;
      if (closeCalls === 1) {
        await new Promise<void>((resolve) => {
          finishClose = resolve;
        });
      }
      input.connection = 'closed';
    });
    const disabled = {
      devices: [{ id: 'a', name: 'A', manufacturer: '', version: '', enabled: false }],
    };
    const enabled = {
      devices: [{ id: 'a', name: 'A', manufacturer: '', version: '', enabled: true }],
    };

    const disabling = service.reconcile(disabled);
    await Promise.resolve();
    const reenabling = service.reconcile(enabled);
    await Promise.resolve();
    finishClose?.();
    await Promise.all([disabling, reenabling]);

    expect(input.connection).toBe('open');
    expect(open).toHaveBeenCalledTimes(2);
    expect(published.some((snapshot) => (
      snapshot.devices.some((device) => device.id === 'a' && device.connection === 'disconnecting')
    ))).toBe(true);
  });

  it('coalesces repeated rescan calls', async () => {
    const a = new FakeMidiInput({ id: 'a', name: 'A' });
    const access = new FakeMidiAccess({ inputs: [a] });
    const { deps } = makeDeps(access);
    service = new MidiInputService(deps);
    await service.start();
    await service.reconcile({
      devices: [{ id: 'a', name: 'A', manufacturer: '', version: '', enabled: true }],
    });
    const openCalls = vi.spyOn(a, 'open');

    await Promise.all([service.rescan(), service.rescan(), service.rescan()]);
    // open() is called at least once but no more than twice (coalesce + flush).
    expect(openCalls.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('does not multiply note delivery across repeated rescans', async () => {
    const input = new FakeMidiInput({ id: 'a', name: 'A' });
    const access = new FakeMidiAccess({ inputs: [input] });
    const { deps, routed } = makeDeps(access);
    service = new MidiInputService(deps);
    await service.start();

    await service.rescan();
    await service.rescan();
    await service.rescan();
    input.emitMessage([0x90, 60, 100]);
    await Promise.resolve();

    expect(routed).toHaveLength(1);
  });

  it('parses note-on/note-off bytes and routes them with source identity', async () => {
    const a = new FakeMidiInput({ id: 'a', name: 'A' });
    const access = new FakeMidiAccess({ inputs: [a] });
    const { deps, routed } = makeDeps(access);
    service = new MidiInputService(deps);
    await service.start();
    await service.reconcile({
      devices: [{ id: 'a', name: 'A', manufacturer: '', version: '', enabled: true }],
    });

    // note-on channel 0, note 60, velocity 100
    a.emitMessage([0x90, 60, 100], 5);
    // note-off channel 0, note 60, velocity 0 (velocity-zero normalization for 0x90)
    a.emitMessage([0x90, 60, 0], 6);
    // explicit 0x80 note-off channel 1, note 72
    a.emitMessage([0x81, 72, 64], 7);
    // non-note message: control change — ignored
    a.emitMessage([0xb0, 1, 64], 8);

    // Wait for the next microtask so async routeNote resolves.
    await Promise.resolve();
    await Promise.resolve();

    const types = routed.map((r) => ({ type: r.type, channel: r.channel, midiNote: r.midiNote, sourceId: r.sourceId }));
    expect(types).toEqual([
      { type: 'noteOn', channel: 0, midiNote: 60, sourceId: 'midi:a' },
      { type: 'noteOff', channel: 0, midiNote: 60, sourceId: 'midi:a' },
      { type: 'noteOff', channel: 1, midiNote: 72, sourceId: 'midi:a' },
    ]);
    // Non-note message was dropped.
    expect(routed).toHaveLength(3);
  });

  it('ignores messages from disabled or stale ports', async () => {
    const a = new FakeMidiInput({ id: 'a', name: 'A' });
    const access = new FakeMidiAccess({ inputs: [a] });
    const { deps, routed } = makeDeps(access);
    service = new MidiInputService(deps);
    await service.start();
    await service.reconcile({
      devices: [{ id: 'a', name: 'A', manufacturer: '', version: '', enabled: true }],
    });

    // disable the device; subsequent messages must not route
    await service.reconcile({
      devices: [{ id: 'a', name: 'A', manufacturer: '', version: '', enabled: false }],
    });
    a.emitMessage([0x90, 60, 100]);
    await Promise.resolve();
    expect(routed).toHaveLength(0);
  });

  it('handles hot-plug statechange by reconciling new ports', async () => {
    const a = new FakeMidiInput({ id: 'a', name: 'A' });
    const access = new FakeMidiAccess({ inputs: [a] });
    const { deps } = makeDeps(access);
    service = new MidiInputService(deps);
    await service.start();
    await service.reconcile({
      devices: [{ id: 'a', name: 'A', manufacturer: '', version: '', enabled: true }],
    });
    const rescan = vi.spyOn(service, 'rescan');

    const b = new FakeMidiInput({ id: 'b', name: 'B' });
    // Simulate hot-plug
    access.addInput(b);
    // Allow microtasks to flush the async rescan
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(rescan).toHaveBeenCalledTimes(1);
    expect(b.connection).toBe('open');
  });

  it('releases a removed source and ignores its stale port callback', async () => {
    const original = new FakeMidiInput({ id: 'a', name: 'A' });
    const access = new FakeMidiAccess({ inputs: [original] });
    const { deps, routed, released } = makeDeps(access);
    service = new MidiInputService(deps);
    await service.start();
    const staleCallback = original.onmidimessage;

    const replacement = new FakeMidiInput({ id: 'a', name: 'A replacement' });
    access.inputs.set('a', replacement);
    await service.rescan();
    staleCallback?.({
      data: new Uint8Array([0x90, 60, 100]),
      target: original,
      timeStamp: 1,
    });
    replacement.emitMessage([0x90, 61, 100]);
    await Promise.resolve();

    expect(released).toContain('midi:a');
    expect(routed.map((event) => event.midiNote)).toEqual([61]);
  });

  it('isolates one device failure from another', async () => {
    const a = new FakeMidiInput({ id: 'a', name: 'A' });
    a.open = async () => { throw new Error('open failed'); };
    const b = new FakeMidiInput({ id: 'b', name: 'B' });
    const access = new FakeMidiAccess({ inputs: [a, b] });
    const { deps, published } = makeDeps(access);
    service = new MidiInputService(deps);
    await service.start();
    await service.reconcile({
      devices: [
        { id: 'a', name: 'A', manufacturer: '', version: '', enabled: true },
        { id: 'b', name: 'B', manufacturer: '', version: '', enabled: true },
      ],
    });
    const last = published.at(-1)!;
    const aRow = last.devices.find((d) => d.id === 'a');
    const bRow = last.devices.find((d) => d.id === 'b');
    expect(aRow?.lastError).toContain('open failed');
    expect(aRow?.connection).toBe('error');
    expect(bRow?.connection).toBe('connected');
    // partial because one failed and one is connected
    expect(last.phase).toBe('partial');
  });
});
