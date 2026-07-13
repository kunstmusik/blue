import React from 'react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useBlueLiveStore } from '../../stores/blue-live-store';
import { useProjectStore } from '../../stores/project-store';

function ToolbarTextButton({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick?: () => void | Promise<void>;
  children: ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      className={clsx('toolbar-text-button', active && 'is-active')}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      onClick={() => {
        void onClick?.();
      }}
    >
      {children}
    </button>
  );
}

export default function ToolbarBlueLive(): React.ReactElement {
  const status = useBlueLiveStore((s) => s.status);
  const running = useBlueLiveStore((s) => s.running);
  const loaded = useProjectStore((s) => s.loaded);

  const isStarting = status === 'starting';
  const isStopping = status === 'stopping';
  const isActive = running || isStarting;
  const isBusy = isStarting || isStopping;
  const canToggle = loaded && !isBusy;

  const handleToggle = () => {
    if (!canToggle) return;
    window.blueAPI?.toggleBlueLive();
  };

  const handleRecompile = () => {
    if (!loaded || isBusy) return;
    window.blueAPI?.recompileBlueLive();
  };

  const handleAllNotesOff = () => {
    if (!running) return;
    window.blueAPI?.sendBlueLiveAllNotesOff();
  };

  return (
    <div className="toolbar-group" aria-label="Blue Live controls">
      <ToolbarTextButton
        title={isActive ? 'Stop Blue Live' : 'Start Blue Live'}
        active={isActive}
        disabled={!canToggle}
        onClick={handleToggle}
      >
        Blue Live
      </ToolbarTextButton>
      <ToolbarTextButton
        title="Recompile Blue Live"
        disabled={!loaded || isBusy}
        onClick={handleRecompile}
      >
        Recompile
      </ToolbarTextButton>
      <ToolbarTextButton
        title="Send All Notes Off"
        disabled={!running}
        onClick={handleAllNotesOff}
      >
        All Notes Off
      </ToolbarTextButton>
    </div>
  );
}
