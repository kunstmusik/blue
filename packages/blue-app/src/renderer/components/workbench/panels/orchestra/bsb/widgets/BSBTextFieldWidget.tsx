import React, { useEffect, useRef, useState } from 'react';
import WidgetWrapper from './WidgetWrapper';
import { getWidgetDisplaySize } from './utils';
import type { BSBWidgetComponentProps } from './widget-component-props';

export function getCommittedTextFieldValue(
  currentValue: string,
  draftValue: string,
): string | null {
  return draftValue === currentValue ? null : draftValue;
}

type BSBTextFieldWidgetProps = BSBWidgetComponentProps;

function BSBTextFieldWidget({
  node,
  isSelected,
  editEnabled,
  onWidgetSelect,
  onBsbInterfacePatch,
  resizeMeta,
  gridSnapEnabled,
  gridSnapWidth,
  gridSnapHeight,
  selectedWidgetIds,
  getWidgetPosition,
  onWidgetAction,
}: BSBTextFieldWidgetProps): React.ReactElement {
  const textValue = typeof node.properties.textValue === 'string' ? node.properties.textValue : '';
  const displaySize = getWidgetDisplaySize(node);
  const [localValue, setLocalValue] = useState(textValue);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) {
      setLocalValue(textValue);
    }
  }, [textValue, focused]);

  const commit = () => {
    const nextValue = getCommittedTextFieldValue(textValue, localValue);
    if (nextValue === null) {
      setLocalValue(textValue);
      return;
    }

    onBsbInterfacePatch?.({
      type: 'updateWidgetProperties',
      widgetId: node.id,
      properties: { textValue: nextValue },
    });
  };

  return (
    <WidgetWrapper
      node={node}
      isSelected={isSelected}
      editEnabled={editEnabled}
      onWidgetSelect={onWidgetSelect}
      displayWidth={displaySize.width}
      displayHeight={displaySize.height}
      resizeMeta={resizeMeta}
      gridSnapEnabled={gridSnapEnabled}
      gridSnapWidth={gridSnapWidth}
      gridSnapHeight={gridSnapHeight}
      onBsbInterfacePatch={onBsbInterfacePatch}
      selectedWidgetIds={selectedWidgetIds}
      getWidgetPosition={getWidgetPosition}
      onWidgetAction={onWidgetAction}
    >
      <div className="flex h-full w-full items-center overflow-hidden rounded border border-blue-border/40 bg-blue-surface/30">
        <input
          ref={inputRef}
          className="h-full w-full overflow-hidden bg-app-bsb-input px-2 text-role-body text-app-text outline-none"
          value={localValue}
          readOnly={editEnabled}
          onChange={(event) => setLocalValue(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
              inputRef.current?.blur();
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              setLocalValue(textValue);
              inputRef.current?.blur();
            }
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          style={{ pointerEvents: editEnabled ? 'none' : undefined }}
        />
      </div>
    </WidgetWrapper>
  );
}

export default React.memo(BSBTextFieldWidget);
