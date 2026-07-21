import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

import type { MixerPatch } from '../../../../shared/project-editor';
import { getProjectDocumentRevision, useProjectStore } from '../../../stores/project-store';
import { usePlaybackStore } from '../../../stores/playback-store';
import { useBlueLiveStore } from '../../../stores/blue-live-store';
import { deriveMixerPlaybackUiState } from '../../../stores/mixer-playback-ui';
import ChannelStrip, { type MixerChainSelection } from './mixer/ChannelStrip';
import { useProjectLibraryNodes } from '../../libraries/use-project-library-nodes';

export default function MixerPanel(): React.ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const mixer = useProjectStore((state) => state.mixer);
  const applyProjectDocumentPatch = useProjectStore((state) => state.applyProjectDocumentPatch);
  const flushPendingPatches = useProjectStore((state) => state.flushPendingPatches);
  const projectSessionId = useProjectStore((state) => state.sessionId);
  const projectRevision = getProjectDocumentRevision();
  const projectEffectNodes = useProjectLibraryNodes(
    'projectOwned', 'effect', loaded ? projectSessionId : null, projectRevision,
  );
  const [chainSelection, setChainSelection] = useState<MixerChainSelection | null>(null);

  const playbackStatus = usePlaybackStore((s) => s.status);
  const blueLiveStatus = useBlueLiveStore((s) => s.status);

  const playbackUi = useMemo(
    () => deriveMixerPlaybackUiState({ playbackStatus, blueLiveStatus }),
    [playbackStatus, blueLiveStatus],
  );

  const [groupRenameDialog, setGroupRenameDialog] = useState<{
    association: string;
    name: string;
  } | null>(null);
  const groupRenameInputRef = useRef<HTMLInputElement>(null);
  const isGroupRenameDialogOpen = groupRenameDialog !== null;

  const handleMixerPatch = useCallback(
    (patch: Record<string, unknown>) => {
      void applyProjectDocumentPatch({ mixer: patch as MixerPatch });
    },
    [applyProjectDocumentPatch],
  );

  const handleOpenEffectInterface = useCallback((request: { ownerType: 'project' | 'library'; effectId: string; projectRef?: { channelId: string; chain: 'pre' | 'post'; entryId: string }; libraryRef?: { libraryEffectId: string } }) => {
    void (async () => {
      await flushPendingPatches();
      const focused = await window.blueAPI.focusEffectEditor(request);
      if (!focused) {
        await window.blueAPI.openEffectInterface(request);
      }
    })();
  }, [flushPendingPatches]);

  const handleRemoveSubChannel = useCallback(
    (channelId: string) => {
      handleMixerPatch({ type: 'removeSubChannel', channelId });
    },
    [handleMixerPatch],
  );

  const openGroupRenameDialog = useCallback((association: string, currentName: string) => {
    setGroupRenameDialog({ association, name: currentName });
  }, []);

  const closeGroupRenameDialog = useCallback(() => {
    setGroupRenameDialog(null);
  }, []);

  const commitGroupRenameDialog = useCallback(() => {
    if (!groupRenameDialog) {
      return;
    }

    const nextName = groupRenameDialog.name.trim();
    if (nextName.length > 0) {
      handleMixerPatch({
        type: 'renameChannelListGroup',
        association: groupRenameDialog.association,
        name: nextName,
      });
    }

    closeGroupRenameDialog();
  }, [groupRenameDialog, handleMixerPatch, closeGroupRenameDialog]);

  useEffect(() => {
    if (!isGroupRenameDialogOpen) {
      return;
    }

    groupRenameInputRef.current?.focus();
    groupRenameInputRef.current?.select();
  }, [isGroupRenameDialogOpen]);

  if (!loaded) {
    return (
      <div className="workbench-panel-shell">
        <div className="workbench-panel-shell__content">
          <div className="flex h-full items-center justify-center text-sm text-blue-muted">
            No project loaded
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="workbench-panel-shell">
      <div className="workbench-panel-shell__content mixer-panel">
        <div className="mixer-toolbar">
          <label className="mixer-toolbar__check">
            <input
              type="checkbox"
              checked={mixer.enabled}
              onChange={(event) => handleMixerPatch({ type: 'setMixerEnabled', value: event.target.checked })}
              className="accent-blue-accent"
            />
            <span>Enabled</span>
          </label>
          <label className="mixer-toolbar__field">
            <span>Extra render time</span>
            <input
              type="number"
              value={mixer.extraRenderTime}
              onChange={(event) => handleMixerPatch({ type: 'updateExtraRenderTime', value: Number(event.target.value) })}
              className="mixer-toolbar__input"
            />
          </label>
          <button
            type="button"
            className="toolbar-text-button"
            onClick={() => handleMixerPatch({ type: 'addSubChannel', name: undefined })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Subchannel
          </button>
          {playbackUi.isPlaying || playbackUi.isBlueLiveActive ? (
            <span className="mixer-playback-badge" title={playbackUi.statusLabel}>
              {playbackUi.statusLabel}
            </span>
          ) : null}
        </div>

        <div className="mixer-main">
          <div className="mixer-channels-scroll">
            {mixer.channelListGroups.map((group, index) => (
              group.channels.length > 0 ? (
                <div
                  key={group.association ?? `channel-group-${index}`}
                  className="mixer-channel-group"
                >
                  <div
                    className="mixer-channel-group__header"
                    onDoubleClick={() => {
                      if (!group.association) {
                        return;
                      }
                      openGroupRenameDialog(group.association, group.listName || 'Audio Layer Group');
                    }}
                    title={group.association ? 'Double-click to rename group' : undefined}
                  >
                    {group.listName || 'Audio Layer Group'}
                  </div>
                  <div className="mixer-channel-group__strips">
                    {group.channels.map((channel) => (
                      <ChannelStrip
                        key={channel.id}
                        mixer={mixer}
                        channel={channel}
                        isMaster={false}
                        isSubChannel={false}
                        onPatch={handleMixerPatch}
                        projectSessionId={projectSessionId}
                        projectRevision={projectRevision}
                        onOpenEffectInterface={handleOpenEffectInterface}
                        selection={chainSelection}
                        onSelectionChange={setChainSelection}
                        projectEffectNodes={projectEffectNodes}
                      />
                    ))}
                  </div>
                </div>
              ) : null
            ))}
            {mixer.channels.length > 0 && (
              <div className="mixer-channel-group">
                <div className="mixer-channel-group__header">Orchestra</div>
                <div className="mixer-channel-group__strips">
                  {mixer.channels.map((channel) => (
                    <ChannelStrip
                      key={channel.id}
                      mixer={mixer}
                      channel={channel}
                      isMaster={false}
                      isSubChannel={false}
                      onPatch={handleMixerPatch}
                      projectSessionId={projectSessionId}
                      projectRevision={projectRevision}
                      onOpenEffectInterface={handleOpenEffectInterface}
                      selection={chainSelection}
                      onSelectionChange={setChainSelection}
                      projectEffectNodes={projectEffectNodes}
                    />
                  ))}
                </div>
              </div>
            )}
            {mixer.subChannels.length > 0 && (
              <div className="mixer-channel-group">
                <div className="mixer-channel-group__header">Subchannels</div>
                <div className="mixer-channel-group__strips">
                  {mixer.subChannels.map((channel) => (
                    <ChannelStrip
                      key={channel.id}
                      mixer={mixer}
                      channel={channel}
                      isMaster={false}
                      isSubChannel
                      onPatch={handleMixerPatch}
                      projectSessionId={projectSessionId}
                      projectRevision={projectRevision}
                      onOpenEffectInterface={handleOpenEffectInterface}
                      selection={chainSelection}
                      onSelectionChange={setChainSelection}
                      projectEffectNodes={projectEffectNodes}
                      onRemoveSubChannel={handleRemoveSubChannel}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mixer-master-strip">
            <ChannelStrip
              mixer={mixer}
              channel={mixer.master}
              isMaster
              isSubChannel={false}
              onPatch={handleMixerPatch}
              projectSessionId={projectSessionId}
              projectRevision={projectRevision}
              onOpenEffectInterface={handleOpenEffectInterface}
              selection={chainSelection}
              onSelectionChange={setChainSelection}
              projectEffectNodes={projectEffectNodes}
            />
          </div>
        </div>
      </div>

      {groupRenameDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeGroupRenameDialog}
        >
          <div
            className="w-90 rounded-lg border border-blue-border/50 bg-blue-bg shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-blue-border/30 px-4 py-3 text-sm font-medium text-blue-text">
              Edit Audio Layer Group Name
            </div>
            <div className="px-4 py-3">
              <input
                ref={groupRenameInputRef}
                className="w-full rounded-sm border border-blue-accent/40 bg-blue-surface/60 px-2 py-1 text-body text-blue-text outline-none"
                value={groupRenameDialog.name}
                onChange={(event) => {
                  setGroupRenameDialog((prev) => (
                    prev
                      ? { ...prev, name: event.target.value }
                      : prev
                  ));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitGroupRenameDialog();
                  }
                  if (event.key === 'Escape') {
                    closeGroupRenameDialog();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-blue-border/30 px-4 py-3">
              <button
                type="button"
                className="rounded border border-blue-border/50 bg-blue-surface/40 px-3 py-1 text-body text-blue-muted hover:text-blue-text"
                onClick={closeGroupRenameDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded border border-blue-accent/60 bg-blue-accent/30 px-3 py-1 text-body text-blue-text"
                onClick={commitGroupRenameDialog}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
