import { describe, expect, it } from 'vitest';
import {
  GenericScore,
  Instance,
  MeasureMeterPair,
  Meter,
  MeterMap,
  PolyObject,
  TimeContext,
} from '@blue/data';
import {
  prepareScoreObjectImport,
  validateScoreObjectExport,
} from './score-object-file';

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
    const result = prepareScoreObjectImport(
      BBF_SOUND_OBJECT_XML,
      contextWithMeter(3, 4),
      'BBF',
    );

    expect(result).toEqual({
      ok: true,
      object: {
        serializedXml: BBF_SOUND_OBJECT_XML,
        objectType: 'GenericScore',
        name: 'Imported BBF',
        backgroundColor: 4281558681,
        durationBeats: 9,
        destinationTimeBase: 'BBF',
        isContainer: false,
      },
    });
  });

  it('uses the project tempo and sample rate for absolute-time durations', () => {
    const context = new TimeContext();
    context.getTempoMap().setTempo(120);
    context.getTempoMap().setEnabled(true);
    context.setSampleRate(48000);

    const secondsResult = prepareScoreObjectImport(
      soundObjectXML('<subjectiveDuration type="SECONDS"><totalSeconds>2</totalSeconds></subjectiveDuration>'),
      context,
      'BEATS',
    );
    const framesResult = prepareScoreObjectImport(
      soundObjectXML('<subjectiveDuration type="FRAME"><frameCount>48000</frameCount></subjectiveDuration>'),
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
      error: 'Export of Instance objects or PolyObjects containing Instance objects is not allowed.',
    });

    const polyObject = new PolyObject();
    polyObject.newLayerAt(0).push(instance);
    expect(validateScoreObjectExport(polyObject.saveAsXML().toXml())).toEqual({
      ok: false,
      error: 'Export of Instance objects or PolyObjects containing Instance objects is not allowed.',
    });
  });

  it('accepts a regular SoundObject export', () => {
    expect(validateScoreObjectExport(new GenericScore().saveAsXML().toXml())).toEqual({ ok: true });
  });
});
