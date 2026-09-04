import { useCallback, useRef, useState, type ReactElement } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { useProjectStore } from '../../../../stores/project-store';
import type {
  MidiInputProcessorSnapshot,
  MidiScaleSnapshot,
} from '../../../../../shared/project-editor';
import { BLUE_INSPECTOR_LABEL_TEXT_CLASS } from '../shared/compactFieldStyles';
import { PopoutContextMenuPortal } from '../../../../hooks/host-portals';
import { AppSelect } from '../../../AppSelect';
import { cn } from '../../../../lib/cn';

const KEY_MAPPING_OPTIONS = [
  { value: 'MIDI', label: 'MIDI' },
  { value: 'PCH', label: 'Csound PCH' },
  { value: 'OCT', label: 'Csound OCT' },
  { value: 'CONSTANT', label: 'Constant' },
  { value: 'TUNING_BLUE_PCH', label: 'Tuning - bluePCH' },
  { value: 'TUNING_CPS', label: 'Tuning - CPS' },
] as const;

const VELOCITY_MAPPING_OPTIONS = [
  { value: 'MIDI', label: 'MIDI' },
  { value: 'CONSTANT', label: 'Constant' },
  { value: 'AMP_0DBFS', label: 'Amp (0dbfs = 1)' },
  { value: 'AMP', label: 'Amp (max 32768)' },
] as const;

function ensureOption(options: ReadonlyArray<{ value: string; label: string }>, current: string) {
  if (options.some((o) => o.value === current)) return [...options];
  if (!current) return [...options];
  return [{ value: current, label: `Custom (${current})` }, ...options];
}

function FormRow({ label, children }: { label: string; children: ReactElement }): ReactElement {
  return (
    <div className="flex items-center gap-3">
      <span className={cn('w-24 flex-none text-right', BLUE_INSPECTOR_LABEL_TEXT_CLASS)}>
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function ScaleSelector({
  scale,
  onScaleChange,
}: {
  scale: MidiScaleSnapshot | null;
  onScaleChange: (scale: MidiScaleSnapshot | null) => void;
}): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleFileSelect = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.scl';
    input.click();

    await new Promise<void>((resolve) => {
      input.onchange = () => resolve();
    });

    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseScalaFile(text, file.name.replace(/\.scl$/i, ''));
      if (parsed) {
        onScaleChange(parsed);
      }
    } catch {
      // ignore read errors
    }
  }, [onScaleChange]);

  const handleReset = useCallback(() => {
    onScaleChange(null);
  }, [onScaleChange]);

  const scaleName = scale?.scaleName || '';

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            className="flex-1 rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 outline-none focus:border-blue-accent"
            value={scaleName}
            readOnly
            placeholder="12TET"
          />
          <button
            type="button"
            className="rounded border border-blue-border bg-blue-surface px-2 py-1 text-role-body text-gray-100 transition hover:border-blue-accent"
            onClick={handleFileSelect}
            disabled={dialogOpen}
          >
            ...
          </button>
        </div>
      </ContextMenu.Trigger>

      <PopoutContextMenuPortal>
        <ContextMenu.Content className="workbench-context-menu">
          <ContextMenu.Item className="workbench-context-menu__item" onSelect={handleReset}>
            Reset (12TET)
          </ContextMenu.Item>
        </ContextMenu.Content>
      </PopoutContextMenuPortal>
    </ContextMenu.Root>
  );
}

function parseScalaFile(text: string, fallbackName: string): MidiScaleSnapshot | null {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('!') && line.trim().length > 0);
  if (lines.length === 0) return null;

  const scaleName = lines[0]!.trim() || fallbackName;
  const countLine = lines.length > 1 ? lines[1]!.trim() : '';
  const expectedCount = Number.parseInt(countLine, 10);

  const ratioStart = Number.isFinite(expectedCount) ? 2 : 1;
  const ratioLines = lines.slice(ratioStart);

  const ratios: number[] = [];
  for (const line of ratioLines) {
    const trimmed = line.trim().split(/\s/)[0]!;
    if (!trimmed) continue;

    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      const num = Number.parseFloat(parts[0]!);
      const den = Number.parseFloat(parts[1]!);
      if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
        ratios.push(num / den);
      }
    } else if (trimmed.includes('.')) {
      const cents = Number.parseFloat(trimmed);
      if (Number.isFinite(cents)) {
        ratios.push(Math.pow(2, cents / 1200));
      }
    } else {
      const val = Number.parseFloat(trimmed);
      if (Number.isFinite(val) && val > 0) {
        ratios.push(val);
      }
    }
  }

  if (ratios.length === 0) return null;

  return {
    scaleName,
    baseFrequency: 261.6255653005986,
    octave: 2,
    ratios,
  };
}

export default function MidiInputProcessorForm({
  midiInput,
}: {
  midiInput: MidiInputProcessorSnapshot;
}): ReactElement {
  const applyPatch = useProjectStore((state) => state.applyProjectDocumentPatch);

  const keyOptions = ensureOption(KEY_MAPPING_OPTIONS, midiInput.keyMapping);
  const velocityOptions = ensureOption(VELOCITY_MAPPING_OPTIONS, midiInput.velocityMapping);

  return (
    <div className="flex flex-col gap-3">
      <FormRow label="Key Mapping">
        <AppSelect
          className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 outline-none focus:border-blue-accent"
          value={midiInput.keyMapping}
          onValueChange={(value) => {
            void applyPatch({ midiInput: { type: 'updateKeyMapping', value } });
          }}
          options={keyOptions}
        />
      </FormRow>

      <FormRow label="Scale">
        <ScaleSelector
          scale={midiInput.scale}
          onScaleChange={(scale) => {
            void applyPatch({ midiInput: { type: 'updateScale', scale } });
          }}
        />
      </FormRow>

      <FormRow label="Constant">
        <input
          className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 outline-none focus:border-blue-accent"
          value={midiInput.pitchConstant}
          onChange={(e) => {
            void applyPatch({ midiInput: { type: 'updatePitchConstant', value: e.target.value } });
          }}
        />
      </FormRow>

      <div className="my-1 border-t border-blue-border/60" />

      <FormRow label="Vel Mapping">
        <AppSelect
          className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 outline-none focus:border-blue-accent"
          value={midiInput.velocityMapping}
          onValueChange={(value) => {
            void applyPatch({ midiInput: { type: 'updateVelocityMapping', value } });
          }}
          options={velocityOptions}
        />
      </FormRow>

      <FormRow label="Constant">
        <input
          className="w-full rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 outline-none focus:border-blue-accent"
          value={midiInput.ampConstant}
          onChange={(e) => {
            void applyPatch({ midiInput: { type: 'updateAmpConstant', value: e.target.value } });
          }}
        />
      </FormRow>
    </div>
  );
}
