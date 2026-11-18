import React from 'react';
import ToolbarBlueLive from './ToolbarBlueLive';
import ToolbarDisplays from './ToolbarDisplays';
import PlaybackControls from './PlaybackControls';

export default function MainToolbar(): React.ReactElement {
  return (
    <header className="toolbar-shell">
      <PlaybackControls />
      <ToolbarDisplays />
      <ToolbarBlueLive />
    </header>
  );
}
