export type {
  AuxiliaryEdge,
  AuxiliaryGroupSizeAction,
  AuxiliarySeedGroupId,
  AuxiliaryGroupKind,
  AuxiliaryPanelPresentation,
  AuxiliarySeedDefinition,
  AuxiliaryGroupInstance,
  AuxiliaryEdgeSlideoutState,
  MinimizedTabState,
  AuxiliarySlideoutView,
  AuxiliaryDockedSizeSnapshot,
  AuxiliaryLayoutState,
} from './auxiliary-layout-model';

export {
  getAuxiliarySeedDefinition,
  getAuxiliaryRailLabel,
  getAuxiliarySeedGroupIdForPanel,
  getAuxiliaryGroupIdForPanel,
  getGroupInstanceForPanel,
  isAuxiliaryPanelId,
  captureAuxiliaryDockedSizes,
  getAuxiliaryPanelPresentation,
  getMinimizedTabsForEdge,
  getAuxiliarySlideoutForEdge,
  createDefaultAuxiliaryLayoutState,
  cloneAuxiliaryLayoutState,
  toggleMinimizedAuxiliaryPanel,
  hideAuxiliarySlideout,
  hideAllAuxiliarySlideouts,
  resizeAuxiliarySlideout,
  moveAuxiliaryEdge,
  moveGroupToEdge,
  movePanelToEdge,
  mergeBackToSeededGroup,
  resetAuxiliaryLayout,
} from './auxiliary-layout-model';

export type { StoredWorkbenchLayout } from './workbench-layout-envelope';
export {
  createStoredWorkbenchLayout,
  parseStoredWorkbenchLayout,
} from './workbench-layout-envelope';

export {
  isAuxiliaryInteractionTarget,
  captureAuxiliaryDockedSizesFromApi,
  shouldPreventAuxiliaryPanelDrop,
  buildDefaultWorkbenchLayout,
  applyAuxiliaryLayout,
  transitionAuxiliaryLayout,
  revealAuxiliaryPanel,
  restoreClosedAuxiliaryPanel,
  dockAuxiliaryPanel,
  minimizeAuxiliaryPanelLayout,
  closeAuxiliaryPanelLayout,
  resizeAuxiliaryGroupLayout,
  minimizeAuxiliaryGroupLayout,
  maximizeAuxiliaryGroupLayout,
  restoreAuxiliaryGroupLayout,
  syncAuxiliaryLayoutFromApi,
} from './auxiliary-layout-dockview';
export type { AuxiliaryLayoutTransitionResult } from './auxiliary-layout-dockview';
