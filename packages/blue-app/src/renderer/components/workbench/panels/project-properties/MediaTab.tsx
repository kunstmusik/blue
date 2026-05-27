import React from 'react';
import { CheckboxBase, FieldRow, InputBase } from './ProjectPropertyFields';
import type { ProjectPropertiesTabProps } from './types';

export default function MediaTab({
  disabled,
  properties,
  updateProjectProperties,
}: ProjectPropertiesTabProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <FieldRow label="Media Folder">
        <InputBase
          disabled={disabled}
          value={properties.mediaFolder}
          onChange={(mediaFolder) => updateProjectProperties({ mediaFolder })}
          placeholder="media"
        />
      </FieldRow>
      <FieldRow label="Copy Imported Media">
        <CheckboxBase
          disabled={disabled}
          checked={properties.copyToMediaFileOnImport}
          onChange={(copyToMediaFileOnImport) =>
            updateProjectProperties({ copyToMediaFileOnImport })
          }
        />
      </FieldRow>
    </div>
  );
}
