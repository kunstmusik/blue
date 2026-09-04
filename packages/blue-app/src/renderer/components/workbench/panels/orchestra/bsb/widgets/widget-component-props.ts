import type {
  BsbInterfacePatch,
  BsbWidgetNodeSnapshot,
} from '../../../../../../../shared/project-editor';
import type { BSBWidgetResizeMeta } from '../bsb-widget-meta';

export interface BSBWidgetComponentProps {
  node: BsbWidgetNodeSnapshot;
  isSelected: boolean;
  editEnabled: boolean;
  onWidgetSelect: (id: string | null, shiftKey?: boolean) => void;
  onBsbInterfacePatch?: (patch: BsbInterfacePatch) => void;
  resizeMeta?: BSBWidgetResizeMeta;
  gridSnapEnabled?: boolean;
  gridSnapWidth?: number;
  gridSnapHeight?: number;
  selectedWidgetIds?: Set<string>;
  getWidgetPosition?: (id: string) => { x: number; y: number } | undefined;
  onWidgetAction?: (action: string) => void;
}

export interface BSBWidgetPatchComponentProps extends Omit<
  BSBWidgetComponentProps,
  'onBsbInterfacePatch'
> {
  onBsbInterfacePatch: (patch: BsbInterfacePatch) => void;
}
