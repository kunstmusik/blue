import React from 'react';

interface InstrumentNameFieldProps {
  name: string;
  onNameChange: (name: string) => void | Promise<void>;
}

export default function InstrumentNameField({
  name,
  onNameChange,
}: InstrumentNameFieldProps): React.ReactElement {
  return (
    <label className="flex items-center gap-3 text-role-body text-blue-muted">
      <span className="w-20 shrink-0 text-right">Name</span>
      <input
        className="min-w-0 flex-1 rounded border border-blue-border bg-app-input px-2 py-1.5 text-role-body text-app-text outline-none focus:border-blue-accent"
        value={name}
        onChange={(event) => void onNameChange(event.target.value)}
      />
    </label>
  );
}

