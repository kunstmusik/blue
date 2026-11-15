import type { ScoreRowObjectSnapshot } from '../types';
import GenericScoreObjectBar from './GenericScoreObjectBar';
import CommentScoreObjectBar from './CommentScoreObjectBar';
import LetterScoreObjectBar from './LetterScoreObjectBar';
import PianoRollScoreObjectBar from './PianoRollScoreObjectBar';
import AudioFileScoreObjectBar from './AudioFileScoreObjectBar';
import FrozenSoundObjectBar from './FrozenSoundObjectBar';
import AudioClipBar from './AudioClipBar';

export interface BarRendererProps {
  item: ScoreRowObjectSnapshot;
  selected: boolean;
  pixelsPerBeat: number;
  pixelsPerSecond?: number;
  rowHeight: number;
  durationBeats: number;
  startBeats?: number;
}

export function getScoreObjectBarRenderer(
  snapshot: ScoreRowObjectSnapshot['barRenderer'],
): React.ComponentType<BarRendererProps> {
  switch (snapshot.kind) {
    case 'comment':
      return CommentScoreObjectBar;
    case 'letter':
      return LetterScoreObjectBar;
    case 'pianoRoll':
      return PianoRollScoreObjectBar;
    case 'audioFile':
      return AudioFileScoreObjectBar;
    case 'frozenSoundObject':
      return FrozenSoundObjectBar;
    case 'audioClip':
      return AudioClipBar;
    case 'generic':
    case 'fallback':
    default:
      return GenericScoreObjectBar;
  }
}

import React from 'react';

export function RenderBar(props: BarRendererProps): React.ReactElement {
  const Renderer = getScoreObjectBarRenderer(props.item.barRenderer);
  return <Renderer {...props} />;
}
