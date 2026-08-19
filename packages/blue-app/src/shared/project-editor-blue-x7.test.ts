import { describe, expect, it } from 'vitest';
import { BlueData, BlueX7, createDefaultBlueX7Voice, Element } from '@blue/data';
import {
  createOrchestraSnapshot,
  applyProjectDocumentPatch,
  isValidBlueX7Patch,
  BlueX7InstrumentSnapshot,
} from './project-editor';

describe('Project Editor - BlueX7 Contract', () => {
  it('creates complete BlueX7 snapshot with voice and derived shared sync/PMS', () => {
    const project = new BlueData();
    const instr = new BlueX7();
    instr.setName('FM Bass');
    instr.setComment('BlueX7 instance');
    project.getArrangement().addInstrument(instr);

    const snapshot = createOrchestraSnapshot(project);
    const instrSnap = snapshot.instruments[0] as BlueX7InstrumentSnapshot;

    expect(instrSnap.type).toBe('blueX7');
    expect(instrSnap.name).toBe('FM Bass');
    expect(instrSnap.comment).toBe('BlueX7 instance');
    expect(instrSnap.enabled).toBe(true);
    expect(instrSnap.voice).toBeDefined();
    expect(instrSnap.voice.common.algorithm).toBe(19);
    expect(instrSnap.voice.common.keyTranspose).toBe(24);
    expect(instrSnap.voice.lfo.speed).toBe(35);
    expect(instrSnap.voice.operators).toHaveLength(6);
    expect(instrSnap.sharedOscillatorSync).toBe(1);
    expect(instrSnap.sharedPitchModulationSensitivity).toBe(0);
  });

  it('reports "mixed" for shared oscillator sync or PMS when operators diverge', () => {
    const project = new BlueData();
    const instr = new BlueX7();
    instr.setOperatorField(0, 'sync', 0); // op0 has sync 0, op1..5 have sync 1
    project.getArrangement().addInstrument(instr);

    let snapshot = createOrchestraSnapshot(project);
    let instrSnap = snapshot.instruments[0] as BlueX7InstrumentSnapshot;
    expect(instrSnap.sharedOscillatorSync).toBe('mixed');
    expect(instrSnap.sharedPitchModulationSensitivity).toBe(0);

    instr.setOperatorField(2, 'modulationPitch', 3);
    snapshot = createOrchestraSnapshot(project);
    instrSnap = snapshot.instruments[0] as BlueX7InstrumentSnapshot;
    expect(instrSnap.sharedPitchModulationSensitivity).toBe('mixed');
  });

  it('applies semantic BlueX7 patch operations via applyProjectDocumentPatch', () => {
    const project = new BlueData();
    const instr = new BlueX7();
    project.getArrangement().addInstrument(instr, '1');
    const assignmentId = '1';

    // 1. setCommonField
    applyProjectDocumentPatch(project, {
      orchestra: {
        type: 'updateInstrument',
        assignmentId,
        patch: {
          blueX7: {
            type: 'setCommonField',
            field: 'algorithm',
            value: 7,
          },
        },
      },
    });
    expect(instr.getVoice().common.algorithm).toBe(7);

    // 2. setOperatorEnabled
    applyProjectDocumentPatch(project, {
      orchestra: {
        type: 'updateInstrument',
        assignmentId,
        patch: {
          blueX7: {
            type: 'setOperatorEnabled',
            operatorIndex: 3,
            enabled: false,
          },
        },
      },
    });
    expect(instr.getVoice().common.operatorEnabled[3]).toBe(false);

    // 3. setLfoField
    applyProjectDocumentPatch(project, {
      orchestra: {
        type: 'updateInstrument',
        assignmentId,
        patch: {
          blueX7: {
            type: 'setLfoField',
            field: 'speed',
            value: 80,
          },
        },
      },
    });
    expect(instr.getVoice().lfo.speed).toBe(80);

    // 4. setOperatorField
    applyProjectDocumentPatch(project, {
      orchestra: {
        type: 'updateInstrument',
        assignmentId,
        patch: {
          blueX7: {
            type: 'setOperatorField',
            operatorIndex: 1,
            field: 'outputLevel',
            value: 50,
          },
        },
      },
    });
    expect(instr.getVoice().operators[1].outputLevel).toBe(50);

    // 5. setSharedOscillatorSync
    applyProjectDocumentPatch(project, {
      orchestra: {
        type: 'updateInstrument',
        assignmentId,
        patch: {
          blueX7: {
            type: 'setSharedOscillatorSync',
            value: 0,
          },
        },
      },
    });
    for (let i = 0; i < 6; i++) {
      expect(instr.getVoice().operators[i].sync).toBe(0);
    }

    // 6. setSharedPitchModulationSensitivity
    applyProjectDocumentPatch(project, {
      orchestra: {
        type: 'updateInstrument',
        assignmentId,
        patch: {
          blueX7: {
            type: 'setSharedPitchModulationSensitivity',
            value: 5,
          },
        },
      },
    });
    for (let i = 0; i < 6; i++) {
      expect(instr.getVoice().operators[i].modulationPitch).toBe(5);
    }

    // 7. setOperatorEnvelopePoint
    applyProjectDocumentPatch(project, {
      orchestra: {
        type: 'updateInstrument',
        assignmentId,
        patch: {
          blueX7: {
            type: 'setOperatorEnvelopePoint',
            operatorIndex: 0,
            stageIndex: 2,
            point: { rate: 60, level: 40 },
          },
        },
      },
    });
    expect(instr.getVoice().operators[0].envelope[2]).toEqual({ rate: 60, level: 40 });

    // 8. setPitchEnvelopePoint
    applyProjectDocumentPatch(project, {
      orchestra: {
        type: 'updateInstrument',
        assignmentId,
        patch: {
          blueX7: {
            type: 'setPitchEnvelopePoint',
            stageIndex: 1,
            point: { rate: 70, level: 30 },
          },
        },
      },
    });
    expect(instr.getVoice().pitchEnvelope[1]).toEqual({ rate: 70, level: 30 });

    // 9. setCsoundPostCode
    applyProjectDocumentPatch(project, {
      orchestra: {
        type: 'updateInstrument',
        assignmentId,
        patch: {
          blueX7: {
            type: 'setCsoundPostCode',
            text: 'outs aout, aout',
          },
        },
      },
    });
    expect(instr.getVoice().csoundPostCode).toBe('outs aout, aout');
  });

  it('replaces entire voice while preserving instrument name, comment, enabled, and assignment ID', () => {
    const project = new BlueData();
    const instr = new BlueX7();
    instr.setName('Lead Patch');
    instr.setComment('Important Comment');
    project.getArrangement().addInstrument(instr, '1');
    const assignmentId = '1';

    const replacement = createDefaultBlueX7Voice();
    replacement.common.algorithm = 12;
    replacement.common.feedback = 4;
    replacement.csoundPostCode = 'blueMixerOut aout * 0.8, aout * 0.8';

    applyProjectDocumentPatch(project, {
      orchestra: {
        type: 'updateInstrument',
        assignmentId,
        patch: {
          blueX7: {
            type: 'replaceVoice',
            voice: replacement,
          },
        },
      },
    });

    expect(instr.getName()).toBe('Lead Patch');
    expect(instr.getComment()).toBe('Important Comment');
    expect(instr.isEnabled()).toBe(true);
    expect(instr.getVoice().common.algorithm).toBe(12);
    expect(instr.getVoice().common.feedback).toBe(4);
    expect(instr.getVoice().csoundPostCode).toBe('blueMixerOut aout * 0.8, aout * 0.8');
  });

  it('preserves BlueX7 voice edits and unknown XML across project save/load round-trip', () => {
    const rawXml = `<blueData version="3.0.0">
  <arrangement>
    <instrumentAssignment arrangementId="1">
      <instrument type="blue.orchestra.BlueX7" enabled="true" customAttr="saved">
        <name>FM Bell</name>
        <comment>Complex FM Bell</comment>
        <customTag>preserved</customTag>
        <algorithmCommonData>
          <keyTranspose>24</keyTranspose>
          <algorithm>14</algorithm>
          <feedback>5</feedback>
          <operator>true</operator>
          <operator>true</operator>
          <operator>true</operator>
          <operator>true</operator>
          <operator>true</operator>
          <operator>true</operator>
        </algorithmCommonData>
        <lfoData>
          <speed>42</speed>
          <delay>10</delay>
          <PMD>15</PMD>
          <AMD>20</AMD>
          <wave>2</wave>
          <sync>1</sync>
        </lfoData>
        <operator>
          <mode>1</mode>
          <sync>1</sync>
          <freqCoarse>2</freqCoarse>
          <freqFine>50</freqFine>
          <detune>3</detune>
          <breakpoint>60</breakpoint>
          <curveLeft>1</curveLeft>
          <curveRight>2</curveRight>
          <depthLeft>30</depthLeft>
          <depthRight>40</depthRight>
          <keyboardRateScaling>2</keyboardRateScaling>
          <outputLevel>85</outputLevel>
          <velocitySensitivity>4</velocitySensitivity>
          <modulationAmplitude>1</modulationAmplitude>
          <modulationPitch>2</modulationPitch>
          <envelopePoint x="10" y="99"/>
          <envelopePoint x="20" y="80"/>
          <envelopePoint x="30" y="50"/>
          <envelopePoint x="40" y="0"/>
        </operator>
        <operator>
          <mode>0</mode>
          <sync>1</sync>
          <freqCoarse>1</freqCoarse>
          <freqFine>0</freqFine>
          <detune>0</detune>
          <breakpoint>0</breakpoint>
          <curveLeft>0</curveLeft>
          <curveRight>0</curveRight>
          <depthLeft>0</depthLeft>
          <depthRight>0</depthRight>
          <keyboardRateScaling>0</keyboardRateScaling>
          <outputLevel>99</outputLevel>
          <velocitySensitivity>0</velocitySensitivity>
          <modulationAmplitude>0</modulationAmplitude>
          <modulationPitch>0</modulationPitch>
          <envelopePoint x="0" y="0"/>
          <envelopePoint x="0" y="0"/>
          <envelopePoint x="0" y="0"/>
          <envelopePoint x="0" y="0"/>
        </operator>
        <operator>
          <mode>0</mode>
          <sync>1</sync>
          <freqCoarse>1</freqCoarse>
          <freqFine>0</freqFine>
          <detune>0</detune>
          <breakpoint>0</breakpoint>
          <curveLeft>0</curveLeft>
          <curveRight>0</curveRight>
          <depthLeft>0</depthLeft>
          <depthRight>0</depthRight>
          <keyboardRateScaling>0</keyboardRateScaling>
          <outputLevel>99</outputLevel>
          <velocitySensitivity>0</velocitySensitivity>
          <modulationAmplitude>0</modulationAmplitude>
          <modulationPitch>0</modulationPitch>
          <envelopePoint x="0" y="0"/>
          <envelopePoint x="0" y="0"/>
          <envelopePoint x="0" y="0"/>
          <envelopePoint x="0" y="0"/>
        </operator>
        <operator>
          <mode>0</mode>
          <sync>1</sync>
          <freqCoarse>1</freqCoarse>
          <freqFine>0</freqFine>
          <detune>0</detune>
          <breakpoint>0</breakpoint>
          <curveLeft>0</curveLeft>
          <curveRight>0</curveRight>
          <depthLeft>0</depthLeft>
          <depthRight>0</depthRight>
          <keyboardRateScaling>0</keyboardRateScaling>
          <outputLevel>99</outputLevel>
          <velocitySensitivity>0</velocitySensitivity>
          <modulationAmplitude>0</modulationAmplitude>
          <modulationPitch>0</modulationPitch>
          <envelopePoint x="0" y="0"/>
          <envelopePoint x="0" y="0"/>
          <envelopePoint x="0" y="0"/>
          <envelopePoint x="0" y="0"/>
        </operator>
        <operator>
          <mode>0</mode>
          <sync>1</sync>
          <freqCoarse>1</freqCoarse>
          <freqFine>0</freqFine>
          <detune>0</detune>
          <breakpoint>0</breakpoint>
          <curveLeft>0</curveLeft>
          <curveRight>0</curveRight>
          <depthLeft>0</depthLeft>
          <depthRight>0</depthRight>
          <keyboardRateScaling>0</keyboardRateScaling>
          <outputLevel>99</outputLevel>
          <velocitySensitivity>0</velocitySensitivity>
          <modulationAmplitude>0</modulationAmplitude>
          <modulationPitch>0</modulationPitch>
          <envelopePoint x="0" y="0"/>
          <envelopePoint x="0" y="0"/>
          <envelopePoint x="0" y="0"/>
          <envelopePoint x="0" y="0"/>
        </operator>
        <operator>
          <mode>0</mode>
          <sync>1</sync>
          <freqCoarse>1</freqCoarse>
          <freqFine>0</freqFine>
          <detune>0</detune>
          <breakpoint>0</breakpoint>
          <curveLeft>0</curveLeft>
          <curveRight>0</curveRight>
          <depthLeft>0</depthLeft>
          <depthRight>0</depthRight>
          <keyboardRateScaling>0</keyboardRateScaling>
          <outputLevel>99</outputLevel>
          <velocitySensitivity>0</velocitySensitivity>
          <modulationAmplitude>0</modulationAmplitude>
          <modulationPitch>0</modulationPitch>
          <envelopePoint x="0" y="0"/>
          <envelopePoint x="0" y="0"/>
          <envelopePoint x="0" y="0"/>
          <envelopePoint x="0" y="0"/>
        </operator>
        <envelopePoint x="5" y="90"/>
        <envelopePoint x="10" y="70"/>
        <envelopePoint x="15" y="60"/>
        <envelopePoint x="20" y="50"/>
        <csoundPostCode>blueMixerOut aout * 0.9, aout * 0.9</csoundPostCode>
      </instrument>
    </instrumentAssignment>
  </arrangement>
</blueData>`;

    const project = BlueData.loadFromString(rawXml);
    const instr = project.getArrangement().getInstrumentById('1') as BlueX7;
    expect(instr).toBeDefined();
    expect(instr.getName()).toBe('FM Bell');
    expect(instr.getVoice().common.algorithm).toBe(14);
    expect(instr.getVoice().lfo.speed).toBe(42);
    expect(instr.getVoice().operators[0].mode).toBe(1);
    expect(instr.getVoice().pitchEnvelope[0]).toEqual({ rate: 5, level: 90 });

    applyProjectDocumentPatch(project, {
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: {
          blueX7: {
            type: 'setCommonField',
            field: 'algorithm',
            value: 22,
          },
        },
      },
    });

    const savedXml = project.saveAsXML().toXml();
    expect(savedXml).toContain('<algorithm>22</algorithm>');
    expect(savedXml).toContain('customAttr="saved"');
    expect(savedXml).toContain('<customTag>preserved</customTag>');

    const reopened = BlueData.loadFromString(savedXml);
    const reopenedInstr = reopened.getArrangement().getInstrumentById('1') as BlueX7;
    expect(reopenedInstr.getVoice().common.algorithm).toBe(22);
    expect(reopenedInstr.getVoice().lfo.speed).toBe(42);
    expect(reopenedInstr.getVoice().operators[0].mode).toBe(1);
  });

  it('rejects out-of-domain BlueX7 patches without mutating the instrument', () => {
    const project = new BlueData();
    const instr = new BlueX7();
    project.getArrangement().addInstrument(instr, '1');
    const before = JSON.stringify(instr.getVoice());

    const invalidPatches = [
      { type: 'setCommonField', field: 'algorithm', value: 40 },        // 1-32
      { type: 'setCommonField', field: 'keyTranspose', value: -1 },     // 0-48
      { type: 'setCommonField', field: 'feedback', value: 8 },          // 0-7
      { type: 'setOperatorField', operatorIndex: 1, field: 'freqCoarse', value: 32 }, // 0-31
      { type: 'setOperatorField', operatorIndex: 1, field: 'detune', value: -8 },     // -7..7
      { type: 'setOperatorField', operatorIndex: 1, field: 'outputLevel', value: 100 }, // 0-99
      { type: 'setOperatorField', operatorIndex: 6, field: 'outputLevel', value: 50 },  // bad index
      { type: 'setLfoField', field: 'wave', value: 6 },                 // 0-5
      { type: 'setSharedOscillatorSync', value: 2 },                    // 0-1
      { type: 'setOperatorEnvelopePoint', operatorIndex: 0, stageIndex: 4, point: { rate: 10, level: 10 } },
      { type: 'setOperatorEnvelopePoint', operatorIndex: 0, stageIndex: 0, point: { rate: 100, level: 10 } },
      { type: 'setPitchEnvelopePoint', stageIndex: 0, point: { rate: 10, level: -1 } },
    ] as const;

    for (const blueX7 of invalidPatches) {
      applyProjectDocumentPatch(project, {
        orchestra: { type: 'updateInstrument', assignmentId: '1', patch: { blueX7 } },
      });
    }

    expect(JSON.stringify(instr.getVoice())).toBe(before);
  });

  it('accepts boundary-value BlueX7 patches at the edges of every domain', () => {
    const project = new BlueData();
    const instr = new BlueX7();
    project.getArrangement().addInstrument(instr, '1');

    const apply = (blueX7: unknown) =>
      applyProjectDocumentPatch(project, {
        orchestra: {
          type: 'updateInstrument',
          assignmentId: '1',
          patch: { blueX7: blueX7 as never },
        },
      });

    apply({ type: 'setCommonField', field: 'algorithm', value: 1 });
    apply({ type: 'setCommonField', field: 'algorithm', value: 32 });
    apply({ type: 'setCommonField', field: 'keyTranspose', value: 0 });
    apply({ type: 'setCommonField', field: 'keyTranspose', value: 48 });
    apply({ type: 'setOperatorField', operatorIndex: 5, field: 'detune', value: -7 });
    apply({ type: 'setOperatorField', operatorIndex: 5, field: 'detune', value: 7 });
    apply({ type: 'setOperatorEnvelopePoint', operatorIndex: 5, stageIndex: 3, point: { rate: 99, level: 0 } });
    apply({ type: 'setLfoField', field: 'wave', value: 5 });
    apply({ type: 'setSharedPitchModulationSensitivity', value: 7 });

    const voice = instr.getVoice();
    expect(voice.common.algorithm).toBe(32);
    expect(voice.common.keyTranspose).toBe(48);
    expect(voice.operators[5].detune).toBe(7);
    expect(voice.operators[5].envelope[3]).toEqual({ rate: 99, level: 0 });
    expect(voice.lfo.wave).toBe(5);
    expect(voice.operators.every((op) => op.modulationPitch === 7)).toBe(true);
  });

  it('applies replaceVoice structurally without per-field domain checks (SysEx quirk parity)', () => {
    const project = new BlueData();
    const instr = new BlueX7();
    project.getArrangement().addInstrument(instr, '1');

    // Java Blue's bank SysEx decode quirk can produce velocitySensitivity
    // above 7 ((byte13 & 56) >>> 2); whole-voice replacement must apply it.
    const imported = createDefaultBlueX7Voice();
    imported.operators[2].velocitySensitivity = 14;

    applyProjectDocumentPatch(project, {
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: { blueX7: { type: 'replaceVoice', voice: imported } },
      },
    });

    expect(instr.getVoice().operators[2].velocitySensitivity).toBe(14);
  });

  it('rejects malformed replaceVoice payloads without throwing or mutating', () => {
    const project = new BlueData();
    const instr = new BlueX7();
    project.getArrangement().addInstrument(instr, '1');
    const before = instr.getVoice();
    const malformed = {
      type: 'replaceVoice',
      voice: {
        common: null,
        lfo: null,
        operators: [null, null, null, null, null, null],
        pitchEnvelope: [null, null, null, null],
        csoundPostCode: 'ignored',
      },
    } as never;

    expect(isValidBlueX7Patch(malformed)).toBe(false);
    expect(() => applyProjectDocumentPatch(project, {
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: { blueX7: malformed },
      },
    })).not.toThrow();
    expect(instr.getVoice()).toEqual(before);
  });
});
