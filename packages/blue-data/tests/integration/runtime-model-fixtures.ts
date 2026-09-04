import { Element } from '../../src/serialization/xml-reader';
import { BlueSynthBuilder } from '../../src/instruments/blue-synth-builder';
import { Mixer } from '../../src/mixer/mixer';
import { TimeContext } from '../../src/time/time-context';
import { TempoMap } from '../../src/time/tempo-map';
import { TempoPoint } from '../../src/time/tempo-point';
import { CurveType } from '../../src/time/curve-type';
import { MeterMap } from '../../src/time/meter-map';
import { MeasureMeterPair } from '../../src/time/measure-meter-pair';
import { Meter } from '../../src/time/meter';

export function createRuntimeBsbFixtureXml(): string {
  return `<instrument type="blue.orchestra.BlueSynthBuilder">
    <name>Runtime Fixture</name>
    <comment>Fixture used by spec 032 parity tests</comment>
    <instrumentText>aout oscili &lt;amp&gt;, 440</instrumentText>
    <alwaysOnInstrumentText>aout oscili &lt;amp&gt;, 220</alwaysOnInstrumentText>
    <globalOrc>gk_runtime = &lt;amp&gt;</globalOrc>
    <globalSco>i1 0 &lt;amp&gt;</globalSco>
    <graphicInterface editEnabled="true">
      <gridSettings>
        <width>24</width>
        <height>18</height>
        <gridStyle>LINE</gridStyle>
        <snapGridEnabled>false</snapGridEnabled>
      </gridSettings>
      <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob">
        <objectName>amp</objectName>
        <x>12</x>
        <y>24</y>
        <value>0.5</value>
        <minimum>0</minimum>
        <maximum>1</maximum>
      </bsbObject>
    </graphicInterface>
    <bsbParameterList>
      <parameter uniqueId="p1" name="amp" label="amp" min="0" max="1" automationEnabled="true" value="0.5">
        <line>
          <linePoint x="0" y="0.5"/>
        </line>
      </parameter>
    </bsbParameterList>
    <presetGroup name="Fixture Presets" currentPresetUniqueId="">
      <preset name="Default" uniqueId="default">
        <setting name="amp">ver2:0.5</setting>
      </preset>
    </presetGroup>
    <opcodeList/>
  </instrument>`;
}

export function loadRuntimeBsbFixture(): BlueSynthBuilder {
  return BlueSynthBuilder.loadFromXML(Element.parse(createRuntimeBsbFixtureXml()));
}

export function createRuntimeMixerFixtureXml(): string {
  return `<mixer>
    <enabled>true</enabled>
    <extraRenderTime>3.5</extraRenderTime>
    <channelList list="channels">
      <channel association="pattern-1">
        <name>Lead</name>
        <outChannel>Master</outChannel>
        <level>-3.0</level>
        <muted>false</muted>
        <solo>false</solo>
        <effectsChain bin="pre">
          <effect>
            <name>Pre EQ</name>
            <enabled>true</enabled>
            <numIns>2</numIns>
            <numOuts>2</numOuts>
            <code>aout = ain1 * 0.5</code>
          </effect>
        </effectsChain>
        <effectsChain bin="post">
          <send>
            <sendChannel>Reverb</sendChannel>
            <level>0.5</level>
            <enabled>true</enabled>
          </send>
        </effectsChain>
      </channel>
    </channelList>
    <channelList list="subChannels">
      <channel>
        <name>Reverb</name>
        <outChannel>Master</outChannel>
        <level>-6.0</level>
        <muted>false</muted>
        <solo>false</solo>
      </channel>
    </channelList>
    <channel>
      <name>Master</name>
      <outChannel>Master</outChannel>
      <level>0.0</level>
      <muted>false</muted>
      <solo>false</solo>
    </channel>
  </mixer>`;
}

export function loadRuntimeMixerFixture(): Mixer {
  return Mixer.loadFromXML(Element.parse(createRuntimeMixerFixtureXml()));
}

export function createRuntimeTimeContext(): TimeContext {
  const context = new TimeContext();

  const tempoMap = new TempoMap();
  tempoMap.setTempoPoint(0, 0, 90, CurveType.CONSTANT);
  tempoMap.addTempoPoint(new TempoPoint(8, 120, CurveType.LINEAR));
  tempoMap.setEnabled(true);
  context.setTempoMap(tempoMap);

  const meterMap = new MeterMap();
  meterMap.clear();
  meterMap.add(new MeasureMeterPair(1, new Meter(3, 4)));
  meterMap.add(new MeasureMeterPair(5, new Meter(4, 4)));
  context.setMeterMap(meterMap);

  context.setSmpteFrameRate(29.97);

  return context;
}

export function createRuntimeTimeContextXml(): string {
  return createRuntimeTimeContext().saveAsXML().toXml();
}
