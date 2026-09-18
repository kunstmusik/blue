import { describe, expect, it } from 'vitest';
import { Arrangement } from '../arrangement';
import { GenericInstrument } from '../instruments/generic-instrument';
import { Channel } from '../mixer/channel';
import { Mixer } from '../mixer/mixer';
import { Send } from '../mixer/send';
import { assignParameterNames, getAllParameters } from './parameter-helper';
import { Parameter } from './parameter';

/**
 * Enumeration fixture: two source channels (one with a post-fader send), one
 * subchannel, and the master. Mirrors the established source/sub/master order.
 */
function createMixerFixture(): { mixer: Mixer; sourceA: Channel; sourceB: Channel; sub: Channel } {
  const mixer = new Mixer();
  mixer.setEnabled(true);

  const sourceA = new Channel();
  sourceA.setName('A');
  const send = new Send();
  send.setSendChannel('Sub');
  send.setEnabled(true);
  sourceA.getPostEffects().push(send);
  mixer.getChannels().push(sourceA);

  const sourceB = new Channel();
  sourceB.setName('B');
  mixer.getChannels().push(sourceB);

  const sub = new Channel();
  sub.setName('Sub');
  mixer.getSubChannels().push(sub);

  return { mixer, sourceA, sourceB, sub };
}

function createArrangementFixture(): Arrangement {
  const arrangement = new Arrangement();
  const instrument = new GenericInstrument();
  instrument.setName('Fixture');
  instrument.setText('outc a1, a1');
  arrangement.addInstrument(instrument, '1');
  return arrangement;
}

function collectPanParameters(parameters: Parameter[]): Parameter[] {
  return parameters.filter((parameter) => parameter.getName() === 'Pan');
}

describe('pan parameter enumeration (Spec 112 T073)', () => {
  it('enumerates Pan exactly once per source, subchannel, and master channel', () => {
    const { mixer, sourceA, sourceB, sub } = createMixerFixture();
    const parameters = getAllParameters(new Arrangement(), mixer, true);

    const panParameters = collectPanParameters(parameters);
    const expected = [sourceA, sourceB, sub, mixer.getMaster()].map((channel) =>
      channel.getPanParameter(),
    );
    expect(panParameters).toHaveLength(expected.length);
    for (const panParameter of expected) {
      expect(
        panParameters.filter((p) => p.getUniqueId() === panParameter.getUniqueId()),
      ).toHaveLength(1);
    }
  });

  it('places Pan after Volume for every channel in the established order', () => {
    const { mixer, sourceA, sourceB, sub } = createMixerFixture();
    const parameters = getAllParameters(new Arrangement(), mixer, true);

    const expectedOrder = [sourceA, sourceB, sub, mixer.getMaster()].flatMap((channel) => [
      channel.getLevelParameter().getUniqueId(),
      channel.getPanParameter().getUniqueId(),
    ]);
    const mixerOrder = parameters
      .filter((p) => p.getName() === 'Volume' || p.getName() === 'Pan')
      .map((p) => p.getUniqueId());
    expect(mixerOrder).toEqual(expectedOrder);
  });

  it('omits Pan from the authoritative compile enumeration when panning is disabled', () => {
    const { mixer } = createMixerFixture();
    const disabled = getAllParameters(new Arrangement(), mixer, false);
    const defaulted = getAllParameters(new Arrangement(), mixer);

    expect(collectPanParameters(disabled)).toHaveLength(0);
    expect(collectPanParameters(defaulted)).toHaveLength(0);
    // Volume enumeration is unaffected.
    expect(disabled.filter((p) => p.getName() === 'Volume')).toHaveLength(4);
  });

  it('keeps the Pan Parameter distinct from Volume with its own identity', () => {
    const channel = new Channel();
    expect(channel.getPanParameter()).not.toBe(channel.getLevelParameter());
    expect(channel.getPanParameter().getUniqueId()).not.toBe(
      channel.getLevelParameter().getUniqueId(),
    );
    expect(channel.getPanParameter().getName()).toBe('Pan');
    expect(channel.getPanParameter().getMinimum()).toBe(0);
    expect(channel.getPanParameter().getMaximum()).toBe(1);
    expect(channel.getPanParameter().getFixedValue()).toBe(0.5);
  });

  it('retains stable unique pan identity through history copies', () => {
    const { mixer } = createMixerFixture();
    // History-mode copies preserve Parameter uniqueId (and channel runtime
    // identity); duplication copies intentionally mint fresh identities.
    const copy = mixer.deepCopy('history') as Mixer;

    const originalPans = collectPanParameters(getAllParameters(new Arrangement(), mixer, true)).map(
      (p) => p.getUniqueId(),
    );
    const copiedPans = collectPanParameters(getAllParameters(new Arrangement(), copy, true)).map(
      (p) => p.getUniqueId(),
    );

    expect(copiedPans).toEqual(originalPans);
    // Fixed values survive the copy too.
    expect(
      collectPanParameters(getAllParameters(new Arrangement(), copy, true)).map((p) =>
        p.getFixedValue(),
      ),
    ).toEqual(
      collectPanParameters(getAllParameters(new Arrangement(), mixer, true)).map((p) =>
        p.getFixedValue(),
      ),
    );
  });

  it('assigns deterministic compilation names to pan parameters in enumeration order', () => {
    const arrangement = createArrangementFixture();
    const { mixer, sourceA, sourceB, sub } = createMixerFixture();

    const parameters = getAllParameters(arrangement, mixer, true);
    assignParameterNames(parameters);

    const panVars = collectPanParameters(parameters).map((p) => p.getCompilationVarName());
    // gk_blue_auto names follow deterministic enumeration order.
    expect(panVars).toHaveLength(4);
    for (const variable of panVars) {
      expect(variable).toMatch(/^gk_blue_auto\d+$/);
    }

    // Re-enumerating and reassigning yields the same name per unique identity.
    const reparameters = getAllParameters(arrangement, mixer, true);
    assignParameterNames(reparameters);
    expect(collectPanParameters(reparameters).map((p) => p.getCompilationVarName())).toEqual(
      panVars,
    );

    // With panning disabled the pan slots close up and later parameters take
    // the deterministic names the pan parameters would have received.
    const disabled = getAllParameters(arrangement, mixer, false);
    assignParameterNames(disabled);
    const enabledVars = new Map(
      parameters.map((p) => [p.getUniqueId(), p.getCompilationVarName()]),
    );
    const disabledVars = new Map(disabled.map((p) => [p.getUniqueId(), p.getCompilationVarName()]));
    const sourceAPanIndex = Number(
      enabledVars.get(sourceA.getPanParameter().getUniqueId())!.replace('gk_blue_auto', ''),
    );
    const sourceBVolumeVar = disabledVars.get(sourceB.getLevelParameter().getUniqueId());
    expect(sourceBVolumeVar).toBe(`gk_blue_auto${sourceAPanIndex}`);
  });

  describe('stereo pan parameter enumeration (Spec 113 T021)', () => {
    it('enumerates Pan, Width, Dual Left, and Dual Right exactly once per source, sub, and master', () => {
      const { mixer, sourceA, sourceB, sub } = createMixerFixture();
      const parameters = getAllParameters(new Arrangement(), mixer, true);

      const channels = [sourceA, sourceB, sub, mixer.getMaster()];
      for (const name of ['Pan', 'Width', 'Dual Left', 'Dual Right']) {
        const namedParams = parameters.filter((p) => p.getName() === name);
        expect(namedParams).toHaveLength(channels.length);
      }
    });

    it('enumerates mixer parameters in the exact Volume -> Pan -> Width -> Dual Left -> Dual Right order', () => {
      const { mixer, sourceA, sourceB, sub } = createMixerFixture();
      const parameters = getAllParameters(new Arrangement(), mixer, true);

      const channels = [sourceA, sourceB, sub, mixer.getMaster()];
      const expectedOrder = channels.flatMap((channel) => [
        channel.getLevelParameter().getUniqueId(),
        channel.getPanParameter().getUniqueId(),
        channel.getPanWidthParameter().getUniqueId(),
        channel.getDualPanLeftParameter().getUniqueId(),
        channel.getDualPanRightParameter().getUniqueId(),
      ]);

      const mixerParamNames = new Set(['Volume', 'Pan', 'Width', 'Dual Left', 'Dual Right']);
      const mixerOrder = parameters
        .filter((p) => mixerParamNames.has(p.getName()))
        .map((p) => p.getUniqueId());

      expect(mixerOrder).toEqual(expectedOrder);
    });

    it('assigns deterministic compilation variables to Width, Dual Left, and Dual Right', () => {
      const arrangement = createArrangementFixture();
      const { mixer } = createMixerFixture();

      const parameters = getAllParameters(arrangement, mixer, true);
      assignParameterNames(parameters);

      for (const name of ['Pan', 'Width', 'Dual Left', 'Dual Right']) {
        const vars = parameters
          .filter((p) => p.getName() === name)
          .map((p) => p.getCompilationVarName());
        expect(vars).toHaveLength(4);
        for (const v of vars) {
          expect(v).toMatch(/^gk_blue_auto\d+$/);
        }
      }
    });
  });
});
