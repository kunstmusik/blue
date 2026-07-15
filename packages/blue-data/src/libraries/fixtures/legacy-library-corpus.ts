export interface LegacyLibraryFixture {
  readonly id: string;
  readonly libraryType: 'instrument' | 'udo' | 'soundObject' | 'effect';
  readonly xml: string;
}

export const EMPTY_LEGACY_LIBRARY_FIXTURES: readonly LegacyLibraryFixture[] = [
  {
    id: 'empty-instrument-library',
    libraryType: 'instrument',
    xml: '<instrumentLibrary><instrumentCategory categoryName="Instrument Library" isRoot="true"/></instrumentLibrary>',
  },
  {
    id: 'empty-udo-library',
    libraryType: 'udo',
    xml: '<udoLibrary><udoCategory categoryName="UDO Library" isRoot="true"/></udoLibrary>',
  },
  {
    id: 'empty-effect-library',
    libraryType: 'effect',
    xml: '<effectsLibrary><effectCategory categoryName="Effects Library" isRoot="true"/></effectsLibrary>',
  },
  {
    id: 'empty-sound-object-library',
    libraryType: 'soundObject',
    xml: '<soundObjectLibrary><category categoryName="SoundObject Library"/></soundObjectLibrary>',
  },
];

export const NESTED_LEGACY_LIBRARY_FIXTURES: readonly LegacyLibraryFixture[] = [
  {
    id: 'nested-instrument-library',
    libraryType: 'instrument',
    xml: [
      '<instrumentLibrary>',
      '<instrumentCategory categoryName="Instrument Library" isRoot="true">',
      '<instrumentCategory categoryName="Σynths" isRoot="false">',
      '<instrument type="blue.orchestra.GenericInstrument"><name>Pad 🎹</name><globalOrc></globalOrc><globalSco></globalSco><instrumentText>ain 0</instrumentText></instrument>',
      '</instrumentCategory>',
      '</instrumentCategory>',
      '</instrumentLibrary>',
    ].join(''),
  },
  {
    id: 'nested-udo-library',
    libraryType: 'udo',
    xml: [
      '<udoLibrary>',
      '<udoCategory categoryName="UDO Library" isRoot="true">',
      '<udoCategory categoryName="Filters" isRoot="false">',
      '<udo><opcodeName>tone</opcodeName><outTypes>a</outTypes><inTypes>ak</inTypes><codeBody><![CDATA[aout tone ain, kcps]]></codeBody><comments>safe data</comments></udo>',
      '</udoCategory>',
      '</udoCategory>',
      '</udoLibrary>',
    ].join(''),
  },
  {
    id: 'nested-effect-library',
    libraryType: 'effect',
    xml: [
      '<effectsLibrary>',
      '<effectCategory categoryName="Effects Library" isRoot="true">',
      '<effectCategory categoryName="Time" isRoot="false">',
      '<effect><name>Echo</name><code>adel delay ain, 0.25</code><numIns>1</numIns><numOuts>1</numOuts></effect>',
      '</effectCategory>',
      '</effectCategory>',
      '</effectsLibrary>',
    ].join(''),
  },
  {
    id: 'mixed-sound-object-library',
    libraryType: 'soundObject',
    xml: [
      '<soundObjectLibrary>',
      '<category categoryName="SoundObject Library">',
      '<soundObject type="blue.soundObject.GenericScore"><name>First</name><startTime>0.0</startTime><subjectiveDuration>1.0</subjectiveDuration><score>i1 0 1</score></soundObject>',
      '<category categoryName="Nested"/>',
      '<soundObject type="example.FutureObject"><name>Raw &amp; Safe</name><!--preserve--><plugin><![CDATA[do-not-run()]]></plugin></soundObject>',
      '</category>',
      '</soundObjectLibrary>',
    ].join(''),
  },
];

export const UNSAFE_EXTERNAL_ENTITY_FIXTURE = [
  '<!DOCTYPE instrumentLibrary [<!ENTITY external SYSTEM "file:///etc/passwd">]>',
  '<instrumentLibrary><instrumentCategory categoryName="&external;" isRoot="true"/></instrumentLibrary>',
].join('');

/** Representative Java Blue-produced envelopes used for export/reparse parity. */
export const JAVA_COMPATIBILITY_LIBRARY_FIXTURES: readonly LegacyLibraryFixture[] = [
  {
    id: 'java-duplicate-instrument-categories',
    libraryType: 'instrument',
    xml: '<instrumentLibrary><instrumentCategory categoryName="Instrument Library" isRoot="true"><instrumentCategory categoryName="Pads" isRoot="false"/><instrumentCategory categoryName="Pads" isRoot="false"/><instrument type="blue.orchestra.GenericInstrument"><name>Direct</name><globalOrc/><globalSco/><instrumentText>ain = 0</instrumentText></instrument></instrumentCategory></instrumentLibrary>',
  },
  {
    id: 'java-udo-modern-style',
    libraryType: 'udo',
    xml: '<udoLibrary><udoCategory categoryName="UDO Library" isRoot="true"><udo><opcodeName>mix2</opcodeName><outTypes>a</outTypes><inTypes>aa</inTypes><codeBody>aout = ain1 + ain2</codeBody><comments>Java fixture</comments><udoStyle>MODERN</udoStyle></udo></udoCategory></udoLibrary>',
  },
  {
    id: 'java-effect-nested-code',
    libraryType: 'effect',
    xml: '<effectsLibrary><effectCategory categoryName="Effects Library" isRoot="true"><effect><name>Gain</name><code><![CDATA[aout = ain * kgain]]></code><numIns>1</numIns><numOuts>1</numOuts></effect></effectCategory></effectsLibrary>',
  },
  {
    id: 'java-soundobject-mixed-unsupported',
    libraryType: 'soundObject',
    xml: '<soundObjectLibrary><category categoryName="SoundObject Library"><category categoryName="Before"/><soundObject type="future.PluginObject"><name>Preserve</name><!--java--><payload><![CDATA[x < y]]></payload></soundObject><category categoryName="After"/></category></soundObjectLibrary>',
  },
];
