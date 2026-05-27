import type {
  ClojureProjectSnapshot,
  ProjectPropertiesSnapshot,
} from '../../../../../shared/project-editor';

export interface ProjectPropertiesTabProps {
  disabled: boolean;
  properties: ProjectPropertiesSnapshot;
  updateProjectProperties: (
    patch: Partial<ProjectPropertiesSnapshot>,
  ) => void | Promise<void>;
}

export interface ClojureProjectTabProps {
  disabled: boolean;
  clojureProject: ClojureProjectSnapshot;
  updateClojureProject: (
    clojureProject: ClojureProjectSnapshot,
  ) => void | Promise<void>;
}
