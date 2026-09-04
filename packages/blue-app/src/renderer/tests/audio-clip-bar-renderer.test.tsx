import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, it, expect } from 'vitest';
import {
  getAudioFadeValue,
  buildFadePolygon,
} from '../components/workbench/panels/score/bar-renderers/audio-fade-renderer';
import AudioClipBar from '../components/workbench/panels/score/bar-renderers/AudioClipBar';
import AudioFileScoreObjectBar from '../components/workbench/panels/score/bar-renderers/AudioFileScoreObjectBar';
import FrozenSoundObjectBar from '../components/workbench/panels/score/bar-renderers/FrozenSoundObjectBar';
import {
  buildWaveformCacheKey,
  buildWaveformPathData,
  clearWaveformCache,
  setWaveformCacheEntry,
  summarizeWaveformChannels,
  summarizeAiffPcmBytes,
} from '../components/workbench/panels/score/bar-renderers/waveform-cache';
import type { AudioFadeType } from '../../shared/project-editor';
import { buildAiffBytes } from '@blue/data';

afterEach(() => {
  clearWaveformCache();
});

describe('AudioClip bar renderer', () => {
  describe('fade curves', () => {
    const fadeTypes: AudioFadeType[] = ['LINEAR', 'CONSTANT_POWER', 'SYMMETRIC', 'FAST', 'SLOW'];
    const tolerance = 0.02;

    for (const fadeType of fadeTypes) {
      describe(`${fadeType}`, () => {
        it('fade-in starts at 0 and ends at 1', () => {
          const start = getAudioFadeValue(0, fadeType, true);
          const end = getAudioFadeValue(1, fadeType, true);
          expect(start).toBeGreaterThanOrEqual(-tolerance);
          expect(start).toBeLessThanOrEqual(tolerance);
          expect(end).toBeGreaterThanOrEqual(1 - tolerance);
          expect(end).toBeLessThanOrEqual(1 + tolerance);
        });

        it('fade-out starts at 1 and ends at 0', () => {
          const start = getAudioFadeValue(0, fadeType, false);
          const end = getAudioFadeValue(1, fadeType, false);
          expect(start).toBeGreaterThanOrEqual(1 - tolerance);
          expect(start).toBeLessThanOrEqual(1 + tolerance);
          expect(end).toBeGreaterThanOrEqual(-tolerance);
          expect(end).toBeLessThanOrEqual(tolerance);
        });

        it('fade values are monotonically increasing for fade-in', () => {
          let prev = getAudioFadeValue(0, fadeType, true);
          for (let i = 1; i <= 10; i++) {
            const x = i / 10;
            const val = getAudioFadeValue(x, fadeType, true);
            expect(val).toBeGreaterThanOrEqual(prev - tolerance);
            prev = val;
          }
        });

        it('fade values are monotonically decreasing for fade-out', () => {
          let prev = getAudioFadeValue(0, fadeType, false);
          for (let i = 1; i <= 10; i++) {
            const x = i / 10;
            const val = getAudioFadeValue(x, fadeType, false);
            expect(val).toBeLessThanOrEqual(prev + tolerance);
            prev = val;
          }
        });
      });
    }

    it('clamps x to [0, 1]', () => {
      expect(getAudioFadeValue(-0.5, 'LINEAR', true)).toBeCloseTo(0);
      expect(getAudioFadeValue(1.5, 'LINEAR', true)).toBeCloseTo(1);
    });

    it('matches the Java slow fade-in midpoint', () => {
      expect(getAudioFadeValue(0.5, 'SLOW', true)).toBeCloseTo(0.097162795158, 6);
    });
  });

  describe('buildFadePolygon', () => {
    it('returns null for zero fade time', () => {
      expect(buildFadePolygon(0, 100, 44, 'LINEAR', true, 0)).toBeNull();
    });

    it('returns null for very small fade (< 2px)', () => {
      expect(buildFadePolygon(0.001, 100, 44, 'LINEAR', true, 0)).toBeNull();
    });

    it('returns polygon string for valid fade', () => {
      const poly = buildFadePolygon(2.0, 100, 44, 'LINEAR', true, 0);
      expect(poly).toBeTruthy();
      const points = poly!.split(',').length;
      expect(points).toBeGreaterThan(4);
    });

    it('fade-out polygon includes correct corner points', () => {
      const poly = buildFadePolygon(1.0, 100, 44, 'LINEAR', false, 50);
      expect(poly).toBeTruthy();
    });

    for (const fadeType of ['LINEAR', 'CONSTANT_POWER', 'FAST', 'SLOW'] as AudioFadeType[]) {
      it(`builds valid polygon for ${fadeType}`, () => {
        const poly = buildFadePolygon(2.0, 100, 44, fadeType, true, 0);
        expect(poly).toBeTruthy();
      });
    }

    it('produces distinct polygons for different fade types', () => {
      const linear = buildFadePolygon(2.0, 100, 44, 'LINEAR', true, 0);
      const constantPower = buildFadePolygon(2.0, 100, 44, 'CONSTANT_POWER', true, 0);
      const slow = buildFadePolygon(2.0, 100, 44, 'SLOW', true, 0);

      expect(constantPower).not.toEqual(linear);
      expect(slow).not.toEqual(linear);
      expect(slow).not.toEqual(constantPower);
    });
  });

  describe('waveform helpers', () => {
    it('summarizes channel samples into min/max buckets', () => {
      const channels = summarizeWaveformChannels([Float32Array.from([-1, -0.5, 0, 0.5, 1])], 5, 5);

      expect(channels).toHaveLength(1);
      expect(channels[0]!.min).toEqual([-1, -0.5, 0, 0.5, 1]);
      expect(channels[0]!.max).toEqual([-1, -0.5, 0, 0.5, 1]);
    });

    it('summarizes uncompressed AIFF PCM when Chromium cannot decode it', () => {
      const comm = buildAiffBytes(1, 4, 16, 4);
      const bytes = new Uint8Array(comm.length + 24);
      bytes.set(comm);
      const writeU32 = (offset: number, value: number) => {
        bytes[offset] = (value >>> 24) & 0xff;
        bytes[offset + 1] = (value >>> 16) & 0xff;
        bytes[offset + 2] = (value >>> 8) & 0xff;
        bytes[offset + 3] = value & 0xff;
      };
      writeU32(4, bytes.length - 8);
      bytes.set([0x53, 0x53, 0x4e, 0x44], comm.length); // SSND
      writeU32(comm.length + 4, 16);
      // offset and block size remain zero; four signed 16-bit samples follow.
      bytes.set([0x80, 0, 0, 0, 0x7f, 0xff, 0xc0, 0], comm.length + 16);

      const channels = summarizeAiffPcmBytes(bytes, 4);

      expect(channels).toHaveLength(1);
      expect(channels![0]!.min).toEqual([-1, 0, 32767 / 32768, -0.5]);
      expect(channels![0]!.max).toEqual([-1, 0, 32767 / 32768, -0.5]);
    });

    it('keeps stereo AIFF PCM channels separate', () => {
      const comm = buildAiffBytes(2, 2, 16, 4);
      const bytes = new Uint8Array(comm.length + 24);
      bytes.set(comm);
      const writeU32 = (offset: number, value: number) => {
        bytes[offset] = (value >>> 24) & 0xff;
        bytes[offset + 1] = (value >>> 16) & 0xff;
        bytes[offset + 2] = (value >>> 8) & 0xff;
        bytes[offset + 3] = value & 0xff;
      };
      writeU32(4, bytes.length - 8);
      bytes.set([0x53, 0x53, 0x4e, 0x44], comm.length); // SSND
      writeU32(comm.length + 4, 16);
      // Two stereo frames: left [-1, 0.25], right [0.5, -0.5].
      bytes.set([0x80, 0, 0x40, 0, 0x20, 0, 0xc0, 0], comm.length + 16);

      const channels = summarizeAiffPcmBytes(bytes, 4);

      expect(channels).toHaveLength(2);
      expect(channels![0]).toEqual({ min: [-1, 0.25], max: [-1, 0.25] });
      expect(channels![1]).toEqual({ min: [0.5, -0.5], max: [0.5, -0.5] });
    });

    it('builds looping waveform path data with file-start offsets', () => {
      const paths = buildWaveformPathData(
        {
          key: buildWaveformCacheKey('aclp:test.wav', 8),
          filePath: 'test.wav',
          pixelSecond: 8,
          loading: false,
          channels: [
            {
              min: [-1, -0.5, -0.25, -0.75, -0.1, -0.2, -0.3, -0.4],
              max: [1, 0.5, 0.25, 0.75, 0.1, 0.2, 0.3, 0.4],
            },
          ],
        },
        {
          width: 4,
          height: 20,
          pixelsPerBeat: 4,
          startOffsetBeats: 0.5,
          looping: true,
        },
      );

      expect(paths).toHaveLength(1);
      expect(paths[0]).toContain('M0.5');
      expect(paths[0]).toContain('L0.5');
      expect(paths[0]).toContain('M1.5');
    });

    it('stacks stereo waveform paths into equal-height channel bands', () => {
      const paths = buildWaveformPathData(
        {
          key: buildWaveformCacheKey('fso:frozen5.aif', 1),
          filePath: 'frozen5.aif',
          pixelSecond: 1,
          loading: false,
          channels: [
            { min: [-1], max: [1] },
            { min: [-1], max: [1] },
          ],
        },
        {
          width: 1,
          height: 40,
          pixelsPerBeat: 1,
        },
      );

      expect(paths).toEqual(['M0.5 0 L0.5 20', 'M0.5 20 L0.5 40']);
    });
  });

  it('renders waveform SVG when cached waveform data is available', () => {
    const cacheKey = buildWaveformCacheKey('aclp:clip.wav', 100);
    setWaveformCacheEntry({
      key: cacheKey,
      filePath: 'clip.wav',
      pixelSecond: 100,
      loading: false,
      channels: [
        {
          min: [-1, -0.2, -0.4, -0.1],
          max: [1, 0.2, 0.4, 0.1],
        },
      ],
    });

    const html = renderToStaticMarkup(
      <AudioClipBar
        item={{
          objectId: 'audio-clip-1',
          objectType: 'AudioClip',
          name: 'Clip',
          startBeats: 0,
          durationBeats: 2,
          startTimeBase: 'BEATS',
          durationTimeBase: 'BEATS',
          backgroundColor: 0x669966,
          isContainer: false,
          barRenderer: {
            kind: 'audioClip',
            labelLines: ['Clip'],
            audioFilePath: 'clip.wav',
            waveformKey: 'aclp:clip.wav',
            fileStartTimeBeats: 0.5,
            audioDurationBeats: 2,
            looping: true,
            fadeInBeats: 0,
            fadeInType: 'LINEAR',
            fadeOutBeats: 0,
            fadeOutType: 'LINEAR',
          },
        }}
        selected={false}
        pixelsPerBeat={100}
        rowHeight={44}
        durationBeats={2}
      />,
    );

    expect(html).toContain('data-waveform-key="aclp:clip.wav"');
    expect(html).toContain(
      'background:linear-gradient(180deg, rgba(145,218,145,0.761) 0%, rgba(102,153,102,0.761) 6px)',
    );
    expect(html).toContain('<svg');
    expect(html).toContain('<path');
  });

  it('renders selected audio clips with Java-style translucent white fill and waveform', () => {
    const cacheKey = buildWaveformCacheKey('aclp:selected.wav', 100);
    setWaveformCacheEntry({
      key: cacheKey,
      filePath: 'selected.wav',
      pixelSecond: 100,
      loading: false,
      channels: [
        {
          min: [-1, -0.25, -0.5, -0.1],
          max: [1, 0.25, 0.5, 0.1],
        },
      ],
    });

    const html = renderToStaticMarkup(
      <AudioClipBar
        item={{
          objectId: 'audio-clip-selected',
          objectType: 'AudioClip',
          name: 'Clip',
          startBeats: 0,
          durationBeats: 2,
          startTimeBase: 'BEATS',
          durationTimeBase: 'BEATS',
          backgroundColor: 0x225588,
          isContainer: false,
          barRenderer: {
            kind: 'audioClip',
            labelLines: ['Clip'],
            audioFilePath: 'selected.wav',
            waveformKey: 'aclp:selected.wav',
            fileStartTimeBeats: 0,
            audioDurationBeats: 2,
            looping: false,
            fadeInBeats: 0,
            fadeInType: 'LINEAR',
            fadeOutBeats: 0,
            fadeOutType: 'LINEAR',
          },
        }}
        selected={true}
        pixelsPerBeat={100}
        rowHeight={44}
        durationBeats={2}
      />,
    );

    expect(html).toContain(
      'background:linear-gradient(180deg, rgba(255,255,255,0.502) 0%, rgba(255,255,255,0.502) 6px)',
    );
    expect(html).toContain('background-color:#000000');
    expect(html).toContain('stroke="rgba(255,255,255,0.502)"');
  });

  it('renders fade polygons with Java-style translucency and inner offsets', () => {
    const html = renderToStaticMarkup(
      <AudioClipBar
        item={{
          objectId: 'audio-clip-fade',
          objectType: 'AudioClip',
          name: 'Clip',
          startBeats: 0,
          durationBeats: 2,
          startTimeBase: 'BEATS',
          durationTimeBase: 'BEATS',
          backgroundColor: 0x222222,
          isContainer: false,
          barRenderer: {
            kind: 'audioClip',
            labelLines: ['Clip'],
            audioFilePath: 'clip.wav',
            waveformKey: null,
            fileStartTimeBeats: 0,
            audioDurationBeats: 2,
            looping: false,
            fadeInBeats: 1,
            fadeInType: 'SLOW',
            fadeOutBeats: 0,
            fadeOutType: 'LINEAR',
          },
        }}
        selected={false}
        pixelsPerBeat={100}
        rowHeight={44}
        durationBeats={2}
      />,
    );

    expect(html).toContain('fill="rgba(255,255,255,0.251)"');
    expect(html).toContain('top:2px');
    expect(html).toContain('left:1px');
    expect(html).toContain('height:40px');
  });

  it('renders AudioFile labels across multiple lines', () => {
    const html = renderToStaticMarkup(
      <AudioFileScoreObjectBar
        item={{
          objectId: 'audio-file-1',
          objectType: 'AudioFile',
          name: 'Upper\\nLower',
          startBeats: 0,
          durationBeats: 2,
          startTimeBase: 'BEATS',
          durationTimeBase: 'BEATS',
          backgroundColor: 0x336699,
          isContainer: false,
          barRenderer: {
            kind: 'audioFile',
            labelLines: ['Upper', 'Lower'],
            audioFilePath: 'audio.wav',
            waveformKey: null,
          },
        }}
        selected={false}
        pixelsPerBeat={100}
        rowHeight={44}
        durationBeats={2}
      />,
    );

    expect(html).toContain('>Upper<');
    expect(html).toContain('>Lower<');
  });

  it('renders FrozenSoundObject labels across multiple lines and the extended-duration shade', () => {
    const html = renderToStaticMarkup(
      <FrozenSoundObjectBar
        item={{
          objectId: 'frozen-1',
          objectType: 'FrozenSoundObject',
          name: 'Frozen\\nTail',
          startBeats: 0,
          durationBeats: 4,
          startTimeBase: 'BEATS',
          durationTimeBase: 'BEATS',
          backgroundColor: 0x000000,
          isContainer: false,
          barRenderer: {
            kind: 'frozenSoundObject',
            labelLines: ['Frozen', 'Tail'],
            frozenWaveFileName: 'frozen.wav',
            waveformKey: null,
            originalDurationBeats: 2,
            currentDurationBeats: 4,
          },
        }}
        selected={false}
        pixelsPerBeat={100}
        rowHeight={44}
        durationBeats={4}
      />,
    );

    expect(html).toContain('>Frozen<');
    expect(html).toContain('>Tail<');
    expect(html).toContain('background-color:var(--color-app-shadow)');
  });

  it('renders both frozen stereo channels across the Java-style inner height', () => {
    const cacheKey = buildWaveformCacheKey('fso:frozen5.aif', 100);
    setWaveformCacheEntry({
      key: cacheKey,
      filePath: 'frozen5.aif',
      pixelSecond: 100,
      loading: false,
      channels: [
        { min: [-1, -0.25], max: [1, 0.25] },
        { min: [-0.5, -0.1], max: [0.5, 0.1] },
      ],
    });

    const html = renderToStaticMarkup(
      <FrozenSoundObjectBar
        item={{
          objectId: 'frozen-stereo',
          objectType: 'FrozenSoundObject',
          name: 'Frozen Stereo',
          startBeats: 0,
          durationBeats: 4,
          startTimeBase: 'BEATS',
          durationTimeBase: 'BEATS',
          backgroundColor: 0x000000,
          isContainer: false,
          barRenderer: {
            kind: 'frozenSoundObject',
            labelLines: ['Frozen Stereo'],
            frozenWaveFileName: 'frozen5.aif',
            waveformKey: 'fso:frozen5.aif',
            originalDurationBeats: 4,
            currentDurationBeats: 4,
          },
        }}
        selected={false}
        pixelsPerBeat={100}
        rowHeight={44}
        durationBeats={4}
      />,
    );

    expect(html).toContain('data-waveform-key="fso:frozen5.aif"');
    expect(html).toContain('height="40"');
    expect(html.match(/<path/g)).toHaveLength(2);
  });
});
