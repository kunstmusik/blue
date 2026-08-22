import { TrackLayerGroup } from './track-layer-group';
import { LayerGroupProvider } from '../layers/layer-group-provider';
import { LayerGroup } from '../layers/layer-group';
import { Layer } from '../layers/layer';
import { Element } from '../../serialization/xml-reader';
import { ObjRefLoadMap } from '../../serialization/obj-ref-map';

export class TrackLayerGroupProvider implements LayerGroupProvider {
  getLayerGroupName(): string { return 'Track'; }

  createLayerGroup(): LayerGroup<Layer> {
    const group = new TrackLayerGroup();
    group.newLayerAt(0);
    return group;
  }

  loadFromXML(element: Element, objRefMap: ObjRefLoadMap): LayerGroup<Layer> | null {
    return element.getName() === 'trackLayerGroup'
      ? TrackLayerGroup.loadFromXML(element, objRefMap)
      : null;
  }
}
