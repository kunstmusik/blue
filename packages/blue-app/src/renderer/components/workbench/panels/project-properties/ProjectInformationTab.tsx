import React from 'react';
import { APP_INSPECTOR_LABEL_TEXT_CLASS } from '../shared/compactFieldStyles';
import { FieldRow, InputBase, TextAreaBase } from './ProjectPropertyFields';
import type { ProjectPropertiesTabProps } from './types';
import { cn } from '../../../../lib/cn';

export default function ProjectInformationTab({
  disabled,
  properties,
  updateProjectProperties,
}: ProjectPropertiesTabProps): React.ReactElement {
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4">
        <FieldRow label="Title">
          <InputBase
            disabled={disabled}
            value={properties.title}
            label="Title"
            fieldId="project-properties:title"
            onChange={(title, metadata) => updateProjectProperties({ title }, metadata)}
          />
        </FieldRow>
        <FieldRow label="Author">
          <InputBase
            disabled={disabled}
            value={properties.author}
            label="Author"
            fieldId="project-properties:author"
            onChange={(author, metadata) => updateProjectProperties({ author }, metadata)}
          />
        </FieldRow>
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <span className={cn('mb-2', APP_INSPECTOR_LABEL_TEXT_CLASS)}>Notes</span>
        <TextAreaBase
          value={properties.notes}
          placeholder="Project notes"
          disabled={disabled}
          className="min-h-0 flex-1 resize-none"
          label="Notes"
          fieldId="project-properties:notes"
          onChange={(notes, metadata) => updateProjectProperties({ notes }, metadata)}
        />
      </div>
    </div>
  );
}
