import React, { useMemo, useState } from 'react';
import { useProjectStore } from '../../../stores/project-store';
import type { ClojureProjectTabProps, ProjectPropertiesTabProps } from './project-properties/types';
import ProjectInformationTab from './project-properties/ProjectInformationTab';
import RealtimeRenderTab from './project-properties/RealtimeRenderTab';
import DiskRenderTab from './project-properties/DiskRenderTab';
import MediaTab from './project-properties/MediaTab';
import ClojureProjectTab from './project-properties/ClojureProjectTab';
import { cn } from '../../../lib/cn';

type ProjectPropertiesTabKey = 'information' | 'realtime' | 'disk' | 'media' | 'clojure';

const TAB_ORDER: Array<{
  key: ProjectPropertiesTabKey;
  label: string;
  title: string;
  description: string;
}> = [
  {
    key: 'information',
    label: 'Project Information',
    title: 'Project Information',
    description: 'Basic metadata for the current project.',
  },
  {
    key: 'realtime',
    label: 'Realtime',
    title: 'Realtime Render',
    description: 'Settings used for realtime playback, audio I/O, and live render flags.',
  },
  {
    key: 'disk',
    label: 'Disk Render',
    title: 'Disk Render',
    description: 'Defaults used when rendering to disk instead of the realtime engine.',
  },
  {
    key: 'media',
    label: 'Media',
    title: 'Media',
    description: 'Media folder behavior for imported files and project-managed assets.',
  },
  {
    key: 'clojure',
    label: 'Clojure',
    title: 'Clojure',
    description: 'Project-level Clojure dependencies loaded before render and evaluation.',
  },
];

function SectionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      className={cn(
        'block w-full border-l-2 px-4 py-2 text-left text-role-body transition-colors',
        active
          ? 'border-l-blue-accent bg-blue-accent/[0.08] text-gray-100'
          : 'border-l-transparent text-blue-muted hover:text-gray-100',
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function EmptyProjectPropertiesState(): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center bg-blue-bg px-6 text-center text-blue-muted">
      <div className="max-w-md rounded-lg border border-blue-border bg-blue-surface/70 px-6 py-5">
        <div className="text-role-headline font-bold text-gray-100">No project loaded</div>
        <div className="mt-2 text-role-body">
          Open a project to edit project information, render settings, and media paths.
        </div>
      </div>
    </div>
  );
}

function TabContent({
  tab,
  propertyProps,
  clojureProps,
}: {
  tab: ProjectPropertiesTabKey;
  propertyProps: ProjectPropertiesTabProps;
  clojureProps: ClojureProjectTabProps;
}): React.ReactElement {
  switch (tab) {
    case 'information':
      return <ProjectInformationTab {...propertyProps} />;
    case 'realtime':
      return <RealtimeRenderTab {...propertyProps} />;
    case 'disk':
      return <DiskRenderTab {...propertyProps} />;
    case 'media':
      return <MediaTab {...propertyProps} />;
    case 'clojure':
      return <ClojureProjectTab {...clojureProps} />;
  }
}

export default function ProjectPropertiesPanel(): React.ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const projectProperties = useProjectStore((state) => state.projectProperties);
  const clojureProject = useProjectStore((state) => state.clojureProject);
  const updateProjectProperties = useProjectStore((state) => state.updateProjectProperties);
  const updateClojureProject = useProjectStore((state) => state.updateClojureProject);
  const [activeTab, setActiveTab] = useState<ProjectPropertiesTabKey>('information');

  const propertyProps = useMemo<ProjectPropertiesTabProps>(
    () => ({
      disabled: !loaded,
      properties: projectProperties,
      updateProjectProperties,
    }),
    [loaded, projectProperties, updateProjectProperties],
  );

  const clojureProps = useMemo<ClojureProjectTabProps>(
    () => ({
      disabled: !loaded,
      clojureProject,
      updateClojureProject,
    }),
    [clojureProject, loaded, updateClojureProject],
  );

  const activeSection = TAB_ORDER.find((section) => section.key === activeTab) ?? TAB_ORDER[0];

  if (!loaded) {
    return <EmptyProjectPropertiesState />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-br from-app-surface/30 to-app-bg text-app-text md:flex-row">
      <aside className="flex w-full flex-col border-b border-blue-border/80 bg-blue-surface md:w-48 md:border-b-0 md:border-r md:py-3">
        <nav className="flex-1 overflow-auto">
          {TAB_ORDER.map((tab) => (
            <SectionButton
              key={tab.key}
              active={activeTab === tab.key}
              label={tab.label}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </nav>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-blue-border/80 bg-gradient-to-b from-app-surface-strong to-app-bg px-5 py-4 md:px-6">
          <h2 className="text-role-title-2 font-semibold text-app-text-strong">
            {activeSection.title}
          </h2>
          <p className="mt-1 max-w-2xl text-role-body text-app-text-muted">
            {activeSection.description}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-5 md:px-6 md:py-6">
          <TabContent tab={activeTab} propertyProps={propertyProps} clojureProps={clojureProps} />
        </div>
      </div>
    </div>
  );
}
