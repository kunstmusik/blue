import React, {
  forwardRef,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { Check, ChevronRight } from 'lucide-react';
import {
  PLAYBACK_DISPLAY_TICK_MS,
  createIdlePlaybackDisplayState,
  derivePlaybackDisplayState,
  usePlaybackStore,
  type PlaybackClockState,
  type PlaybackDisplayState,
  type PlaybackStatus,
} from '../../stores/playback-store';
import { useProjectStore } from '../../stores/project-store';
import {
  buildPlayheadDisplayState,
  buildSelectionDisplayState,
  DEFAULT_PLAYHEAD_PRIMARY_MODE,
  DEFAULT_PLAYHEAD_SECONDARY_MODE,
  TOOLBAR_TIME_DISPLAY_FORMATS,
  getTimeDisplayFormatMenuLabel,
  type ToolbarDisplayMode,
} from './toolbar-formatters';
import { TimeBase } from '../../../shared/time-base';

const ToolbarDisplayCard = forwardRef<HTMLElement, ComponentPropsWithoutRef<'section'> & {
  title: string;
}>(
  ({ title, children, className = '', ...props }, ref): React.ReactElement => (
    <section
      ref={ref}
      className={`toolbar-display-card ${className}`.trim()}
      {...props}
    >
      <div className="toolbar-display-label mb-0.5">{title}</div>
      {children}
    </section>
  ),
);

ToolbarDisplayCard.displayName = 'ToolbarDisplayCard';

function isLivePlaybackStatus(status: PlaybackStatus): boolean {
  return status === 'playing' || status === 'stopping';
}

function useInterpolatedPlaybackDisplay(
  status: PlaybackStatus,
  clock: PlaybackClockState | null,
  authoritativeDisplay: PlaybackDisplayState,
): PlaybackDisplayState {
  const [display, setDisplay] = useState<PlaybackDisplayState>(() =>
    clock && isLivePlaybackStatus(status)
      ? authoritativeDisplay
      : createIdlePlaybackDisplayState(),
  );
  const clockRef = useRef<PlaybackClockState | null>(clock);

  useEffect(() => {
    clockRef.current = clock;
  }, [clock]);

  useEffect(() => {
    if (!clock || !isLivePlaybackStatus(status)) {
      setDisplay(createIdlePlaybackDisplayState());
      return;
    }

    setDisplay(authoritativeDisplay);
  }, [authoritativeDisplay, clock, status]);

  useEffect(() => {
    if (!isLivePlaybackStatus(status)) {
      return;
    }

    const timer = window.setInterval(() => {
      const currentClock = clockRef.current;
      if (!currentClock) {
        return;
      }

      setDisplay((previous) => {
        const next = derivePlaybackDisplayState(currentClock, Date.now());
        if (
          previous.source === next.source &&
          Math.abs(previous.sampleFrames - next.sampleFrames) < 1 &&
          Math.abs(previous.elapsedSeconds - next.elapsedSeconds) < 0.001
        ) {
          return previous;
        }
        return next;
      });
    }, PLAYBACK_DISPLAY_TICK_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [status]);

  return display;
}

const PlayheadDisplayCard = memo(function PlayheadDisplayCard({
  primaryMode,
  secondaryMode,
}: {
  primaryMode: ToolbarDisplayMode;
  secondaryMode: ToolbarDisplayMode;
}): React.ReactElement {
  const renderStartTime = useProjectStore((state) => state.transport.renderStartTime);
  const tempoMap = useProjectStore((state) => state.transport.tempoMap);
  const meterMap = useProjectStore((state) => state.transport.meterMap);
  const smpteFrameRate = useProjectStore((state) => state.transport.smpteFrameRate);
  const sampleRate = useProjectStore((state) => state.transport.sampleRate);
  const status = usePlaybackStore((state) => state.status);
  const clock = usePlaybackStore((state) => state.clock);
  const authoritativeDisplay = usePlaybackStore((state) => state.display);
  const transportAnchor = usePlaybackStore((state) => state.transportAnchor);
  const display = useInterpolatedPlaybackDisplay(status, clock, authoritativeDisplay);

  const playhead = useMemo(
    () => {
      const playheadTransport = transportAnchor ?? {
        renderStartTime,
        tempoMap,
        meterMap,
        smpteFrameRate,
        sampleRate,
      };

      return buildPlayheadDisplayState(
        playheadTransport,
        {
          status,
          hasClock: clock !== null,
          elapsedSeconds: display.elapsedSeconds,
          source: display.source,
        },
        {
          primaryMode,
          secondaryMode,
        },
      );
    },
    [
      transportAnchor,
      renderStartTime,
      tempoMap,
      meterMap,
      smpteFrameRate,
      sampleRate,
      status,
      clock,
      display.elapsedSeconds,
      display.source,
      primaryMode,
      secondaryMode,
    ],
  );

  return (
    <ToolbarDisplayCard title="Playhead" className="w-59">
      <div className="toolbar-display-values toolbar-display-values--playhead">
        <div className="toolbar-display-main toolbar-display-main--playhead">{playhead.primaryText}</div>
        {playhead.secondaryText ? (
          <div className="toolbar-display-secondary toolbar-display-secondary--playhead">
            {playhead.secondaryText}
          </div>
        ) : null}
      </div>
    </ToolbarDisplayCard>
  );
});

const SelectionDisplayCard = memo(function SelectionDisplayCard({
  format,
}: {
  format: TimeBase;
}): React.ReactElement {
  const renderStartTime = useProjectStore((state) => state.transport.renderStartTime);
  const renderEndTime = useProjectStore((state) => state.transport.renderEndTime);
  const tempoMap = useProjectStore((state) => state.transport.tempoMap);
  const meterMap = useProjectStore((state) => state.transport.meterMap);
  const smpteFrameRate = useProjectStore((state) => state.transport.smpteFrameRate);
  const sampleRate = useProjectStore((state) => state.transport.sampleRate);

  const selection = useMemo(
    () =>
      buildSelectionDisplayState({
        renderStartTime,
        renderEndTime,
        tempoMap,
        meterMap,
        smpteFrameRate,
        sampleRate,
      }, format),
    [renderStartTime, renderEndTime, tempoMap, meterMap, smpteFrameRate, sampleRate, format],
  );

  return (
    <ToolbarDisplayCard title="Selection" className="w-64">
      <div className="toolbar-display-values toolbar-display-values--selection">
        <div className="toolbar-display-secondary toolbar-display-secondary--selection" title="Selection Start">
          {selection.startText}
        </div>
        <div className="toolbar-display-secondary toolbar-display-secondary--selection" title="Selection End">
          {selection.endText}
        </div>
        <div className="toolbar-display-secondary toolbar-display-secondary--selection" title="Selection Duration">
          {selection.durationText}
        </div>
      </div>
    </ToolbarDisplayCard>
  );
});

function ContextMenuCheckItem({
  checked,
  onSelect,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
}): React.ReactElement {
  return (
    <ContextMenu.CheckboxItem
      className="toolbar-context-menu__item"
      checked={checked}
      onCheckedChange={(nextChecked) => {
        if (nextChecked) {
          onSelect();
        }
      }}
    >
      <ContextMenu.ItemIndicator className="toolbar-context-menu__item-indicator">
        <Check size={12} strokeWidth={2.5} />
      </ContextMenu.ItemIndicator>
      {children}
    </ContextMenu.CheckboxItem>
  );
}

function ToolbarFormatSubmenu({
  label,
  mode,
  onModeChange,
  portalContainer,
  includeOff = false,
  offLabel = 'Off',
}: {
  label: string;
  mode: ToolbarDisplayMode;
  onModeChange: (mode: ToolbarDisplayMode) => void;
  portalContainer?: HTMLElement;
  includeOff?: boolean;
  offLabel?: string;
}): React.ReactElement {
  return (
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger className="toolbar-context-menu__item toolbar-context-menu__subtrigger">
        <span>{label}</span>
        <ChevronRight className="w-3.5 h-3.5 opacity-60" />
      </ContextMenu.SubTrigger>
      {portalContainer ? (
        <ContextMenu.Portal container={portalContainer}>
          <ContextMenu.SubContent
            className="toolbar-context-menu"
            sideOffset={6}
            alignOffset={-4}
          >
            {includeOff ? (
              <ContextMenuCheckItem checked={mode === 'off'} onSelect={() => onModeChange('off')}>
                {offLabel}
              </ContextMenuCheckItem>
            ) : null}

            {includeOff ? (
              <ContextMenu.Separator className="toolbar-context-menu__separator" />
            ) : null}

            <ContextMenuCheckItem checked={mode === 'sync'} onSelect={() => onModeChange('sync')}>
              Sync to {label === 'Primary' ? 'Primary' : 'Secondary'} Ruler
            </ContextMenuCheckItem>

            <ContextMenu.Separator className="toolbar-context-menu__separator" />

            {TOOLBAR_TIME_DISPLAY_FORMATS.map((format) => (
              <ContextMenuCheckItem
                key={format}
                checked={mode === format}
                onSelect={() => onModeChange(format)}
              >
                {getTimeDisplayFormatMenuLabel(format)}
              </ContextMenuCheckItem>
            ))}
          </ContextMenu.SubContent>
        </ContextMenu.Portal>
      ) : null}
    </ContextMenu.Sub>
  );
}

function ToolbarPlayheadMenu({
  children,
  primaryMode,
  secondaryMode,
  onPrimaryModeChange,
  onSecondaryModeChange,
}: {
  children: ReactNode;
  primaryMode: ToolbarDisplayMode;
  secondaryMode: ToolbarDisplayMode;
  onPrimaryModeChange: (mode: ToolbarDisplayMode) => void;
  onSecondaryModeChange: (mode: ToolbarDisplayMode) => void;
}): React.ReactElement {
  const portalContainer = typeof document !== 'undefined' ? document.body : undefined;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      {portalContainer ? (
        <ContextMenu.Portal container={portalContainer}>
          <ContextMenu.Content
            className="toolbar-context-menu"
            sideOffset={6}
            align="start"
          >
            <ToolbarFormatSubmenu
              label="Primary"
              mode={primaryMode}
              onModeChange={onPrimaryModeChange}
              portalContainer={portalContainer}
            />

            <ContextMenu.Separator className="toolbar-context-menu__separator" />

            <ToolbarFormatSubmenu
              label="Secondary"
              mode={secondaryMode}
              onModeChange={onSecondaryModeChange}
              portalContainer={portalContainer}
              includeOff
            />
          </ContextMenu.Content>
        </ContextMenu.Portal>
      ) : null}
    </ContextMenu.Root>
  );
}

function ToolbarSelectionMenu({
  children,
  format,
  onFormatChange,
}: {
  children: ReactNode;
  format: ToolbarDisplayMode;
  onFormatChange: (mode: ToolbarDisplayMode) => void;
}): React.ReactElement {
  const portalContainer = typeof document !== 'undefined' ? document.body : undefined;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      {portalContainer ? (
        <ContextMenu.Portal container={portalContainer}>
          <ContextMenu.Content
            className="toolbar-context-menu"
            sideOffset={6}
            align="start"
          >
            <ContextMenuCheckItem checked={format === 'sync'} onSelect={() => onFormatChange('sync')}>
              Sync to Ruler
            </ContextMenuCheckItem>

            <ContextMenu.Separator className="toolbar-context-menu__separator" />

            {TOOLBAR_TIME_DISPLAY_FORMATS.map((fmt) => (
              <ContextMenuCheckItem
                key={fmt}
                checked={format === fmt}
                onSelect={() => onFormatChange(fmt)}
              >
                {getTimeDisplayFormatMenuLabel(fmt)}
              </ContextMenuCheckItem>
            ))}
          </ContextMenu.Content>
        </ContextMenu.Portal>
      ) : null}
    </ContextMenu.Root>
  );
}

export default function ToolbarDisplays(): React.ReactElement {
  const [primaryMode, setPrimaryMode] = useState<ToolbarDisplayMode>(DEFAULT_PLAYHEAD_PRIMARY_MODE);
  const [secondaryMode, setSecondaryMode] = useState<ToolbarDisplayMode>(DEFAULT_PLAYHEAD_SECONDARY_MODE);
  const [selectionMode, setSelectionMode] = useState<ToolbarDisplayMode>('sync');
  const primaryTimeDisplay = useProjectStore((state) => state.score.timeState.primaryTimeDisplay);

  const selectionFormat: TimeBase = selectionMode === 'sync'
    ? (primaryTimeDisplay as TimeBase)
    : (selectionMode as TimeBase);

  return (
    <div className="toolbar-displays flex flex-1 min-w-0 items-center justify-center">
      <div className="toolbar-displays__inner">
        <ToolbarPlayheadMenu
          primaryMode={primaryMode}
          secondaryMode={secondaryMode}
          onPrimaryModeChange={setPrimaryMode}
          onSecondaryModeChange={setSecondaryMode}
        >
          <PlayheadDisplayCard primaryMode={primaryMode} secondaryMode={secondaryMode} />
        </ToolbarPlayheadMenu>

        <ToolbarSelectionMenu format={selectionMode} onFormatChange={setSelectionMode}>
          <SelectionDisplayCard format={selectionFormat} />
        </ToolbarSelectionMenu>
      </div>
    </div>
  );
}
