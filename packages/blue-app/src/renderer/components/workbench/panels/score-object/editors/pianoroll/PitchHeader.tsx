import React, { useMemo } from 'react';
import type { NoteSnapshot, ScaleSnapshot } from './types';
import { OCTAVES, CENTER_OCTAVE, NOTE_NAMES_FULL, GENERATE_MIDI, MIDI_NOTE_COUNT, PITCH_HEADER_WIDTH } from './types';

interface PitchHeaderProps {
  notes: NoteSnapshot[];
  selectedIndices: Set<number>;
  scale: ScaleSnapshot;
  noteHeight: number;
  pchGenerationMethod: number;
}

export default function PitchHeader({ notes, selectedIndices, scale, noteHeight, pchGenerationMethod }: PitchHeaderProps): React.ReactElement {
  const isMidi = pchGenerationMethod === GENERATE_MIDI;
  const numDegrees = isMidi ? 12 : (scale.ratios.length || 12);
  const minOctave = CENTER_OCTAVE - Math.floor(OCTAVES / 2);
  const totalRows = isMidi ? MIDI_NOTE_COUNT : OCTAVES * numDegrees;
  const totalHeight = totalRows * noteHeight;

  const rows = useMemo(() => {
    const result: Array<{ y: number; label: string; isOctave: boolean }> = [];

    if (isMidi) {
      for (let midi = MIDI_NOTE_COUNT - 1; midi >= 0; midi--) {
        const octave = Math.floor(midi / 12);
        const degree = midi % 12;
        const y = (MIDI_NOTE_COUNT - 1 - midi) * noteHeight;
        const isC = degree === 0;
        let label = '';
        if (isC) {
          label = `C${octave}`;
        } else if (noteHeight >= 10) {
          label = NOTE_NAMES_FULL[degree] ?? '';
        }
        result.push({ y, label, isOctave: isC });
      }
    } else {
      for (let oct = minOctave + OCTAVES - 1; oct >= minOctave; oct--) {
        for (let deg = numDegrees - 1; deg >= 0; deg--) {
          const rowFromTop = (OCTAVES - 1 - (oct - minOctave)) * numDegrees + (numDegrees - 1 - deg);
          const isOctave = deg === 0;
          let label = '';
          if (isOctave) {
            label = `${oct}.00`;
          } else if (noteHeight >= 10) {
            label = deg < 10 ? `0${deg}` : `${deg}`;
          }
          result.push({ y: rowFromTop * noteHeight, label, isOctave });
        }
      }
    }
    return result;
  }, [isMidi, numDegrees, noteHeight, minOctave]);

  const selectedHighlights = useMemo(() => {
    return [...selectedIndices].map((i) => {
      const n = notes[i];
      if (!n) return null;
      let y: number;
      if (isMidi) {
        const midiNote = n.octave * 12 + n.scaleDegree;
        y = (MIDI_NOTE_COUNT - 1 - midiNote) * noteHeight;
      } else {
        const rowFromTop = (OCTAVES - 1 - (n.octave - minOctave)) * numDegrees + (numDegrees - 1 - n.scaleDegree);
        y = rowFromTop * noteHeight;
      }
      return { key: i, y };
    }).filter(Boolean);
  }, [selectedIndices, notes, noteHeight, isMidi, numDegrees, minOctave]);

  return (
    <div className="relative bg-app-surface-strong" style={{ width: PITCH_HEADER_WIDTH, height: totalHeight }}>
      {rows.map((row, i) => (
        <div key={`ph-${i}`}
          className="absolute left-0 right-0 border-b"
          style={{
            top: row.y,
            height: noteHeight,
            borderColor: row.isOctave ? 'rgba(100,150,255,0.25)' : 'rgba(255,255,255,0.06)',
          }}
        >
          {row.label && (
            <span className="absolute right-1 text-micro leading-none select-none" style={{ top: Math.max(1, (noteHeight - 10) / 2), color: row.isOctave ? 'rgba(198,226,255,0.9)' : 'rgba(198,226,255,0.45)' }}>
              {row.label}
            </span>
          )}
        </div>
      ))}
      {selectedHighlights.map((h) => h && (
        <div key={`hl-${h.key}`}
          className="absolute left-0"
          style={{
            top: h.y,
            width: 4,
            height: noteHeight,
            backgroundColor: 'color-mix(in srgb, var(--color-app-success) 70%, var(--color-app-clear))',
          }}
        />
      ))}
    </div>
  );
}
