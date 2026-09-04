import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { ColorPickerPopover, type ColorPickerAnchorRect } from '../../../../ColorPicker';

export interface ScoreObjectColorPickerHandle {
  /**
   * `anchorElement` is the timeline container the rect was measured against.
   * Floating workbench panels live in a popout document, so the popover needs
   * that element to render and dismiss inside the correct window.
   */
  open(
    initialColor: number,
    anchor: ColorPickerAnchorRect,
    anchorElement?: HTMLElement | null,
  ): void;
}

interface Props {
  onSelect: (color: number) => void;
}

const ScoreObjectColorPicker = forwardRef<ScoreObjectColorPickerHandle, Props>(
  function ScoreObjectColorPicker({ onSelect }, ref) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState('#000000');
    const [anchor, setAnchor] = useState<ColorPickerAnchorRect | null>(null);
    const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
    const close = useCallback(() => setOpen(false), []);

    useImperativeHandle(
      ref,
      () => ({
        open(initialColor, nextAnchor, nextAnchorElement) {
          setValue(`#${(initialColor & 0x00ffffff).toString(16).padStart(6, '0')}`);
          setAnchor(nextAnchor);
          setAnchorElement(nextAnchorElement ?? null);
          setOpen(true);
        },
      }),
      [],
    );

    return (
      <ColorPickerPopover
        open={open}
        value={value}
        anchor={anchor}
        anchorElement={anchorElement}
        anchorHitTarget={null}
        onClose={close}
        onChange={(nextValue) => {
          setValue(nextValue);
          const color = Number.parseInt(nextValue.slice(1), 16);
          if (Number.isFinite(color)) onSelect(color);
        }}
      />
    );
  },
);

export default ScoreObjectColorPicker;
