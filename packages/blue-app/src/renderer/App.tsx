import { useIPCListeners } from './hooks/use-ipc-listeners';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { useProjectStore } from './stores/project-store';
import { useUIStore } from './stores/ui-store';
import MainToolbar from './components/menu-bar/MainToolbar';
import WelcomeScreen from './components/welcome/WelcomeScreen';
import WorkbenchShell from './components/workbench/WorkbenchShell';
import GeneratedCsdModal from './components/workbench/panels/GeneratedCsdModal';
import EffectLibraryModal from './components/workbench/panels/EffectLibraryModal';
import MissingAudioAssetsModal from './components/workbench/panels/MissingAudioAssetsModal';
import ErrorBoundary from './components/notifications/ErrorBoundary';

export default function App(): React.ReactElement {
  useIPCListeners();
  useKeyboardShortcuts();

  const activePanel = useUIStore((s) => s.activePanel);
  const isLoading = useProjectStore((s) => s.isLoading);

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen overflow-hidden">
        <MainToolbar />

        <main className="flex-1 overflow-hidden relative">
          {activePanel === 'welcome' && <WelcomeScreen />}
          {activePanel === 'project' && <WorkbenchShell />}

          {isLoading && (
            <div className="absolute inset-0 bg-blue-bg/80 flex items-center justify-center z-50">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-blue-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-blue-muted text-sm">Loading project...</p>
              </div>
            </div>
          )}
        </main>

        <GeneratedCsdModal />
        <EffectLibraryModal />
        <MissingAudioAssetsModal />
      </div>
    </ErrorBoundary>
  );
}
