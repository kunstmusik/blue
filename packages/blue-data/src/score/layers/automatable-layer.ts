import { Layer } from './layer';
import type { ParameterIdList } from '../../automation/parameter-id-list';

export interface AutomatableLayer extends Layer {
  /** Returns the collection of associated automation parameter IDs. */
  getAutomationParameters(): ParameterIdList;
}
