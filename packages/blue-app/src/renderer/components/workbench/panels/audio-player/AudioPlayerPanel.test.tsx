import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AudioPlayerPanel from './AudioPlayerPanel';

describe('AudioPlayerPanel', () => {
  it('renders one black empty state with transport controls below it', () => {
    const html = renderToStaticMarkup(<AudioPlayerPanel />);
    const emptyState = 'No File Selected';

    expect(html.match(new RegExp(emptyState, 'g'))).toHaveLength(1);
    expect(html).not.toContain('<canvas');
    expect(html).toContain('bg-black');
    expect(html).toContain('aria-label="Play"');
    expect(html).toContain('aria-label="Enable loop"');
    expect(html).toContain('lucide-play');
    expect(html).toContain('lucide-repeat');
    expect(html).toContain('00:00.000 / 00:00.000');
    expect(html.indexOf(emptyState)).toBeLessThan(html.indexOf('Audio transport controls'));
  });
});
