import {
  AutomationCurve,
  BlueData,
  BlueSynthBuilder,
  BSBGroup,
  BSBKnob,
  Element,
  OpcodeDefinition,
  Preset,
  PresetGroup,
  TrackLayerGroup,
  UDOStyle,
  loadInstrumentFromXML,
} from '@blue/data';
import { describe, expect, it } from 'vitest';
import { createInstrumentSnapshot, type InstrumentSnapshot } from '../../shared/project-editor';
import type { LibraryTransferSourceReference } from '../../shared/unified-library';
import { UnifiedLibraryProjectAdapter } from './project-adapter';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryService } from './service';

type InstrumentSource = 'track' | 'arrangement' | 'library';

function createRichInstrument(name: string): BlueSynthBuilder {
  const instrument = new BlueSynthBuilder();
  instrument.setName(name);
  instrument.setComment(`${name} comment`);
  instrument.setEnabled(false);
  instrument.setInstrumentText('aout copyUdo(<gain>)\nouts aout, aout');
  instrument.setAlwaysOnInstrumentText('prints "always on"');
  instrument.setGlobalOrc('giCopy ftgen 0, 0, 16, 10, 1');
  instrument.setGlobalSco('f 0 8');
  instrument.setBsbEditEnabled(false);
  instrument.setBsbGridSettings({
    enabled: true,
    snapEnabled: false,
    width: 7,
    height: 9,
    gridStyle: 'LINE',
  });

  const graphicInterface = instrument.getGraphicInterface();
  const group = graphicInterface.createWidgetByType('BSBGroup') as BSBGroup;
  group.objectName = 'controls';
  group.groupName = 'Controls';
  group.automationAllowed = false;
  const gain = graphicInterface.createWidgetByType('BSBKnob') as BSBKnob;
  gain.objectName = 'gain';
  gain.minimum = -1;
  gain.maximum = 2;
  gain.value = 0.375;
  gain.label = 'Gain';
  group.addChild(gain);
  graphicInterface.getRootGroup().addChild(group);

  const parameter = instrument.getParameters()[0]!;
  parameter.setLabel('Gain automation');
  parameter.setResolution(0.125);
  parameter.setCurve(AutomationCurve.STEP);
  parameter.setFixedValue(0.375);
  parameter.setPoints([{ time: 0, value: 0.375 }, { time: 2, value: 1.25 }]);
  parameter.setAutomationEnabled(true);

  const preset = new Preset();
  preset.setPresetName('Wide');
  preset.setValue('gain', 'ver2:1.25');
  const presets = new PresetGroup();
  presets.setPresetGroupName('Factory');
  presets.presets.push(preset);
  presets.setCurrentPresetUniqueId(preset.getUniqueId());
  presets.setCurrentPresetModified(true);
  instrument.setPresetGroup(presets);

  const udo = new OpcodeDefinition();
  udo.setName('copyUdo');
  udo.setStyle(UDOStyle.MODERN);
  udo.setOutTypes('a');
  udo.setInputArguments('kgain');
  udo.setCode('kgain xin\naout oscili kgain, 440\nxout aout');
  udo.setComments('embedded copy dependency');
  instrument.getOpcodeList().addOpcode(udo);
  return instrument;
}

function normalizeSnapshot(instrument: BlueSynthBuilder): InstrumentSnapshot {
  const snapshot = structuredClone(
    createInstrumentSnapshot('', instrument, instrument.isEnabled()),
  );
  snapshot.assignmentId = '';
  if (snapshot.type !== 'blueSynthBuilder') return snapshot;

  let widgetIndex = 0;
  const normalizeWidget = (widget: typeof snapshot.widgetTree): void => {
    widget.id = `widget-${widgetIndex++}`;
    for (const child of widget.children ?? []) normalizeWidget(child);
  };
  normalizeWidget(snapshot.widgetTree);

  snapshot.automationParameters?.forEach((parameter, index) => {
    parameter.parameterId = `parameter-${index}`;
  });

  const presetIds = new Map<string, string>();
  let presetIndex = 0;
  const indexPresets = (group: NonNullable<typeof snapshot.presetGroup>): void => {
    for (const preset of group.presets) {
      presetIds.set(preset.uniqueId, `preset-${presetIndex++}`);
    }
    for (const child of group.subGroups) indexPresets(child);
  };
  const normalizePresets = (group: NonNullable<typeof snapshot.presetGroup>): void => {
    for (const preset of group.presets) preset.uniqueId = presetIds.get(preset.uniqueId)!;
    if (group.currentPresetUniqueId) {
      group.currentPresetUniqueId = presetIds.get(group.currentPresetUniqueId);
    }
    for (const child of group.subGroups) normalizePresets(child);
  };
  if (snapshot.presetGroup) {
    indexPresets(snapshot.presetGroup);
    normalizePresets(snapshot.presetGroup);
  }
  return snapshot;
}

function copyOwnedIds(instrument: BlueSynthBuilder): Set<string> {
  const snapshot = createInstrumentSnapshot('', instrument, instrument.isEnabled());
  if (snapshot.type !== 'blueSynthBuilder') return new Set();
  const ids = new Set<string>();
  const visitWidget = (widget: typeof snapshot.widgetTree): void => {
    if (widget.id) ids.add(widget.id);
    for (const child of widget.children ?? []) visitWidget(child);
  };
  for (const child of snapshot.widgetTree.children ?? []) visitWidget(child);
  for (const parameter of snapshot.automationParameters ?? []) ids.add(parameter.parameterId);
  const visitPresets = (group: NonNullable<typeof snapshot.presetGroup>): void => {
    for (const preset of group.presets) ids.add(preset.uniqueId);
    for (const child of group.subGroups) visitPresets(child);
  };
  if (snapshot.presetGroup) visitPresets(snapshot.presetGroup);
  return ids;
}

function expectCompleteIndependentCopy(
  source: BlueSynthBuilder,
  copy: BlueSynthBuilder,
  expectFreshOwnedIds = true,
): void {
  expect(copy).not.toBe(source);
  expect(normalizeSnapshot(copy)).toEqual(normalizeSnapshot(source));
  if (expectFreshOwnedIds) {
    const sourceIds = copyOwnedIds(source);
    expect([...copyOwnedIds(copy)].filter((id) => sourceIds.has(id))).toEqual([]);
  }
  copy.setName('Mutated copy');
  expect(source.getName()).not.toBe('Mutated copy');
}

describe.each<InstrumentSource>(['track', 'arrangement', 'library'])(
  '%s instrument copy source',
  (sourceKind) => {
    it('preserves the complete payload when pasted to Track, Arrangement, and User Library targets', async () => {
      const data = new BlueData();
      data.getScore().length = 0;
      const group = new TrackLayerGroup();
      group.setUniqueId('tracks');
      const sourceTrack = group.newLayerAt(0);
      sourceTrack.setUniqueId('source-track');
      sourceTrack.setInstrument(createRichInstrument('Track Source'));
      const targetTrack = group.newLayerAt(1);
      targetTrack.setUniqueId('target-track');
      data.getScore().push(group);

      const arrangementSource = createRichInstrument('Arrangement Source');
      data.getArrangement().addInstrumentWithId(arrangementSource, '1');

      let projectRevision = 0;
      const adapter = new UnifiedLibraryProjectAdapter(() => ({
        data,
        sessionId: 17,
        revision: projectRevision,
        commit: () => ++projectRevision,
      }));
      let client: UnifiedLibraryRepositoryClient;
      const service = new UnifiedLibraryService(
        ':memory:',
        (path) => {
          client = UnifiedLibraryRepositoryClient.openForTesting(path);
          return client;
        },
        adapter,
      );
      await service.start();

      try {
        const root = await client!.getRoot('instrument');
        const librarySource = createRichInstrument('Library Source');
        const librarySourceXml = librarySource.saveAsXML().toXml();
        const libraryNode = await client!.createItem({
          libraryType: 'instrument',
          parentId: root.id,
          displayName: librarySource.getName(),
          payload: {
            embeddedName: librarySource.getName(),
            objectType: 'blue.orchestra.BlueSynthBuilder',
            supportStatus: 'supported',
            supportReasonCode: null,
            supportMessage: null,
            payloadXml: librarySourceXml,
            rawHash: 'rich-source',
            canonicalContentHash: 'rich-source',
            serializerRevision: '1',
            preview: {},
            dependencies: { itemOwned: [], unresolvedExternal: [] },
            metadataRevision: 1,
          },
        });

        let source: BlueSynthBuilder;
        let reference: LibraryTransferSourceReference;
        if (sourceKind === 'track') {
          source = sourceTrack.getInstrument() as BlueSynthBuilder;
          const captured = await service.captureTrackInstrumentClipboard({
            projectSessionId: 17,
            projectRevision,
            rootGroupId: group.getUniqueId(),
            trackId: sourceTrack.getUniqueId(),
          });
          expect(captured).toMatchObject({
            ok: true,
            value: { source: { kind: 'buffer', libraryType: 'instrument' } },
          });
          if (!captured.ok) throw new Error(captured.error.message);
          reference = { kind: 'clipboard', source: captured.value.source };
        } else if (sourceKind === 'arrangement') {
          source = data.getArrangement().getInstrumentById('1') as BlueSynthBuilder;
          const projectNode = adapter.list('instrument')[0]!;
          reference = {
            kind: 'clipboard',
            source: { kind: 'library', key: projectNode.key, revision: projectNode.revision },
          };
        } else {
          source = librarySource;
          reference = {
            kind: 'clipboard',
            source: {
              kind: 'userNode',
              libraryType: 'instrument',
              nodeId: libraryNode.id,
              revision: libraryNode.revision,
            },
          };
        }

        const trackPreview = await service.previewLibraryTransfer({
          source: reference,
          target: {
            kind: 'trackInstrument',
            projectSessionId: 17,
            projectRevision,
            track: { rootGroupId: group.getUniqueId(), trackId: targetTrack.getUniqueId() },
          },
        });
        expect(trackPreview).toMatchObject({ ok: true, value: { canApply: true } });
        if (!trackPreview.ok) throw new Error(trackPreview.error.message);
        const trackReceipt = await service.applyLibraryTransfer(trackPreview.value.previewToken);
        expect(trackReceipt).toMatchObject({ ok: true });
        expectCompleteIndependentCopy(source, targetTrack.getInstrument() as BlueSynthBuilder);

        const arrangementPreview = await service.previewLibraryTransfer({
          source: reference,
          target: {
            kind: 'orchestra',
            projectSessionId: 17,
            projectRevision,
            insertIndex: data.getArrangement().size(),
          },
        });
        expect(arrangementPreview).toMatchObject({ ok: true, value: { canApply: true } });
        if (!arrangementPreview.ok) throw new Error(arrangementPreview.error.message);
        const arrangementReceipt = await service.applyLibraryTransfer(
          arrangementPreview.value.previewToken,
        );
        expect(arrangementReceipt).toMatchObject({ ok: true });
        if (!arrangementReceipt.ok) throw new Error(arrangementReceipt.error.message);
        expectCompleteIndependentCopy(
          source,
          data.getArrangement().getInstrumentById(
            arrangementReceipt.value.insertedIdentity,
          ) as BlueSynthBuilder,
        );

        let libraryCopyNodeId: string;
        if (sourceKind === 'library') {
          const duplicate = await service.applyLibraryMutation({
            type: 'duplicateNode',
            nodeId: libraryNode.id,
            expectedRevision: libraryNode.revision,
            parentId: root.id,
          });
          expect(duplicate).toMatchObject({ ok: true });
          if (!duplicate.ok) throw new Error(duplicate.error.message);
          libraryCopyNodeId = duplicate.value.affectedNodes[0]!.nodeId;
        } else {
          const copied = await service.copyLibraryTransferToUser(reference, root.id);
          expect(copied).toMatchObject({ ok: true });
          if (!copied.ok) throw new Error(copied.error.message);
          libraryCopyNodeId = copied.value.affectedNodes[0]!.nodeId;
        }
        const libraryCopyXml = (await client!.getItemPayload(libraryCopyNodeId)).payloadXml;
        const libraryCopy = loadInstrumentFromXML(Element.parse(libraryCopyXml));
        expect(libraryCopy).toBeInstanceOf(BlueSynthBuilder);
        // User Library records preserve their portable XML exactly. Fresh widget,
        // parameter, and preset identities are created when that record enters a project.
        expectCompleteIndependentCopy(source, libraryCopy as BlueSynthBuilder, false);
      } finally {
        await service.stop();
      }
    });
  },
);
