export type PanelMode = 'editor' | 'properties' | 'output' | 'repl';

export interface PanelDescriptor {
  id: string;
  title: string;
  mode: PanelMode;
  openAtStartup: boolean;
  position?: number;
  icon?: string;
  auxiliaryGroupId?: 'properties-main' | 'output-main';
  auxiliaryRailLabel?: string;
  /** Whether the panel may close through tab/window commands. Defaults to true. */
  isClosable?: boolean;
  /** Whether the panel may participate in Float. Defaults to true. */
  isFloatable?: boolean;
}

export const WORKBENCH_PANEL_REGISTRY: PanelDescriptor[] = [
  { id: 'ScoreTopComponent', title: 'Score', mode: 'editor', openAtStartup: true, icon: '♪' },
  { id: 'OrchestraTopComponent', title: 'Orchestra', mode: 'editor', openAtStartup: true, position: 200, icon: '🎻' },
  { id: 'GlobalOrchestraTopComponent', title: 'Global Orchestra', mode: 'editor', openAtStartup: true },
  { id: 'GlobalScoreTopComponent', title: 'Global Score', mode: 'editor', openAtStartup: true },
  { id: 'TablesTopComponent', title: 'Tables', mode: 'editor', openAtStartup: true },
  { id: 'UserDefinedOpcodeTopComponent', title: 'UDOs', mode: 'editor', openAtStartup: true, position: 300 },
  { id: 'ProjectPropertiesTopComponent', title: 'Project Properties', mode: 'editor', openAtStartup: true },
  { id: 'BlueLiveTopComponent', title: 'Blue Live', mode: 'editor', openAtStartup: true, position: 800, icon: '🔴' },
  { id: 'ScratchPadTopComponent', title: 'Scratch Pad', mode: 'editor', openAtStartup: false },

  {
    id: 'SoundObjectPropertiesTopComponent',
    title: 'Score Object Properties',
    mode: 'properties',
    openAtStartup: false,
    auxiliaryGroupId: 'properties-main',
    auxiliaryRailLabel: 'Properties',
  },
  {
    id: 'LibrariesTopComponent',
    title: 'Libraries',
    mode: 'properties',
    openAtStartup: false,
    auxiliaryGroupId: 'properties-main',
    auxiliaryRailLabel: 'Libraries',
  },
  {
    id: 'SoundObjectLibraryTopComponent',
    title: 'Project SoundObjects',
    mode: 'properties',
    openAtStartup: false,
    auxiliaryGroupId: 'properties-main',
    auxiliaryRailLabel: 'SoundObjects',
  },
  {
    id: 'AudioFilePlayerTopComponent',
    title: 'Audio File Player',
    mode: 'properties',
    openAtStartup: false,
    auxiliaryGroupId: 'properties-main',
    auxiliaryRailLabel: 'Audio Player',
  },
  {
    id: 'SoundFontViewerTopComponent',
    title: 'SoundFont Viewer',
    mode: 'properties',
    openAtStartup: false,
    auxiliaryGroupId: 'properties-main',
    auxiliaryRailLabel: 'SoundFont Viewer',
  },
  {
    id: 'MarkersTopComponent',
    title: 'Markers',
    mode: 'properties',
    openAtStartup: false,
    auxiliaryGroupId: 'properties-main',
    auxiliaryRailLabel: 'Markers',
  },
  {
    id: 'MidiInputPanelTopComponent',
    title: 'MIDI Input',
    mode: 'properties',
    openAtStartup: false,
    auxiliaryGroupId: 'properties-main',
    auxiliaryRailLabel: 'MIDI Input',
  },

  {
    id: 'ScoreObjectEditorTopComponent',
    title: 'Score Object Editor',
    mode: 'output',
    openAtStartup: false,
    auxiliaryGroupId: 'output-main',
    auxiliaryRailLabel: 'Score Editor',
  },
  {
    id: 'MixerTopComponent',
    title: 'Mixer',
    mode: 'output',
    openAtStartup: false,
    position: 200,
    icon: '🎛',
    auxiliaryGroupId: 'output-main',
    auxiliaryRailLabel: 'Mixer',
  },
  {
    id: 'BlueFileManagerTopComponent',
    title: 'File Manager',
    mode: 'output',
    openAtStartup: false,
    auxiliaryGroupId: 'output-main',
    auxiliaryRailLabel: 'Files',
  },
  { id: 'VirtualKeyboardTopComponent', title: 'Virtual Keyboard', mode: 'output', openAtStartup: false, position: 800, icon: '🎹', auxiliaryGroupId: 'output-main', auxiliaryRailLabel: 'Virtual Keyboard' },
  {
    id: 'OutputTopComponent',
    title: 'Output',
    mode: 'output',
    openAtStartup: true,
    auxiliaryGroupId: 'output-main',
    auxiliaryRailLabel: 'Output',
  },

  { id: 'JavaScriptConsoleTopComponent', title: 'JavaScript Console', mode: 'repl', openAtStartup: false, auxiliaryGroupId: 'output-main', auxiliaryRailLabel: 'JS Console' },
  { id: 'JythonConsoleTopComponent', title: 'Python Console', mode: 'repl', openAtStartup: false, auxiliaryGroupId: 'output-main', auxiliaryRailLabel: 'Python Console' },
  { id: 'ClojureConsoleTopComponent', title: 'Clojure REPL', mode: 'repl', openAtStartup: false, auxiliaryGroupId: 'output-main', auxiliaryRailLabel: 'Clojure REPL' },
];

export const PANEL_MAP = new Map(WORKBENCH_PANEL_REGISTRY.map((panel) => [panel.id, panel]));

export type NativeMenuCommand =
  | { type: 'focus-panel'; panelId: string }
  | { type: 'close-floating-group'; panelId: string }
  | { type: 'reset-windows' }
  | { type: 'open-effects-library' }
  | { type: 'open-ftable-converter' }
  | { type: 'open-csoundrc-editor' }
  | { type: 'open-code-repository-editor' }
  | { type: 'open-midi-import' }
  | { type: 'toggle-follow-playback' }
  | { type: 'toggle-follow-playback-on-render-start' }
  | { type: 'toggle-loop-rendering' }
  | { type: 'add-marker' }
  | { type: 'navigate-next-marker' }
  | { type: 'navigate-previous-marker' }
  | { type: 'rewind-to-start' }
  | { type: 'render-stop-project' }
  | { type: 'edit-tempo-map' }
  | { type: 'edit-meter-map' }
  | { type: 'show-not-yet-implemented' };

export function getPanel(id: string): PanelDescriptor | undefined {
  return PANEL_MAP.get(id);
}

export function getPanelsByMode(mode: PanelMode): PanelDescriptor[] {
  return WORKBENCH_PANEL_REGISTRY.filter((panel) => panel.mode === mode);
}

export function getDefaultEditorPanels(): PanelDescriptor[] {
  return getPanelsByMode('editor').filter((panel) => panel.openAtStartup);
}

export function isAuxiliaryEligiblePanel(panelId: string): boolean {
  return PANEL_MAP.has(panelId);
}
