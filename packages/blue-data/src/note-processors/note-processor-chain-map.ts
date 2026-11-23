import { XmlLoadContext } from '../serialization/xml-load';
import { checkRoot, checkShape } from '../utilities/xml';
import { Element } from '../serialization/xml-reader';
import { BlueDataObject } from '../blue-data-object';
import { NoteProcessorChain } from './note-processor-chain';

export class NoteProcessorChainMap implements BlueDataObject {
  private chains = new Map<string, NoteProcessorChain>();

  /** Creates a default note processor chain map or copies a supplied instance. */
  constructor(other?: NoteProcessorChainMap) {
    if (other) {
      for (const [name, chain] of other.chains) {
        this.chains.set(name, chain.deepCopy());
      }
    }
  }

  /** Looks up the processor chain saved under the given name. */
  getChain(name: string): NoteProcessorChain | undefined {
    return this.chains.get(name);
  }

  /** Retrieves the chain associated with the supplied name. */
  getNoteProcessorChain(name: string): NoteProcessorChain | undefined {
    return this.chains.get(name);
  }

  /** Stores a named chain, replacing the previous entry for that name. */
  setChain(name: string, chain: NoteProcessorChain): void {
    this.chains.set(name, chain);
  }

  /** Returns the names of the currently stored chains. */
  getChainNames(): string[] {
    return Array.from(this.chains.keys());
  }

  /** Removes the entry under the supplied name. */
  removeChain(name: string): void {
    this.chains.delete(name);
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessorChainMap');
    for (const [name, chain] of this.chains) {
      const npcNode = new Element('npc');
      npcNode.setAttribute('name', name);
      npcNode.addElement(chain.saveAsXML());
      elem.addElement(npcNode);
    }
    return elem;
  }

  /** Reconstructs the named note processor chains from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): NoteProcessorChainMap {
    checkRoot(data, 'noteProcessorChainMap', context);
    checkShape(data, [], ['npc', 'noteProcessorChain'], context, ['npc', 'noteProcessorChain']);
    const map = new NoteProcessorChainMap();
    const forms = new Map<string, Set<string>>();
    for (const node of data.getElements()) {
      const legacy = node.getName() === 'noteProcessorChain';
      if (!legacy) checkShape(node, ['name'], ['noteProcessorChain'], context);
      const name = node.getAttribute('name');
      let chain = legacy ? node : node.getElement('noteProcessorChain');
      if (!name?.trim() || !chain)
        throw context.at(node).error({
          code: 'conflict',
          message: 'Chain map requires a nonempty name and one chain.',
          recovery: 'Correct the named chain entry.',
        });
      if (legacy) {
        chain = node.clone();
        chain.removeAttribute('name');
        context.anchor(chain, node);
      }
      const value = NoteProcessorChain.loadFromXML(chain, context);
      const existing = map.chains.get(name);
      if (existing) {
        if (
          forms.get(name)?.has(node.getName()) ||
          existing.saveAsXML().toXml() !== value.saveAsXML().toXml()
        )
          throw context.at(node).error({
            code: 'conflict',
            member: '@name',
            value: name,
            message: 'Duplicate or conflicting named chain.',
            recovery: 'Keep one unambiguous named chain.',
          });
      } else {
        forms.set(name, new Set());
        map.chains.set(name, value);
      }
      forms.get(name)!.add(node.getName());
    }
    return map;
  }

  deepCopy(): BlueDataObject {
    return new NoteProcessorChainMap(this);
  }
}
