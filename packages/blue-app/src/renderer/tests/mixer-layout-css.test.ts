import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mixerCss = readFileSync(new URL('../styles/index.css', import.meta.url), 'utf8');

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return mixerCss.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's'))?.[1] ?? '';
}

describe('mixer minimum sizing', () => {
  it('scrolls vertically instead of collapsing channel controls into each other', () => {
    expect(rule('.mixer-main')).toMatch(/overflow-y:\s*auto/);
    expect(rule('.mixer-channels-scroll')).toMatch(/min-height:\s*300px/);
    expect(rule('.mixer-master-strip')).toMatch(/min-height:\s*300px/);
    expect(rule('.mixer-level-section')).toMatch(/min-height:\s*96px/);
  });
});
