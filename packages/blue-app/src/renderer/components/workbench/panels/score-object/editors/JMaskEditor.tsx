import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
import type { JMaskEditorPayload } from '../../../../../../shared/project-editor';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';
import type { ProjectDocumentCommitMetadata } from '../../../../../../shared/project-history';
import type { FieldSnapshot, ParameterSnapshot } from './jmask/jmask-utils';
import { getParameters, cloneField } from './jmask/jmask-utils';
import ParameterRow from './jmask/ParameterRow';
import GeneratedScoreModal from './GeneratedScoreModal';
import { useScoreObjectTest } from './useScoreObjectTest';
import {
  PopoutDropdownMenuPortal,
  portalEventIsolationProps,
} from '../../../../../hooks/host-portals';

// Radix uses the main document for keyboard focus checks, even inside a popout.
const VISIBILITY_ITEM = '[role="menuitemcheckbox"]';

function focusPopoutVisibilityMenu(event: React.FocusEvent<HTMLDivElement>): void {
  const menu = event.currentTarget;
  if (event.target !== menu || menu.ownerDocument === globalThis.document) return;
  event.preventDefault();
  menu.querySelector<HTMLElement>(VISIBILITY_ITEM)?.focus({ preventScroll: true });
}

function navigatePopoutVisibilityMenu(event: React.KeyboardEvent<HTMLDivElement>): void {
  const menu = event.currentTarget;
  if (menu.ownerDocument === globalThis.document) return;
  const { key } = event;
  if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'Home' && key !== 'End') return;

  const items = [...menu.querySelectorAll<HTMLElement>(VISIBILITY_ITEM)];
  const index = items.findIndex((item) => item === menu.ownerDocument.activeElement);
  let next: number;
  if (key === 'Home') next = 0;
  else if (key === 'End') next = items.length - 1;
  else if (key === 'ArrowDown') next = index + 1;
  else next = index < 0 ? items.length - 1 : index - 1;

  event.preventDefault();
  event.stopPropagation();
  items[next]?.focus();
}

export default function JMaskEditor({
  document,
  onPatch,
}: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  if (editor.kind !== 'structured' || editor.editorFamily !== 'JMask') return <></>;

  const payload = editor.payload as JMaskEditorPayload;
  const field = payload.field as FieldSnapshot;
  const parameters = useMemo(() => getParameters(field), [field]);
  const duration = document.shared.subjectiveDuration.value;
  const { testing, testOutput, testError, runTest, clearTestOutput, clearTestError } =
    useScoreObjectTest(document.target);

  const handleTest = useCallback(() => {
    void runTest();
  }, [runTest]);

  const testRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        handleTest();
      }
    };
    const el = testRef.current;
    el?.addEventListener('keydown', handler);
    return () => {
      el?.removeEventListener('keydown', handler);
    };
  }, [handleTest]);

  const patch = useCallback(
    (nextPatch: Record<string, unknown>, metadata?: ProjectDocumentCommitMetadata) => {
      onPatch(
        {
          type: 'updateTypeSpecificEditor',
          target: document.target,
          patch: nextPatch,
        },
        metadata,
      );
    },
    [document.target, onPatch],
  );

  const handleFieldChange = useCallback(
    (nextField: FieldSnapshot) => {
      patch({ field: nextField }, { label: 'Edit JMask Field', phase: 'single' });
    },
    [patch],
  );

  const handleSeedUsedChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      patch({ seedUsed: e.target.checked });
    },
    [patch],
  );

  const handleVisibilityToggle = useCallback(
    (index: number, visible: boolean) => {
      const next = cloneField(field);
      const params = getParameters(next);
      if (index >= 0 && index < params.length) {
        params[index] = { ...params[index]!, visible };
      }
      patch({ field: next });
    },
    [field, patch],
  );

  const visibleRows = useMemo(() => {
    const rows: Array<{ parameter: ParameterSnapshot; fieldIndex: number; parameterNum: number }> =
      [];
    let num = 0;
    for (let i = 0; i < parameters.length; i++) {
      num += 1;
      rows.push({ parameter: parameters[i]!, fieldIndex: i, parameterNum: num });
    }
    return rows;
  }, [parameters]);

  return (
    <div ref={testRef} className="flex h-full flex-col bg-blue-bg" tabIndex={-1}>
      <div className="flex shrink-0 items-center gap-2 border-b border-app-border bg-app-surface-strong px-2 py-1">
        <span className="text-role-headline font-bold text-app-text">JMask</span>
        <DropdownMenu.Root key={`visibility:${JSON.stringify(document.target)}`} modal={false}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded text-role-callout text-app-text-muted hover:bg-app-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
              title="Show or hide JMask parameter rows"
              aria-label="Parameter Visibility"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenu.Trigger>
          <PopoutDropdownMenuPortal>
            <DropdownMenu.Content
              {...portalEventIsolationProps}
              className="editor-context-menu"
              onFocus={focusPopoutVisibilityMenu}
              onKeyDownCapture={navigatePopoutVisibilityMenu}
              align="start"
              sideOffset={4}
            >
              {parameters.map((p, i) => {
                const name = p.name ? ` - ${p.name}` : '';
                return (
                  <DropdownMenu.CheckboxItem
                    key={i}
                    checked={p.visible !== false}
                    className="editor-context-menu__item"
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(visible) => handleVisibilityToggle(i, visible)}
                  >
                    Parameter {i + 1}
                    {name}
                    <DropdownMenu.ItemIndicator className="editor-context-menu__item-indicator">
                      <Check size={12} strokeWidth={2.5} />
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.CheckboxItem>
                );
              })}
            </DropdownMenu.Content>
          </PopoutDropdownMenuPortal>
        </DropdownMenu.Root>
        <div className="flex-1" />
        <label className="flex items-center gap-1 text-role-body text-gray-300">
          <input
            type="checkbox"
            checked={payload?.seedUsed}
            onChange={handleSeedUsedChange}
            className="rounded border border-blue-border"
          />
          Seed
        </label>
        {payload?.seedUsed && (
          <SeedInput
            value={payload.seed}
            onCommit={(seed) => patch({ seed })}
            className="w-24 rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
          />
        )}
        <button
          type="button"
          className="rounded border border-blue-border px-2 py-0.5 text-role-body text-gray-300 hover:border-blue-accent"
          onClick={handleTest}
          disabled={testing}
          title="Test (Cmd/Ctrl+T)"
        >
          {testing ? 'Testing...' : 'Test'}
        </button>
      </div>
      {testError && (
        <div className="px-3 py-1.5 text-role-body border-b shrink-0 bg-red-900/20 text-red-300 flex items-center gap-2">
          <span>Error: {testError}</span>
          <button
            className="underline text-blue-muted hover:text-gray-200"
            onClick={clearTestError}
          >
            dismiss
          </button>
        </div>
      )}
      {testOutput !== null && <GeneratedScoreModal text={testOutput} onClose={clearTestOutput} />}
      <div className="flex-1 overflow-auto p-1 space-y-1">
        {visibleRows
          .filter((r) => r.parameter.visible !== false)
          .map((row) => (
            <ParameterRow
              key={`${JSON.stringify(document.target)}:${row.fieldIndex}`}
              parameter={row.parameter}
              parameterNum={row.parameterNum}
              duration={duration}
              field={field}
              fieldIndex={row.fieldIndex}
              onFieldChange={handleFieldChange}
            />
          ))}
      </div>
    </div>
  );
}

function SeedInput({
  value,
  onCommit,
  className,
}: {
  value: string;
  onCommit: (value: string) => void;
  className: string;
}): React.ReactElement {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const valid =
    /^[+-]?\d+$/.test(draft.trim()) &&
    BigInt(draft.trim()) >= -9223372036854775808n &&
    BigInt(draft.trim()) <= 9223372036854775807n;
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label="Random seed"
      aria-invalid={!valid}
      value={draft}
      className={className}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        const token = event.currentTarget.value.trim();
        if (!/^[+-]?\d+$/.test(token)) return;
        const seed = BigInt(token);
        if (seed < -9223372036854775808n || seed > 9223372036854775807n) return;
        const canonical = String(seed);
        setDraft(canonical);
        if (canonical !== value) onCommit(canonical);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur();
        if (event.key === 'Escape') {
          event.currentTarget.value = value;
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
