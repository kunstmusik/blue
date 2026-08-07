import type { PanelDescriptor } from './panel-registry';
import { getPanel } from './panel-registry';
import PlaceholderPanel from './panels/PlaceholderPanel';
import BlueLivePanel from './panels/BlueLivePanel';
import MidiInputPanel from './panels/MidiInputPanel';
import GlobalOrchestraPanel from './panels/GlobalOrchestraPanel';
import GlobalScorePanel from './panels/GlobalScorePanel';
import OrchestraPanel from './panels/OrchestraPanel';
import ProjectPropertiesPanel from './panels/ProjectPropertiesPanel';
import TablesPanel from './panels/TablesPanel';
import UserDefinedOpcodePanel from './panels/UserDefinedOpcodePanel';
import VirtualKeyboardPanel from './panels/VirtualKeyboardPanel';
import MixerPanel from './panels/MixerPanel';
import OutputPanel from './panels/output/OutputPanel';
import ScorePanel from './panels/ScorePanel';
import ScoreObjectPropertiesPanel from './panels/ScoreObjectPropertiesPanel';
import ScoreObjectEditorPanel from './panels/ScoreObjectEditorPanel';
import MarkersPanel from './panels/MarkersPanel';
import AudioPlayerPanel from './panels/audio-player/AudioPlayerPanel';
import LibrariesPanel from './panels/LibrariesPanel';
import SoundObjectLibraryPanel from './panels/SoundObjectLibraryPanel';
import { LibraryItemEditorPanel } from '../libraries/LibraryItemEditorPanel';
import { libraryEditorSessionIdFromPanel } from '../../stores/library-editor-store';

export interface WorkbenchPanelContentProps {
  panelId: string;
  descriptor?: PanelDescriptor;
}

export default function WorkbenchPanelContent({
  panelId,
  descriptor: propDescriptor,
}: WorkbenchPanelContentProps): React.ReactElement | null {
  const librarySessionId = libraryEditorSessionIdFromPanel(panelId);
  if (librarySessionId) {
    return <LibraryItemEditorPanel sessionId={librarySessionId} />;
  }

  const descriptor = propDescriptor ?? getPanel(panelId);
  if (!descriptor) {
    return null;
  }

  switch (descriptor.id) {
    case 'OrchestraTopComponent':
      return <OrchestraPanel />;
    case 'GlobalOrchestraTopComponent':
      return <GlobalOrchestraPanel />;
    case 'GlobalScoreTopComponent':
      return <GlobalScorePanel />;
    case 'ProjectPropertiesTopComponent':
      return <ProjectPropertiesPanel />;
    case 'TablesTopComponent':
      return <TablesPanel />;
    case 'UserDefinedOpcodeTopComponent':
      return <UserDefinedOpcodePanel />;
    case 'BlueLiveTopComponent':
      return <BlueLivePanel />;
    case 'MidiInputPanelTopComponent':
      return <MidiInputPanel />;
    case 'VirtualKeyboardTopComponent':
      return <VirtualKeyboardPanel />;
    case 'MixerTopComponent':
      return <MixerPanel />;
    case 'OutputTopComponent':
      return <OutputPanel />;
    case 'ScoreTopComponent':
      return <ScorePanel />;
    case 'SoundObjectPropertiesTopComponent':
      return <ScoreObjectPropertiesPanel />;
    case 'ScoreObjectEditorTopComponent':
      return <ScoreObjectEditorPanel />;
    case 'MarkersTopComponent':
      return <MarkersPanel />;
    case 'AudioFilePlayerTopComponent':
      return <AudioPlayerPanel />;
    case 'LibrariesTopComponent':
      return <LibrariesPanel />;
    case 'SoundObjectLibraryTopComponent':
      return <SoundObjectLibraryPanel />;
    default:
      return <PlaceholderPanel descriptor={descriptor} showHeader={false} />;
  }
}
