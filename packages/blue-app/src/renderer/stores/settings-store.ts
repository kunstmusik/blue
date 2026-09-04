import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { toast } from 'sonner';

interface SettingsState {
  enginePath: string;
  recentFiles: string[];
  windowBounds: { x: number; y: number; width: number; height: number } | null;
  midiInputDevice: string;
  midiOutputDevice: string;
  oscInputPort: number;
  oscOutputPort: number;
  oscOutputHost: string;
}

interface SettingsActions {
  openFile: () => Promise<void>;
  openRecentFile: (path: string) => Promise<void>;
  newProject: () => Promise<void>;
  addRecentFile: (path: string) => void;
  removeRecentFile: (path: string) => void;
  rehydrate: () => void;
}

// Dynamic storage: localStorage in browser, in-memory in tests
const getStorage = (): StateStorage => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // localStorage not available
  }
  // Fallback: in-memory storage for tests
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set, get) => ({
      enginePath: 'blue-engine',
      recentFiles: [],
      windowBounds: null,
      midiInputDevice: '',
      midiOutputDevice: '',
      oscInputPort: 0,
      oscOutputPort: 0,
      oscOutputHost: 'localhost',

      openFile: async () => {
        try {
          const filePath = await window.blueAPI.openFile();
          if (filePath) {
            get().addRecentFile(filePath);
          }
        } catch (err: unknown) {
          toast.error(`Failed to open: ${err instanceof Error ? err.message : String(err)}`);
        }
      },

      openRecentFile: async (filePath: string) => {
        try {
          const result = await window.blueAPI.openFilePath(filePath);
          if (result) {
            get().addRecentFile(result);
          }
        } catch (err: unknown) {
          toast.error(`Failed to open: ${err instanceof Error ? err.message : String(err)}`);
        }
      },

      newProject: async () => {
        try {
          await window.blueAPI.newFile();
        } catch (err: unknown) {
          toast.error(
            `Failed to create project: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      },

      addRecentFile: (path: string) =>
        set((state) => {
          const files = [path, ...state.recentFiles.filter((f) => f !== path)].slice(0, 10);
          return { recentFiles: files };
        }),

      removeRecentFile: (path: string) =>
        set((state) => ({
          recentFiles: state.recentFiles.filter((f) => f !== path),
        })),

      rehydrate: () => {
        const api = useSettingsStore.persist;
        api.rehydrate();
      },
    }),
    {
      name: 'blue-settings',
      storage: createJSONStorage(() => getStorage()),
      partialize: (state) => ({
        recentFiles: state.recentFiles,
        windowBounds: state.windowBounds,
        enginePath: state.enginePath,
        midiInputDevice: state.midiInputDevice,
        midiOutputDevice: state.midiOutputDevice,
        oscInputPort: state.oscInputPort,
        oscOutputPort: state.oscOutputPort,
        oscOutputHost: state.oscOutputHost,
      }),
    },
  ),
);
