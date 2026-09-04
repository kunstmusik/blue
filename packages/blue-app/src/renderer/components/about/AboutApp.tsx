import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

import type { AppMetadata } from '../../../shared/app-metadata';
import { cn } from '../../lib/cn';

interface AboutAppProps {
  iconUrl: string;
}

const UNKNOWN_METADATA: AppMetadata = {
  version: 'unknown',
  sourceRevision: 'unknown',
  buildDate: 'unknown',
  channel: 'unknown',
  runtime: {
    electron: 'unknown',
    chromium: 'unknown',
    node: 'unknown',
  },
};

function formatBuildDate(value: string): string {
  if (value === 'unknown') return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function MetadataRow({ label, value, breakValue = false }: {
  label: string;
  value: string;
  breakValue?: boolean;
}) {
  return (
    <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-baseline gap-4 border-b border-app-border/60 py-1.5 last:border-b-0">
      <dt className="text-role-body text-app-text-muted">{label}</dt>
      <dd className={cn('min-w-0 text-right text-role-body text-app-text-soft', breakValue && 'break-all font-mono')}>
        {value}
      </dd>
    </div>
  );
}

export default function AboutApp({ iconUrl }: AboutAppProps) {
  const [metadata, setMetadata] = useState<AppMetadata>(UNKNOWN_METADATA);

  useEffect(() => {
    let active = true;
    void window.blueAPI.getAppMetadata()
      .then((nextMetadata) => {
        if (active) setMetadata(nextMetadata);
      })
      .catch(() => {
        if (active) setMetadata(UNKNOWN_METADATA);
      });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        void window.blueAPI.closeAboutWindow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      active = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <main className="flex h-full min-h-0 flex-col overflow-auto bg-[linear-gradient(145deg,var(--color-app-surface-strong)_0%,var(--color-app-canvas)_72%)] px-7 py-6 text-app-text">
      <div className="pointer-events-none absolute left-0 top-0 h-1 w-full bg-app-accent" />
      <section className="flex items-start gap-5">
        <div className="flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center rounded-xl border border-app-accent/35 bg-app-surface p-3 shadow-[0_0.625rem_1.5rem_var(--color-app-shadow)]">
          <img className="h-full w-full object-contain" src={iconUrl} alt="Blue icon" />
        </div>
        <div className="min-w-0 pt-1">
          <p className="mb-1 text-role-callout font-medium uppercase tracking-[0.3em] text-app-accent">Blue</p>
          <h1 className="text-role-large-title font-medium text-app-text-strong">About Blue</h1>
          <p className="mt-2 max-w-[18.125rem] text-role-body text-app-text-muted">
            An object composition environment for Csound.
          </p>
        </div>
      </section>

      <div className="my-5 h-px bg-app-border/70" />

      <section aria-labelledby="build-details-heading" className="min-h-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <Check size={13} strokeWidth={2.25} className="text-app-accent" aria-hidden="true" />
          <h2 id="build-details-heading" className="text-role-title-3 font-semibold uppercase tracking-[0.18em] text-app-text-muted">
            Build details
          </h2>
        </div>
        <dl>
          <MetadataRow label="Version" value={metadata.version} />
          <MetadataRow label="Channel" value={metadata.channel} />
          <MetadataRow label="Build date" value={formatBuildDate(metadata.buildDate)} />
          <MetadataRow label="Git hash" value={metadata.sourceRevision} breakValue />
        </dl>
      </section>

      <section aria-labelledby="runtime-heading" className="mt-5">
        <h2 id="runtime-heading" className="mb-1 text-role-title-3 font-semibold uppercase tracking-[0.18em] text-app-text-muted">
          Runtime
        </h2>
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-role-callout text-app-text-muted">Electron</dt>
            <dd className="mt-0.5 font-mono text-role-body text-app-text-soft">{metadata.runtime.electron}</dd>
          </div>
          <div>
            <dt className="text-role-callout text-app-text-muted">Chromium</dt>
            <dd className="mt-0.5 font-mono text-role-body text-app-text-soft">{metadata.runtime.chromium}</dd>
          </div>
          <div>
            <dt className="text-role-callout text-app-text-muted">Node.js</dt>
            <dd className="mt-0.5 font-mono text-role-body text-app-text-soft">{metadata.runtime.node}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          autoFocus
          onClick={() => { void window.blueAPI.closeAboutWindow(); }}
          className="inline-flex items-center gap-2 rounded border border-app-accent bg-app-accent px-4 py-1.5 text-role-body font-medium text-app-text-strong transition-colors hover:bg-app-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-focus"
        >
          <X size={14} strokeWidth={2.25} aria-hidden="true" />
          Close
        </button>
      </div>
    </main>
  );
}
