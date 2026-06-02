import { FilePlus, FolderOpen } from 'lucide-react';
import { useSettingsStore } from '../../stores/settings-store';

export default function WelcomeScreen(): React.ReactElement {
  const recentFiles = useSettingsStore((s) => s.recentFiles);
  const removeRecentFile = useSettingsStore((s) => s.removeRecentFile);
  const openFile = useSettingsStore((s) => s.openFile);
  const openRecentFile = useSettingsStore((s) => s.openRecentFile);
  const newProject = useSettingsStore((s) => s.newProject);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-8">
      <div className="text-center">
        <h1 className="mb-2 text-5xl font-bold text-app-accent">Blue</h1>
        <p className="text-lg text-app-text-muted">
          An object composition environment for Csound
        </p>
      </div>

      <div className="flex gap-4">
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-app-accent bg-app-accent px-8 py-3 text-base font-medium text-white transition-colors hover:bg-app-accent-hover"
          onClick={newProject}
        >
          <FilePlus className="w-5 h-5" />
          New Project
        </button>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-app-accent bg-app-accent px-8 py-3 text-base font-medium text-white transition-colors hover:bg-app-accent-hover"
          onClick={openFile}
        >
          <FolderOpen className="w-5 h-5" />
          Open a .blue Project
        </button>
      </div>

      {recentFiles.length > 0 && (
        <div className="w-full max-w-md">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-app-text-muted">
            Recent Files
          </h2>
          <ul className="space-y-1">
            {recentFiles.map((filePath) => (
              <li
                key={filePath}
                className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-blue-surface cursor-pointer group"
                onClick={() => openRecentFile(filePath)}
              >
                <span className="text-sm truncate flex-1" title={filePath}>
                  {filePath.split('/').pop()}
                </span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-blue-muted hover:text-red-400 px-2 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRecentFile(filePath);
                  }}
                  title="Remove from recent files"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
