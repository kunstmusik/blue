/**
 * Deterministic builder for the checked-in BlueX7 pop-song fixture
 * (fixtures/blue-x7-pop-song.blue and its generated CSD).
 *
 * Every identity (track, layer-group, instrument Parameter, mixer Parameter)
 * is pinned so regeneration is byte-stable, and all musical content is
 * embedded here as data. PianoRolls use frequency pitch generation
 * (pchGenerationMethod 0): with the default 12TET scale (base C4, octave 8
 * = middle C), Scale.getFrequency emits Hz directly, so the score reads
 * plain frequency p4 values (261.625565 = middle C) that flow through the
 * BlueX7 target's Hz branch (p4 >= 15). The score time display is BBF
 * (bars.beats.hundredths) and every sound object's start, duration, and
 * repeat point are stored as BBF time values.
 *
 * Regenerate the checked-in files with:
 *   BLUE_X7_REGEN_FIXTURE=1 pnpm --filter @blue/data test -- pop-song-fixture
 *
 * Browser-safe data-model code: no fs or host APIs here; the test companion
 * owns file IO.
 */
import { BlueData } from '../../blue-data';
import {
  BlueX7,
  createDefaultBlueX7Voice,
  type BlueX7Voice,
} from '../blue-x7';
import {
  BLUE_X7_PARAMETER_DESCRIPTORS,
  writeBlueX7VoiceValue,
} from './parameter-catalog';
import { PianoRoll } from '../../sound-objects/piano-roll';
import { PianoNote } from '../../sound-objects/piano-roll/piano-note';
import { Track } from '../../score/track/track';
import { TrackLayerGroup } from '../../score/track/track-layer-group';
import { Channel } from '../../mixer/channel';
import { TimeBase } from '../../time/time-base';
import { TimePosition } from '../../time/time-position';
import { TimeDuration } from '../../time/time-duration';
import { TimeBehavior } from '../../sound-objects/time-behavior';

/** Frequency pitch generation (blue.soundObject.PianoRoll GENERATE_FREQUENCY). */
const PCH_GENERATION_METHOD_FREQUENCY = 0;

const LAYER_GROUP_UNIQUE_ID = "0d1331c3-ae84-43d2-a566-994cfd03b471";

const PROJECT_TITLE = 'BlueX7 Pop Song (Manual Test)';
const PROJECT_AUTHOR = 'blue-electron';
const PROJECT_NOTES = [
  'Manual test project for the BlueX7 engine integration.',
  'Track "E Piano": BlueX7 E.Piano-style patch (algorithm 5, tine ping on op6).',
  'Track "Bass": BlueX7 FM bass patch (algorithm 1, feedback 4).',
  'Pop progression at 112 BPM: intro / verse / chorus / verse / chorus / outro.',
  'All parts are PianoRolls using frequency pitch generation (p4 = Hz,',
  '261.625565 = middle C; the instrument also accepts pch below 15).',
  'Score time display is BBF (bars.beats.hundredths); sound object times',
  'are stored as BBF positions and durations.',
  'Tempo map is enabled at 112 BPM; mixer is enabled with one channel per track.',
].join('\n');

interface RollSpec {
  name: string;
  backgroundColor: number;
  start: number;
  duration: number;
  /** [octave, scaleDegree, start, duration] per note (octave 8 = C4). */
  notes: [number, number, number, number][];
}

interface TrackSpec {
  name: string;
  uniqueId: string;
  instrumentName: string;
  noteAmp: number;
  voiceSlots: number[];
  parameterIds: string[];
  rolls: RollSpec[];
}

const MASTER_CHANNEL_PARAM_ID = "param-438380a1-1fe6-4f65-907c-d6abbdd87a38";

const CHANNELS: { name: string; association: string; paramId: string }[] = [
  { name: "E Piano", association: "313b80ef-a098-404e-b957-cc88ac030af5", paramId: "param-ce1aee0b-fa2f-4a0c-b904-2ca5e04ba003" },
  { name: "Bass", association: "1fef7747-e706-4786-a1aa-ac20b50b6f8e", paramId: "param-dd9aa36b-32f6-409f-b008-facd522022e5" },
];

const TRACKS: TrackSpec[] = [
  {
    name: "E Piano",
    uniqueId: "313b80ef-a098-404e-b957-cc88ac030af5",
    instrumentName: "E Piano",
    noteAmp: 88,
    // Renderer unpacked-DX7 voice slots (algorithm 0-based, detune +7 center).
    voiceSlots: [
      99, 12, 15, 20, 72, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 60, 0, 14, 0, 7, 99, 25, 20, 40, 65, 25, 20, 0, 0, 0, 0, 0, 0, 0, 0, 2, 50, 0, 1, 0, 9, 99, 30, 20, 35, 60, 35, 30, 30, 0, 0, 0, 0, 0, 0, 0, 0, 50, 0, 1, 0, 7, 99, 40, 20, 50, 65, 40, 35, 0, 0, 0, 0, 0, 0, 0, 0, 2, 35, 0, 2, 0, 7, 99, 35, 20, 40, 72, 52, 48, 48, 0, 0, 0, 0, 0, 0, 0, 0, 68, 0, 1, 0, 7, 92, 45, 20, 55, 85, 72, 65, 0, 0, 0, 0, 0, 0, 3, 0, 3, 85, 0, 1, 0, 7, 50, 50, 50, 50, 50, 50, 50, 50, 4, 0, 1, 38, 35, 12, 0, 0, 1, 0, 24, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    parameterIds: [
      "param-9516f023-8fbe-49cb-9181-b4072610d762",
      "param-aa308e01-4ce7-4d4c-8f35-aa72dd29f9c4",
      "param-3ebe5f89-e8d1-4a5b-8ec4-24f2a6f93771",
      "param-f3f5519f-fcd5-4864-b73d-e8872e88163a",
      "param-f905fd82-6427-4d7e-9f91-582d3766989f",
      "param-7d46f843-ad3a-43c2-9612-62106de66ca6",
      "param-e67048e3-49ba-4e2d-94ec-27950235084f",
      "param-209bf955-9bb8-4ec3-917a-efc836bcb0fc",
      "param-36853fa0-7569-4b1f-8f0d-4194084ce28f",
      "param-e95c4bf2-d96e-4941-adab-bec7f12c8704",
      "param-9facabfa-15d9-405c-913e-4a8a94247444",
      "param-864ca247-1651-4d56-9329-15cfcfdc3e88",
      "param-7bb00d49-e3e8-43f5-9ff8-2dc8e5d1b639",
      "param-3d38a2de-99b1-466f-8158-eaba841defb3",
      "param-a5ebdbcc-05a3-4cbb-a3ca-de69730eea76",
      "param-53e2b76a-0830-4e9f-8f2d-1352d28cf4ff",
      "param-19c1a89a-dc58-44a3-85e1-9ee4991666f6",
      "param-855348e3-7104-4b5b-9d11-7ef46c28e9b3",
      "param-426a2d6f-2ef6-4ca2-8b88-e84075af2b0e",
      "param-27ffe816-660f-4215-b063-74a0af05bc62",
      "param-4d7d148c-9e7b-4744-b5f6-fe134291df7d",
      "param-3e7d6236-b7d1-4a88-9e63-c7e535c27cbf",
      "param-6e7c933f-65b3-4dc4-9ee9-f6682716a657",
      "param-c196e770-2597-4e1c-a430-05dcf2d3408a",
      "param-c67e5e35-daae-4230-9139-3c64c0b53dc4",
      "param-e1d3f9da-f2bd-444f-add4-fdcdfb951191",
      "param-d80d733a-30f6-4fa5-af1e-0e8afeb77e76",
      "param-6b8af784-530d-4b21-997a-b0aade3e25f3",
      "param-6cc52739-6526-4f47-a1d3-2397cc167c5f",
      "param-a9fec582-ce03-40b1-9ed0-10f83e4f356f",
      "param-afe96924-a269-458e-b2ce-555051c81c39",
      "param-a5c22af4-e272-42c8-b614-f8a87e7170bf",
      "param-a06368fa-8b50-4e5f-953f-eb79ef001383",
      "param-6dca2a8c-e6c0-4494-a411-f0270fbed278",
      "param-72805c3f-328f-44f3-a7e5-509439490067",
      "param-a04f4fb3-85a1-417d-bcf8-128455b47612",
      "param-3ac0d52b-5609-42b4-8596-caae4b875bf3",
      "param-b6f6bc66-7f15-45e9-b690-adb9c88d00bb",
      "param-98e29420-d8c4-4e20-b43e-1f5f8b99db9c",
      "param-7943fdfb-7fbb-4dbb-923c-3b1745220b78",
      "param-0f164b8e-8f80-4795-b940-38fb06aa1dbb",
      "param-f4410d5c-d921-437a-a6b2-f6b8e709eef5",
      "param-afbc2fa6-63a9-4729-a69b-b49913233322",
      "param-8c130e00-3fb1-42de-a079-f607c9148ae0",
      "param-67f83640-e8dd-41d8-8fbc-99a2d545b7cb",
      "param-722063ac-4531-46f6-86a2-cd813dd1bdad",
      "param-1b211e1b-56f2-4c4e-a7ef-1353a0022727",
      "param-885b32ff-4bc6-4004-aab2-305a67cd4471",
      "param-a9014523-fb8f-4049-9eef-6dae25eb5fb5",
      "param-d1536720-3134-4c54-912e-815722c0f1fc",
      "param-1976f98e-0810-4bb9-8aed-ddeecfbafe84",
      "param-8013c387-7e15-4c66-a55a-2113c8cee15e",
      "param-dd0796d5-ea7b-44fb-a71f-f8461adcf504",
      "param-d3cb71dc-62d6-4b38-b722-bea1af3c2925",
      "param-40341e10-ae16-4791-aa9f-ed1ff2a56b19",
      "param-8f895377-fdf5-4726-8608-9eec3d3cdf55",
      "param-513b5652-3605-4315-94b8-e376855e1fb6",
      "param-8e4a9f0e-d376-4a31-a29e-c524293572de",
      "param-d19b33eb-4f62-43f5-b1c7-3df8cddc71d1",
      "param-5a8022cc-d4e0-46f9-b990-0a36f065c336",
      "param-9d90a002-32ad-4e00-ba46-812f0e13e5f5",
      "param-8344d3ec-2580-46b9-9602-14c93421d03f",
      "param-ff69ce3c-28a0-4bdd-bc0b-6b2c45ff076f",
      "param-539710fa-cddf-4cf8-a20d-9fe6e481f86a",
      "param-2ba00e89-756b-4181-9c64-accabf131d77",
      "param-70a98802-81dd-4734-9d36-111938b58410",
      "param-59aeda21-8e4b-48b1-afe5-91287fe924d6",
      "param-2753e93e-3c2f-4ad1-8d43-8861b00526c6",
      "param-0d5185a2-fc17-4e31-a066-9e2c5098073f",
      "param-3163e626-823a-47f7-86ec-9eaf3991c01d",
      "param-db0b70b0-9f94-4e1a-a433-43d42013d4a7",
      "param-4cd58583-2c82-4bcc-9ba6-e9aafb3f72b9",
      "param-1bfdd60b-bf7f-4233-baec-93875a67c582",
      "param-4a411e49-bac9-4a7d-bf0f-a0bc9bf94ef4",
      "param-61e57810-cbe9-481b-a2fc-680755dc8235",
      "param-b956f1af-1220-45d3-9606-342cc4f6e5e6",
      "param-d5d5e36e-3d70-4c8f-bc88-ecfbb0c85f58",
      "param-d3ff9137-8b59-42cd-aa74-b5c9b4654d69",
      "param-641d0fb4-b96c-45a1-8ee0-05cad1a9d8fa",
      "param-0423c3ee-8e3a-497e-95c0-53d4ce7f80b5",
      "param-010ab4ab-9179-48b0-9f9b-01c997298aab",
      "param-b6b60d63-1be7-4854-baf0-afb3333a2df7",
      "param-5677c20d-d4b6-4a3d-9636-f98f0e89b3be",
      "param-c6231277-cbc3-4c77-96c1-376e9023bcd6",
      "param-6f3fe2d0-e791-434e-9b29-a81c701e7452",
      "param-292ab5d8-ddaa-463d-bc40-08ccb683abc7",
      "param-ccdcd14f-4873-4427-bd35-707234a8c492",
      "param-ad135408-adea-469b-a2a1-1312d7b8d1db",
      "param-fa76345f-b93a-4ac3-977b-76cc0f989002",
      "param-d924b83f-0fb9-4b7b-b2ce-4aa61b138161",
      "param-7e5f68a5-0f70-46c6-8eac-42207ad7f34f",
      "param-068744ab-1da7-428a-8b82-5b82f8db89bb",
      "param-76ded019-46f6-44b3-b32b-7614bfdf155f",
      "param-ee3b6281-bf41-4222-9e8b-a0f64d9cc8f8",
      "param-3b039b1f-c983-416e-88b3-ef40a6bcc549",
      "param-63921584-e30d-474b-8765-243c9e270002",
      "param-881a38af-d2ed-43d4-aef7-6055fb9da35f",
      "param-db7ea1b6-74fd-4fed-82e0-b08e133f0005",
      "param-8ddcaaf5-c17a-48b4-983a-eddfd591b4f0",
      "param-9c15320b-471f-465d-af6e-e035384c53ee",
      "param-1f66dc1a-13e8-4502-ab0b-1481c5b71c3b",
      "param-0f99d364-6f3e-4168-9512-129c6068e9b8",
      "param-d02edcb0-d9ff-4af3-a97f-fd690b005585",
      "param-5a151aa7-f3d5-4e5b-a14c-dac8cbde06ed",
      "param-b748f25a-196a-41f9-bd07-f786e4926d0b",
      "param-c089eca9-3f13-457e-ba4c-8d7135e45b91",
      "param-56c4caf7-2f78-4519-960d-df4eaeed4f92",
      "param-29e2d01c-7345-45eb-87d6-1735ec4c0dac",
      "param-a0f6e467-7ef6-44e0-b765-a87f13200d23",
      "param-f20d602b-db02-4b4c-a775-c51ae1d4a25a",
      "param-68258855-be13-4e82-adae-97cdbfae9081",
      "param-fac9dd0c-e67f-463f-9ca9-7e36fc5f70e7",
      "param-21ef9a74-fe27-4107-a899-9db271d59f1c",
      "param-abaf590d-6b30-4fcb-8756-a3beb6d2bb63",
      "param-dfd28083-8134-4b92-8b0e-e6d5480cb150",
      "param-b7a86fc3-d5ab-4ea8-b2b6-09f9cff57c9e",
      "param-444ab091-4641-44ec-b1be-f76b6134d138",
      "param-83fc512c-9766-48c7-818e-393c5cd553b6",
      "param-179cfc2e-70cc-4808-9acf-4605bd9b7898",
      "param-6ad121ed-a29c-41e1-91b3-2c5f7f38ed46",
      "param-c79a4b64-9865-46ff-afe5-2d9304c9d633",
      "param-7519f0f8-eec9-478f-9478-e6187f42e699",
      "param-1180f5f2-cadb-4459-9262-96b1835e8307",
      "param-ac4d6597-c5d7-402e-bdaa-e1456b42731b",
      "param-21e6a1d4-81c5-4442-a0e9-cab908e468e7",
      "param-f7c9c6cc-b95d-4bc4-b927-30edda058282",
      "param-59b17d0d-97a4-43d3-b5ab-26da8ad66a28",
      "param-be5113dc-d1a3-494f-9e5c-34447266699b",
      "param-85e3b3a6-a8d9-4c0b-85f2-dcd589ba2dd6",
      "param-004b49db-c22c-40d1-b604-5a006085f9b6",
      "param-fa9a3acd-793d-4da9-820f-30305513ea01",
      "param-7c50afb9-3ee2-4497-9b4d-5e67bb686785",
      "param-f3026fc8-81df-4c44-ac57-1ee59b1c156a",
      "param-49029a27-5d07-4d1b-8484-5ac0c986be99",
      "param-f845a306-30f5-41b1-8114-6ff6b11edda3",
      "param-a64380fb-5f83-473c-a58b-ae73f1ef5675",
      "param-49d11ed7-273d-4e8b-9f4a-84388d5d7b6b",
      "param-0b37ae09-bb66-4fae-b2cd-9c88ac6c5c7f",
      "param-b7c29e0e-a13e-48fe-b77e-c41c82a53a23",
      "param-4c0238be-6b52-48f5-9349-3a1b0d1160f5",
      "param-4a4ba132-4746-40d9-808f-5bee67bb5cf3",
      "param-e16d3113-fa04-458f-80f7-6722c60328ce",
      "param-e67bf052-4cc2-4adc-b57b-0f650f79f581",
      "param-38ac6aa5-094c-4d5f-beaf-f845134c86b4",
      "param-e9e60842-52e4-4ed2-a4d2-c7144548a464",
      "param-c602b913-e72d-4a0e-9d36-b56af60f0d46",
      "param-ca12262b-65db-4b7e-9e84-f29e8d1b50a8",
      "param-ab4bf402-226e-4778-81d4-ee496407a366",
      "param-43806d76-beb9-418e-aad8-f0bd771ece6c",
      "param-707e782a-1ab4-4b0c-8772-712733abb6f0",
      "param-54167c5f-7e23-40ac-9906-fed0c64f27b9",
    ],
    rolls: [
      {
        name: "EP Intro",
        backgroundColor: 4210752,
        start: 0,
        duration: 16,
        notes: [
        [8, 0, 0, 1.5],
        [8, 0, 2.5, 1.5],
        [8, 4, 0, 1.5],
        [8, 4, 2.5, 1.5],
        [8, 7, 0, 1.5],
        [8, 7, 2.5, 1.5],
        [7, 11, 4, 1.5],
        [7, 11, 6.5, 1.5],
        [8, 2, 4, 1.5],
        [8, 2, 6.5, 1.5],
        [8, 7, 4, 1.5],
        [8, 7, 6.5, 1.5],
        [8, 0, 8, 1.5],
        [8, 0, 10.5, 1.5],
        [8, 4, 8, 1.5],
        [8, 4, 10.5, 1.5],
        [8, 9, 8, 1.5],
        [8, 9, 10.5, 1.5],
        [8, 0, 12, 1.5],
        [8, 0, 14.5, 1.5],
        [8, 5, 12, 1.5],
        [8, 5, 14.5, 1.5],
        [8, 9, 12, 1.5],
        [8, 9, 14.5, 1.5],
        ],
      },
      {
        name: "EP Verse 1",
        backgroundColor: 4210752,
        start: 16,
        duration: 32,
        notes: [
        [8, 0, 0, 1.5],
        [8, 0, 2.5, 1.5],
        [8, 4, 0, 1.5],
        [8, 4, 2.5, 1.5],
        [8, 7, 0, 1.5],
        [8, 7, 2.5, 1.5],
        [7, 11, 4, 1.5],
        [7, 11, 6.5, 1.5],
        [8, 2, 4, 1.5],
        [8, 2, 6.5, 1.5],
        [8, 7, 4, 1.5],
        [8, 7, 6.5, 1.5],
        [8, 0, 8, 1.5],
        [8, 0, 10.5, 1.5],
        [8, 4, 8, 1.5],
        [8, 4, 10.5, 1.5],
        [8, 9, 8, 1.5],
        [8, 9, 10.5, 1.5],
        [8, 0, 12, 1.5],
        [8, 0, 14.5, 1.5],
        [8, 5, 12, 1.5],
        [8, 5, 14.5, 1.5],
        [8, 9, 12, 1.5],
        [8, 9, 14.5, 1.5],
        [8, 0, 16, 1.5],
        [8, 0, 18.5, 1.5],
        [8, 4, 16, 1.5],
        [8, 4, 18.5, 1.5],
        [8, 7, 16, 1.5],
        [8, 7, 18.5, 1.5],
        [7, 11, 20, 1.5],
        [7, 11, 22.5, 1.5],
        [8, 2, 20, 1.5],
        [8, 2, 22.5, 1.5],
        [8, 7, 20, 1.5],
        [8, 7, 22.5, 1.5],
        [8, 0, 24, 1.5],
        [8, 0, 26.5, 1.5],
        [8, 4, 24, 1.5],
        [8, 4, 26.5, 1.5],
        [8, 9, 24, 1.5],
        [8, 9, 26.5, 1.5],
        [8, 0, 28, 1.5],
        [8, 0, 30.5, 1.5],
        [8, 5, 28, 1.5],
        [8, 5, 30.5, 1.5],
        [8, 9, 28, 1.5],
        [8, 9, 30.5, 1.5],
        ],
      },
      {
        name: "EP Chorus 1",
        backgroundColor: 4210752,
        start: 48,
        duration: 32,
        notes: [
        [8, 0, 0, 1.5],
        [8, 0, 2.5, 1.5],
        [8, 5, 0, 1.5],
        [8, 5, 2.5, 1.5],
        [8, 9, 0, 1.5],
        [8, 9, 2.5, 1.5],
        [7, 11, 4, 1.5],
        [7, 11, 6.5, 1.5],
        [8, 2, 4, 1.5],
        [8, 2, 6.5, 1.5],
        [8, 7, 4, 1.5],
        [8, 7, 6.5, 1.5],
        [8, 0, 8, 1.5],
        [8, 0, 10.5, 1.5],
        [8, 4, 8, 1.5],
        [8, 4, 10.5, 1.5],
        [8, 7, 8, 1.5],
        [8, 7, 10.5, 1.5],
        [7, 11, 12, 1.5],
        [7, 11, 14.5, 1.5],
        [8, 2, 12, 1.5],
        [8, 2, 14.5, 1.5],
        [8, 7, 12, 1.5],
        [8, 7, 14.5, 1.5],
        [8, 0, 16, 1.5],
        [8, 0, 18.5, 1.5],
        [8, 5, 16, 1.5],
        [8, 5, 18.5, 1.5],
        [8, 9, 16, 1.5],
        [8, 9, 18.5, 1.5],
        [7, 11, 20, 1.5],
        [7, 11, 22.5, 1.5],
        [8, 2, 20, 1.5],
        [8, 2, 22.5, 1.5],
        [8, 7, 20, 1.5],
        [8, 7, 22.5, 1.5],
        [8, 0, 24, 1.5],
        [8, 0, 26.5, 1.5],
        [8, 4, 24, 1.5],
        [8, 4, 26.5, 1.5],
        [8, 7, 24, 1.5],
        [8, 7, 26.5, 1.5],
        [7, 11, 28, 1.5],
        [7, 11, 30.5, 1.5],
        [8, 2, 28, 1.5],
        [8, 2, 30.5, 1.5],
        [8, 7, 28, 1.5],
        [8, 7, 30.5, 1.5],
        ],
      },
      {
        name: "EP Verse 2",
        backgroundColor: 4210752,
        start: 80,
        duration: 32,
        notes: [
        [8, 0, 0, 1.5],
        [8, 0, 2.5, 1.5],
        [8, 4, 0, 1.5],
        [8, 4, 2.5, 1.5],
        [8, 7, 0, 1.5],
        [8, 7, 2.5, 1.5],
        [7, 11, 4, 1.5],
        [7, 11, 6.5, 1.5],
        [8, 2, 4, 1.5],
        [8, 2, 6.5, 1.5],
        [8, 7, 4, 1.5],
        [8, 7, 6.5, 1.5],
        [8, 0, 8, 1.5],
        [8, 0, 10.5, 1.5],
        [8, 4, 8, 1.5],
        [8, 4, 10.5, 1.5],
        [8, 9, 8, 1.5],
        [8, 9, 10.5, 1.5],
        [8, 0, 12, 1.5],
        [8, 0, 14.5, 1.5],
        [8, 5, 12, 1.5],
        [8, 5, 14.5, 1.5],
        [8, 9, 12, 1.5],
        [8, 9, 14.5, 1.5],
        [8, 0, 16, 1.5],
        [8, 0, 18.5, 1.5],
        [8, 4, 16, 1.5],
        [8, 4, 18.5, 1.5],
        [8, 7, 16, 1.5],
        [8, 7, 18.5, 1.5],
        [7, 11, 20, 1.5],
        [7, 11, 22.5, 1.5],
        [8, 2, 20, 1.5],
        [8, 2, 22.5, 1.5],
        [8, 7, 20, 1.5],
        [8, 7, 22.5, 1.5],
        [8, 0, 24, 1.5],
        [8, 0, 26.5, 1.5],
        [8, 4, 24, 1.5],
        [8, 4, 26.5, 1.5],
        [8, 9, 24, 1.5],
        [8, 9, 26.5, 1.5],
        [8, 0, 28, 1.5],
        [8, 0, 30.5, 1.5],
        [8, 5, 28, 1.5],
        [8, 5, 30.5, 1.5],
        [8, 9, 28, 1.5],
        [8, 9, 30.5, 1.5],
        ],
      },
      {
        name: "EP Chorus 2",
        backgroundColor: 4210752,
        start: 112,
        duration: 32,
        notes: [
        [8, 0, 0, 1.5],
        [8, 0, 2.5, 1.5],
        [8, 5, 0, 1.5],
        [8, 5, 2.5, 1.5],
        [8, 9, 0, 1.5],
        [8, 9, 2.5, 1.5],
        [7, 11, 4, 1.5],
        [7, 11, 6.5, 1.5],
        [8, 2, 4, 1.5],
        [8, 2, 6.5, 1.5],
        [8, 7, 4, 1.5],
        [8, 7, 6.5, 1.5],
        [8, 0, 8, 1.5],
        [8, 0, 10.5, 1.5],
        [8, 4, 8, 1.5],
        [8, 4, 10.5, 1.5],
        [8, 7, 8, 1.5],
        [8, 7, 10.5, 1.5],
        [7, 11, 12, 1.5],
        [7, 11, 14.5, 1.5],
        [8, 2, 12, 1.5],
        [8, 2, 14.5, 1.5],
        [8, 7, 12, 1.5],
        [8, 7, 14.5, 1.5],
        [8, 0, 16, 1.5],
        [8, 0, 18.5, 1.5],
        [8, 5, 16, 1.5],
        [8, 5, 18.5, 1.5],
        [8, 9, 16, 1.5],
        [8, 9, 18.5, 1.5],
        [7, 11, 20, 1.5],
        [7, 11, 22.5, 1.5],
        [8, 2, 20, 1.5],
        [8, 2, 22.5, 1.5],
        [8, 7, 20, 1.5],
        [8, 7, 22.5, 1.5],
        [8, 0, 24, 1.5],
        [8, 0, 26.5, 1.5],
        [8, 4, 24, 1.5],
        [8, 4, 26.5, 1.5],
        [8, 7, 24, 1.5],
        [8, 7, 26.5, 1.5],
        [7, 11, 28, 1.5],
        [7, 11, 30.5, 1.5],
        [8, 2, 28, 1.5],
        [8, 2, 30.5, 1.5],
        [8, 7, 28, 1.5],
        [8, 7, 30.5, 1.5],
        ],
      },
      {
        name: "EP Outro",
        backgroundColor: 4210752,
        start: 144,
        duration: 16,
        notes: [
        [8, 0, 0, 1.5],
        [8, 0, 2.5, 1.5],
        [8, 5, 0, 1.5],
        [8, 5, 2.5, 1.5],
        [8, 9, 0, 1.5],
        [8, 9, 2.5, 1.5],
        [7, 11, 4, 1.5],
        [7, 11, 6.5, 1.5],
        [8, 2, 4, 1.5],
        [8, 2, 6.5, 1.5],
        [8, 7, 4, 1.5],
        [8, 7, 6.5, 1.5],
        [8, 0, 8, 1.5],
        [8, 0, 10.5, 1.5],
        [8, 4, 8, 1.5],
        [8, 4, 10.5, 1.5],
        [8, 7, 8, 1.5],
        [8, 7, 10.5, 1.5],
        [8, 0, 12, 4],
        [8, 4, 12, 4],
        [8, 7, 12, 4],
        ],
      },
    ],
  },
  {
    name: "Bass",
    uniqueId: "1fef7747-e706-4786-a1aa-ac20b50b6f8e",
    instrumentName: "FM Bass",
    noteAmp: 104,
    // Renderer unpacked-DX7 voice slots (algorithm 0-based, detune +7 center).
    voiceSlots: [
      99, 35, 15, 40, 52, 36, 34, 34, 0, 0, 0, 0, 0, 0, 0, 0, 25, 0, 1, 0, 5, 99, 40, 15, 40, 55, 40, 38, 38, 0, 0, 0, 0, 0, 0, 0, 0, 30, 0, 1, 0, 7, 99, 45, 15, 40, 62, 45, 42, 42, 0, 0, 0, 0, 0, 0, 0, 0, 42, 0, 2, 0, 7, 99, 50, 15, 40, 68, 52, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0, 52, 0, 1, 0, 6, 99, 40, 15, 40, 75, 62, 58, 58, 0, 0, 0, 0, 0, 0, 0, 0, 72, 0, 1, 0, 7, 99, 30, 12, 45, 92, 75, 72, 0, 0, 0, 0, 0, 0, 0, 0, 3, 90, 0, 1, 0, 7, 50, 50, 50, 50, 50, 50, 50, 50, 0, 4, 1, 35, 0, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    parameterIds: [
      "param-ac1f2c7e-1682-4e22-ab86-cf53ed16fb67",
      "param-8d71660b-2675-4159-bfbe-a252b84e1aa0",
      "param-36aeb439-121b-42f8-a598-1e3f4d788363",
      "param-fa536513-9d5e-4711-bb38-576ce14a1507",
      "param-11cee922-c3d7-4344-af97-f6b4c7dbc921",
      "param-62ec27c2-b45b-4c3d-b3f0-758730ff14eb",
      "param-8329e532-cc18-49ca-9203-aa4f99b6d7bd",
      "param-98f17464-e783-45aa-82dc-49361594824a",
      "param-a0706ef3-3fd2-42b9-97f9-a2337b754a6a",
      "param-c4adcc42-a1a9-4e6b-9a31-c04ce6d7ed5b",
      "param-d92a0e00-d010-4041-afe0-c5fca9b510d4",
      "param-b59b87f6-8f2f-4ae9-85c9-31b00038883a",
      "param-f7f01265-8bba-4d21-ba06-fb5e0a9d8c9c",
      "param-e5d43508-9840-46c1-9c77-5ed71c52bb29",
      "param-40b204c9-ced4-4c81-b50b-cba89405b518",
      "param-e51efa2c-79e8-4383-aa61-78e9fa737e8c",
      "param-5c150ce5-765a-4599-a0b5-30ad31a4603d",
      "param-c334fe5f-cdec-4dc6-a6ac-158415ed1ade",
      "param-d969fd3c-9ebd-4580-95c0-d0c25e607e7a",
      "param-d0f9e26a-a343-4ed3-a20d-6fabc81aed9f",
      "param-a84315bf-148f-4d9c-80e5-7927e46f596b",
      "param-88e2e7e9-5508-4446-a983-36917adf59cb",
      "param-7aa5fb59-6ead-472f-8a99-ff5f3758c4f6",
      "param-d8d6ea1e-a42b-4090-81d6-3c92e095de72",
      "param-13e861f3-f50f-4647-b9af-de6927ddb104",
      "param-56476e66-4691-425a-ac30-060f4cc03419",
      "param-2a036dbc-f8c2-4f7c-9407-541e4c760fd0",
      "param-e488d62e-938b-4eb3-9e74-6c6453c29f7d",
      "param-43b14dd2-7b05-42e6-b12f-d490e2c4d8c1",
      "param-39b0736b-9164-4b2b-92ac-3d5f71eb3431",
      "param-c0fe7a5c-b978-4b23-bcef-dbceb2d1834d",
      "param-6df43d7a-9523-4185-a964-0a431888c948",
      "param-627afe2b-351f-4aee-8e17-28ad7898810f",
      "param-5f54c715-6fc2-4021-b4d7-f47c71110e06",
      "param-69ce70c4-8e7d-4ebd-a245-4e3245a2deaf",
      "param-aac4a4cb-2e91-44da-aa67-d9293b2b2d49",
      "param-7dfa274c-ffb5-4787-88e2-a119df4ee0db",
      "param-c057a360-c08d-44a5-b86b-ef7bdb058c57",
      "param-71e1f212-d55d-4d20-8743-4e6721afd02e",
      "param-2627456c-358a-49ac-a4ea-448a4c5797f3",
      "param-9a793eb2-0e5a-4f15-880a-8e0873a2efe0",
      "param-89e9f10e-ce1f-4647-9866-36f742f2d55e",
      "param-c1ab9618-3556-4946-a65f-c7220873f60e",
      "param-005c1a5a-c6d4-4a9a-9bb9-09fd1d4ebb7a",
      "param-38819c2c-0452-4b91-9c66-b94c51df624a",
      "param-e8b7f0c3-90a9-4bf2-9720-5da069f395f5",
      "param-beb8719e-4c74-4b38-b1c9-71df19c17531",
      "param-9da40e5f-f3bc-46e8-8935-77f9c0add251",
      "param-2a4c8721-b284-4bd0-a2fc-2be7a19de5b2",
      "param-f7b63cbf-50b8-4b2e-b645-2c765aaf860b",
      "param-06844227-351f-4bc2-9ead-4798efea013a",
      "param-2419961c-28e8-4126-9b99-e57e568667af",
      "param-4f24c4c2-42f3-482a-a4d4-1260973fa371",
      "param-2b82ab3d-3368-4a0d-9484-1c37012c68e1",
      "param-c3675819-7af1-4c64-9ab0-94f568204e78",
      "param-0cd2e68e-1fe8-4023-88b4-b6d5e15c2300",
      "param-f2c5f0cc-5185-4007-9188-7ebc4a1fa72a",
      "param-a842c2dc-b525-4f85-b46e-c7b91c10156d",
      "param-cf30d972-03c9-43fc-888c-e5f2dda4534d",
      "param-0078ab02-c29e-4111-beb5-4629a4fb6541",
      "param-2cb7e404-d53b-4dca-85d2-a69bc851c366",
      "param-749e0654-e60d-4f7b-90c8-00fbbc0ad9b0",
      "param-d18dab00-d81b-4924-8125-680770bb3520",
      "param-c996edd8-b4b5-43e9-afd1-1b2607fff2e2",
      "param-8b2135b8-cd76-477c-a5c6-3833aecf7328",
      "param-af8d90b9-7428-4f62-b165-81407350e13b",
      "param-30a61842-b4f2-42de-af74-27fea2b0faca",
      "param-3dc58775-e734-4e2f-b8ee-c60f0aec2f49",
      "param-5dd3cbe2-ae77-4c61-baa4-5134da212231",
      "param-36e09fdb-3dad-4d70-8176-386addf0c33e",
      "param-f680b109-2526-4e74-8512-3d80b0a65e76",
      "param-0450ada4-b5cb-457f-a581-a02c691df663",
      "param-620bbf5a-0d43-49b6-8fc8-4b1a29d33977",
      "param-be0b093c-14a5-46db-a025-2e4734401cc4",
      "param-d0a3d079-aa30-4c55-8edf-3af7ec34fac4",
      "param-d5777d0b-1426-47ba-9f33-872c2ae2da02",
      "param-b33b956c-dfd8-4ea7-9dd5-ed14cd8a058f",
      "param-6777f9c9-e6b9-43fd-aab2-df9e90a5a361",
      "param-42cb1a2c-3201-4775-bc24-67e4018f2106",
      "param-4cf4935b-770b-4435-a203-0820048f96ff",
      "param-d5dd5fab-0998-4026-a6c5-20e148a8b32e",
      "param-f0432d77-facc-4fd6-9004-548ac8aff232",
      "param-203dcae8-dcb6-42f7-97ae-935b019d71a1",
      "param-d5d78355-63c9-41ee-b0cc-f145eb165bea",
      "param-7631f06b-acaf-4bd6-9ee3-7403f9a1e114",
      "param-a4b70fee-1e0f-4e02-abec-e75f873e7240",
      "param-2a238766-d0cd-4aea-9586-6be3890d17b3",
      "param-24ba83da-02ff-4702-aac4-0454cafcf5d2",
      "param-2e042f0b-8a6b-403c-bfb7-a694f098940c",
      "param-efd9731a-b704-4ed0-b30a-fb9ceee3f219",
      "param-eed74fd1-4c47-440e-8589-437416b1124f",
      "param-8c4074ee-72eb-4bc7-a26b-e44b27749597",
      "param-cdf6846e-7375-461e-83cf-26e6c2a8dec3",
      "param-ed9c5776-2908-4e44-bd3c-506f2e787463",
      "param-10886efb-4577-455b-b8a7-65883ff2af09",
      "param-a0f50c21-e87d-4fa1-9bf7-ee1af6240f20",
      "param-662f7d6f-e77a-4228-8a42-b44dba5bd35e",
      "param-a044c19e-09fe-44dc-a4ce-b83c1b163a08",
      "param-cee0fd8d-f0eb-426f-a026-6e698533e62e",
      "param-f7641882-0f8a-42db-89f0-1aec88475a78",
      "param-c56d7b16-4f5b-4745-8bd8-fe2a45c0c6c8",
      "param-8c00fca8-d2ce-46d5-80f3-712ef3821b72",
      "param-d4c85f4b-4a73-412d-90c9-76c7748242e0",
      "param-fddcfd2d-b703-4e39-988a-29d73385a531",
      "param-c911ae95-e7d5-4995-a4e6-d942eaf3f3eb",
      "param-fcfef018-9da1-4a51-acf2-d6e6ba30860d",
      "param-71317bf7-39d6-4953-bfd9-98e9671ee2a4",
      "param-99a5f804-a459-4d9c-a837-2b09e7388f43",
      "param-a1462710-ecd5-46ea-a946-c50551fe625d",
      "param-1f32da03-65be-4136-b869-11cd206fb4bb",
      "param-ea2f02e2-b57c-48a7-b064-305ce9d59dcb",
      "param-b9db7c75-2ce7-446c-96c2-0fd91dbc8204",
      "param-0259d49c-2c3e-4f0a-8bab-a623930b6dd6",
      "param-1e6d2973-ff94-4e00-8ce9-6a63451dc9dd",
      "param-c3ca95cd-d965-401b-ba27-a1147e069b5a",
      "param-4910624d-11d0-4b2d-83cb-535047830650",
      "param-12935ab5-00ac-4ff5-865c-29986aef652d",
      "param-ab9d0d04-2d0f-4751-a3fb-7a1c4740ea44",
      "param-3abfe47c-9271-4b02-91df-fd25b7d5862f",
      "param-9da01e11-372d-49f2-8622-d6120b68365e",
      "param-8f157cc4-d989-4f5b-961d-ecba95ac36da",
      "param-7769b6c2-1f2b-4be1-8e4e-2eb6696ebd75",
      "param-3188ab10-349a-497d-8de2-1985c5f7f2b1",
      "param-69863ef7-34a0-4742-97d8-8c51265a6459",
      "param-610ba9ae-1abc-4092-80dd-d9152e5dbfe0",
      "param-f3bcdb39-fe54-4315-8527-5274fdd879a5",
      "param-257998b4-1cae-4ded-b514-efde849a28b3",
      "param-963628cd-1598-4285-855b-130d2c2ae9f9",
      "param-71a8dd12-1049-4fe9-be9f-e28091481fe8",
      "param-7d3814ce-5713-4eda-84fb-fc156720e290",
      "param-f88e653d-341b-4315-bb7c-83c99a59e11b",
      "param-38b73255-8cd0-4dc8-986d-8dbc14b53944",
      "param-9b8dca96-883d-4dbe-aa02-29900448160b",
      "param-02cfabf5-fe4d-4645-ad34-9c9725df5185",
      "param-a3aa3e35-1bec-46b3-81a3-8f0fec8c31f9",
      "param-8bc21e84-39ff-4e45-b338-e200de9e9738",
      "param-40b90c95-6021-43d9-b5ef-032f159e7786",
      "param-c2c90115-1773-4425-86c0-b5a42f61bf17",
      "param-a5f024f9-5ab1-4be4-a0c0-e7d04d33ffd2",
      "param-a478d6ba-fd20-4908-a69d-c1042863963a",
      "param-5150f498-0633-47e4-bb38-285eb1e0e946",
      "param-bf148d39-c324-45d2-b0d2-79274ea7ebf2",
      "param-9effdcc9-cc7e-4542-82b9-b673f3431302",
      "param-54dbf300-f4eb-477e-a951-421f59e3b30f",
      "param-de240e41-e729-48d6-9228-2e20cedffedf",
      "param-a878917c-49b2-4c46-a348-d662a4296e74",
      "param-461c5f90-2a94-46a3-b0c3-26c03bf7ff50",
      "param-41081f6d-6723-42e4-bc9a-8b1d59435075",
      "param-4b12ea45-57c0-4fae-b09f-10197c709037",
      "param-9d52826d-035c-485d-9d49-a86ee344b041",
      "param-f87cc69c-5b58-4c90-93d1-c12ba2d81bb8",
    ],
    rolls: [
      {
        name: "Bass Intro",
        backgroundColor: 4210752,
        start: 0,
        duration: 16,
        notes: [
        [6, 0, 0, 1],
        [6, 0, 1.5, 0.5],
        [6, 0, 2, 1],
        [6, 7, 3.5, 0.5],
        [6, 7, 4, 1],
        [6, 7, 5.5, 0.5],
        [6, 7, 6, 1],
        [6, 14, 7.5, 0.5],
        [6, 9, 8, 1],
        [6, 9, 9.5, 0.5],
        [6, 9, 10, 1],
        [6, 16, 11.5, 0.5],
        [6, 5, 12, 1],
        [6, 5, 13.5, 0.5],
        [6, 5, 14, 1],
        [6, 12, 15.5, 0.5],
        ],
      },
      {
        name: "Bass Verse 1",
        backgroundColor: 4210752,
        start: 16,
        duration: 32,
        notes: [
        [6, 0, 0, 1],
        [6, 0, 1.5, 0.5],
        [6, 0, 2, 1],
        [6, 7, 3.5, 0.5],
        [6, 7, 4, 1],
        [6, 7, 5.5, 0.5],
        [6, 7, 6, 1],
        [6, 14, 7.5, 0.5],
        [6, 9, 8, 1],
        [6, 9, 9.5, 0.5],
        [6, 9, 10, 1],
        [6, 16, 11.5, 0.5],
        [6, 5, 12, 1],
        [6, 5, 13.5, 0.5],
        [6, 5, 14, 1],
        [6, 12, 15.5, 0.5],
        [6, 0, 16, 1],
        [6, 0, 17.5, 0.5],
        [6, 0, 18, 1],
        [6, 7, 19.5, 0.5],
        [6, 7, 20, 1],
        [6, 7, 21.5, 0.5],
        [6, 7, 22, 1],
        [6, 14, 23.5, 0.5],
        [6, 9, 24, 1],
        [6, 9, 25.5, 0.5],
        [6, 9, 26, 1],
        [6, 16, 27.5, 0.5],
        [6, 5, 28, 1],
        [6, 5, 29.5, 0.5],
        [6, 5, 30, 1],
        [6, 12, 31.5, 0.5],
        ],
      },
      {
        name: "Bass Chorus 1",
        backgroundColor: 4210752,
        start: 48,
        duration: 32,
        notes: [
        [6, 5, 0, 1],
        [6, 5, 1.5, 0.5],
        [6, 5, 2, 1],
        [6, 12, 3.5, 0.5],
        [6, 7, 4, 1],
        [6, 7, 5.5, 0.5],
        [6, 7, 6, 1],
        [6, 14, 7.5, 0.5],
        [6, 0, 8, 1],
        [6, 0, 9.5, 0.5],
        [6, 0, 10, 1],
        [6, 7, 11.5, 0.5],
        [6, 7, 12, 1],
        [6, 7, 13.5, 0.5],
        [6, 7, 14, 1],
        [6, 14, 15.5, 0.5],
        [6, 5, 16, 1],
        [6, 5, 17.5, 0.5],
        [6, 5, 18, 1],
        [6, 12, 19.5, 0.5],
        [6, 7, 20, 1],
        [6, 7, 21.5, 0.5],
        [6, 7, 22, 1],
        [6, 14, 23.5, 0.5],
        [6, 0, 24, 1],
        [6, 0, 25.5, 0.5],
        [6, 0, 26, 1],
        [6, 7, 27.5, 0.5],
        [6, 7, 28, 1],
        [6, 7, 29.5, 0.5],
        [6, 7, 30, 1],
        [6, 14, 31.5, 0.5],
        ],
      },
      {
        name: "Bass Verse 2",
        backgroundColor: 4210752,
        start: 80,
        duration: 32,
        notes: [
        [6, 0, 0, 1],
        [6, 0, 1.5, 0.5],
        [6, 0, 2, 1],
        [6, 7, 3.5, 0.5],
        [6, 7, 4, 1],
        [6, 7, 5.5, 0.5],
        [6, 7, 6, 1],
        [6, 14, 7.5, 0.5],
        [6, 9, 8, 1],
        [6, 9, 9.5, 0.5],
        [6, 9, 10, 1],
        [6, 16, 11.5, 0.5],
        [6, 5, 12, 1],
        [6, 5, 13.5, 0.5],
        [6, 5, 14, 1],
        [6, 12, 15.5, 0.5],
        [6, 0, 16, 1],
        [6, 0, 17.5, 0.5],
        [6, 0, 18, 1],
        [6, 7, 19.5, 0.5],
        [6, 7, 20, 1],
        [6, 7, 21.5, 0.5],
        [6, 7, 22, 1],
        [6, 14, 23.5, 0.5],
        [6, 9, 24, 1],
        [6, 9, 25.5, 0.5],
        [6, 9, 26, 1],
        [6, 16, 27.5, 0.5],
        [6, 5, 28, 1],
        [6, 5, 29.5, 0.5],
        [6, 5, 30, 1],
        [6, 12, 31.5, 0.5],
        ],
      },
      {
        name: "Bass Chorus 2",
        backgroundColor: 4210752,
        start: 112,
        duration: 32,
        notes: [
        [6, 5, 0, 1],
        [6, 5, 1.5, 0.5],
        [6, 5, 2, 1],
        [6, 12, 3.5, 0.5],
        [6, 7, 4, 1],
        [6, 7, 5.5, 0.5],
        [6, 7, 6, 1],
        [6, 14, 7.5, 0.5],
        [6, 0, 8, 1],
        [6, 0, 9.5, 0.5],
        [6, 0, 10, 1],
        [6, 7, 11.5, 0.5],
        [6, 7, 12, 1],
        [6, 7, 13.5, 0.5],
        [6, 7, 14, 1],
        [6, 14, 15.5, 0.5],
        [6, 5, 16, 1],
        [6, 5, 17.5, 0.5],
        [6, 5, 18, 1],
        [6, 12, 19.5, 0.5],
        [6, 7, 20, 1],
        [6, 7, 21.5, 0.5],
        [6, 7, 22, 1],
        [6, 14, 23.5, 0.5],
        [6, 0, 24, 1],
        [6, 0, 25.5, 0.5],
        [6, 0, 26, 1],
        [6, 7, 27.5, 0.5],
        [6, 7, 28, 1],
        [6, 7, 29.5, 0.5],
        [6, 7, 30, 1],
        [6, 14, 31.5, 0.5],
        ],
      },
      {
        name: "Bass Outro",
        backgroundColor: 4210752,
        start: 144,
        duration: 16,
        notes: [
        [6, 5, 0, 1],
        [6, 5, 1.5, 0.5],
        [6, 5, 2, 1],
        [6, 12, 3.5, 0.5],
        [6, 7, 4, 1],
        [6, 7, 5.5, 0.5],
        [6, 7, 6, 1],
        [6, 14, 7.5, 0.5],
        [6, 0, 8, 1],
        [6, 0, 9.5, 0.5],
        [6, 0, 10, 1],
        [6, 7, 11.5, 0.5],
        [6, 0, 12, 4],
        ],
      },
    ],
  },
];

/**
 * Rebuild a BlueX7Voice from the renderer's 155-slot unpacked DX7 table by
 * inverting buildBlueX7VoiceTransport's two transforms (algorithm 0-based,
 * detune +7 center) through the parameter catalog's write functions.
 */
function voiceFromSlots(slots: readonly number[]): BlueX7Voice {
  const voice = createDefaultBlueX7Voice();
  for (const descriptor of BLUE_X7_PARAMETER_DESCRIPTORS) {
    if (descriptor.transport.kind !== 'voice') continue;
    let value = slots[descriptor.transport.slot];
    if (descriptor.transport.slot === 134) {
      value += 1;
    } else if (descriptor.transport.slot < 126 && descriptor.transport.slot % 21 === 20) {
      value -= 7;
    }
    writeBlueX7VoiceValue(voice, descriptor.key, value);
  }
  return voice;
}

/**
 * Author one beat count as a 1-based BBF position in the project's 4/4
 * meter (bar 1 beat 1 = beat 0). Whole-bar values stay exact.
 */
function beatsToPosition(beats: number): TimePosition {
  const bar = Math.floor(beats / 4) + 1;
  const beat = Math.floor(beats % 4) + 1;
  const fraction = Math.round(((beats % 4) % 1) * 100);
  return TimePosition.bbf(bar, beat, fraction);
}

/**
 * Author one beat count as a BBF duration: bars count full 4/4 measures and
 * beats carry the remainder (TimeDuration.bbf is count-based, unlike the
 * 1-based position form).
 */
function beatsToDuration(beats: number): TimeDuration {
  const bar = Math.floor(beats / 4);
  const beat = Math.floor(beats % 4);
  const fraction = Math.round(((beats % 4) % 1) * 100);
  return TimeDuration.bbf(bar, beat, fraction);
}

function buildChannel(name: string, association: string, paramId: string): Channel {
  const channel = new Channel();
  channel.setName(name);
  channel.setOutChannel('Master');
  channel.setAssociation(association);
  channel.getLevelParameter().setUniqueId(paramId);
  return channel;
}

/** Build the complete pop-song project. Pure: no IO, no randomness. */
export function buildBlueX7PopSongProject(): BlueData {
  const data = new BlueData();
  const props = data.getProjectProperties();
  props.title = PROJECT_TITLE;
  props.author = PROJECT_AUTHOR;
  props.notes = PROJECT_NOTES;
  props.useZeroDbFS = true;
  props.diskUseZeroDbFS = true;

  const score = data.getScore();
  const tempoMap = score.getTimeContext().getTempoMap();
  tempoMap.setEnabled(true);
  tempoMap.setVisible(true);
  tempoMap.setTempo(112);
  score.getTimeState().setTimeDisplay(TimeBase.BBF);

  // Replace the default root PolyObject with the pinned track layer group.
  score.length = 0;
  const layerGroup = new TrackLayerGroup();
  layerGroup.setName('Tracks');
  layerGroup.setUniqueId(LAYER_GROUP_UNIQUE_ID);
  score.push(layerGroup);

  for (const spec of TRACKS) {
    const track = new Track();
    track.setName(spec.name);
    track.setUniqueId(spec.uniqueId);

    const instrument = new BlueX7();
    instrument.setName(spec.instrumentName);
    instrument.setVoice(voiceFromSlots(spec.voiceSlots));
    track.setInstrument(instrument);
    // setInstrument deep-copies across an ownership boundary, which regenerates
    // Parameter identities; pin them afterwards for byte-stable output.
    const ownedInstrument = track.getInstrument() as BlueX7;
    const ownedParameters = ownedInstrument.getParameters();
    if (ownedParameters.length !== spec.parameterIds.length) {
      throw new Error(`pinned parameter ids do not match ${spec.name} parameters`);
    }
    for (const [index, parameter] of ownedParameters.entries()) {
      parameter.setUniqueId(spec.parameterIds[index]);
    }

    for (const rollSpec of spec.rolls) {
      const roll = new PianoRoll();
      roll.setName(rollSpec.name);
      roll.setBackgroundColor(rollSpec.backgroundColor);
      roll.setStartTime(beatsToPosition(rollSpec.start));
      roll.setSubjectiveDuration(beatsToDuration(rollSpec.duration));
      roll.setTimeBehavior(TimeBehavior.NONE);
      roll.setPchGenerationMethod(PCH_GENERATION_METHOD_FREQUENCY);
      roll.setNoteTemplate(
        `i <INSTR_ID> <START> <DUR> <FREQ> ${spec.noteAmp}`,
      );
      roll.setRepeatPoint(beatsToDuration(4));
      for (const [octave, degree, start, duration] of rollSpec.notes) {
        const note = new PianoNote();
        note.setOctave(octave);
        note.setScaleDegree(degree);
        note.setStart(start);
        note.setDuration(duration);
        roll.addNote(note);
      }
      track.push(roll);
    }
    layerGroup.push(track);
  }

  const mixer = data.getMixer();
  mixer.setEnabled(true);
  for (const channel of CHANNELS) {
    mixer.getChannels().push(buildChannel(channel.name, channel.association, channel.paramId));
  }
  mixer.getMaster().getLevelParameter().setUniqueId(MASTER_CHANNEL_PARAM_ID);

  return data;
}
