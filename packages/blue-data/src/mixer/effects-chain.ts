/**
 * EffectsChain — ordered list of effects for a channel.
 * Mirrors the Java EffectsChain class.
 */
import { Effect } from './effect';
import { Send } from './send';
import { Element } from '../serialization/xml-reader';
import { BlueDataObject } from '../blue-data-object';
import type { CopyMode } from '../deep-copyable';

export type EffectsChainItem = Effect | Send;

export class EffectsChain extends Array<EffectsChainItem> implements BlueDataObject {
  getSends(): Send[] {
    return this.filter((item): item is Send => item instanceof Send);
  }

  saveAsXML(): Element {
    const elem = new Element('effectsChain');
    for (const item of this) {
      elem.addElement(item.saveAsXML());
    }
    return elem;
  }

  static loadFromXML(data: Element): EffectsChain {
    const chain = new EffectsChain();

    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      if (node.getName() === 'effect') {
        chain.push(Effect.loadFromXML(node));
      } else if (node.getName() === 'send') {
        chain.push(Send.loadFromXML(node));
      }
    }

    return chain;
  }

  deepCopy(mode: CopyMode = 'duplication'): BlueDataObject {
    const copy = new EffectsChain();
    for (const item of this) {
      if (item instanceof Effect) {
        copy.push(item.deepCopy(mode) as Effect);
      } else {
        copy.push(item.deepCopy(mode) as Send);
      }
    }
    return copy;
  }
}
