import React, { useCallback } from 'react';
import type { FieldDefSnapshot } from './types';
import { AppSelect } from '../../../../../AppSelect';

interface FieldSelectorViewProps {
  fieldDefinitions: FieldDefSnapshot[];
  selectedFieldDef: FieldDefSnapshot | null;
  onSelectField: (fieldDef: FieldDefSnapshot | null) => void;
}

export default function FieldSelectorView({
  fieldDefinitions,
  selectedFieldDef,
  onSelectField,
}: FieldSelectorViewProps): React.ReactElement {
  const handleChange = useCallback(
    (value: string) => {
      const idx = parseInt(value, 10);
      if (idx < 0 || idx >= fieldDefinitions.length) {
        onSelectField(null);
      } else {
        onSelectField(fieldDefinitions[idx]!);
      }
    },
    [fieldDefinitions, onSelectField],
  );

  const selectedIndex = selectedFieldDef
    ? fieldDefinitions.findIndex((fd) => fd.fieldName === selectedFieldDef.fieldName)
    : -1;

  return (
    <AppSelect
      className="h-full w-full border-t border-blue-border/30 bg-app-surface-strong px-1 text-role-body text-blue-muted focus:outline-none"
      value={selectedIndex}
      onValueChange={handleChange}
      options={fieldDefinitions.map((field, index) => ({ value: index, label: field.fieldName }))}
    />
  );
}
