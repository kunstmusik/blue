import React, { useCallback } from 'react';
import { X } from 'lucide-react';
import type { FieldDefSnapshot } from './types';
import { AppSelect } from '../../../../../AppSelect';

interface FieldDefinitionsEditorProps {
  fieldDefinitions: FieldDefSnapshot[];
  onPatch: (patch: Record<string, unknown>) => void;
}

export default function FieldDefinitionsEditor({
  fieldDefinitions,
  onPatch,
}: FieldDefinitionsEditorProps): React.ReactElement {
  const handleAdd = useCallback(() => {
    const name = `field${fieldDefinitions.length + 1}`;
    onPatch({
      addFieldDef: {
        fieldName: name,
        fieldType: 'CONTINUOUS',
        minValue: 0,
        maxValue: 1,
        defaultValue: 1,
      },
    });
  }, [fieldDefinitions.length, onPatch]);

  const handleRemove = useCallback(
    (index: number) => {
      onPatch({ removeFieldDef: index });
    },
    [onPatch],
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="text-role-headline font-bold text-blue-muted uppercase tracking-wider">
        Additional Fields
      </div>
      <div className="overflow-x-auto rounded border border-blue-border/40 bg-black p-1">
        <table className="w-full text-role-body">
          <thead>
            <tr className="text-blue-muted">
              <th className="text-left py-0.5 px-1">Name</th>
              <th className="text-left py-0.5 px-1">Type</th>
              <th className="text-left py-0.5 px-1">Min</th>
              <th className="text-left py-0.5 px-1">Max</th>
              <th className="text-left py-0.5 px-1">Default</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {fieldDefinitions.map((fd, index) => (
              <tr key={index} className="border-t border-blue-border/20">
                <td className="py-0.5 px-1">
                  <input
                    type="text"
                    className="w-full bg-transparent text-gray-200 focus:outline-none"
                    value={fd.fieldName}
                    onChange={(e) =>
                      onPatch({ updateFieldDef: { index, fieldName: e.target.value } })
                    }
                  />
                </td>
                <td className="py-0.5 px-1">
                  <AppSelect
                    className="bg-transparent text-gray-200 focus:outline-none"
                    value={fd.fieldType}
                    onValueChange={(value) =>
                      onPatch({ updateFieldDef: { index, fieldType: value } })
                    }
                    options={[
                      { value: 'CONTINUOUS', label: 'Continuous' },
                      { value: 'DISCRETE', label: 'Discrete' },
                    ]}
                  />
                </td>
                <td className="py-0.5 px-1">
                  <input
                    type="number"
                    className="w-12 bg-transparent text-gray-200 focus:outline-none"
                    value={fd.minValue}
                    step="any"
                    onChange={(e) =>
                      onPatch({
                        updateFieldDef: { index, minValue: parseFloat(e.target.value) || 0 },
                      })
                    }
                  />
                </td>
                <td className="py-0.5 px-1">
                  <input
                    type="number"
                    className="w-12 bg-transparent text-gray-200 focus:outline-none"
                    value={fd.maxValue}
                    step="any"
                    onChange={(e) =>
                      onPatch({
                        updateFieldDef: { index, maxValue: parseFloat(e.target.value) || 0 },
                      })
                    }
                  />
                </td>
                <td className="py-0.5 px-1">
                  <input
                    type="number"
                    className="w-12 bg-transparent text-gray-200 focus:outline-none"
                    value={fd.defaultValue}
                    step="any"
                    onChange={(e) =>
                      onPatch({
                        updateFieldDef: { index, defaultValue: parseFloat(e.target.value) || 0 },
                      })
                    }
                  />
                </td>
                <td className="py-0.5 px-1">
                  <button
                    className="text-red-400 hover:text-red-300 flex items-center justify-center"
                    onClick={() => handleRemove(index)}
                    title="Remove Field"
                    aria-label="Remove Field"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="text-role-callout text-blue-accent hover:text-blue-accent/80 self-start"
        onClick={handleAdd}
      >
        + Add Field
      </button>
    </div>
  );
}
