/**
 * Test support for BlueX7 runtime-sync tests: builds real BlueData fixtures
 * (arrangement and Track-owned BlueX7 instruments with duplicate display
 * names) and produces real compiled bindings through the @blue/data compile
 * path (direct-global parameter channels and per-instance epochs).
 */
import {
  Arrangement,
  BlueData,
  BlueX7,
  CompileData,
  ParameterHelper,
  Tables,
  TrackLayerGroup,
  ScoreTrack,
  type CompiledBlueX7Binding,
} from '@blue/data';

// Re-exported for the runtime-sync tests.
export { BlueData, BlueX7 };

export interface BlueX7Fixture {
  data: BlueData;
  bindings: Map<string, CompiledBlueX7Binding>;
  /** First TrackLayerGroup id and its first Track id (single-group fixtures). */
  rootGroupId: string;
  trackId: string;
  rootGroupIds: string[];
  trackIds: string[];
}

function addArrangementBlueX7(data: BlueData, name: string): void {
  const instr = new BlueX7();
  instr.setName(name);
  data.getArrangement().addInstrumentAtEnd(instr);
}

function addTrackBlueX7(data: BlueData, name: string): { rootGroupId: string; trackId: string } {
  const group = new TrackLayerGroup();
  const track = new ScoreTrack();
  track.setName(name);
  const instr = new BlueX7();
  instr.setName(name); // duplicate display names across owners
  track.setInstrument(instr);
  group.push(track);
  data.getScore().push(group);
  return { rootGroupId: group.getUniqueId(), trackId: track.getUniqueId() };
}

/**
 * Build the fixture project and compile it exactly like the CSD build does:
 * snapshot arrangement, prepare Track instruments, allocate tables, assign
 * parameter names, then register BlueX7 bindings.
 */
export function compileBlueX7ProjectFixtures(
  options: {
    arrangementInstruments?: number;
    trackInstruments?: number;
  } = {},
): BlueX7Fixture {
  const arrangementCount = options.arrangementInstruments ?? 1;
  const trackCount = options.trackInstruments ?? 1;
  const data = new BlueData();
  for (let i = 0; i < arrangementCount; i++) {
    addArrangementBlueX7(data, 'BlueX7');
  }
  const groups: string[] = [];
  const tracks: string[] = [];
  for (let i = 0; i < trackCount; i++) {
    const ids = addTrackBlueX7(data, 'BlueX7');
    groups.push(ids.rootGroupId);
    tracks.push(ids.trackId);
  }

  // Render snapshot compile path (mirrors createRenderSnapshot + the CSD build)
  const snapshotArrangement = new Arrangement(data.getArrangement());
  const tables = new Tables();
  const compileData = new CompileData(snapshotArrangement, tables, false);
  data.getScore().prepareTrackInstruments(compileData);
  compileData.setHandleParametersAndChannels(true);
  snapshotArrangement.generateFTables(tables);
  const parameters = ParameterHelper.getAllParameters(snapshotArrangement, data.getMixer());
  ParameterHelper.assignParameterNames(parameters);
  compileData.registerBlueX7CompiledBindings();

  const bindings = new Map<string, CompiledBlueX7Binding>();
  for (const binding of compileData.getBlueX7Bindings()) {
    bindings.set(binding.ownerIdentity, binding);
  }

  return {
    data,
    bindings,
    rootGroupId: groups[0],
    trackId: tracks[0],
    rootGroupIds: groups,
    trackIds: tracks,
  };
}
