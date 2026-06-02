import { ChevronDown } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { getSnapValue, type SnapValueName, type SnapCategory } from '@blue/data';
import type { ScorePathSegment } from './types';
import type { NoteProcessorChainSnapshot } from '../../../../../shared/project-editor';

type ScoreMode = 'score' | 'singleLine' | 'multiLine';

interface Props {
  mode: ScoreMode;
  onModeChange: (mode: ScoreMode) => void;
  pathSegments: ScorePathSegment[];
  onNavigateToSegment: (index: number) => void;
  onNavigateToRoot: () => void;
  snapEnabled: boolean;
  snapValue: SnapValueName;
  onSnapToggle: (enabled: boolean) => void;
  onSnapValueChange: (value: SnapValueName) => void;
  onRulerConfig: () => void;
  onOpenNoteProcessorChain?: (scope: 'rootScore' | 'layerGroup', groupId?: string) => void;
  getSegmentNoteProcessorChain?: (index: number) => NoteProcessorChainSnapshot | undefined;
}

const MODE_OPTIONS: { value: ScoreMode; label: string }[] = [
  { value: 'score', label: 'Score' },
  { value: 'singleLine', label: 'Single Line' },
  { value: 'multiLine', label: 'Multi Line' },
];

const SNAP_GROUPS: { label: string; category: SnapCategory; values: SnapValueName[] }[] = [
  { label: 'Musical', category: 'MUSICAL', values: ['BAR', 'HALF', 'BEAT', 'EIGHTH', 'SIXTEENTH', 'THIRTY_SECOND', 'SIXTY_FOURTH'] },
  { label: 'Triplets', category: 'TRIPLET', values: ['QUARTER_TRIPLET', 'EIGHTH_TRIPLET', 'SIXTEENTH_TRIPLET'] },
  { label: 'Time', category: 'TIME', values: ['ONE_SECOND', 'HUNDRED_MS', 'TEN_MS', 'ONE_MS'] },
  { label: 'SMPTE', category: 'SMPTE', values: ['FRAME'] },
  { label: 'Samples', category: 'SAMPLE', values: ['SAMPLE'] },
];

export default function ScoreToolbar({
  mode,
  onModeChange,
  pathSegments,
  onNavigateToSegment,
  onNavigateToRoot,
  snapEnabled,
  snapValue,
  onSnapToggle,
  onSnapValueChange,
  onRulerConfig,
  onOpenNoteProcessorChain,
  getSegmentNoteProcessorChain,
}: Props) {
  const snapDef = getSnapValue(snapValue);

  return (
    <div className="flex items-center h-7 px-2 bg-app-surface border-b border-app-border/40 text-body select-none shrink-0">
      {/* Mode selection toggle group */}
      <div className="flex items-center mr-2 border border-app-border/40 rounded overflow-hidden">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`px-2 py-0.5 text-ui transition-colors cursor-pointer ${
              mode === opt.value
                ? 'bg-app-accent/20 text-app-text font-medium'
                : 'bg-transparent text-app-text-muted hover:bg-app-hover hover:text-app-text'
            }`}
            onClick={() => onModeChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Breadcrumb navigation path (inline) */}
      <div className="flex items-center gap-1 overflow-x-auto min-w-0">
        {pathSegments.map((segment, i) => {
          const hasNpc = !!onOpenNoteProcessorChain;
          const npcChain = getSegmentNoteProcessorChain?.(i);
          const hasChain = npcChain && npcChain.processors.length > 0;

          return (
            <span key={segment.groupId ?? 'root'} className="flex items-center gap-0 whitespace-nowrap">
              {i > 0 && <span className="mr-1 text-app-text-muted">/</span>}
              <button
                className={`px-1 py-0.5 rounded text-ui cursor-pointer ${
                  i === pathSegments.length - 1
                    ? 'font-medium bg-app-surface/80 text-app-text'
                    : 'text-app-text-muted hover:bg-app-hover hover:text-app-text'
                }`}
                onClick={() => (i === 0 ? onNavigateToRoot() : onNavigateToSegment(i))}
              >
                {segment.label}
              </button>
              {hasNpc && (
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      className="relative px-0.5 py-0 text-app-text-muted hover:text-app-text cursor-pointer transition-colors"
                      title={`Note Processors – ${segment.label}`}
                    >
                      <ChevronDown className="w-3 h-3" />
                      {hasChain && (
                        <span className="absolute -top-0.5 -right-0.5 w-1 h-1 rounded-full bg-red-500" />
                      )}
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className="min-w-[160px] rounded border border-app-border/50 bg-app-menu py-1 shadow-lg z-50"
                      sideOffset={4}
                      align="start"
                    >
                      <DropdownMenu.Item
                        className="flex items-center gap-2 rounded-sm px-3 py-1 text-ui text-app-text outline-none cursor-pointer data-[highlighted]:bg-app-highlight"
                        onSelect={() => {
                          if (i === 0) onOpenNoteProcessorChain('rootScore');
                          else onOpenNoteProcessorChain('layerGroup', segment.groupId ?? undefined);
                        }}
                      >
                        Edit Note Processors
                        {hasChain && (
                          <span className="text-red-400 text-micro">({npcChain.processors.length})</span>
                        )}
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              )}
            </span>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Snap button with dropdown */}
      <div className="flex items-stretch mr-1.5 h-[22px]">
        <button
          className={`px-1.5 text-ui border rounded-l transition-colors cursor-pointer flex items-center ${
            snapEnabled
              ? 'bg-app-accent/20 text-app-text border-app-accent/40'
              : 'bg-transparent text-app-text-muted border-app-border/40 hover:bg-app-hover'
          }`}
          onClick={() => onSnapToggle(!snapEnabled)}
          title="Toggle snap on/off"
        >
          Snap: {snapDef.displayName}
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className={`px-1 border border-l-0 rounded-r transition-colors cursor-pointer flex items-center ${
                snapEnabled
                  ? 'bg-app-accent/20 text-app-text border-app-accent/40'
                  : 'bg-transparent text-app-text-muted border-app-border/40 hover:bg-app-hover'
              }`}
              title="Configure snap value"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[140px] rounded border border-app-border/50 bg-app-menu py-1 shadow-lg z-50"
              sideOffset={4}
              align="start"
            >
              {SNAP_GROUPS.map((group) => (
                <DropdownMenu.Sub key={group.label}>
                  <DropdownMenu.SubTrigger className="flex w-full items-center justify-between rounded-sm px-3 py-1 text-ui text-app-text outline-none cursor-pointer data-[highlighted]:bg-app-highlight">
                    {group.label}
                    <ChevronDown className="w-3 h-3 ml-2 rotate-[-90deg]" />
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent
                      className="min-w-[120px] rounded border border-app-border/50 bg-app-menu py-1 shadow-lg z-50"
                      sideOffset={-2}
                      alignOffset={-4}
                    >
                      {group.values.map((name) => {
                        const def = getSnapValue(name);
                        return (
                          <DropdownMenu.Item
                            key={name}
                            className={`rounded-sm px-3 py-1 text-ui outline-none cursor-pointer data-[highlighted]:bg-app-highlight ${
                              snapValue === name
                                ? 'bg-app-accent/20 text-app-text font-medium'
                                : 'text-app-text'
                            }`}
                            onSelect={() => onSnapValueChange(name)}
                          >
                            {def.displayName}
                          </DropdownMenu.Item>
                        );
                      })}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
              ))}
              <DropdownMenu.Separator className="my-1 h-px bg-app-border/30" />
              <DropdownMenu.Item
                className={`rounded-sm px-3 py-1 text-ui outline-none cursor-pointer data-[highlighted]:bg-app-highlight ${
                  snapValue === 'AUTO'
                    ? 'bg-app-accent/20 text-app-text font-medium'
                    : 'text-app-text'
                }`}
                onSelect={() => onSnapValueChange('AUTO')}
              >
                Auto
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Ruler config button */}
      <button
        className="rounded border border-app-border/40 bg-app-surface px-2 py-0.5 text-ui text-app-text cursor-pointer transition-colors hover:bg-app-hover"
        onClick={onRulerConfig}
        title="Ruler configuration"
      >
        Ruler
      </button>

    </div>
  );
}
