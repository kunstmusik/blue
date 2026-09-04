import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn() class composition helper', () => {
  it('resolves Tailwind utility conflicts with last-wins precedence', () => {
    expect(cn('py-1', 'py-1.5')).toBe('py-1.5');
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-sm', 'text-base')).toBe('text-base');
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });

  it('handles falsy parts cleanly without stray or duplicated whitespace', () => {
    expect(cn('foo', undefined, 'bar', null, false, '')).toBe('foo bar');
    expect(cn(undefined, false, null, '')).toBe('');
    expect(cn('  foo  ', '  bar  ')).toBe('foo bar');
  });

  it('preserves opaque and custom classes (BEM, third-party) verbatim without conflict resolution', () => {
    expect(cn('mixer-chain-entry--disabled', 'scrollbar-thin')).toBe(
      'mixer-chain-entry--disabled scrollbar-thin'
    );
    expect(cn('dv-default-view-content', 'cm-editor')).toBe('dv-default-view-content cm-editor');
    expect(cn('custom-class', 'another-custom-class')).toBe('custom-class another-custom-class');
  });

  describe('text-role-* typography conflict group', () => {
    const roles = [
      'text-role-large-title',
      'text-role-title-2',
      'text-role-title-3',
      'text-role-headline',
      'text-role-body',
      'text-role-callout',
      'text-role-subheadline',
    ] as const;

    it('replaces an earlier text-role with a later text-role', () => {
      expect(cn('text-role-body', 'text-role-title-2')).toBe('text-role-title-2');
      expect(cn('text-role-subheadline', 'text-role-headline')).toBe('text-role-headline');
      expect(cn('text-role-callout', 'text-role-large-title')).toBe('text-role-large-title');
    });

    it('preserves text-role tokens when unrelated utilities merge', () => {
      expect(cn('text-role-body font-bold', 'text-white')).toBe(
        'text-role-body font-bold text-white'
      );
      expect(cn('text-role-title-3', 'py-2', 'px-4')).toBe(
        'text-role-title-3 py-2 px-4'
      );
    });

    it('covers all seven registered text roles', () => {
      for (const role of roles) {
        expect(cn('text-role-body', role)).toBe(role);
      }
    });
  });
});
