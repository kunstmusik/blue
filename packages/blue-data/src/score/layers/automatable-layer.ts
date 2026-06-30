import { Layer } from './layer';
import type { ParameterIdList } from '../../automation/parameter-id-list';

export interface AutomatableLayer extends Layer {
  getAutomationParameters(): ParameterIdList;
}
