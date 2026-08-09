import React from 'react';
import type {
  ScoreObjectEditorDocumentSnapshot,
  ScorePatch,
  TypeSpecificScoreObjectEditorSnapshot,
  UdoDefinitionSnapshot,
} from '../../../../../shared/project-editor';
import ClojureObjectEditor from './editors/ClojureObjectEditor';
import CodeBackedScoreObjectEditor from './editors/CodeBackedScoreObjectEditor';
import JavaScriptObjectEditor from './editors/JavaScriptObjectEditor';
import ExternalScoreObjectEditor from './editors/ExternalScoreObjectEditor';
import AudioClipScoreObjectEditor from './editors/AudioClipScoreObjectEditor';
import FileBackedScoreObjectEditor from './editors/FileBackedScoreObjectEditor';
import PatternObjectEditor from './editors/PatternObjectEditor';
import LineObjectEditor from './editors/LineObjectEditor';
import ZakLineObjectEditor from './editors/ZakLineObjectEditor';
import PianoRollEditor from './editors/PianoRollEditor';
import PolyObjectScoreObjectEditor from './editors/PolyObjectScoreObjectEditor';
import TrackerScoreObjectEditor from './editors/TrackerScoreObjectEditor';
import ObjectBuilderScoreObjectEditor from './editors/ObjectBuilderScoreObjectEditor';

import JMaskEditor from './editors/JMaskEditor';
import SoundEditor from './editors/SoundEditor';
import PolyObjectEditor from './editors/PolyObjectEditor';
import TrackerObjectEditor from './editors/TrackerObjectEditor';
import UnsupportedScoreObjectEditor from './editors/UnsupportedScoreObjectEditor';

export interface ScoreObjectEditorComponentProps {
  document: ScoreObjectEditorDocumentSnapshot;
  onPatch: (patch: ScorePatch) => void;
  /**
   * Project-global UDO definitions available to score-object editors whose
   * underlying instrument exposes orchestra-code fields (e.g. a Sound's BSB).
   * Library-backed score objects omit this so project UDOs never leak in.
   */
  projectUdos?: readonly UdoDefinitionSnapshot[];
}

export type ScoreObjectEditorComponent = React.ComponentType<ScoreObjectEditorComponentProps>;

function resolveStructuredEditor(editorFamily: string): ScoreObjectEditorComponent {
  switch (editorFamily) {
    case 'PatternObject': return PatternObjectEditor;
    case 'LineObject': return LineObjectEditor;
    case 'ZakLineObject': return ZakLineObjectEditor;
    case 'PianoRoll': return PianoRollEditor;
    case 'TrackerObject': return TrackerObjectEditor;

    case 'JMask': return JMaskEditor;
    case 'Sound': return SoundEditor;
    case 'PolyObject': return PolyObjectEditor;
    default: return UnsupportedScoreObjectEditor;
  }
}

export function resolveEditorComponent(
  editor: TypeSpecificScoreObjectEditorSnapshot,
): ScoreObjectEditorComponent {
  switch (editor.kind) {
    case 'code':
      if (editor.target.editorObjectType === 'ObjectBuilder') return ObjectBuilderScoreObjectEditor;
      if (editor.syntax === 'javascript') return JavaScriptObjectEditor;
      if (editor.target.editorObjectType === 'ClojureObject') return ClojureObjectEditor;
      return CodeBackedScoreObjectEditor;
    case 'external':
      return ExternalScoreObjectEditor;
    case 'audioClip':
      return AudioClipScoreObjectEditor;
    case 'file':
      return FileBackedScoreObjectEditor;
    case 'polyObject':
      return PolyObjectScoreObjectEditor;
    case 'tracker':
      return TrackerScoreObjectEditor;
    case 'structured':
      return resolveStructuredEditor(editor.editorFamily);
    case 'fallback':
    default:
      return UnsupportedScoreObjectEditor;
  }
}
