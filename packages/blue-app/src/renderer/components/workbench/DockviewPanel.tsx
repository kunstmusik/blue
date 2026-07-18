import { forwardRef } from 'react';
import type { IDockviewPanelProps } from 'dockview';
import { PANEL_MAP } from './panel-registry';
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

const DockviewPanel = forwardRef<HTMLDivElement, IDockviewPanelProps>(
  function DockviewPanel(props, ref) {
    const descriptor = PANEL_MAP.get(props.api.id);
    const librarySessionId = libraryEditorSessionIdFromPanel(props.api.id);

    if (librarySessionId) {
      return (
        <div ref={ref} className="workbench-panel-shell">
          <div className="workbench-panel-shell__content">
            <LibraryItemEditorPanel sessionId={librarySessionId} />
          </div>
        </div>
      );
    }

    if (!descriptor) {
      return (
        <div ref={ref} className="h-full bg-blue-bg flex items-center justify-center text-blue-muted">
          Unknown panel: {props.api.title}
        </div>
      );
    }

    return (
      <div ref={ref} className="workbench-panel-shell">
        <div className="workbench-panel-shell__content">
          {descriptor.id === 'OrchestraTopComponent' ? (
            <OrchestraPanel />
          ) : descriptor.id === 'GlobalOrchestraTopComponent' ? (
            <GlobalOrchestraPanel />
          ) : descriptor.id === 'GlobalScoreTopComponent' ? (
            <GlobalScorePanel />
          ) : descriptor.id === 'ProjectPropertiesTopComponent' ? (
            <ProjectPropertiesPanel />
          ) : descriptor.id === 'TablesTopComponent' ? (
            <TablesPanel />
          ) : descriptor.id === 'UserDefinedOpcodeTopComponent' ? (
            <UserDefinedOpcodePanel />
          ) : descriptor.id === 'BlueLiveTopComponent' ? (
            <BlueLivePanel />
          ) : descriptor.id === 'MidiInputPanelTopComponent' ? (
            <MidiInputPanel />
          ) : descriptor.id === 'VirtualKeyboardTopComponent' ? (
            <VirtualKeyboardPanel />
          ) : descriptor.id === 'MixerTopComponent' ? (
            <MixerPanel />
          ) : descriptor.id === 'OutputTopComponent' ? (
            <OutputPanel />
          ) : descriptor.id === 'ScoreTopComponent' ? (
            <ScorePanel />
          ) : descriptor.id === 'SoundObjectPropertiesTopComponent' ? (
            <ScoreObjectPropertiesPanel />
          ) : descriptor.id === 'ScoreObjectEditorTopComponent' ? (
            <ScoreObjectEditorPanel />
          ) : descriptor.id === 'MarkersTopComponent' ? (
            <MarkersPanel />
          ) : descriptor.id === 'AudioFilePlayerTopComponent' ? (
            <AudioPlayerPanel />
          ) : descriptor.id === 'LibrariesTopComponent' ? (
            <LibrariesPanel />
          ) : descriptor.id === 'SoundObjectLibraryTopComponent' ? (
            <SoundObjectLibraryPanel />
          ) : (
            <PlaceholderPanel descriptor={descriptor} showHeader={false} />
          )}
        </div>
      </div>
    );
  },
);

export default DockviewPanel;
