import React from 'react';
import type { BlueX7Voice } from '@blue/data';
import type { BlueX7Patch } from '../../../../shared/project-editor';
import type { ProjectDocumentCommitMetadata } from '../../../../shared/project-history';
import SelectedCodeEditor from '../../workbench/panels/editors/SelectedCodeEditor';

export interface CsoundPanelProps {
  voice: BlueX7Voice;
  historyIdentity?: string;
  active?: boolean;
  onApplyPatch: (
    description: string,
    patch: BlueX7Patch,
    metadata?: ProjectDocumentCommitMetadata,
  ) => void;
}

export const CsoundPanel: React.FC<CsoundPanelProps> = ({
  voice,
  historyIdentity = 'bluex7',
  active = true,
  onApplyPatch,
}) => {
  const handlePostCodeChange = (text: string, metadata?: ProjectDocumentCommitMetadata) => {
    const patch = { type: 'setCsoundPostCode' as const, text };
    if (metadata) {
      onApplyPatch('Edit Csound Post-Code', patch, metadata);
    } else {
      onApplyPatch('Edit Csound Post-Code', patch);
    }
  };

  return (
    <div
      className="flex flex-col h-full min-h-0 rounded border border-blue-border bg-blue-surface/40 p-3 gap-3"
      data-testid="bluex7-csound-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-blue-border pb-1 shrink-0">
        <span className="text-role-headline font-bold text-gray-200 uppercase tracking-wider">
          Post Code
        </span>
      </div>

      <div className="flex flex-col flex-1 min-h-0 gap-1.5" data-testid="bluex7-post-code-tab">
        <span className="text-role-body text-blue-muted shrink-0">
          Post-processing code executed after the FM orchestra (e.g. mixer output, panning,
          effects):
        </span>
        <div className="flex-1 min-h-0 h-full">
          <SelectedCodeEditor
            active={active}
            value={voice.csoundPostCode ?? ''}
            mode="orc"
            typingGroupingMs={500}
            historyMetadata={{
              fieldId: `instrument:${historyIdentity}:csoundPostCode`,
              gestureId: `project-text:instrument:${historyIdentity}:csoundPostCode`,
              label: 'Edit Csound Post-Code',
              phase: 'update',
            }}
            ariaLabel="Csound Post Code"
            onChange={handlePostCodeChange}
          />
        </div>
      </div>
    </div>
  );
};
