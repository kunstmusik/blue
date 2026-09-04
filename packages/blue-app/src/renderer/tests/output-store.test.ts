import { describe, it, expect, beforeEach } from 'vitest';
import { useOutputStore, MAX_LINES } from '../stores/output-store';

describe('output-store', () => {
  beforeEach(() => {
    useOutputStore.setState({
      tabs: {},
      tabOrder: [],
      activeTabId: null,
    });
  });

  describe('getOrCreateTab', () => {
    it('creates a new tab when none exists', () => {
      const tab = useOutputStore.getState().getOrCreateTab('Csound');
      expect(tab.name).toBe('Csound');
      expect(tab.lines).toEqual([]);
      expect(useOutputStore.getState().activeTabId).toBe('Csound');
    });

    it('returns existing tab when name matches and newIO is false', () => {
      const store = useOutputStore.getState();
      store.getOrCreateTab('Csound');
      store.appendToTab('Csound', 'hello\n');

      const tab = useOutputStore.getState().getOrCreateTab('Csound');
      expect(tab.lines).toHaveLength(1);
    });

    it('creates fresh tab when newIO is true', () => {
      const store = useOutputStore.getState();
      store.getOrCreateTab('Csound');
      store.appendToTab('Csound', 'old output\n');

      const tab = useOutputStore.getState().getOrCreateTab('Csound', true);
      expect(tab.lines).toHaveLength(0);
    });
  });

  describe('appendToTab', () => {
    it('splits text on newlines into separate lines', () => {
      const store = useOutputStore.getState();
      store.appendToTab('Csound', 'line1\nline2\nline3\n');

      const tab = useOutputStore.getState().tabs['Csound'];
      expect(tab.lines).toHaveLength(3);
      expect(tab.lines[0].text).toBe('line1');
      expect(tab.lines[1].text).toBe('line2');
      expect(tab.lines[2].text).toBe('line3');
    });

    it('assigns incrementing IDs', () => {
      const store = useOutputStore.getState();
      store.appendToTab('Csound', 'a\nb\n');

      const tab = useOutputStore.getState().tabs['Csound'];
      expect(tab.lines[0].id).toBe(1);
      expect(tab.lines[1].id).toBe(2);
    });

    it('records type as stdout by default', () => {
      useOutputStore.getState().appendToTab('Csound', 'msg\n');
      expect(useOutputStore.getState().tabs['Csound'].lines[0].type).toBe('stdout');
    });

    it('records type as stderr when specified', () => {
      useOutputStore.getState().appendToTab('Csound', 'error!\n', 'stderr');
      expect(useOutputStore.getState().tabs['Csound'].lines[0].type).toBe('stderr');
    });

    it('creates tab if it does not exist', () => {
      useOutputStore.getState().appendToTab('NewTab', 'content\n');
      expect(useOutputStore.getState().tabs['NewTab']).toBeDefined();
      expect(useOutputStore.getState().tabOrder).toContain('NewTab');
    });

    it('buffers partial lines without trailing newline', () => {
      const store = useOutputStore.getState();
      store.appendToTab('Csound', 'partial');
      expect(useOutputStore.getState().tabs['Csound'].lines).toHaveLength(0);
      expect(useOutputStore.getState().tabs['Csound'].pendingText).toBe('partial');
      expect(useOutputStore.getState().tabs['Csound'].pendingType).toBe('stdout');

      store.appendToTab('Csound', ' line\nrest');
      expect(useOutputStore.getState().tabs['Csound'].lines).toHaveLength(1);
      expect(useOutputStore.getState().tabs['Csound'].lines[0].text).toBe('partial line');
      expect(useOutputStore.getState().tabs['Csound'].pendingText).toBe('rest');
      expect(useOutputStore.getState().tabs['Csound'].pendingType).toBe('stdout');
    });

    it('normalizes carriage-return-delimited output into visible lines', () => {
      const store = useOutputStore.getState();
      store.appendToTab('Csound', 'line1\rline2\r', 'stderr');

      const tab = useOutputStore.getState().tabs['Csound'];
      expect(tab.lines).toHaveLength(2);
      expect(tab.lines[0].text).toBe('line1');
      expect(tab.lines[1].text).toBe('line2');
      expect(tab.lines[0].type).toBe('stderr');
      expect(tab.pendingText).toBe('');
      expect(tab.pendingType).toBeNull();
    });
  });

  describe('resetTab', () => {
    it('clears all lines', () => {
      const store = useOutputStore.getState();
      store.getOrCreateTab('Csound');
      store.appendToTab('Csound', 'some output');
      store.resetTab('Csound');

      expect(useOutputStore.getState().tabs['Csound'].lines).toHaveLength(0);
      expect(useOutputStore.getState().tabs['Csound'].lineCounter).toBe(0);
      expect(useOutputStore.getState().tabs['Csound'].pendingType).toBeNull();
    });

    it('does nothing for non-existent tab', () => {
      useOutputStore.getState().resetTab('NoTab');
      expect(useOutputStore.getState().tabs['NoTab']).toBeUndefined();
    });
  });

  describe('selectTab', () => {
    it('sets the active tab', () => {
      const store = useOutputStore.getState();
      store.getOrCreateTab('Tab1');
      store.getOrCreateTab('Tab2');
      store.selectTab('Tab1');

      expect(useOutputStore.getState().activeTabId).toBe('Tab1');
    });
  });

  describe('colorOverrides preservation', () => {
    it('preserves existing color overrides across getOrCreateTab with newIO', () => {
      const store = useOutputStore.getState();
      const tab1 = store.getOrCreateTab('Csound');
      tab1.colorOverrides.error = '#ff0000';
      const tab2 = store.getOrCreateTab('Csound', true);
      expect(tab2.colorOverrides.error).toBe('#ff0000');
    });
  });

  describe('multi-tab isolation', () => {
    it('tabs do not share lines', () => {
      const store = useOutputStore.getState();
      store.getOrCreateTab('Csound');
      store.getOrCreateTab('Csound (Disk)');
      store.appendToTab('Csound', 'realtime output\n');
      store.appendToTab('Csound (Disk)', 'disk output\n');

      expect(useOutputStore.getState().tabs['Csound'].lines).toHaveLength(1);
      expect(useOutputStore.getState().tabs['Csound (Disk)'].lines).toHaveLength(1);
      expect(useOutputStore.getState().tabs['Csound'].lines[0].text).toBe('realtime output');
      expect(useOutputStore.getState().tabs['Csound (Disk)'].lines[0].text).toBe('disk output');
    });

    it('resetting one tab does not affect another', () => {
      const store = useOutputStore.getState();
      store.getOrCreateTab('Csound');
      store.getOrCreateTab('Csound (Disk)');
      store.appendToTab('Csound', 'rt\n');
      store.appendToTab('Csound (Disk)', 'disk\n');
      store.resetTab('Csound');

      expect(useOutputStore.getState().tabs['Csound'].lines).toHaveLength(0);
      expect(useOutputStore.getState().tabs['Csound (Disk)'].lines).toHaveLength(1);
    });
  });

  describe('MAX_LINES trimming', () => {
    it('trims oldest lines when exceeding MAX_LINES', () => {
      const store = useOutputStore.getState();
      // Build a text block with MAX_LINES + 50 lines
      const totalLines = MAX_LINES + 50;
      const textBlock = Array.from({ length: totalLines }, (_, i) => `line-${i}`).join('\n') + '\n';
      store.appendToTab('Csound', textBlock);

      const tab = useOutputStore.getState().tabs['Csound'];
      expect(tab.lines).toHaveLength(MAX_LINES);
      // Oldest 50 lines should be gone; first kept line is line-50
      expect(tab.lines[0].text).toBe('line-50');
      // Last line is the final one
      expect(tab.lines[tab.lines.length - 1].text).toBe(`line-${totalLines - 1}`);
    });

    it('lineCounter continues incrementing past MAX_LINES', () => {
      const store = useOutputStore.getState();
      const totalLines = MAX_LINES + 100;
      const textBlock = Array.from({ length: totalLines }, (_, i) => `L${i}`).join('\n') + '\n';
      store.appendToTab('Csound', textBlock);

      const tab = useOutputStore.getState().tabs['Csound'];
      expect(tab.lineCounter).toBe(totalLines);
      // The last line's ID should equal the total count
      expect(tab.lines[tab.lines.length - 1].id).toBe(totalLines);
    });
  });
});
