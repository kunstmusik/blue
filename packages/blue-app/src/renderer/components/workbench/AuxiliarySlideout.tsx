import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  PanelBottomOpen,
  PanelLeftOpen,
  PanelRightOpen,
  X,
} from 'lucide-react';
import type { AuxiliarySlideoutView } from './auxiliary-layout';
import { getAuxiliaryRailLabel } from './auxiliary-layout';
import { getPanel } from './panel-registry';
import WorkbenchPanelContent from './WorkbenchPanelContent';
import { libraryEditorSessionIdFromPanel } from '../../stores/library-editor-store';

interface AuxiliarySlideoutProps {
  slideout: AuxiliarySlideoutView;
  onClose: () => void;
  onDock: () => void;
  onResize: (size: number) => void;
}

function getDockIcon(edge: AuxiliarySlideoutView['edge']) {
  switch (edge) {
    case 'left':
      return PanelLeftOpen;
    case 'bottom':
      return PanelBottomOpen;
    default:
      return PanelRightOpen;
  }
}

export default function AuxiliarySlideout({
  slideout,
  onClose,
  onDock,
  onResize,
}: AuxiliarySlideoutProps) {
  const descriptor = getPanel(slideout.panelId);
  const isLibrarySession = libraryEditorSessionIdFromPanel(slideout.panelId) !== null;
  const DockIcon = getDockIcon(slideout.edge);

  if (!descriptor && !isLibrarySession) {
    return null;
  }

  const title = descriptor?.title ?? getAuxiliaryRailLabel(slideout.panelId);

  const style =
    slideout.edge === 'bottom'
      ? { height: `${slideout.size}px` }
      : { width: `${slideout.size}px` };

  function handleResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startSize = slideout.size;

    function handlePointerMove(moveEvent: PointerEvent) {
      let nextSize = startSize;

      if (slideout.edge === 'right') {
        nextSize = startSize + (startX - moveEvent.clientX);
      } else if (slideout.edge === 'left') {
        nextSize = startSize + (moveEvent.clientX - startX);
      } else {
        nextSize = startSize + (startY - moveEvent.clientY);
      }

      onResize(nextSize);
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  return (
    <section
      className={[
        'workbench-aux-slideout',
        `workbench-aux-slideout--${slideout.edge}`,
      ].join(' ')}
      style={style}
      data-auxiliary-slideout="true"
      aria-label={`${title} slideout`}
    >
      <div
        className={[
          'workbench-aux-slideout__resize-handle',
          `workbench-aux-slideout__resize-handle--${slideout.edge}`,
        ].join(' ')}
        onPointerDown={handleResizeStart}
      />

      <header
        className="workbench-aux-slideout__header"
        data-aux-slideout-drag-handle="true"
        data-aux-panel-id={slideout.panelId}
        data-aux-edge={slideout.edge}
      >
        <div className="workbench-aux-slideout__title">
          {getAuxiliaryRailLabel(slideout.panelId)}
        </div>

        <div className="workbench-aux-slideout__actions">
          <button
            type="button"
            className="workbench-aux-slideout__action"
            data-aux-drag-ignore="true"
            title="Dock tool window"
            aria-label="Dock tool window"
            onClick={onDock}
          >
            <DockIcon size={14} strokeWidth={1.9} />
          </button>

          <button
            type="button"
            className="workbench-aux-slideout__action"
            data-aux-drag-ignore="true"
            title="Hide tool window"
            aria-label="Hide tool window"
            onClick={onClose}
          >
            <X size={14} strokeWidth={1.9} />
          </button>
        </div>
      </header>

      <div className="workbench-aux-slideout__content">
        <WorkbenchPanelContent panelId={slideout.panelId} descriptor={descriptor} />
      </div>
    </section>
  );
}

