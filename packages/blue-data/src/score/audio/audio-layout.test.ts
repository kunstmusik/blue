import { describe, expect, it } from 'vitest';
import {
  createAudioLayoutManifest,
  resolveEffectiveTrackLayout,
  type AudioFileLayoutObservation,
} from './audio-layout';

describe('audio-layout types and resolution (T005)', () => {
  it('creates empty and populated manifests', () => {
    const empty = createAudioLayoutManifest();
    expect(empty.observations.size).toBe(0);

    const obs1: AudioFileLayoutObservation = {
      filePath: 'test/mono.wav',
      channels: 1,
      status: 'verified',
    };
    const manifest = createAudioLayoutManifest([['test/mono.wav', obs1]]);
    expect(manifest.observations.size).toBe(1);
    expect(manifest.observations.get('test/mono.wav')).toEqual(obs1);
  });

  it('resolves all-mono track to "mono" when every clip is verified 1-channel', () => {
    const obsMono: AudioFileLayoutObservation = {
      filePath: '/audio/mono1.wav',
      channels: 1,
      status: 'verified',
    };
    const obsMono2: AudioFileLayoutObservation = {
      filePath: '/audio/mono2.wav',
      channels: 1,
      status: 'verified',
    };
    const manifest = createAudioLayoutManifest([
      ['/audio/mono1.wav', obsMono],
      ['/audio/mono2.wav', obsMono2],
    ]);

    const layout = resolveEffectiveTrackLayout(['/audio/mono1.wav', '/audio/mono2.wav'], manifest);
    expect(layout).toBe('mono');
  });

  it('resolves to "stereo-or-unknown" if any clip is stereo or unsupported', () => {
    const obsMono: AudioFileLayoutObservation = {
      filePath: '/audio/mono.wav',
      channels: 1,
      status: 'verified',
    };
    const obsStereo: AudioFileLayoutObservation = {
      filePath: '/audio/stereo.wav',
      channels: 2,
      status: 'verified',
    };
    const manifest = createAudioLayoutManifest([
      ['/audio/mono.wav', obsMono],
      ['/audio/stereo.wav', obsStereo],
    ]);

    // Mixed track
    expect(resolveEffectiveTrackLayout(['/audio/mono.wav', '/audio/stereo.wav'], manifest)).toBe(
      'stereo-or-unknown',
    );

    // Only stereo
    expect(resolveEffectiveTrackLayout(['/audio/stereo.wav'], manifest)).toBe('stereo-or-unknown');
  });

  it('resolves to "stereo-or-unknown" if clip observation is missing or unreadable', () => {
    const manifest = createAudioLayoutManifest();
    expect(resolveEffectiveTrackLayout(['/audio/missing.wav'], manifest)).toBe('stereo-or-unknown');

    const unreadableManifest = createAudioLayoutManifest([
      [
        '/audio/corrupt.wav',
        { filePath: '/audio/corrupt.wav', channels: 'unsupported', status: 'unreadable' },
      ],
    ]);
    expect(resolveEffectiveTrackLayout(['/audio/corrupt.wav'], unreadableManifest)).toBe(
      'stereo-or-unknown',
    );
  });

  it('resolves to "stereo-or-unknown" if channel has upstream effects or unclassified sources', () => {
    const obsMono: AudioFileLayoutObservation = {
      filePath: '/audio/mono.wav',
      channels: 1,
      status: 'verified',
    };
    const manifest = createAudioLayoutManifest([['/audio/mono.wav', obsMono]]);

    expect(
      resolveEffectiveTrackLayout(['/audio/mono.wav'], manifest, { hasUpstreamEffects: true }),
    ).toBe('stereo-or-unknown');

    expect(
      resolveEffectiveTrackLayout(['/audio/mono.wav'], manifest, {
        hasStereoOrUnclassifiedSource: true,
      }),
    ).toBe('stereo-or-unknown');
  });
});
