import React from 'react';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
  dependencyNote?: string | null;
}

export default function SettingsSection({
  title,
  children,
  dependencyNote,
}: SettingsSectionProps): React.ReactElement {
  return (
    <section className="mx-auto max-w-3xl">
      <h2 className="mb-5 text-role-title-2 font-semibold text-app-text-strong">{title}</h2>
      {children}
      {dependencyNote && (
        <div className="mt-4 rounded-md border border-app-warning/30 bg-app-warning/10 px-3 py-2 text-role-callout text-app-warning">
          {dependencyNote}
        </div>
      )}
    </section>
  );
}
