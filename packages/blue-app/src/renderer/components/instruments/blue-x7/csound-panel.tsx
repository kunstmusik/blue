import React, { useEffect, useState } from 'react';
import type { BlueX7Voice } from '@blue/data';
import { generateBlueX7Preview, type BlueX7PreviewResult } from '@blue/data';
import type { BlueX7Patch } from '../../../../shared/project-editor';
import SelectedCodeEditor from '../../workbench/panels/editors/SelectedCodeEditor';

export interface CsoundPanelProps {
  voice: BlueX7Voice;
  instrumentName?: string;
  onApplyPatch: (description: string, patch: BlueX7Patch) => void;
}

export const CsoundPanel: React.FC<CsoundPanelProps> = ({
  voice,
  instrumentName = 'BlueX7',
  onApplyPatch,
}) => {
  const [activeTab, setActiveTab] = useState<'postCode' | 'preview' | 'bindings'>('postCode');
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

  return (
    <div className="rounded border border-blue-border bg-blue-surface/40 p-3 space-y-3" data-testid="bluex7-csound-panel">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between border-b border-blue-border pb-2">
        <div className="flex items-center gap-2">
          <span className="text-role-headline text-gray-200 uppercase tracking-wider">Csound & Code</span>
          <div className="flex rounded border border-blue-border bg-blue-bg/80 p-0.5 text-role-body">
            <button
              type="button"
              aria-label="Csound Post Code Tab"
              onClick={() => setActiveTab('postCode')}
              className={`rounded px-2.5 py-0.5 transition-colors ${
                activeTab === 'postCode' ? 'bg-blue-accent text-white font-medium' : 'text-blue-muted hover:text-gray-200'
              }`}
            >
              Post Code
            </button>
            <button
              type="button"
              aria-label="Csound Preview Tab"
              onClick={() => setActiveTab('preview')}
              className={`rounded px-2.5 py-0.5 transition-colors ${
                activeTab === 'preview' ? 'bg-blue-accent text-white font-medium' : 'text-blue-muted hover:text-gray-200'
              }`}
            >
              Generated Preview
            </button>
            <button
              type="button"
              aria-label="Csound Bindings Tab"
              onClick={() => setActiveTab('bindings')}
              className={`rounded px-2.5 py-0.5 transition-colors ${
                activeTab === 'bindings' ? 'bg-blue-accent text-white font-medium' : 'text-blue-muted hover:text-gray-200'
              }`}
            >
              Bindings & Diagnostics
            </button>
          </div>
        </div>
      </div>

      {/* Tab: Post Code */}
      {activeTab === 'postCode' && (
        <div className="flex flex-col gap-1.5 h-64" data-testid="bluex7-post-code-tab">
          <span className="text-role-body text-blue-muted">
            Post-processing code executed after the FM orchestra (e.g. mixer output, panning, effects):
          </span>
          <SelectedCodeEditor
            value={voice.csoundPostCode ?? ''}
            mode="orc"
            ariaLabel="Csound Post Code"
            onChange={handlePostCodeChange}
          />
        </div>
      )}

      {/* Tab: Generated Preview */}
      {activeTab === 'preview' && (
        <div className="space-y-2" data-testid="bluex7-preview-tab">
          {previewError ? (
            <div className="rounded border border-red-500/50 bg-red-900/30 p-2 text-role-subheadline text-red-200" data-testid="csound-preview-error">
              {previewError}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <span className="text-role-subheadline font-semibold text-blue-muted block mb-1">Generated F-Tables:</span>
                <pre
                  data-testid="csound-tables-preview"
                  className="max-h-60 overflow-y-auto rounded border border-blue-border bg-blue-bg/90 p-2 font-mono text-role-subheadline text-gray-200"
                >
                  {preview?.tables || '; Generating tables...'}
                </pre>
              </div>
              <div>
                <span className="text-role-subheadline font-semibold text-blue-muted block mb-1">Generated Instrument Body:</span>
                <pre
                  data-testid="csound-body-preview"
                  className="max-h-60 overflow-y-auto rounded border border-blue-border bg-blue-bg/90 p-2 font-mono text-role-subheadline text-gray-200"
                >
                  {preview?.body || '; Generating body...'}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Bindings & Diagnostics */}
      {activeTab === 'bindings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="bluex7-bindings-tab">
          <div className="rounded border border-blue-border bg-blue-bg/40 p-2.5 space-y-1.5">
            <span className="text-role-subheadline font-semibold text-emerald-400 block">
              ✓ Emitted Synthesis Parameters
            </span>
            <ul className="text-role-subheadline text-gray-300 space-y-1 list-disc list-inside">
              {preview?.bindings.emitted.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded border border-blue-border bg-blue-bg/40 p-2.5 space-y-1.5">
            <span className="text-role-subheadline font-semibold text-amber-400 block">
              ⚠ Preserved But Dormant in Csound Engine
            </span>
            <ul className="text-role-subheadline text-blue-muted space-y-1 list-disc list-inside">
              {preview?.bindings.notEmitted.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
