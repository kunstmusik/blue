import { describe, expect, it } from 'vitest';
import {
  GenericScore,
  PianoRoll,
  Instance,
  MeasureMeterPair,
  Meter,
  MeterMap,
  PolyObject,
  TimeContext,
} from '@blue/data';
import { prepareScoreObjectImport, validateScoreObjectExport } from './score-object-file';

function soundObjectXML(durationXml: string): string {
  return `<soundObject type="blue.soundObject.GenericScore">
  <startTime type="BEATS"><csoundBeats>0</csoundBeats></startTime>
  ${durationXml}
  <name>Imported BBF</name>
  <backgroundColor>4281558681</backgroundColor>
  <score>i1 0 1</score>
</soundObject>`;
}

const BBF_SOUND_OBJECT_XML = soundObjectXML(
  '<subjectiveDuration type="BBF"><bars>3</bars><beats>0</beats><fraction>0</fraction></subjectiveDuration>',
);

function contextWithMeter(numBeats: number, beatLength: number): TimeContext {
  const context = new TimeContext();
  const meterMap = new MeterMap();
  meterMap.clear();
  meterMap.add(new MeasureMeterPair(1, new Meter(numBeats, beatLength)));
  context.setMeterMap(meterMap);
  return context;
}

describe('Sound Object file import/export', () => {
  it('converts imported BBF duration with the destination project context', () => {
    const result = prepareScoreObjectImport(BBF_SOUND_OBJECT_XML, contextWithMeter(3, 4), 'BBF');

    expect(result).toMatchObject({
      ok: true,
      object: {
        objectType: 'GenericScore',
        name: 'Imported BBF',
        backgroundColor: -13408615,
        durationBeats: 9,
        destinationTimeBase: 'BBF',
        isContainer: false,
      },
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.object.serializedXml).toContain('<subjectiveDuration type="BBF">');
    expect(result.object.serializedXml).toContain('<bars>3</bars>');
  });

  it('uses the project tempo and sample rate for absolute-time durations', () => {
    const context = new TimeContext();
    context.getTempoMap().setTempo(120);
    context.getTempoMap().setEnabled(true);
    context.setSampleRate(48000);

    const secondsResult = prepareScoreObjectImport(
      soundObjectXML(
        '<subjectiveDuration type="SECONDS"><totalSeconds>2</totalSeconds></subjectiveDuration>',
      ),
      context,
      'BEATS',
    );
    const framesResult = prepareScoreObjectImport(
      soundObjectXML(
        '<subjectiveDuration type="FRAME"><frameCount>48000</frameCount></subjectiveDuration>',
      ),
      context,
      'BEATS',
    );

    expect(secondsResult.ok && secondsResult.object.durationBeats).toBe(4);
    expect(framesResult.ok && framesResult.object.durationBeats).toBe(2);
  });

  it('rejects malformed or non-SoundObject XML', () => {
    const context = new TimeContext();
    expect(prepareScoreObjectImport('<soundObject', context, 'BEATS')).toEqual({
      ok: false,
      error: 'Could not parse XML from file.',
    });
    expect(prepareScoreObjectImport('<instrument />', context, 'BEATS')).toEqual({
      ok: false,
      error: 'File did not contain a Sound Object.',
    });
  });

  it('blocks Instance exports and PolyObjects containing Instances', () => {
    const instance = new Instance();
    expect(validateScoreObjectExport(instance.saveAsXML().toXml())).toEqual({
      ok: false,
      error:
        'Export of Instance objects or PolyObjects containing Instance objects is not allowed.',
    });

    const polyObject = new PolyObject();
    polyObject.newLayerAt(0).push(instance);
    expect(validateScoreObjectExport(polyObject.saveAsXML().toXml())).toEqual({
      ok: false,
      error:
        'Export of Instance objects or PolyObjects containing Instance objects is not allowed.',
    });
  });

  it('accepts a regular SoundObject export', () => {
    expect(validateScoreObjectExport(new GenericScore().saveAsXML().toXml())).toEqual({ ok: true });
  });
});

it('returns native source and nested diagnostics before Sound Object insertion', () => {
  const source = {
    kind: 'soundObject' as const,
    label: 'C:\\Users\\Blue\\bad.blueObject',
    nativePath: 'C:\\Users\\Blue\\bad.blueObject',
  };
  const result = prepareScoreObjectImport(
    '<soundObject type="blue.soundObject.GenericScore"><score future="true">i1 0 1</score></soundObject>',
    new TimeContext(),
    'BEATS',
    source,
  );
  expect(result).toMatchObject({
    ok: false,
    diagnostics: [{ source, path: '/soundObject/score[1]/@future', severity: 'error' }],
  });
  if (result.ok) throw new Error('Expected rejection');
  expect(result.error).toContain(source.label);
});

it('returns safe resource warnings and canonical XML for the later insertion', () => {
  const xml = new PianoRoll().saveAsXML().toXml().replace('<scale>', '<scale/><scale>');
  const result = prepareScoreObjectImport(xml, new TimeContext(), 'BEATS');
  expect(result).toMatchObject({
    ok: true,
    diagnostics: [{ code: 'SL-H10', severity: 'warning' }],
  });
  if (!result.ok) throw new Error(result.error);
  expect(result.object.serializedXml.match(/<scale>/g)).toHaveLength(1);
  expect(result.object.serializedXml).not.toContain('<scale/>');
});
