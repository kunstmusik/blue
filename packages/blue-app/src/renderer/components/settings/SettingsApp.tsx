import React, { useState, useEffect, useCallback } from 'react';
import {
  PROGRAM_SETTINGS_PANEL_ORDER,
} from '../../../shared/program-settings';
import type {
  ProgramSettingsSnapshot,
  ProgramSettingsPanelId,
  ProgramSettingsSaveResult,
  SettingsValidationIssue,
} from '../../../shared/program-settings';
import { cn } from '../../lib/cn';
import GeneralSettings from './GeneralSettings';
import ProjectDefaultsSettings from './ProjectDefaultsSettings';
import PlaybackSettings from './PlaybackSettings';
import UtilitySettings from './UtilitySettings';
import RealtimeRenderSettings from './RealtimeRenderSettings';
import DiskRenderSettings from './DiskRenderSettings';
import MidiSettings from './MidiSettings';
import OscSettings from './OscSettings';
import { useMidiInputStore } from '../../stores/midi-input-store';
import type { MidiInputServiceSnapshot } from '../../../shared/midi-input';
import { isValidOscPort, type OscServerRuntimeSnapshot } from '../../../shared/osc-control';

export default function SettingsApp(): React.ReactElement {
  const [active, setActive] = useState<ProgramSettingsPanelId>('general');
  const [savedSnapshot, setSavedSnapshot] = useState<ProgramSettingsSnapshot | null>(null);
  const [draft, setDraft] = useState<ProgramSettingsSnapshot | null>(null);
  const [dirty, setDirty] = useState(false);
  const [validationIssues, setValidationIssues] = useState<SettingsValidationIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [oscRuntime, setOscRuntime] = useState<OscServerRuntimeSnapshot | null>(null);

  const setMidiSavedPreferences = useMidiInputStore((s) => s.setSavedPreferences);
  const setMidiSnapshot = useMidiInputStore((s) => s.setSnapshot);
  const midiDraft = useMidiInputStore((s) => s.draftMidiInput);
  const midiDraftDirty = useMidiInputStore((s) => s.draftDirty);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await window.blueAPI.getProgramSettings();
        if (!cancelled) {
          setSavedSnapshot(snapshot);
          setDraft(snapshot);
          setMidiSavedPreferences(snapshot.midiInput);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setMidiSavedPreferences]);

  // Subscribe to runtime MIDI snapshot updates from main (if available).
  useEffect(() => {
    const api = window.blueAPI as typeof window.blueAPI & {
      onMidiInputServiceSnapshot?: (cb: (snapshot: MidiInputServiceSnapshot) => void) => () => void;
      getMidiInputServiceSnapshot?: () => Promise<MidiInputServiceSnapshot | null>;
    };
    if (!api?.onMidiInputServiceSnapshot) return;
    const unsub = api.onMidiInputServiceSnapshot((snapshot) => {
      setMidiSnapshot(snapshot);
    });
    // Pull the initial cached snapshot so the panel renders with current state.
    void api.getMidiInputServiceSnapshot?.().then((snapshot) => {
      if (snapshot) setMidiSnapshot(snapshot);
    });
    return () => { unsub(); };
  }, [setMidiSnapshot]);

  useEffect(() => {
    const api = window.blueAPI as typeof window.blueAPI & {
      getOscServerSnapshot?: () => Promise<OscServerRuntimeSnapshot>;
      onOscServerSnapshot?: (callback: (snapshot: OscServerRuntimeSnapshot) => void) => () => void;
    };
    const unsubscribe = api.onOscServerSnapshot?.((snapshot) => {
      setOscRuntime((current) => !current || snapshot.revision >= current.revision ? snapshot : current);
    });
    void api.getOscServerSnapshot?.().then((snapshot) => {
      setOscRuntime((current) => !current || snapshot.revision >= current.revision ? snapshot : current);
    }).catch(() => undefined);
    return () => { unsubscribe?.(); };
  }, []);

  const handleDraftChange = useCallback((updated: ProgramSettingsSnapshot) => {
    setDraft(updated);
    setDirty(true);
    setValidationIssues([]);
  }, []);

  const handleApply = useCallback(async () => {
    if (!draft) return;
    // Merge the latest MIDI draft back into the program settings draft before
    // saving so the Apply button reflects unsaved Settings edits.
    const merged: ProgramSettingsSnapshot = {
      ...draft,
      midiInput: midiDraft,
    };
    const result: ProgramSettingsSaveResult = await window.blueAPI.saveProgramSettings(merged);
    if (result.ok && result.snapshot) {
      setSavedSnapshot(result.snapshot);
      setDraft(result.snapshot);
      setMidiSavedPreferences(result.snapshot.midiInput);
      setDirty(false);
      setValidationIssues(result.validationIssues ?? []);
    } else {
      setValidationIssues(result.validationIssues ?? []);
    }
  }, [draft, midiDraft, setMidiSavedPreferences]);

  const handleCancel = useCallback(() => {
    if (savedSnapshot) {
      setDraft(savedSnapshot);
      setMidiSavedPreferences(savedSnapshot.midiInput);
      setDirty(false);
      setValidationIssues([]);
    }
  }, [savedSnapshot, setMidiSavedPreferences]);

  const handleResetPanel = useCallback(async () => {
    const snapshot = await window.blueAPI.resetProgramSettingsPanel(active);
    setSavedSnapshot(snapshot);
    setDraft(snapshot);
    if (active === 'midi') {
      setMidiSavedPreferences(snapshot.midiInput);
    }
    setDirty(false);
    setValidationIssues([]);
  }, [active, setMidiSavedPreferences]);

  if (loading || !draft) {
    return (
      <div className="px-6 py-6 text-content text-app-text-muted">
        Loading settings...
      </div>
    );
  }

  const secondaryButtonClass =
    'inline-flex items-center rounded-md border border-app-border bg-transparent px-4 py-1.5 text-content transition-colors enabled:hover:border-app-accent/60 enabled:hover:text-app-text-strong disabled:cursor-default disabled:opacity-40';
  const hasInvalidOscDraft = !isValidOscPort(draft.osc.preferredPort);

  const renderPanel = () => {
    switch (active) {
      case 'general':
        return (
          <GeneralSettings
            settings={draft.general}
            onChange={(general) => handleDraftChange({ ...draft, general })}
          />
        );
      case 'projectDefaults':
        return (
          <ProjectDefaultsSettings
            settings={draft.projectDefaults}
            onChange={(projectDefaults) => handleDraftChange({ ...draft, projectDefaults })}
          />
        );
      case 'playback':
        return (
          <PlaybackSettings
            settings={draft.playback}
            onChange={(playback) => handleDraftChange({ ...draft, playback })}
          />
        );
      case 'utility':
        return (
          <UtilitySettings
            settings={draft.utility}
            onChange={(utility) => handleDraftChange({ ...draft, utility })}
          />
        );
      case 'realtimeRender':
        return (
          <RealtimeRenderSettings
            settings={draft.realtimeRender}
            enginePath={draft.appSpecific.enginePath}
            onChange={(realtimeRender) => handleDraftChange({ ...draft, realtimeRender })}
            onEnginePathChange={(enginePath) => handleDraftChange({
              ...draft,
              appSpecific: { ...draft.appSpecific, enginePath },
            })}
          />
        );
      case 'diskRender':
        return (
          <DiskRenderSettings
            settings={draft.diskRender}
            onChange={(diskRender) => handleDraftChange({ ...draft, diskRender })}
          />
        );
      case 'midi':
        return <MidiSettings />;
      case 'osc':
        return (
          <OscSettings
            settings={draft.osc}
            runtime={oscRuntime}
            onChange={(osc) => handleDraftChange({ ...draft, osc })}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-app-bg text-app-text text-content">
      <nav className="flex w-[180px] shrink-0 flex-col border-r border-app-border bg-app-surface py-3">
        {PROGRAM_SETTINGS_PANEL_ORDER.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActive(cat.id)}
            className={cn(
              'w-full border-l-2 border-transparent px-4 py-2 text-left text-app-text-muted transition-colors hover:bg-app-accent/6 hover:text-app-text-strong',
              active === cat.id && 'border-app-accent bg-app-accent/10 text-app-text-strong',
            )}
          >
            {cat.label}
          </button>
        ))}
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
          {renderPanel()}
        </div>
        {validationIssues.length > 0 && (
          <div className="border-t border-app-danger/30 bg-app-danger/10 px-4 py-2 text-body text-app-danger">
            {validationIssues.map((issue, i) => (
              <div key={i}>{issue.path}: {issue.message}</div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-app-border px-6 py-3">
          <button
            type="button"
            onClick={handleResetPanel}
            className={cn(secondaryButtonClass, 'text-app-text-muted')}
          >
            Reset Panel
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={!dirty && !midiDraftDirty}
            className={cn(
              secondaryButtonClass,
              dirty || midiDraftDirty ? 'text-app-text' : 'text-app-text-subtle',
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={(!dirty && !midiDraftDirty) || hasInvalidOscDraft}
            className="inline-flex items-center rounded-md bg-app-accent px-4 py-1.5 text-content text-white transition-colors enabled:hover:bg-app-accent-hover disabled:cursor-default disabled:bg-app-surface-strong disabled:text-app-text-subtle"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
