import React from 'react';
import type {
  BsbWidgetSnapshot,
  InstrumentPatch,
} from '../../../../../../shared/project-editor';

interface BSBWidgetEditorProps {
  widgets: BsbWidgetSnapshot[];
  onInstrumentPatch: (patch: InstrumentPatch) => void | Promise<void>;
}

export default function BSBWidgetEditor({
  widgets,
  onInstrumentPatch,
}: BSBWidgetEditorProps): React.ReactElement {
  if (widgets.length === 0) {
    return (
      <div className="rounded border border-blue-border bg-app-input px-4 py-3 text-sm text-blue-muted">
        No BSB widget object names are currently available from this instrument.
      </div>
    );
  }

  return (
    <div className="rounded border border-blue-border bg-app-input">
      <div className="border-b border-blue-border px-3 py-2 text-body uppercase tracking-[0.16em] text-blue-muted">
        Widgets
      </div>
      <ul className="divide-y divide-blue-border/50 text-sm">
        {widgets.map((widget) => (
          <li
            key={widget.objectName}
            className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate font-mono text-app-text-strong">
                &lt;{widget.objectName}&gt;
              </div>
              <div className="text-ui text-blue-muted">
                {widget.widgetType} · {widget.minimum} to {widget.maximum}
              </div>
            </div>
            <input
              className="w-full rounded border border-blue-border bg-app-field px-2 py-1 text-right font-mono text-body text-app-text outline-none focus:border-blue-accent"
              type="number"
              value={Number.isFinite(widget.value) ? widget.value : 0}
              min={widget.minimum}
              max={widget.maximum}
              onChange={(event) =>
                void onInstrumentPatch({
                  bsbWidgetValues: {
                    [widget.objectName]: Number.parseFloat(event.target.value) || 0,
                  },
                })
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
