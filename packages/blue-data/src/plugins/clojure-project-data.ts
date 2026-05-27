import type { BlueDataObject } from '../blue-data-object';
import { Element } from '../serialization/xml-reader';

export const CLOJURE_PROJECT_DATA_BDO_TYPE = 'blue.clojure.project.ClojureProjectData';

export class ClojureLibraryEntry implements BlueDataObject {
  private dependencyCoordinates = 'org/library-name';
  private version = '1.0.0';

  constructor(other?: ClojureLibraryEntry) {
    if (other) {
      this.dependencyCoordinates = other.dependencyCoordinates;
      this.version = other.version;
    }
  }

  getDependencyCoordinates(): string {
    return this.dependencyCoordinates;
  }

  setDependencyCoordinates(coordinates: string): void {
    this.dependencyCoordinates = coordinates;
  }

  getVersion(): string {
    return this.version;
  }

  setVersion(version: string): void {
    this.version = version;
  }

  static loadFromXML(data: Element): ClojureLibraryEntry {
    const entry = new ClojureLibraryEntry();
    const nodes = data.getElements();

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const nodeText = node.getTextString();

      switch (node.getName()) {
        case 'coordinates':
          entry.setDependencyCoordinates(nodeText);
          break;
        case 'version':
          entry.setVersion(nodeText);
          break;
      }
    }

    return entry;
  }

  saveAsXML(): Element {
    const element = new Element('clojureLibraryEntry');
    element.addElement('coordinates').setText(this.getDependencyCoordinates());
    element.addElement('version').setText(this.getVersion());
    return element;
  }

  deepCopy(): BlueDataObject {
    return new ClojureLibraryEntry(this);
  }
}

export class ClojureProjectData implements BlueDataObject {
  private libraryEntries: ClojureLibraryEntry[] = [];

  constructor(other?: ClojureProjectData) {
    if (other) {
      this.libraryEntries = other.libraryEntries.map(
        (entry) => entry.deepCopy() as ClojureLibraryEntry,
      );
    }
  }

  getLibraryEntries(): ClojureLibraryEntry[] {
    return this.libraryEntries;
  }

  setLibraryEntries(entries: ClojureLibraryEntry[]): void {
    this.libraryEntries = [...entries];
  }

  addLibraryEntry(entry: ClojureLibraryEntry): void {
    this.libraryEntries.push(entry);
  }

  getPomegranateString(): string | null {
    const filtered = this.libraryEntries.filter(
      (entry) =>
        entry.getDependencyCoordinates().trim().length > 0 &&
        entry.getVersion().trim().length > 0,
    );

    if (filtered.length === 0) {
      return null;
    }

    let builder = "(use '[cemerick.pomegranate :only (add-dependencies)])\n";
    builder += "(add-dependencies :coordinates '[";

    for (const entry of filtered) {
      builder += `[${entry.getDependencyCoordinates()} \"${entry.getVersion()}\" :exclusions [org.clojure/clojure]]\n`;
    }

    builder += '] :repositories (merge ';
    builder += 'cemerick.pomegranate.aether/maven-central ';
    builder += '{"clojars" "https://repo.clojars.org"}))';

    return builder;
  }

  static loadFromXML(data: Element): ClojureProjectData {
    const projectData = new ClojureProjectData();
    const nodes = data.getElements();

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      if (node.getName() === 'clojureLibraryEntry') {
        projectData.addLibraryEntry(ClojureLibraryEntry.loadFromXML(node));
      }
    }

    return projectData;
  }

  saveAsXML(): Element {
    const element = new Element('blueDataObject');
    element.setAttribute('bdoType', CLOJURE_PROJECT_DATA_BDO_TYPE);

    for (const entry of this.libraryEntries) {
      element.addElement(entry.saveAsXML());
    }

    return element;
  }

  deepCopy(): BlueDataObject {
    return new ClojureProjectData(this);
  }
}

export function isClojureProjectDataElement(element: Element | null): element is Element {
  return (
    element !== null &&
    element.getName() === 'blueDataObject' &&
    element.getAttribute('bdoType') === CLOJURE_PROJECT_DATA_BDO_TYPE
  );
}

export function findClojureProjectDataElement(pluginDataXml: Element[]): Element | null {
  return pluginDataXml.find((element) => isClojureProjectDataElement(element)) ?? null;
}

export function loadClojureProjectDataFromPluginData(
  pluginDataXml: Element[],
): ClojureProjectData | null {
  const element = findClojureProjectDataElement(pluginDataXml);
  return element ? ClojureProjectData.loadFromXML(element) : null;
}

export function replaceClojureProjectDataInPluginData(
  pluginDataXml: Element[],
  projectData: ClojureProjectData | null,
): Element[] {
  const nextPluginData: Element[] = pluginDataXml.filter(
    (element) => !isClojureProjectDataElement(element),
  );

  if (projectData) {
    nextPluginData.push(projectData.saveAsXML());
  }

  return nextPluginData;
}