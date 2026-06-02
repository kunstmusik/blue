import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { SnapValueName } from '@blue/data';
import { getSnapValue } from '@blue/data';

interface PianoRollSnapButtonProps {
  snapEnabled: boolean;
  snapValue: SnapValueName;
  onToggleSnap: () => void;
  onChangeSnapValue: (value: SnapValueName) => void;
}

const SNAP_GROUPS: { label: string; values: SnapValueName[] }[] = [
  { label: 'Musical', values: ['BAR', 'HALF', 'BEAT', 'EIGHTH', 'SIXTEENTH', 'THIRTY_SECOND', 'SIXTY_FOURTH'] },
  { label: 'Triplets', values: ['QUARTER_TRIPLET', 'EIGHTH_TRIPLET', 'SIXTEENTH_TRIPLET'] },
  { label: 'Time', values: ['ONE_SECOND', 'HUNDRED_MS', 'TEN_MS', 'ONE_MS'] },
  { label: 'SMPTE', values: ['FRAME'] },
];

const menuClass = 'z-50 min-w-35 rounded border border-blue-border/50 bg-app-menu py-1 shadow-lg';
const itemClass = 'cursor-pointer rounded-sm px-3 py-1 text-[11px] text-blue-text outline-none data-[highlighted]:bg-app-highlight';
const subTriggerClass = 'flex w-full cursor-pointer items-center justify-between rounded-sm px-3 py-1 text-[11px] text-blue-text outline-none data-[highlighted]:bg-app-highlight';

export default function PianoRollSnapButton({
  snapEnabled,
  snapValue,
  onToggleSnap,
  onChangeSnapValue,
}: PianoRollSnapButtonProps): React.ReactElement {
  const snapDef = getSnapValue(snapValue);
  const displayName = snapDef.displayName;

  return (
    <div className="flex items-stretch h-[22px]">
      <button
        className={`px-1.5 text-[11px] border rounded-l transition-colors cursor-pointer flex items-center ${
          snapEnabled
            ? 'bg-blue-accent/20 text-blue-text border-blue-accent/40'
            : 'bg-transparent text-blue-muted border-blue-border/40 hover:bg-blue-hover'
        }`}
        onClick={onToggleSnap}
        title="Toggle snap on/off"
      >
        Snap: {displayName}
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className={`px-1 border border-l-0 rounded-r transition-colors cursor-pointer flex items-center ${
              snapEnabled
                ? 'bg-blue-accent/20 text-blue-text border-blue-accent/40'
                : 'bg-transparent text-blue-muted border-blue-border/40 hover:bg-blue-hover'
            }`}
            title="Configure snap value"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={menuClass}
            sideOffset={4}
            align="start"
          >
            {SNAP_GROUPS.slice(0, 2).map((group) => (
              <SnapSubmenu
                key={group.label}
                label={group.label}
                values={group.values}
                snapValue={snapValue}
                onChangeSnapValue={onChangeSnapValue}
              />
            ))}
            <DropdownMenu.Separator className="h-px bg-blue-border/30 my-1" />
            {SNAP_GROUPS.slice(2).map((group) => (
              <SnapSubmenu
                key={group.label}
                label={group.label}
                values={group.values}
                snapValue={snapValue}
                onChangeSnapValue={onChangeSnapValue}
              />
            ))}
            <SnapItem
              value="SAMPLE"
              snapValue={snapValue}
              onChangeSnapValue={onChangeSnapValue}
            />
            <DropdownMenu.Separator className="h-px bg-blue-border/30 my-1" />
            <SnapItem
              value="AUTO"
              snapValue={snapValue}
              onChangeSnapValue={onChangeSnapValue}
            />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function SnapSubmenu({
  label,
  values,
  snapValue,
  onChangeSnapValue,
}: {
  label: string;
  values: SnapValueName[];
  snapValue: SnapValueName;
  onChangeSnapValue: (value: SnapValueName) => void;
}): React.ReactElement {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className={subTriggerClass}>
        {label}
        <ChevronRight className="w-3 h-3 ml-2" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent className={menuClass} sideOffset={-2} alignOffset={-4}>
          {values.map((value) => (
            <SnapItem
              key={value}
              value={value}
              snapValue={snapValue}
              onChangeSnapValue={onChangeSnapValue}
            />
          ))}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

function SnapItem({
  value,
  snapValue,
  onChangeSnapValue,
}: {
  value: SnapValueName;
  snapValue: SnapValueName;
  onChangeSnapValue: (value: SnapValueName) => void;
}): React.ReactElement {
  const def = getSnapValue(value);
  return (
    <DropdownMenu.Item
      className={`${itemClass} ${snapValue === value ? 'bg-blue-accent/20 text-blue-text font-medium' : ''}`}
      onSelect={() => onChangeSnapValue(value)}
    >
      {def.displayName}
    </DropdownMenu.Item>
  );
}
