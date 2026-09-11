import type {
  ClojureProjectSnapshot,
  ProjectPropertiesSnapshot,
} from '../../../../../shared/project-editor';
import type { ProjectDocumentCommitMetadata } from '../../../../../shared/project-history';

export interface ProjectPropertiesTabProps {
  disabled: boolean;
  properties: ProjectPropertiesSnapshot;
  updateProjectProperties: (
    patch: Partial<ProjectPropertiesSnapshot>,
    metadata?: ProjectDocumentCommitMetadata,
  ) => void | Promise<void>;
}

export interface ClojureProjectTabProps {
  disabled: boolean;
  clojureProject: ClojureProjectSnapshot;
  updateClojureProject: (
    clojureProject: ClojureProjectSnapshot,
    metadata?: ProjectDocumentCommitMetadata,
  ) => void | Promise<void>;
}
