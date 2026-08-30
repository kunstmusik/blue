import {
  BlueData,
  BlueX7,
  GenericScore,
  PolyObject,
  TimeDuration,
  TimeBehavior,
  TrackLayerGroup,
} from '@blue/data';

export interface BlueX7MultiInstanceOwner {
  ownerIdentity: string;
  instrument: BlueX7;
  noteText: string;
}

export interface BlueX7MultiInstanceFixture {
  data: BlueData;
  owners: readonly BlueX7MultiInstanceOwner[];
  groupId: string;
  trackIds: readonly [string, string];
}

const OWNER_COUNT = 4;
const NOTES_PER_OWNER = 8;

function configureInstrument(instrument: BlueX7, ownerIndex: number): void {
  instrument.setName('Duplicate BlueX7');
  instrument.setEnabled(true);
  instrument.applyFixedValue('common.algorithm', ownerIndex * 7 + 1);
  instrument.applyFixedValue('common.feedback', ownerIndex + 1);
  for (let operator = 0; operator < 6; operator += 1) {
    instrument.setOperatorEnabled(operator, (operator + ownerIndex) % 3 !== 0);
  }
  instrument.getParameters().forEach((parameter, parameterIndex) => {
    parameter.setUniqueId(`x7-owner-${ownerIndex + 1}-parameter-${parameterIndex + 1}`);
  });
  const automated = instrument.getParameters().find(
    (parameter) => parameter.getName() === 'common.feedback',
  )!;
  automated.setAutomationEnabled(true);
  automated.setPoints([
    { time: 0, value: ownerIndex + 1 },
    { time: 60, value: ownerIndex + 4 },
  ]);
}

function buildNotes(instrumentId: string | number, ownerIndex: number): string {
  return Array.from({ length: NOTES_PER_OWNER }, (_, noteIndex) => {
    const start = noteIndex * (60 / NOTES_PER_OWNER);
    const pitch = 48 + ownerIndex * 5 + noteIndex;
    return `i${instrumentId} ${start} 0.5 ${pitch} ${72 + ownerIndex * 8}`;
  }).join('\n');
}

function createScoreObject(noteText: string): GenericScore {
  const score = new GenericScore();
  score.setName('BlueX7 stress notes');
  score.setSubjectiveDuration(TimeDuration.beats(60));
  score.setTimeBehavior(TimeBehavior.NONE);
  score.setScoreText(noteText);
  return score;
}

/** Deterministic four-owner/32-note fixture shared by US4 integration tests. */
export function createBlueX7MultiInstanceFixture(): BlueX7MultiInstanceFixture {
  const data = new BlueData();
  data.setRenderEndTime(60);
  data.getMixer().getMaster().setLevel(-6);
  const owners: BlueX7MultiInstanceOwner[] = [];

  const root = data.getScore()[0] as PolyObject;
  const arrangementLayer = root[0]!;
  for (let index = 0; index < 2; index += 1) {
    const instrument = new BlueX7();
    configureInstrument(instrument, index);
    const assignmentId = String(index + 1);
    data.getArrangement().addInstrument(instrument, assignmentId);
    const noteText = buildNotes(assignmentId, index);
    arrangementLayer.push(createScoreObject(noteText));
    owners.push({ ownerIdentity: `arrangement:${assignmentId}`, instrument, noteText });
  }

  const group = new TrackLayerGroup();
  group.setName('Duplicate BlueX7 Tracks');
  group.setUniqueId('x7-four-owner-group');
  const trackIds: [string, string] = ['x7-four-owner-track-1', 'x7-four-owner-track-2'];
  for (let index = 2; index < OWNER_COUNT; index += 1) {
    const trackIndex = index - 2;
    const track = group.newLayerAt(group.length);
    track.setName('Duplicate BlueX7');
    track.setUniqueId(trackIds[trackIndex]!);
    const instrument = new BlueX7();
    configureInstrument(instrument, index);
    track.setOwnedInstrument(instrument);
    const noteText = buildNotes(1, index);
    track.push(createScoreObject(noteText));
    owners.push({
      ownerIdentity: `track:${group.getUniqueId()}:${track.getUniqueId()}`,
      instrument,
      noteText,
    });
  }
  data.getScore().push(group);

  return { data, owners, groupId: group.getUniqueId(), trackIds };
}
