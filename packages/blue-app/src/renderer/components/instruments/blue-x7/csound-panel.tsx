import React, { useEffect, useId, useState } from 'react';
import type { BlueX7Voice } from '@blue/data';
import { generateBlueX7Preview, type BlueX7PreviewResult } from '@blue/data';
import type { BlueX7Patch } from '../../../../shared/project-editor';
import { BlueX7TabList, type BlueX7TabItem } from './tab-list';
import SelectedCodeEditor from '../../workbench/panels/editors/SelectedCodeEditor';

export type CsoundSubTab = 'postCode' | 'preview' | 'bindings';

export interface CsoundPanelProps {
  voice: BlueX7Voice;
  instrumentName?: string;
  instanceId?: string;
  active?: boolean;
  onApplyPatch: (description: string, patch: BlueX7Patch) => void;
}

const CSOUND_TABS: readonly BlueX7TabItem<CsoundSubTab>[] = [
  { key: 'postCode', label: 'Post Code', ariaLabel: 'Csound Post Code Tab', testId: 'csound-tab-post-code' },
  { key: 'preview', label: 'Generated Preview', ariaLabel: 'Csound Preview Tab', testId: 'csound-tab-preview' },
  { key: 'bindings', label: 'Bindings & Diagnostics', ariaLabel: 'Csound Bindings Tab', testId: 'csound-tab-bindings' },
];

export const CsoundPanel: React.FC<CsoundPanelProps> = ({
  voice,
  instrumentName = 'BlueX7',
  instanceId: providedInstanceId,
  active = true,
  onApplyPatch,
}) => {
  const generatedId = useId().replace(/:/g, '');
  const instanceId = providedInstanceId ?? `bluex7-csound-${generatedId}`;
  const [activeTab, setActiveTab] = useState<CsoundSubTab>('postCode');
  const [preview, setPreview] = useState<BlueX7PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Debounced live preview generation (latest-only, isolated from project state)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const result = generateBlueX7Preview(voice, instrumentName);
        setPreview(result);
        setPreviewError(null);
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : String(err));
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [voice, instrumentName]);

  const handlePostCodeChange = (text: string) => {
    onApplyPatch('Edit Csound Post-Code', {
      type: 'setCsoundPostCode',
      text,
    });
  };

  const isPostCodeActive = active && activeTab === 'postCode';
  const isPreviewActive = active && activeTab === 'preview';
  const isBindingsActive = active && activeTab === 'bindings';

  return (
    <div className="flex flex-col h-full min-h-0 rounded border border-blue-border bg-blue-surface/40 p-3 gap-3" data-testid="bluex7-csound-panel">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between border-b border-blue-border pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-role-headline font-bold text-gray-200 uppercase tracking-wider">Csound & Code</span>
          <BlueX7TabList<CsoundSubTab>
            instanceId={instanceId}
            ariaLabel="Csound Sections"
            tabs={CSOUND_TABS}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
          />
        </div>
      </div>

      {/* Tabpanel Stack */}
      <div className="relative min-h-0 flex-1 w-full">
        {/* Tab: Post Code */}
        <div
          id={`${instanceId}-panel-postCode`}
          role="tabpanel"
          aria-labelledby={`${instanceId}-tab-postCode`}
          aria-hidden={!isPostCodeActive}
          style={{ visibility: isPostCodeActive ? 'visible' : 'hidden' }}
          className={
            isPostCodeActive
              ? 'relative h-full min-h-0 flex flex-col gap-1.5'
              : 'pointer-events-none absolute inset-0 flex flex-col gap-1.5'
          }
          data-testid="bluex7-post-code-tab"
        >
          <span className="text-role-body text-blue-muted shrink-0">
            Post-processing code executed after the FM orchestra (e.g. mixer output, panning, effects):
          </span>
          <div className="flex-1 min-h-0 h-full">
            <SelectedCodeEditor
              active={isPostCodeActive}
              value={voice.csoundPostCode ?? ''}
              mode="orc"
              ariaLabel="Csound Post Code"
              onChange={handlePostCodeChange}
            />
          </div>
        </div>

        {/* Tab: Generated Preview */}
        <div
          id={`${instanceId}-panel-preview`}
          role="tabpanel"
          aria-labelledby={`${instanceId}-tab-preview`}
          aria-hidden={!isPreviewActive}
          style={{ visibility: isPreviewActive ? 'visible' : 'hidden' }}
          className={
            isPreviewActive
              ? 'relative h-full min-h-0 overflow-y-auto space-y-2'
              : 'pointer-events-none absolute inset-0 overflow-y-auto space-y-2'
          }
          data-testid="bluex7-preview-tab"
        >
          {previewError ? (
            <div className="rounded border border-red-500/50 bg-red-900/30 p-2 text-role-callout text-red-200" data-testid="csound-preview-error">
              {previewError}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-full min-h-0">
              <div className="flex flex-col min-h-0">
                <span className="text-role-headline font-bold text-blue-muted block mb-1 shrink-0">Generated F-Tables:</span>
                <pre
                  data-testid="csound-tables-preview"
                  className="flex-1 min-h-48 overflow-y-auto rounded border border-blue-border bg-blue-bg/90 p-2 font-mono text-role-body text-gray-200"
                >
                  {preview ? preview.tables : '; Generating tables...'}
                </pre>
              </div>
              <div className="flex flex-col min-h-0">
                <span className="text-role-headline font-bold text-blue-muted block mb-1 shrink-0">Generated Instrument Body:</span>
                <pre
                  data-testid="csound-body-preview"
                  className="flex-1 min-h-48 overflow-y-auto rounded border border-blue-border bg-blue-bg/90 p-2 font-mono text-role-body text-gray-200"
                >
                  {preview ? preview.body : '; Generating body...'}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Tab: Bindings & Diagnostics */}
        <div
          id={`${instanceId}-panel-bindings`}
          role="tabpanel"
          aria-labelledby={`${instanceId}-tab-bindings`}
          aria-hidden={!isBindingsActive}
          style={{ visibility: isBindingsActive ? 'visible' : 'hidden' }}
          className={
            isBindingsActive
              ? 'relative h-full min-h-0 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3'
              : 'pointer-events-none absolute inset-0 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3'
          }
          data-testid="bluex7-bindings-tab"
        >
          <div className="rounded border border-blue-border bg-blue-bg/40 p-2.5 space-y-1.5 overflow-y-auto">
            <span className="text-role-headline font-bold text-emerald-400 block">
              ✓ Emitted Synthesis Parameters
            </span>
            <ul className="text-role-callout text-gray-300 space-y-1 list-disc list-inside">
              {preview?.bindings.emitted.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded border border-blue-border bg-blue-bg/40 p-2.5 space-y-1.5 overflow-y-auto">
            <span className="text-role-headline font-bold text-amber-400 block">
              Not Synthesized (Outside Parameter Scope)
            </span>
            <ul className="text-role-callout text-blue-muted space-y-1 list-disc list-inside">
              {preview?.bindings.notEmitted.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
