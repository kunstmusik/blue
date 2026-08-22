import { useEffect } from 'react';
import { useIPCListeners } from './hooks/use-ipc-listeners';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { useMidiInputService } from './hooks/use-midi-input-service';
import { useOscControlCommands } from './hooks/use-osc-control-commands';
import { useProjectStore } from './stores/project-store';
import { useUIStore } from './stores/ui-store';
import MainToolbar from './components/menu-bar/MainToolbar';
import WelcomeScreen from './components/welcome/WelcomeScreen';
import WorkbenchShell from './components/workbench/WorkbenchShell';
import GeneratedCsdModal from './components/workbench/panels/GeneratedCsdModal';
import MissingAudioAssetsModal from './components/workbench/panels/MissingAudioAssetsModal';
import FTableConverterModal from './components/workbench/panels/tools/FTableConverterModal';
import CsoundRCEditorModal from './components/workbench/panels/tools/CsoundRCEditorModal';
import CodeRepositoryEditorModal from './components/workbench/panels/code-repository/CodeRepositoryEditorModal';
import MidiImportDialog from './components/workbench/panels/MidiImportDialog';
import FreezeOperationDialog from './components/workbench/panels/FreezeOperationDialog';
import RenderToDiskDialog from './components/workbench/panels/RenderToDiskDialog';
import ErrorBoundary from './components/notifications/ErrorBoundary';
import { LibraryTransferDialog } from './components/libraries/LibraryTransferDialog';
import { useLibraryStore } from './stores/library-store';
import { useCodeRepositoryStore } from './stores/code-repository-store';

export default function App(): React.ReactElement {
  useIPCListeners();
  useKeyboardShortcuts();
  useMidiInputService();
  useOscControlCommands();
  useEffect(() => {
    void useLibraryStore.getState().initialize();
    useCodeRepositoryStore.getState().initialize();
    return () => {
      useLibraryStore.getState().dispose();
      useCodeRepositoryStore.getState().dispose();
    };
  }, []);

  const activePanel = useUIStore((s) => s.activePanel);
  const isLoading = useProjectStore((s) => s.isLoading);
  const transferPreview = useLibraryStore((s) => s.transferPreview);
  const applyTransfer = useLibraryStore((s) => s.applyTransfer);
  const cancelTransfer = useLibraryStore((s) => s.cancelTransfer);

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen overflow-hidden">
        <MainToolbar />

        <main className="flex-1 overflow-hidden relative">
          <WorkbenchShell />
          {activePanel === 'welcome' && (
            <div className="absolute inset-0 z-40 bg-blue-bg">
              <WelcomeScreen />
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-blue-bg/80 flex items-center justify-center z-50">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-blue-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-blue-muted text-role-body">Loading project...</p>
              </div>
            </div>
          )}
        </main>

        <GeneratedCsdModal />
        <MissingAudioAssetsModal />
        <FTableConverterModal />
        <CsoundRCEditorModal />
        <CodeRepositoryEditorModal />
        <MidiImportDialog />
        <FreezeOperationDialog />
        <RenderToDiskDialog />
        {transferPreview && (
          <LibraryTransferDialog
            preview={transferPreview}
            onApply={(mode) => { void applyTransfer(mode); }}
            onCancel={cancelTransfer}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
