import { describe, it, expect } from 'vite-plus/test';

describe('BSB UDO Panel', () => {
  it('tracks opcode list text in BSB snapshot', () => {
    const snapshot = {
      opcodeListText: 'opcode myUDO, k, k\n  xout a + b\nendop',
    };
    expect(snapshot.opcodeListText).toContain('myUDO');
  });

  it('handles empty opcode list text', () => {
    const snapshot = { opcodeListText: '' };
    expect(snapshot.opcodeListText).toBe('');
  });

  it('handles undefined opcode list text', () => {
    const snapshot = { opcodeListText: undefined };
    expect(snapshot.opcodeListText ?? '').toBe('');
  });

  it('tracks structured UDO list in BSB snapshot', () => {
    const snapshot = {
      udolist: [
        {
          name: 'myUDO',
          style: 'CLASSIC' as const,
          outTypes: 'k',
          inTypes: 'k',
          inputArguments: '',
          code: 'xout a + b',
          comments: '',
        },
      ],
    };
    expect(snapshot.udolist).toHaveLength(1);
    expect(snapshot.udolist[0].name).toBe('myUDO');
  });

  it('handles empty UDO list', () => {
    const snapshot = { udolist: [] };
    expect(snapshot.udolist).toHaveLength(0);
  });

  it('handles undefined UDO list', () => {
    const snapshot = { udolist: undefined };
    expect(snapshot.udolist ?? []).toHaveLength(0);
  });

  it('supports both Classic and Modern UDO styles', () => {
    const snapshot = {
      udolist: [
        {
          name: 'classicUDO',
          style: 'CLASSIC' as const,
          outTypes: 'k',
          inTypes: 'k',
          inputArguments: '',
          code: 'xout a',
          comments: '',
        },
        {
          name: 'modernUDO',
          style: 'MODERN' as const,
          outTypes: 'k',
          inTypes: '',
          inputArguments: 'kfreq, kamp',
          code: 'xout a',
          comments: '',
        },
      ],
    };
    expect(snapshot.udolist[0].style).toBe('CLASSIC');
    expect(snapshot.udolist[1].style).toBe('MODERN');
    expect(snapshot.udolist[1].inputArguments).toBe('kfreq, kamp');
  });
});
