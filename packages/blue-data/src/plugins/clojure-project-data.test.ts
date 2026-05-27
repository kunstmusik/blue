import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import {
  CLOJURE_PROJECT_DATA_BDO_TYPE,
  ClojureLibraryEntry,
  ClojureProjectData,
  findClojureProjectDataElement,
  loadClojureProjectDataFromPluginData,
  replaceClojureProjectDataInPluginData,
} from './clojure-project-data';

describe('ClojureProjectData', () => {
  it('loads Java plugin XML', () => {
    const xml = Element.parse(`<blueDataObject bdoType="blue.clojure.project.ClojureProjectData">
      <clojureLibraryEntry>
        <coordinates>kunstmusik/score</coordinates>
        <version>0.3.0</version>
      </clojureLibraryEntry>
    </blueDataObject>`);

    const data = ClojureProjectData.loadFromXML(xml);

    expect(data.getLibraryEntries()).toHaveLength(1);
    expect(data.getLibraryEntries()[0].getDependencyCoordinates()).toBe('kunstmusik/score');
    expect(data.getLibraryEntries()[0].getVersion()).toBe('0.3.0');
  });

  it('builds the Java-compatible pomegranate string', () => {
    const data = new ClojureProjectData();
    expect(data.getPomegranateString()).toBeNull();

    const score = new ClojureLibraryEntry();
    score.setDependencyCoordinates('com.kunstmusik/score');
    score.setVersion('0.3.0');
    data.addLibraryEntry(score);

    expect(data.getPomegranateString()).toBe(
      "(use '[cemerick.pomegranate :only (add-dependencies)])\n" +
        "(add-dependencies :coordinates '[[com.kunstmusik/score \"0.3.0\" :exclusions [org.clojure/clojure]]\n" +
        '] :repositories (merge cemerick.pomegranate.aether/maven-central {"clojars" "https://repo.clojars.org"}))',
    );

    const pink = new ClojureLibraryEntry();
    pink.setDependencyCoordinates('com.kunstmusik/pink');
    pink.setVersion('0.3.0');
    data.addLibraryEntry(pink);

    expect(data.getPomegranateString()).toBe(
      "(use '[cemerick.pomegranate :only (add-dependencies)])\n" +
        "(add-dependencies :coordinates '[[com.kunstmusik/score \"0.3.0\" :exclusions [org.clojure/clojure]]\n" +
        "[com.kunstmusik/pink \"0.3.0\" :exclusions [org.clojure/clojure]]\n" +
        '] :repositories (merge cemerick.pomegranate.aether/maven-central {"clojars" "https://repo.clojars.org"}))',
    );
  });

  it('saves the Java-compatible plugin element', () => {
    const data = new ClojureProjectData();
    const entry = new ClojureLibraryEntry();
    entry.setDependencyCoordinates('kunstmusik/score');
    entry.setVersion('0.3.0');
    data.addLibraryEntry(entry);

    const xml = data.saveAsXML();

    expect(xml.getName()).toBe('blueDataObject');
    expect(xml.getAttribute('bdoType')).toBe(CLOJURE_PROJECT_DATA_BDO_TYPE);
    expect(xml.getElement('clojureLibraryEntry')?.getElement('coordinates')?.getTextString()).toBe(
      'kunstmusik/score',
    );
  });

  it('round-trips through pluginData helpers', () => {
    const pluginDataXml = [
      Element.parse('<blueDataObject bdoType="other.Plugin"><value>1</value></blueDataObject>'),
      Element.parse(`<blueDataObject bdoType="${CLOJURE_PROJECT_DATA_BDO_TYPE}">
        <clojureLibraryEntry>
          <coordinates>kunstmusik/score</coordinates>
          <version>0.3.0</version>
        </clojureLibraryEntry>
      </blueDataObject>`),
    ];

    const loaded = loadClojureProjectDataFromPluginData(pluginDataXml);
    expect(findClojureProjectDataElement(pluginDataXml)).not.toBeNull();
    expect(loaded?.getLibraryEntries()[0].getDependencyCoordinates()).toBe('kunstmusik/score');

    const replacement = new ClojureProjectData();
    const replacementEntry = new ClojureLibraryEntry();
    replacementEntry.setDependencyCoordinates('kunstmusik/new-score');
    replacementEntry.setVersion('0.4.0');
    replacement.addLibraryEntry(replacementEntry);

    const replaced = replaceClojureProjectDataInPluginData(pluginDataXml, replacement);
    expect(replaced).toHaveLength(2);
    expect(loadClojureProjectDataFromPluginData(replaced)?.getLibraryEntries()[0].getVersion()).toBe(
      '0.4.0',
    );
    expect(replaced[0].getAttribute('bdoType')).toBe('other.Plugin');
  });

  it('deep-copies library entries', () => {
    const data = new ClojureProjectData();
    const entry = new ClojureLibraryEntry();
    entry.setDependencyCoordinates('kunstmusik/score');
    entry.setVersion('0.3.0');
    data.addLibraryEntry(entry);

    const copy = data.deepCopy() as ClojureProjectData;
    copy.getLibraryEntries()[0].setVersion('0.4.0');

    expect(data.getLibraryEntries()[0].getVersion()).toBe('0.3.0');
  });
});